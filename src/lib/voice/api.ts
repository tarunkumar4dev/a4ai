// Voice endpoints (contract 1.4): config, transcribe (raw audio body), speak (audio stream). Same token handling as
// the agent client; one silent refresh on 401. Nothing here logs audio, transcripts or bodies.
import { agentUrl } from "@/lib/agent/config";
import { AgentHttpError, agentDevRole, agentHeaders, errorFrom, getAgentToken, refreshAgentToken } from "@/lib/agent/client";
import type { TranscribeResponse, VoiceConfig } from "@/lib/agent/types";

async function token(): Promise<string | null> {
  const t = await getAgentToken().catch(() => null);
  if (!t && !agentDevRole()) throw new AgentHttpError(401, "no token");
  return t;
}

async function authed(path: string, init: RequestInit & { extra?: Record<string, string> }): Promise<Response> {
  const { extra, ...rest } = init;
  const go = (t: string | null) => fetch(agentUrl(path), { ...rest, headers: agentHeaders(t, extra ?? {}) });
  let res = await go(await token());
  if (res.status === 401 && !agentDevRole()) {
    const fresh = await refreshAgentToken();
    if (fresh) res = await go(fresh);
  }
  if (!res.ok && res.status !== 204) throw await errorFrom(res);
  return res;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

export async function voiceConfig(signal?: AbortSignal): Promise<VoiceConfig> {
  const res = await authed("/agent/voice/config", { signal, extra: { Accept: "application/json" } });
  const j = await res.json();
  if (!isObj(j) || typeof j.enabled !== "boolean") throw new AgentHttpError(502, "Bad /agent/voice/config response");
  return j as VoiceConfig;
}

export function idempotencyKey(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
}

/** Upload the recording. The server decodes the container itself (30 s / 1 MB are enforced there). */
export async function transcribe(blob: Blob, mime: string, key: string, signal?: AbortSignal): Promise<TranscribeResponse> {
  const res = await authed("/agent/voice/transcribe", {
    method: "POST", body: blob, signal,
    extra: { "Content-Type": mime || blob.type || "application/octet-stream", "Idempotency-Key": key, Accept: "application/json" },
  });
  const j = await res.json();
  if (!isObj(j) || typeof j.transcript !== "string") throw new AgentHttpError(502, "Bad /agent/voice/transcribe response");
  return j as TranscribeResponse;
}

export interface SpeakOpts { text: string; language?: "hi" | "en" | "hi-en"; speaker?: string | null; pace?: number; phrase?: string; signal?: AbortSignal }

/** Audio for one sentence (mp3 stream). null = TTS is off on the server (204): use speechSynthesis. */
export async function speak(o: SpeakOpts): Promise<Blob | null> {
  const body: Record<string, unknown> = { text: o.text.slice(0, 300) };
  if (o.language) body.language = o.language;
  if (o.speaker) body.speaker = o.speaker;
  if (typeof o.pace === "number") body.pace = o.pace;
  if (o.phrase) body.phrase = o.phrase;
  const res = await authed("/agent/voice/speak", {
    method: "POST", body: JSON.stringify(body), signal: o.signal,
    extra: { "Content-Type": "application/json", Accept: "audio/mpeg" },
  });
  if (res.status === 204) return null;
  return res.blob();
}
