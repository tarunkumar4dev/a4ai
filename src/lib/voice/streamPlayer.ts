// Gapless playback of streamed TTS chunks (contract 1.5 `audio` events). Each chunk is a whole small audio file; it
// is decoded with Web Audio and scheduled right after the previous one (AudioBufferSourceNode chaining), strictly in
// `index` order even when chunks arrive or decode out of order. A chunk that never decodes is skipped after the next
// ones are ready, so one bad chunk never blocks the answer.
//   push(chunk)   — as `audio` events arrive
//   end()         — the turn's stream finished: no more chunks will come
//   stop()        — barge-in / tap: silence now, drop everything
// onStart fires when the first sound starts (→ "speaking"); onIdle when everything pushed has played after end().
// The AudioContext is injected (tests use a fake; the browser one is created lazily on first use).

export interface AudioCtxLike {
  readonly currentTime: number;
  readonly destination: unknown;
  readonly state?: string;
  resume?: () => Promise<void>;
  decodeAudioData(data: ArrayBuffer): Promise<{ duration: number }>;
  createBufferSource(): {
    buffer: unknown;
    onended: (() => void) | null;
    connect(dest: unknown): void;
    start(when?: number): void;
    stop(when?: number): void;
  };
}

export interface StreamChunk { index: number; data: string; mime?: string }

export interface StreamPlayer {
  push(c: StreamChunk): void;
  end(): void;
  stop(): void;
  readonly playing: boolean;
  readonly received: number;
}

export interface StreamPlayerOpts {
  ctx: () => AudioCtxLike | null;
  onStart?: () => void;
  onIdle?: () => void;
  /** after this long without the next index, a missing chunk is skipped (the server already skipped it) */
  gapMs?: number;
  now?: () => number;
}

const b64ToBuffer = (b64: string): ArrayBuffer => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};

export function createStreamPlayer(o: StreamPlayerOpts): StreamPlayer {
  const gapMs = o.gapMs ?? 1500;
  const now = o.now ?? (() => Date.now());
  let ctx: AudioCtxLike | null = null;
  let next = 0;                         // next index to schedule
  let endAt = 0;                        // ctx time when the scheduled audio ends
  let started = false;
  let ended = false;
  let stopped = false;
  let received = 0;
  let live = 0;                         // sources scheduled and not finished
  let waitingSince = 0;
  const decoded = new Map<number, { duration: number } | null>();   // null = failed to decode
  const sources: ReturnType<AudioCtxLike["createBufferSource"]>[] = [];

  const maybeIdle = () => {
    if (stopped || !ended || live > 0) return;
    const pendingHigher = [...decoded.keys()].some((k) => k >= next);
    if (!pendingHigher) o.onIdle?.();
  };

  const pump = () => {
    if (stopped || !ctx) return;
    for (;;) {
      if (!decoded.has(next)) {
        // a later chunk is ready but `next` never came: skip it after gapMs (server-side skips leave holes)
        const later = [...decoded.keys()].some((k) => k > next);
        if (later && waitingSince && now() - waitingSince > gapMs) { next++; waitingSince = 0; continue; }
        if (later && !waitingSince) { waitingSince = now(); setTimeout(pump, gapMs + 20); }
        break;
      }
      const buf = decoded.get(next);
      decoded.delete(next);
      next++;
      waitingSince = 0;
      if (!buf) continue;                // failed decode: skip
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      const at = Math.max(ctx.currentTime, endAt);
      src.start(at);
      endAt = at + buf.duration;
      live++;
      sources.push(src);
      src.onended = () => { live--; maybeIdle(); };
      if (!started) { started = true; o.onStart?.(); }
    }
    maybeIdle();
  };

  return {
    get playing() { return started && !stopped && (live > 0 || !ended); },
    get received() { return received; },
    push(c) {
      if (stopped) return;
      received++;
      ctx ??= o.ctx();
      if (!ctx) return;
      if (ctx.state === "suspended") void ctx.resume?.().catch(() => undefined);
      const c0 = ctx;
      c0.decodeAudioData(b64ToBuffer(c.data))
        .then((b) => { decoded.set(c.index, b); })
        .catch(() => { decoded.set(c.index, null); })
        .finally(pump);
    },
    end() { ended = true; pump(); if (received === 0) { stopped = true; } },
    stop() {
      stopped = true;
      for (const s of sources) { s.onended = null; try { s.stop(); } catch { /* already stopped */ } }
      sources.length = 0;
      decoded.clear();
      live = 0;
    },
  };
}

/** The browser AudioContext, created once on first use (after a user gesture: the mic tap). */
let shared: AudioCtxLike | null = null;
export function browserAudioCtx(): AudioCtxLike | null {
  if (shared) return shared;
  const AC = (typeof window !== "undefined" && ((window as unknown as { AudioContext?: new () => AudioCtxLike }).AudioContext
    ?? (window as unknown as { webkitAudioContext?: new () => AudioCtxLike }).webkitAudioContext)) || null;
  if (!AC) return null;
  try { shared = new AC(); } catch { shared = null; }
  return shared;
}
