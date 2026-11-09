// Agent SSE client: POST /agent/chat (streams AgentEvent), POST /agent/approve, GET /agent/drafts/:id/pdf,
// GET /agent/meta, GET /agent/sessions (contract 1.1).
// Base URL = VITE_AGENT_URL (see ./config).
import { agentUrl } from "./config";
import {
  createSseParser, decodeSseData, parseAgentMeta, parseAgentSessions,
  type AgentEvent, type AgentMeta, type SessionSummary,
} from "./events";

/** Dev only: VITE_AGENT_DEV_ROLE=admin|teacher -> X-Dev-Role (backend honours it only with AGENT_DEV_MODE=1). */
export function agentDevRole(env: { DEV?: boolean; VITE_AGENT_DEV_ROLE?: string } = import.meta.env): "admin" | "teacher" | null {
  const r = (env.VITE_AGENT_DEV_ROLE ?? "").trim().toLowerCase();
  return env.DEV && (r === "admin" || r === "teacher") ? r : null;
}

export function agentHeaders(token: string | null, extra: Record<string, string> = {}, devRole = agentDevRole()): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  if (token) h.Authorization = `Bearer ${token}`;
  if (devRole) h["X-Dev-Role"] = devRole;
  return h;
}

export class AgentHttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** JWT of the logged-in user (the session lives in "@/lib/supabaseClient", see src/lib/api.ts). */
export async function getAgentToken(): Promise<string | null> {
  const { supabase } = await import("@/lib/supabaseClient");
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function errorText(res: Response): Promise<string> {
  try {
    const j = await res.json();
    if (typeof j?.detail === "string") return j.detail;
    if (typeof j?.message === "string") return j.message;
  } catch { /* not JSON */ }
  return `HTTP ${res.status}`;
}

export async function streamChat(opts: {
  message: string;
  sessionId?: string | null;
  token: string | null;
  onEvent: (e: AgentEvent) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const res = await fetch(agentUrl("/agent/chat"), {
    method: "POST",
    headers: agentHeaders(opts.token, { "Content-Type": "application/json", Accept: "text/event-stream" }),
    body: JSON.stringify({ session_id: opts.sessionId ?? null, message: opts.message }),
    signal: opts.signal,
  });
  if (!res.ok) throw new AgentHttpError(res.status, await errorText(res));
  if (!res.body) throw new AgentHttpError(res.status, "Empty response");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();
  const emit = (payloads: string[]) => {
    for (const p of payloads) {
      const ev = decodeSseData(p);
      if (ev) opts.onEvent(ev);
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

export interface ApproveResult { ok: boolean; [k: string]: unknown }

export async function approve(opts: { sessionId: string; approvalId: string; token: string | null; signal?: AbortSignal }): Promise<ApproveResult> {
  const res = await fetch(agentUrl("/agent/approve"), {
    method: "POST",
    headers: agentHeaders(opts.token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ session_id: opts.sessionId, approval_id: opts.approvalId }),
    signal: opts.signal,
  });
  if (!res.ok) throw new AgentHttpError(res.status, await errorText(res));
  const j = await res.json().catch(() => ({}));
  return { ok: true, ...(j && typeof j === "object" ? j : {}) };
}

/** Only the agent's own draft-PDF path is fetched with the user's token (never an arbitrary URL). */
export function isAgentPdfPath(path: unknown): path is string {
  return typeof path === "string" && /^\/agent\/drafts\/[0-9a-f-]{36}\/pdf$/i.test(path);
}

export async function downloadAgentPdf(opts: { path: string; token: string | null; filename?: string }): Promise<void> {
  if (!isAgentPdfPath(opts.path)) throw new AgentHttpError(400, "Invalid download link");
  const res = await fetch(agentUrl(opts.path), { headers: agentHeaders(opts.token) });
  if (!res.ok) throw new AgentHttpError(res.status, await errorText(res));
  const url = URL.createObjectURL(await res.blob());
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = opts.filename ?? "a4ai-test.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

async function getJson(path: string, token: string | null, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(agentUrl(path), { headers: agentHeaders(token, { Accept: "application/json" }), signal });
  if (!res.ok) throw new AgentHttpError(res.status, await errorText(res));
  return res.json();
}

/** GET /agent/meta → data source pill, role badge, greeting name. Throws on HTTP errors or a bad shape. */
export async function fetchAgentMeta(token: string | null, signal?: AbortSignal): Promise<AgentMeta> {
  const meta = parseAgentMeta(await getJson("/agent/meta", token, signal));
  if (!meta) throw new AgentHttpError(502, "Bad /agent/meta response");
  return meta;
}

/** GET /agent/sessions → own sessions, newest first (max 50). */
export async function fetchAgentSessions(token: string | null, signal?: AbortSignal): Promise<SessionSummary[]> {
  return parseAgentSessions(await getJson("/agent/sessions", token, signal));
}
