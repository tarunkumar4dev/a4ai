// "Start listening" requests from outside the dock (the floating mic on mobile dashboards opens the sheet, then asks
// the dock — which mounts a frame later — to begin). Main bundle, no deps.
const listeners = new Set<() => void>();
let pending = false;

export function onVoiceStartRequest(fn: () => void): () => void {
  listeners.add(fn);
  if (pending) { pending = false; queueMicrotask(fn); }
  return () => { listeners.delete(fn); };
}

export function requestVoiceStart(): void {
  if (!listeners.size) { pending = true; setTimeout(() => { pending = false; }, 4000); return; }
  listeners.forEach((l) => l());
}

/** Tests only. */
export const _resetVoiceSurface = () => { listeners.clear(); pending = false; };
