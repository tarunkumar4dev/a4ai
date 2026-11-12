// Push-to-talk, pure. No DOM, no audio APIs here (see ./recorder.ts) so every rule is unit-tested:
//   tap = start, tap again = stop, auto-stop on silence, hard stop at MAX_MS. No wake word, no always-on listening.
//   States: idle → listening → transcribing → thinking → speaking → idle. A state change is visible the instant the
//   mic stops (the recorder calls `stop` synchronously before the upload starts).
export type VoiceState = "idle" | "listening" | "transcribing" | "thinking" | "speaking";

export const MAX_MS = 30_000;            // backend rejects longer audio (Sarvam REST limit)
export const MAX_BYTES = 1_048_576;
export const MIN_SPEECH_MS = 400;        // shorter than this = a tap, not speech
export const SILENCE_AFTER_SPEECH_MS = 2500; // quiet this long after speech → stop (people pause mid-sentence to think)
export const SILENCE_NO_SPEECH_MS = 8000;    // nothing said at all → stop (and say "Dobara boliye")
export const AUTO_SEND_PAUSE_MS = 5000;  // transcript + Edit shown this long (with a seconds countdown), then sent
export const LEVEL_SPEECH = 0.06;        // RMS (0..1) above this = speech; calibrated per session by `noiseFloor`
export const SPACE_HOLD_MS = 150;        // desktop: Space held longer than a keypress = talk

/** The recorder calls `feed(rms, nowMs)` ~20×/s; `feed` answers "stop" when the utterance is over. */
export class SilenceDetector {
  private start: number | null = null;
  private lastSpeech: number | null = null;
  private floor: number;
  private speechMs = 0;
  private lastTick: number | null = null;
  readonly threshold: number;

  constructor(opts: { noiseFloor?: number; threshold?: number } = {}) {
    this.floor = opts.noiseFloor ?? 0;
    this.threshold = opts.threshold ?? LEVEL_SPEECH;
  }

  /** @returns "stop" (silence after speech / nothing said / max length), "empty" (stopped without speech) or null */
  feed(rms: number, now: number): "stop" | "empty" | null {
    if (this.start === null) { this.start = now; this.lastTick = now; }
    const dt = this.lastTick === null ? 0 : now - this.lastTick;
    this.lastTick = now;
    // noise floor: slow average of quiet frames, so a corridor fan is not "speech"
    const speaking = rms > Math.max(this.threshold, this.floor * 2.5);
    if (!speaking) this.floor = this.floor === 0 ? rms : this.floor * 0.95 + rms * 0.05;
    if (speaking) { this.lastSpeech = now; this.speechMs += dt; }
    if (now - this.start >= MAX_MS) return this.speechMs >= MIN_SPEECH_MS ? "stop" : "empty";
    if (this.lastSpeech === null) return now - this.start >= SILENCE_NO_SPEECH_MS ? "empty" : null;
    if (now - this.lastSpeech >= SILENCE_AFTER_SPEECH_MS) return this.speechMs >= MIN_SPEECH_MS ? "stop" : "empty";
    return null;
  }

  /** true when enough speech was heard to be worth uploading */
  get hasSpeech(): boolean { return this.speechMs >= MIN_SPEECH_MS; }
  get noiseFloor(): number { return this.floor; }
}

/** The MIME MediaRecorder should use, in preference order. null = recording unsupported. Pure. */
export function pickMimeType(isTypeSupported: (t: string) => boolean): string | null {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"];
  for (const c of candidates) { try { if (isTypeSupported(c)) return c; } catch { /* Safari throws on odd input */ } }
  return null;
}

/** getUserMedia constraints: the three noise switches the brief asks for. */
export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  noiseSuppression: true, echoCancellation: true, autoGainControl: true, channelCount: 1, sampleRate: 16000,
};

/** Can this browser record at all? (MediaRecorder + getUserMedia; iOS Safari 14.3+ and Chrome Android both can.) */
export function recordingSupported(w: { MediaRecorder?: unknown; navigator?: { mediaDevices?: { getUserMedia?: unknown } } } = window as never): boolean {
  return typeof w.MediaRecorder === "function" && typeof w.navigator?.mediaDevices?.getUserMedia === "function";
}

export type Event =
  | { type: "tap" }                      // the mic button
  | { type: "silence"; empty: boolean }  // SilenceDetector said stop / empty
  | { type: "recorded"; bytes: number }  // blob ready → upload
  | { type: "transcript"; next: "auto" | "confirm" | "repeat" | "pick" }
  | { type: "sent" }                     // user (or the auto-send pause) sent the transcript
  | { type: "answer_done"; speech: boolean }
  | { type: "speech_done" }
  | { type: "error" }
  | { type: "denied" };

export interface Transition { state: VoiceState; action?: "start_rec" | "stop_rec" | "upload" | "send" | "play" | "discard" | "say_repeat" | "stop_play" }

/** The state machine. Pure: (state, event) → (next state, side effect to run). */
export function transition(state: VoiceState, ev: Event): Transition {
  switch (ev.type) {
    case "tap":
      if (state === "idle") return { state: "listening", action: "start_rec" };
      if (state === "listening") return { state: "transcribing", action: "stop_rec" };   // instant feedback
      if (state === "speaking") return { state: "idle", action: "stop_play" };           // tapping the mic stops playback
      return { state };                                                                  // transcribing / thinking: ignore
    case "silence":
      if (state !== "listening") return { state };
      return ev.empty ? { state: "idle", action: "say_repeat" } : { state: "transcribing", action: "stop_rec" };
    case "recorded":
      if (state !== "transcribing") return { state };
      return ev.bytes > MAX_BYTES ? { state: "idle", action: "discard" } : { state: "transcribing", action: "upload" };
    case "transcript":
      if (state !== "transcribing") return { state };
      if (ev.next === "repeat") return { state: "idle", action: "say_repeat" };
      if (ev.next === "auto") return { state: "thinking", action: "send" };
      return { state: "idle" };  // confirm / pick: the user taps
    case "sent": return { state: "thinking" };
    case "answer_done": return ev.speech ? { state: "speaking", action: "play" } : { state: "idle" };
    case "speech_done": return { state: "idle" };
    case "error": case "denied": return { state: "idle", action: state === "listening" ? "stop_rec" : undefined };
    default: return { state };
  }
}

/** Hindi + English label for each state (no technical words). */
export const STATE_LABEL: Record<VoiceState, { hi: string; en: string }> = {
  idle: { hi: "Mic dabakar boliye", en: "Tap the mic and speak" },
  listening: { hi: "Sun raha hoon…", en: "Listening…" },
  transcribing: { hi: "Samajh raha hoon…", en: "Working it out…" },
  thinking: { hi: "Jawab dhoondh raha hoon…", en: "Finding the answer…" },
  speaking: { hi: "Bol raha hoon…", en: "Speaking…" },
};

/** "slow" network (navigator.connection) → no level meter, browser speechSynthesis instead of TTS audio. Pure. */
export function liteVoice(conn: { effectiveType?: string; saveData?: boolean; rtt?: number; downlink?: number } | null | undefined): boolean {
  if (!conn) return false;
  if (conn.saveData) return true;
  if (conn.effectiveType === "slow-2g" || conn.effectiveType === "2g") return true;
  if (typeof conn.rtt === "number" && conn.rtt >= 1200) return true;
  if (typeof conn.downlink === "number" && conn.downlink > 0 && conn.downlink < 0.25) return true;
  return false;
}
