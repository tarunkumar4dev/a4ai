// Dev preview only (/__agent-preview): forces the voice-input UI into one state for screenshots. null = real
// behaviour. Nothing in production sets it.
import { useSyncExternalStore } from "react";

export type PreviewVoiceState = "listening" | "ready" | "denied" | "unsupported" | "processing";
let cur: PreviewVoiceState | null = null;
const subs = new Set<() => void>();
export const previewVoice = {
  get: () => cur,
  set(v: PreviewVoiceState | null) { if (v !== cur) { cur = v; subs.forEach((f) => f()); } },
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
};
export const usePreviewVoice = () => useSyncExternalStore(previewVoice.subscribe, previewVoice.get, () => null);
