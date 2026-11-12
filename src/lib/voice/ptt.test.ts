import { describe, expect, it } from "vitest";
import {
  AUDIO_CONSTRAINTS, MAX_BYTES, MAX_MS, SILENCE_AFTER_SPEECH_MS, SILENCE_NO_SPEECH_MS, SilenceDetector, liteVoice,
  pickMimeType, recordingSupported, transition, type VoiceState,
} from "./ptt";

describe("SilenceDetector", () => {
  const run = (levels: Array<[number, number]>) => {
    const d = new SilenceDetector();
    let out: string | null = null;
    for (const [t, rms] of levels) { out = d.feed(rms, t); if (out) return { out, at: t, d }; }
    return { out, at: null, d };
  };
  it("a 2 s thinking pause mid-sentence does not stop the mic", () => {
    const frames: Array<[number, number]> = [];
    for (let t = 0; t < 1000; t += 50) frames.push([t, 0.2]);          // speech
    for (let t = 1000; t < 3000; t += 50) frames.push([t, 0.005]);     // 2 s pause
    for (let t = 3000; t < 4000; t += 50) frames.push([t, 0.2]);       // speech again
    expect(run(frames).out).toBeNull();
  });
  it("stops after silence that follows speech", () => {
    const frames: Array<[number, number]> = [];
    for (let t = 0; t < 1000; t += 50) frames.push([t, 0.2]);          // 1 s of speech
    for (let t = 1000; t < 4000; t += 50) frames.push([t, 0.005]);     // then quiet
    const r = run(frames);
    expect(r.out).toBe("stop");
    expect(r.at! - 1000).toBeGreaterThanOrEqual(SILENCE_AFTER_SPEECH_MS - 50);
    expect(r.at! - 1000).toBeLessThan(SILENCE_AFTER_SPEECH_MS + 100);
  });
  it("gives up when nothing is said", () => {
    const frames: Array<[number, number]> = [];
    for (let t = 0; t < 12000; t += 50) frames.push([t, 0.004]);
    const r = run(frames);
    expect(r.out).toBe("empty");
    expect(r.at).toBeGreaterThanOrEqual(SILENCE_NO_SPEECH_MS - 50);
  });
  it("a short tap of noise is not speech", () => {
    const frames: Array<[number, number]> = [[0, 0.3], [50, 0.3], [100, 0.3]];
    for (let t = 150; t < 12000; t += 50) frames.push([t, 0.004]);
    expect(run(frames).out).toBe("empty");
  });
  it("hard stops at MAX_MS even while someone keeps talking", () => {
    const frames: Array<[number, number]> = [];
    for (let t = 0; t <= MAX_MS + 100; t += 50) frames.push([t, 0.2]);
    const r = run(frames);
    expect(r.out).toBe("stop");
    expect(r.at).toBe(MAX_MS);
  });
  it("adapts to a noisy room: constant fan noise is not speech", () => {
    const frames: Array<[number, number]> = [];
    for (let t = 0; t < 12000; t += 50) frames.push([t, 0.03]); // steady noise under the speech threshold
    expect(run(frames).out).toBe("empty");
  });
});

describe("pickMimeType", () => {
  it("prefers webm/opus (Chrome Android), then mp4 (iOS Safari)", () => {
    expect(pickMimeType((t) => t.startsWith("audio/webm"))).toBe("audio/webm;codecs=opus");
    expect(pickMimeType((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(pickMimeType(() => false)).toBeNull();
    expect(pickMimeType(() => { throw new Error("x"); })).toBeNull();
  });
  it("asks for the three noise switches and mono", () => {
    expect(AUDIO_CONSTRAINTS).toMatchObject({ noiseSuppression: true, echoCancellation: true, autoGainControl: true, channelCount: 1 });
  });
  it("recordingSupported needs MediaRecorder and getUserMedia", () => {
    expect(recordingSupported({ MediaRecorder: () => 0, navigator: { mediaDevices: { getUserMedia: () => 0 } } })).toBe(true);
    expect(recordingSupported({ navigator: { mediaDevices: { getUserMedia: () => 0 } } })).toBe(false);
    expect(recordingSupported({ MediaRecorder: () => 0, navigator: {} })).toBe(false);
  });
});

describe("transition (push-to-talk state machine)", () => {
  it("tap starts, tap stops — and the state changes before the upload", () => {
    expect(transition("idle", { type: "tap" })).toEqual({ state: "listening", action: "start_rec" });
    expect(transition("listening", { type: "tap" })).toEqual({ state: "transcribing", action: "stop_rec" });
  });
  it("silence auto-stops; empty silence says 'dobara boliye' and never guesses", () => {
    expect(transition("listening", { type: "silence", empty: false })).toEqual({ state: "transcribing", action: "stop_rec" });
    expect(transition("listening", { type: "silence", empty: true })).toEqual({ state: "idle", action: "say_repeat" });
  });
  it("too big a recording is discarded, not uploaded", () => {
    expect(transition("transcribing", { type: "recorded", bytes: MAX_BYTES + 1 })).toEqual({ state: "idle", action: "discard" });
    expect(transition("transcribing", { type: "recorded", bytes: 90_000 })).toEqual({ state: "transcribing", action: "upload" });
  });
  it("transcript: auto sends, confirm/pick wait for the user, repeat asks again", () => {
    expect(transition("transcribing", { type: "transcript", next: "auto" })).toEqual({ state: "thinking", action: "send" });
    expect(transition("transcribing", { type: "transcript", next: "confirm" })).toEqual({ state: "idle" });
    expect(transition("transcribing", { type: "transcript", next: "pick" })).toEqual({ state: "idle" });
    expect(transition("transcribing", { type: "transcript", next: "repeat" })).toEqual({ state: "idle", action: "say_repeat" });
  });
  it("answers are spoken, tapping the mic stops playback, errors always land in idle", () => {
    expect(transition("thinking", { type: "answer_done", speech: true })).toEqual({ state: "speaking", action: "play" });
    expect(transition("thinking", { type: "answer_done", speech: false })).toEqual({ state: "idle" });
    expect(transition("speaking", { type: "tap" })).toEqual({ state: "idle", action: "stop_play" });
    expect(transition("speaking", { type: "speech_done" })).toEqual({ state: "idle" });
    for (const s of ["idle", "listening", "transcribing", "thinking", "speaking"] as VoiceState[]) {
      expect(transition(s, { type: "error" }).state).toBe("idle");
      expect(transition(s, { type: "denied" }).state).toBe("idle");
    }
    expect(transition("listening", { type: "error" }).action).toBe("stop_rec");
  });
  it("never listens without a tap (no wake word, no always-on)", () => {
    for (const ev of [{ type: "silence", empty: false }, { type: "speech_done" }, { type: "answer_done", speech: false }] as const) {
      expect(transition("idle", ev).state).toBe("idle");
    }
    expect(transition("thinking", { type: "tap" })).toEqual({ state: "thinking" });
  });
});

describe("liteVoice (slow network)", () => {
  it("2g / saveData / high rtt / tiny downlink = lite", () => {
    expect(liteVoice(null)).toBe(false);
    expect(liteVoice({ effectiveType: "4g", rtt: 100, downlink: 10 })).toBe(false);
    expect(liteVoice({ effectiveType: "2g" })).toBe(true);
    expect(liteVoice({ saveData: true })).toBe(true);
    expect(liteVoice({ rtt: 1500 })).toBe(true);
    expect(liteVoice({ downlink: 0.1 })).toBe(true);
  });
});
