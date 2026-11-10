// Low-level helpers for the agent backend: auth headers (Supabase token; X-Dev-Role in `vite dev` only), the HTTP
// error type (status + Retry-After), token refresh on 401, approve and the two token-protected downloads.
// Base URL = VITE_AGENT_URL (see ./config). Nothing here logs bodies, URLs with ?q= or tokens.
import { agentUrl } from "./config";

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
  constructor(public status: number, message: string, public retryAfterSec: number | null = null) { super(message); }
}

/** Retry-After as seconds (delta-seconds or an HTTP date); null when absent / unparsable. Pure. */
export function parseRetryAfter(v: string | null | undefined, now = Date.now()): number | null {
  if (!v) return null;
  const n = Number(v.trim());
  if (Number.isFinite(n) && n >= 0) return Math.min(3600, Math.ceil(n));
  const t = Date.parse(v);
  return Number.isFinite(t) ? Math.max(0, Math.min(3600, Math.ceil((t - now) / 1000))) : null;
}

/** JWT of the logged-in user (the session lives in "@/lib/supabaseClient", see src/lib/api.ts). */
export async function getAgentToken(): Promise<string | null> {
  const { supabase } = await import("@/lib/supabaseClient");
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/** After a 401: ask Supabase for a fresh access token once (null = really signed out). */
export async function refreshAgentToken(): Promise<string | null> {
  try {
    const { supabase } = await import("@/lib/supabaseClient");
    const { data, error } = await supabase.auth.refreshSession();
    return error ? null : data.session?.access_token ?? null;
  } catch { return null; }
}

export async function errorFrom(res: Response): Promise<AgentHttpError> {
  let msg = `HTTP ${res.status}`;
  try {
    const j = await res.json();
    if (typeof j?.detail === "string") msg = j.detail;
    else if (typeof j?.message === "string") msg = j.message;
  } catch { /* not JSON */ }
  return new AgentHttpError(res.status, msg, parseRetryAfter(res.headers.get("retry-after")));
}

export interface ApproveResult { ok: boolean; [k: string]: unknown }

/** Only the agent's own draft-PDF path is fetched with the user's token (never an arbitrary URL). */
export function isAgentPdfPath(path: unknown): path is string {
  return typeof path === "string" && /^\/agent\/drafts\/[0-9a-f-]{36}\/pdf$/i.test(path);
}

/** Save a Blob as a download (object URL revoked after 10 s). */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

export async function approve(opts: { sessionId: string; approvalId: string; token: string | null; signal?: AbortSignal }): Promise<ApproveResult> {
  const res = await fetch(agentUrl("/agent/approve"), {
    method: "POST",
    headers: agentHeaders(opts.token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ session_id: opts.sessionId, approval_id: opts.approvalId }),
    signal: opts.signal,
  });
  if (!res.ok) throw await errorFrom(res);
  const j = await res.json().catch(() => ({}));
  return { ok: true, ...(j && typeof j === "object" ? j : {}) };
}

export async function downloadAgentPdf(opts: { path: string; token: string | null; filename?: string }): Promise<void> {
  if (!isAgentPdfPath(opts.path)) throw new AgentHttpError(400, "Invalid download link");
  const res = await fetch(agentUrl(opts.path), { headers: agentHeaders(opts.token) });
  if (!res.ok) throw await errorFrom(res);
  saveBlob(await res.blob(), opts.filename ?? "a4ai-test.pdf");
}
