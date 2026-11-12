// Browser recorder: getUserMedia (noise suppression, echo cancellation, AGC) → MediaRecorder → one Blob.
// Level meter from an AnalyserNode (RMS 0..1, ~20×/s) drives the SilenceDetector (./ptt.ts) for auto-stop and the UI
// meter. Audio stays in memory; the Blob is handed to the caller and dropped. Loaded lazily (never in the main bundle).
import { AUDIO_CONSTRAINTS, MAX_MS, SilenceDetector, pickMimeType } from "./ptt";

export interface Recording {
  mimeType: string;
  /** stop now; resolves with the audio (empty Blob when nothing was captured) */
  stop(): Promise<Blob>;
  /** release the mic without a result */
  cancel(): void;
}

export interface RecorderOptions {
  onLevel?: (rms: number) => void;             // for the meter (skipped on lite mode by the caller)
  onAutoStop?: (reason: "stop" | "empty") => void;
  meter?: boolean;                              // false = no AnalyserNode at all (slow phones / lite)
}

export class MicDenied extends Error { constructor() { super("mic_denied"); } }
export class MicUnsupported extends Error { constructor() { super("mic_unsupported"); } }

export async function startRecording(opts: RecorderOptions = {}): Promise<Recording> {
  if (typeof MediaRecorder !== "function" || !navigator.mediaDevices?.getUserMedia) throw new MicUnsupported();
  const mime = pickMimeType((t) => MediaRecorder.isTypeSupported(t));
  if (!mime) throw new MicUnsupported();
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") throw new MicDenied();
    throw new MicUnsupported();
  }
  const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 24_000 });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

  let ctx: AudioContext | null = null;
  let raf = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const detector = new SilenceDetector();
  let stopped = false;
  let done: ((b: Blob) => void) | null = null;
  const finished = new Promise<Blob>((resolve) => { done = resolve; });

  const release = () => {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    stream.getTracks().forEach((t) => t.stop());
    if (ctx) { void ctx.close().catch(() => { /* already closed */ }); ctx = null; }
  };
  rec.onstop = () => {
    release();
    done?.(new Blob(chunks, { type: mime.split(";")[0] }));
  };
  const stopNow = () => {
    if (stopped) return;
    stopped = true;
    try { if (rec.state !== "inactive") rec.stop(); else rec.onstop?.(new Event("stop")); } catch { release(); done?.(new Blob([], { type: mime })); }
  };

  // level meter + silence detection (transform-only UI on the other side; here just numbers)
  if (opts.meter !== false && typeof AudioContext === "function") {
    try {
      ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      let last = 0;
      const tick = (now: number) => {
        if (stopped) return;
        raf = requestAnimationFrame(tick);
        if (now - last < 50) return; // ~20×/s is enough for a meter and for silence detection
        last = now;
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        opts.onLevel?.(rms);
        const verdict = detector.feed(rms, now);
        if (verdict) { opts.onAutoStop?.(verdict); stopNow(); }
      };
      raf = requestAnimationFrame(tick);
    } catch { /* no meter: the hard timer below still stops the recording */ }
  }
  timer = setTimeout(() => { opts.onAutoStop?.(detector.hasSpeech || opts.meter === false ? "stop" : "empty"); stopNow(); }, MAX_MS);
  rec.start(250);

  return {
    mimeType: mime,
    stop: () => { stopNow(); return finished; },
    cancel: () => { stopped = true; try { if (rec.state !== "inactive") rec.stop(); } catch { /* ignore */ } release(); },
  };
}
