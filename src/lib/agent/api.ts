// Typed client for every a4ai Agent endpoint (contract: ./types.ts). One interface, two adapters:
//   http — the real backend at VITE_AGENT_URL, with the signed-in user's Supabase token;
//   mock — ./mock.ts, an in-browser fake that follows the same contract (VITE_AGENT_MOCK=1 at build/dev time;
//          the mock chunk is not even emitted otherwise).
// Nothing here logs request or response bodies (they hold questions and student data).
import { agentUrl } from "./config";
import {
  AgentHttpError, agentDevRole, agentHeaders, approve as approveHttp, downloadAgentPdf, getAgentToken,
  type ApproveResult,
} from "./client";
import {
  createSseParser, decodeSseData, parseAgentMeta, parseMessagesPage, parseQueryHistory, parseSessionsPage,
  parseSuggestions,
} from "./events";
import type {
  AgentEvent, AgentMeta, ChatRequestBody, FeedbackBody, MessagesPage, QueryHistoryItem, SessionPatch, SessionSummary,
  SessionsPage, SessionsQuery, Suggestion,
} from "./types";

export interface StreamOptions { body: ChatRequestBody; onEvent: (e: AgentEvent) => void; signal?: AbortSignal }

export interface AgentApi {
  readonly kind: "http" | "mock";
  meta(signal?: AbortSignal): Promise<AgentMeta>;
  listSessions(q: SessionsQuery, signal?: AbortSignal): Promise<SessionsPage>;
  getMessages(sessionId: string, cursor: string | null, signal?: AbortSignal): Promise<MessagesPage>;
  patchSession(sessionId: string, patch: SessionPatch): Promise<SessionSummary | null>;
  deleteSession(sessionId: string, opts?: { keepalive?: boolean }): Promise<void>;
  listQueries(q: { q?: string; limit?: number }, signal?: AbortSignal): Promise<QueryHistoryItem[]>;
  deleteQuery(id: string): Promise<void>;
  clearQueries(): Promise<void>;
  suggestions(q: { q: string; limit?: number }, signal?: AbortSignal): Promise<Suggestion[]>;
  feedback(body: FeedbackBody): Promise<void>;
  cancel(requestId: string): Promise<void>;
  chat(opts: StreamOptions): Promise<void>;
  approve(opts: { sessionId: string; approvalId: string; signal?: AbortSignal }): Promise<ApproveResult>;
  downloadPdf(opts: { path: string; filename?: string }): Promise<void>;
}

// ---- http -------------------------------------------------------------------------------------------
async function token(): Promise<string | null> {
  const t = await getAgentToken().catch(() => null);
  if (!t && !agentDevRole()) throw new AgentHttpError(401, "no token");
  return t;
}

async function errorText(res: Response): Promise<string> {
  try {
    const j = await res.json();
    if (typeof j?.detail === "string") return j.detail;
    if (typeof j?.message === "string") return j.message;
  } catch { /* not JSON */ }
  return `HTTP ${res.status}`;
}

const qs = (params: Record<string, string | number | boolean | null | undefined>): string => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : "";
};

async function request(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
  const { json, ...rest } = init;
  const extra: Record<string, string> = { Accept: "application/json" };
  if (json !== undefined) extra["Content-Type"] = "application/json";
  const res = await fetch(agentUrl(path), {
    ...rest,
    headers: agentHeaders(await token(), extra),
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) throw new AgentHttpError(res.status, await errorText(res));
  return res;
}
const getJson = async (path: string, signal?: AbortSignal) => (await request(path, { signal })).json();
const enc = encodeURIComponent;

export const httpApi: AgentApi = {
  kind: "http",
  async meta(signal) {
    const m = parseAgentMeta(await getJson("/agent/meta", signal));
    if (!m) throw new AgentHttpError(502, "Bad /agent/meta response");
    return m;
  },
  async listSessions(q, signal) {
    return parseSessionsPage(await getJson(`/agent/sessions${qs({ cursor: q.cursor, limit: q.limit, q: q.q?.trim(), pinned: q.pinned })}`, signal));
  },
  async getMessages(id, cursor, signal) {
    return parseMessagesPage(await getJson(`/agent/sessions/${enc(id)}/messages${qs({ cursor })}`, signal));
  },
  async patchSession(id, patch) {
    const res = await request(`/agent/sessions/${enc(id)}`, { method: "PATCH", json: patch });
    const j = await res.json().catch(() => null);
    return parseSessionsPage({ sessions: j && typeof j === "object" ? [j] : [] }).sessions[0] ?? null;
  },
  async deleteSession(id, opts) { await request(`/agent/sessions/${enc(id)}`, { method: "DELETE", keepalive: opts?.keepalive }); },
  async listQueries(q, signal) {
    return parseQueryHistory(await getJson(`/agent/history/queries${qs({ q: q.q?.trim(), limit: q.limit })}`, signal));
  },
  async deleteQuery(id) { await request(`/agent/history/queries/${enc(id)}`, { method: "DELETE" }); },
  async clearQueries() { await request("/agent/history/queries", { method: "DELETE" }); },
  async suggestions(q, signal) {
    return parseSuggestions(await getJson(`/agent/suggestions${qs({ q: q.q, limit: q.limit })}`, signal));
  },
  async feedback(body) { await request("/agent/feedback", { method: "POST", json: body }); },
  async cancel(requestId) { await request(`/agent/chat/${enc(requestId)}/cancel`, { method: "POST", json: {} }); },
  async chat({ body, onEvent, signal }) {
    const res = await fetch(agentUrl("/agent/chat"), {
      method: "POST",
      headers: agentHeaders(await token(), { "Content-Type": "application/json", Accept: "text/event-stream" }),
      body: JSON.stringify(chatBody(body)),
      signal,
    });
    if (!res.ok) throw new AgentHttpError(res.status, await errorText(res));
    if (!res.body) throw new AgentHttpError(res.status, "Empty response");
    await readSse(res.body, onEvent);
  },
  async approve({ sessionId, approvalId, signal }) {
    return approveHttp({ sessionId, approvalId, token: await token(), signal });
  },
  async downloadPdf({ path, filename }) {
    await downloadAgentPdf({ path, token: await token(), filename });
  },
};

/** The JSON body of POST /agent/chat: v1 fields always, v2 fields only when set (a v1 backend ignores nothing). */
export function chatBody(b: ChatRequestBody): Record<string, unknown> {
  const out: Record<string, unknown> = { session_id: b.session_id ?? null, message: b.message };
  if (typeof b.regenerate_from_seq === "number") out.regenerate_from_seq = b.regenerate_from_seq;
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

/** True when the backend simply doesn't have this endpoint yet (v1): 404 on a list, 405, or 501. */
export const isMissingEndpoint = (err: unknown): boolean =>
  err instanceof AgentHttpError && (err.status === 404 || err.status === 405 || err.status === 501);
