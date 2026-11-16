// Voice upgrade (1.5): gapless streamed playback, adaptive end of speech, barge-in detection, audio routing.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStreamPlayer, type AudioCtxLike } from "./streamPlayer";
import { BargeInDetector, BARGE_MS, SILENCE_AFTER_SHORT_MS, SILENCE_AFTER_SPEECH_MS, SilenceDetector, transition } from "./ptt";
import { emitVoiceAudio, onVoiceAudio } from "./audioBus";
import { parseAgentEvent } from "@/lib/agent/events";

// ---- fake Web Audio ------------------------------------------------------------------------------------------------
function fakeCtx(decodeDelay: (bytes: number) => number = () => 0, failOn?: number) {
  const started: Array<{ when: number; dur: number; tag: number }> = [];
  const ctx: AudioCtxLike & { started: typeof started; t: number } = {
    t: 0,
    get currentTime() { return this.t; },
    destination: {},
    started,
    decodeAudioData(data: ArrayBuffer) {
      const tag = new Uint8Array(data)[0];
      return new Promise((res, rej) => setTimeout(() => (tag === failOn ? rej(new Error("bad")) : res({ duration: 1, tag } as never)), decodeDelay(tag)));
    },
    createBufferSource() {
      const src = {
        buffer: null as unknown, onended: null as (() => void) | null,
        connect() { /* noop */ },
        start(when = 0) { started.push({ when, dur: 1, tag: (src.buffer as { tag: number }).tag }); },
        stop() { /* noop */ },
      };
      return src;
    },
  };
  return ctx;
}
const chunk = (index: number) => ({ index, data: btoa(String.fromCharCode(index)), mime: "audio/mpeg" });
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

afterEach(() => { vi.useRealTimers(); });

describe("stream player", () => {
  it("plays chunks gaplessly in index order even when they decode out of order", async () => {
    const ctx = fakeCtx((tag) => (tag === 0 ? 30 : 1));   // chunk 0 decodes last
    const onStart = vi.fn();
    const p = createStreamPlayer({ ctx: () => ctx, onStart });
    [0, 1, 2].forEach((i) => p.push(chunk(i)));
    await tick(60);
    expect(ctx.started.map((s) => s.tag)).toEqual([0, 1, 2]);
    expect(ctx.started.map((s) => s.when)).toEqual([0, 1, 2]);   // back to back: no gap, no overlap
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("starts as soon as chunk 0 is ready, before the rest arrive", async () => {
    const ctx = fakeCtx();
    const onStart = vi.fn();
    const p = createStreamPlayer({ ctx: () => ctx, onStart });
    p.push(chunk(0));
    await tick();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(ctx.started).toHaveLength(1);
  });

  it("a chunk that fails to decode is skipped; a missing index is skipped after the gap", async () => {
    const ctx = fakeCtx(() => 0, 1);
    const p = createStreamPlayer({ ctx: () => ctx, gapMs: 20 });
    [0, 1, 2].forEach((i) => p.push(chunk(i)));
    await tick(20);
    expect(ctx.started.map((s) => s.tag)).toEqual([0, 2]);
    const ctx2 = fakeCtx();
    const p2 = createStreamPlayer({ ctx: () => ctx2, gapMs: 20 });
    p2.push(chunk(0)); p2.push(chunk(2));          // index 1 never comes (server skipped it)
    await tick(80);
    expect(ctx2.started.map((s) => s.tag)).toEqual([0, 2]);
  });

  it("stop() silences and drops everything still queued (barge-in)", async () => {
    const ctx = fakeCtx((tag) => (tag === 0 ? 0 : 30));
    const p = createStreamPlayer({ ctx: () => ctx });
    [0, 1, 2].forEach((i) => p.push(chunk(i)));
    await tick(5);
    p.stop();
    await tick(60);
    expect(ctx.started.map((s) => s.tag)).toEqual([0]);
    p.push(chunk(3));
    await tick(10);
    expect(ctx.started).toHaveLength(1);
  });
});

describe("adaptive end of speech (VAD)", () => {
  const run = (frames: Array<[number, number]>) => {
    const d = new SilenceDetector();
    for (const [t, rms] of frames) { const out = d.feed(rms, t); if (out) return { out, at: t }; }
    return { out: null, at: null };
  };
  it("a short reply ('haan') + 1 s of silence goes to STT after ~0.9 s, not after the long pause or 5 s", () => {
    const frames: Array<[number, number]> = [];
    for (let t = 0; t < 500; t += 50) frames.push([t, 0.2]);           // ~0.5 s "haan"
    for (let t = 500; t < 1500; t += 50) frames.push([t, 0.005]);      // 1 s quiet
    const r = run(frames);
    expect(r.out).toBe("stop");
    expect(r.at! - 450).toBeGreaterThanOrEqual(SILENCE_AFTER_SHORT_MS - 50);
    expect(r.at! - 450).toBeLessThan(1100);
    expect(r.at!).toBeLessThan(5000);
  });
  it("a long question still gets the patient pause", () => {
    const frames: Array<[number, number]> = [];
    for (let t = 0; t < 2000; t += 50) frames.push([t, 0.2]);
    for (let t = 2000; t < 5000; t += 50) frames.push([t, 0.005]);
    const r = run(frames);
    expect(r.at! - 1950).toBeGreaterThanOrEqual(SILENCE_AFTER_SPEECH_MS - 50);
  });
});

describe("barge-in", () => {
  it("fires after BARGE_MS of clear speech, not on the answer's quiet echo or a click", () => {
    const d = new BargeInDetector();
    let t = 0;
    for (; t < 1000; t += 50) expect(d.feed(0.05, t)).toBe(false);   // echo of the answer under LEVEL_BARGE
    expect(d.feed(0.5, t)).toBe(false); t += 50;                      // a click
    expect(d.feed(0.01, t)).toBe(false); t += 50;
    let fired = -1;
    for (let k = 0; k < 20; k++, t += 50) if (d.feed(0.4, t) && fired < 0) fired = k * 50;
    expect(fired).toBeGreaterThanOrEqual(BARGE_MS);
    expect(fired).toBeLessThan(BARGE_MS + 100);
  });
  it("tap while speaking → listening (stop + record), audio_start → speaking", () => {
    expect(transition("speaking", { type: "tap" })).toEqual({ state: "listening", action: "barge_in" });
    expect(transition("thinking", { type: "audio_start" })).toEqual({ state: "speaking" });
    expect(transition("idle", { type: "audio_start" })).toEqual({ state: "idle" });
  });
});

describe("audio events", () => {
  it("parse: valid chunk kept, broken ones dropped", () => {
    const ok = parseAgentEvent({ type: "audio", seq: 3, request_id: "r", index: 0, mime: "audio/mpeg", data: "SUQz", chars: 9, ttfa_ms: 640 });
    expect(ok && ok.type === "audio" && ok.index === 0 && ok.ttfa_ms === 640).toBe(true);
    expect(parseAgentEvent({ type: "audio", seq: 3, request_id: "r", index: -1, data: "x" })).toBeNull();
    expect(parseAgentEvent({ type: "audio", seq: 3, request_id: "r", index: 1, data: "" })).toBeNull();
  });
  it("the bus delivers chunks to listeners (the store never puts them in chat state)", () => {
    const got: number[] = [];
    const off = onVoiceAudio((c) => got.push(c.index));
    emitVoiceAudio({ type: "audio", seq: 1, request_id: "r", index: 2, mime: "audio/mpeg", data: "SUQz", chars: 4 } as never);
    off();
    emitVoiceAudio({ type: "audio", seq: 2, request_id: "r", index: 3, mime: "audio/mpeg", data: "SUQz", chars: 4 } as never);
    expect(got).toEqual([2]);
  });
});
