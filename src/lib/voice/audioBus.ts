// `audio` events (contract 1.5) bus: the agent store hands every streamed TTS chunk of a live voice turn here and
// keeps it OUT of chat state (base64 audio never sits in React state or the persisted history). useVoice listens and
// feeds the stream player. Main bundle, no deps — same shape as ./uiActions.
import type { SpeechAudioEvent } from "@/lib/agent/types";

export interface VoiceAudioChunk { requestId: string; index: number; mime: string; data: string; ttfaMs: number | null }

const listeners = new Set<(c: VoiceAudioChunk) => void>();

export function onVoiceAudio(fn: (c: VoiceAudioChunk) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function emitVoiceAudio(ev: SpeechAudioEvent): void {
  const c: VoiceAudioChunk = { requestId: ev.request_id, index: ev.index, mime: ev.mime, data: ev.data, ttfaMs: ev.ttfa_ms ?? null };
  listeners.forEach((l) => { try { l(c); } catch { /* one bad listener must not break the stream */ } });
}

/** Tests only. */
export const _audioListenerCount = () => listeners.size;
