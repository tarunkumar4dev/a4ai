// Agent SSE client: POST /api/agent/chat (streams AgentEvent), POST /api/agent/approve.
import { backendUrl } from "@/lib/apiBase";
import { createSseParser, decodeSseData, type AgentEvent } from "./events";

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
  token: string;
  onEvent: (e: AgentEvent) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const res = await fetch(backendUrl("/agent/chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream", Authorization: `Bearer ${opts.token}` },
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

export async function approve(opts: { sessionId: string; approvalId: string; token: string; signal?: AbortSignal }): Promise<ApproveResult> {
  const res = await fetch(backendUrl("/agent/approve"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.token}` },
    body: JSON.stringify({ session_id: opts.sessionId, approval_id: opts.approvalId }),
    signal: opts.signal,
  });
  if (!res.ok) throw new AgentHttpError(res.status, await errorText(res));
  const j = await res.json().catch(() => ({}));
  return { ok: true, ...(j && typeof j === "object" ? j : {}) };
}
