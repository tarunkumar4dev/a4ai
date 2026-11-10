// Typed client for every a4ai Agent endpoint (contract 1.3: ./api.gen.ts via ./types.ts). One interface, two adapters:
//   http — the real backend at VITE_AGENT_URL, with the signed-in user's Supabase token (refreshed once on a 401);
//   mock — ./mock.ts, an in-memory fake typed with the SAME generated types (VITE_AGENT_MOCK=1 builds only; the mock
//          chunk is not emitted otherwise).
// Nothing here logs request or response bodies (they hold questions and student data).
import { agentUrl } from "./config";
import {
  AgentHttpError, agentDevRole, agentHeaders, approve as approveHttp, downloadAgentPdf, errorFrom, getAgentToken,
  refreshAgentToken, saveBlob, type ApproveResult,
} from "./client";
import {
  createSseParser, decodeSseData, parseAgentMeta, parseMessageList, parseQueryItems, parseSessionItemOrNull,
  parseSessionList, parseSuggestions,
} from "./events";
import type {
  AgentEvent, CancelResponse, ChatRequest, FeedbackRequest, MessagesQuery, MetaResponse, QueryItem, SessionItem,
  SessionList, SessionPatch, SessionsQuery, StoredMessagePage, Suggestion,
} from "./types";

export interface StreamOptions {
  body: ChatRequest;
  onEvent: (e: AgentEvent) => void;
  /** X-Agent-Request-Id from the response headers — known before the first event (cancel works at once) */
  onRequestId?: (id: string) => void;
  signal?: AbortSignal;
}

export interface AgentApi {
  readonly kind: "http" | "mock";
  meta(signal?: AbortSignal): Promise<MetaResponse>;
  listSessions(q: SessionsQuery, signal?: AbortSignal): Promise<SessionList>;
  getMessages(sessionId: string, q: MessagesQuery, signal?: AbortSignal): Promise<StoredMessagePage>;
  patchSession(sessionId: string, patch: SessionPatch): Promise<SessionItem | null>;
  deleteSession(sessionId: string, opts?: { keepalive?: boolean }): Promise<void>;
  listQueries(q: { q?: string; limit?: number }, signal?: AbortSignal): Promise<QueryItem[]>;
  deleteQuery(id: string): Promise<void>;
  clearQueries(): Promise<void>;
  suggestions(q: { q: string; limit?: number }, signal?: AbortSignal): Promise<Suggestion[]>;
  feedback(body: FeedbackRequest): Promise<void>;
  cancel(requestId: string): Promise<CancelResponse | null>;
  chat(opts: StreamOptions): Promise<void>;
  approve(opts: { sessionId: string; approvalId: string; signal?: AbortSignal }): Promise<ApproveResult>;
  downloadPdf(opts: { path: string; filename?: string }): Promise<void>;
  /** GET /agent/files/{file_id} (the `file` event's download). 404 / 410 = expired. */
  downloadFile(opts: { fileId: string; filename: string }): Promise<void>;
}

// ---- http -------------------------------------------------------------------------------------------
async function token(): Promise<string | null> {
  const t = await getAgentToken().catch(() => null);
  if (!t && !agentDevRole()) throw new AgentHttpError(401, "no token");
  return t;
}

const qs = (params: Record<string, string | number | boolean | null | undefined>): string => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : "";
};

/** fetch with the user's token; one silent token refresh + retry on 401. Throws AgentHttpError on !ok. */
async function authedFetch(path: string, init: RequestInit & { json?: unknown; accept?: string } = {}): Promise<Response> {
  const { json, accept, ...rest } = init;
  const extra: Record<string, string> = { Accept: accept ?? "application/json" };
  if (json !== undefined) extra["Content-Type"] = "application/json";
  const go = (t: string | null) => fetch(agentUrl(path), {
    ...rest, headers: agentHeaders(t, extra), body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  let res = await go(await token());
  if (res.status === 401 && !agentDevRole()) {
    const fresh = await refreshAgentToken();
    if (fresh) res = await go(fresh);
  }
  if (!res.ok) throw await errorFrom(res);
  return res;
}
const getJson = async (path: string, signal?: AbortSignal) => (await authedFetch(path, { signal })).json();
const enc = encodeURIComponent;

/** Only ids the backend could have made (uuid / hex) go into a /agent/files URL. */
export const isFileId = (id: unknown): id is string => typeof id === "string" && /^[0-9a-zA-Z_-]{8,64}$/.test(id);

export const httpApi: AgentApi = {
  kind: "http",
  async meta(signal) {
    const m = parseAgentMeta(await getJson("/agent/meta", signal));
    if (!m) throw new AgentHttpError(502, "Bad /agent/meta response");
    return m;
  },
  async listSessions(q, signal) {
    return parseSessionList(await getJson(`/agent/sessions${qs({ cursor: q.cursor, limit: q.limit, q: q.q?.trim(), pinned: q.pinned })}`, signal));
  },
  async getMessages(id, q, signal) {
    return parseMessageList(await getJson(`/agent/sessions/${enc(id)}/messages${qs({ cursor: q.cursor, limit: q.limit })}`, signal));
  },
  async patchSession(id, patch) {
    const res = await authedFetch(`/agent/sessions/${enc(id)}`, { method: "PATCH", json: patch });
    return parseSessionItemOrNull(await res.json().catch(() => null));
  },
  async deleteSession(id, opts) { await authedFetch(`/agent/sessions/${enc(id)}`, { method: "DELETE", keepalive: opts?.keepalive }); },
  async listQueries(q, signal) {
    return parseQueryItems(await getJson(`/agent/history/queries${qs({ q: q.q?.trim(), limit: q.limit })}`, signal));
  },
  async deleteQuery(id) { await authedFetch(`/agent/history/queries/${enc(id)}`, { method: "DELETE" }); },
  async clearQueries() { await authedFetch("/agent/history/queries", { method: "DELETE" }); },
  async suggestions(q, signal) {
    return parseSuggestions(await getJson(`/agent/suggestions${qs({ q: q.q, limit: q.limit })}`, signal));
  },
  async feedback(body) { await authedFetch("/agent/feedback", { method: "POST", json: body }); },
  async cancel(requestId) {
    const res = await authedFetch(`/agent/chat/${enc(requestId)}/cancel`, { method: "POST", json: {} });
    const j = await res.json().catch(() => null) as CancelResponse | null;
    return j && typeof j.request_id === "string" ? j : null;
  },
  async chat({ body, onEvent, onRequestId, signal }) {
    const res = await authedFetch("/agent/chat", { method: "POST", json: chatBody(body), accept: "text/event-stream", signal });
    if (!res.body) throw new AgentHttpError(res.status, "Empty response");
    const rid = res.headers.get("x-agent-request-id");
    if (rid) onRequestId?.(rid);
    await readSse(res.body, onEvent);
  },
  async approve({ sessionId, approvalId, signal }) {
    return approveHttp({ sessionId, approvalId, token: await token(), signal });
  },
  async downloadPdf({ path, filename }) {
    await downloadAgentPdf({ path, token: await token(), filename });
  },
  async downloadFile({ fileId, filename }) {
    if (!isFileId(fileId)) throw new AgentHttpError(400, "Invalid file id");
    const res = await authedFetch(`/agent/files/${enc(fileId)}`, { accept: "*/*" });
    saveBlob(await res.blob(), filename);
  },
};

/** The JSON body of POST /agent/chat: only the fields that are set (regenerate ignores `message`). */
export function chatBody(b: ChatRequest): ChatRequest {
  const out: ChatRequest = { session_id: b.session_id ?? null };
  if (typeof b.regenerate_from_seq === "number") out.regenerate_from_seq = b.regenerate_from_seq;
  else out.message = b.message ?? null;
  if (typeof b.edit_of_seq === "number") out.edit_of_seq = b.edit_of_seq;
  return out;
}

export async function readSse(body: ReadableStream<Uint8Array>, onEvent: (e: AgentEvent) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();
  const emit = (payloads: string[]) => {
    for (const p of payloads) {
      const ev = decodeSseData(p);
      if (ev) onEvent(ev);
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    emit(parser.push(decoder.decode(value, { stream: true })));
  }
  emit(parser.push(decoder.decode()));
  emit(parser.end());
}

// ---- adapter choice ------------------------------------------------------------------------------------
export const AGENT_MOCK = import.meta.env.VITE_AGENT_MOCK === "1";
let picked: Promise<AgentApi> | null = null;

/** The adapter for this build. */
export function getAgentApi(): Promise<AgentApi> {
  if (!picked) {
    if (import.meta.env.VITE_AGENT_MOCK === "1") picked = import("./mock").then((m) => m.mockApi);
    else picked = Promise.resolve(httpApi);
  }
  return picked;
}

/** Tests only. */
export function setAgentApiForTests(api: AgentApi | null) { picked = api ? Promise.resolve(api) : null; }

/** True when the backend doesn't have this endpoint (an older deploy): 404 on a list, 405, or 501. */
export const isMissingEndpoint = (err: unknown): boolean =>
  err instanceof AgentHttpError && (err.status === 404 || err.status === 405 || err.status === 501);
