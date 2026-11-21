import { describe, expect, it } from "vitest";
import { VOICE_SILENCE_TIMEOUT_MS, dictationReducer, initialDictation, recognitionCtor } from "./webSpeech";
import { initialSession, sessionReducer } from "./session";
import { appendTranscript } from "@/components/voice/VoiceComposer";

describe("browser dictation (Web Speech)", () => {
  const run = (...as: Parameters<typeof dictationReducer>[1][]) => as.reduce(dictationReducer, initialDictation);
  it("requesting → listening → live text → ready, never sending", () => {
    expect(run({ type: "start" }).state).toBe("requesting");
    const live = run({ type: "start" }, { type: "listening" }, { type: "result", final: "Meri classes", interim: "ki attendance" });
    expect(live).toEqual({ state: "listening", text: "Meri classes", interim: "ki attendance" });
    expect(dictationReducer(live, { type: "end", reason: "silence" })).toEqual({ state: "ready", text: "Meri classes ki attendance", interim: "" });
  });
  it("timeout keeps the text; nothing said = no speech", () => {
    const live = run({ type: "start" }, { type: "listening" }, { type: "result", final: "abc", interim: "" });
    expect(dictationReducer(live, { type: "end", reason: "timeout" })).toMatchObject({ state: "timeout", text: "abc" });
    expect(run({ type: "start" }, { type: "listening" }, { type: "end", reason: "silence" }).state).toBe("nospeech");
  });
  it("errors map to friendly states", () => {
    expect(run({ type: "start" }, { type: "error", error: "not-allowed" }).state).toBe("denied");
    expect(run({ type: "start" }, { type: "error", error: "network" }).state).toBe("network");
    expect(run({ type: "start" }, { type: "error", error: "audio-capture" }).state).toBe("unsupported");
    expect(run({ type: "start" }, { type: "listening" }, { type: "error", error: "aborted" }).state).toBe("listening");
  });
  it("silence after speech is 2.5 s; no recognition API → no mic", () => {
    expect(VOICE_SILENCE_TIMEOUT_MS).toBe(2500);
    expect(recognitionCtor({})).toBeNull();
    function Fake() { /* */ }
    expect(recognitionCtor({ webkitSpeechRecognition: Fake })).toBe(Fake);
  });
  it("dictation appends to what is already typed", () => {
    expect(appendTranscript("", " ECE 1 ki attendance ")).toBe("ECE 1 ki attendance");
    expect(appendTranscript("Mujhe", "ECE 1 ki attendance")).toBe("Mujhe ECE 1 ki attendance");
  });
});

describe("server voice: transcript goes to the box, not sent", () => {
  it("ready notice, state idle (no countdown)", () => {
    const s = sessionReducer({ ...initialSession, state: "transcribing" }, { type: "ready", text: "ECE 1 ki attendance" });
    expect(s.state).toBe("idle");
    expect(s.notice).toEqual({ kind: "ready", text: "ECE 1 ki attendance" });
    expect(sessionReducer(initialSession, { type: "ready", text: "" }).notice).toEqual({ kind: "repeat" });
  });
});
