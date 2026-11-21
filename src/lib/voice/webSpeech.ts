// Free voice input with the browser's own speech recognition (Web Speech API — Chrome on Android, Edge, Safari),
// used when the server voice (Sarvam, /agent/voice/config) is off. Dictation only: the text goes into the message
// box for review and is NEVER sent by itself. The selected language is a hint (en-IN / hi-IN), not a lock; spoken
// words are not translated. Permission is asked only when the mic is tapped; recognition stops on Stop, after
// VOICE_SILENCE_TIMEOUT_MS of quiet following speech (natural pauses between words are fine), at VOICE_MAX_MS, and
// when the component unmounts (panel closed). No audio is stored anywhere by this code.
import { useCallback, useEffect, useReducer, useRef } from "react";

export const VOICE_SILENCE_TIMEOUT_MS = 2500;
export const VOICE_NO_SPEECH_MS = 8000;
export const VOICE_MAX_MS = 60_000;

export type DictationState = "idle" | "requesting" | "listening" | "processing" | "ready" | "denied" | "unsupported" | "network" | "timeout" | "nospeech";

interface RecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onstart: (() => void) | null; onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
}
type RecognitionCtor = new () => RecognitionLike;

export function recognitionCtor(w: unknown = typeof window !== "undefined" ? window : undefined): RecognitionCtor | null {
  const g = w as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor } | undefined;
  return g?.SpeechRecognition ?? g?.webkitSpeechRecognition ?? null;
}
export const dictationSupported = () => !!recognitionCtor();

export interface Dictation { state: DictationState; interim: string; text: string }
export type DictationAction =
  | { type: "start" } | { type: "listening" } | { type: "result"; final: string; interim: string }
  | { type: "end"; reason: "stop" | "silence" | "timeout" } | { type: "error"; error: string } | { type: "reset" };

export const initialDictation: Dictation = { state: "idle", interim: "", text: "" };

/** Pure: what the strip shows. */
export function dictationReducer(s: Dictation, a: DictationAction): Dictation {
  switch (a.type) {
    case "start": return { state: "requesting", interim: "", text: "" };
    case "listening": return s.state === "requesting" ? { ...s, state: "listening" } : s;
    case "result": return s.state === "listening" || s.state === "requesting" ? { state: "listening", text: a.final, interim: a.interim } : s;
    case "end": {
      if (s.state !== "listening" && s.state !== "requesting" && s.state !== "processing") return s;
      const text = `${s.text} ${s.interim}`.replace(/\s+/g, " ").trim();
      if (!text) return { state: a.reason === "timeout" ? "timeout" : "nospeech", interim: "", text: "" };
      return { state: a.reason === "timeout" ? "timeout" : "ready", interim: "", text };
    }
    case "error": {
      if (a.error === "not-allowed" || a.error === "service-not-allowed") return { ...initialDictation, state: "denied" };
      if (a.error === "network") return { ...s, state: "network", interim: "" };
      if (a.error === "no-speech") return { ...initialDictation, state: "nospeech" };
      if (a.error === "audio-capture") return { ...initialDictation, state: "unsupported" };
      return s; // "aborted": our own stop/abort — "end" follows
    }
    case "reset": return initialDictation;
    default: return s;
  }
}

/** onText(text) gets the recognised text once, when listening ends with something said. */
export function useDictation(lang: string, onText: (text: string) => void) {
  const [s, dispatch] = useReducer(dictationReducer, initialDictation);
  const rec = useRef<RecognitionLike | null>(null);
  const timers = useRef<{ silence?: ReturnType<typeof setTimeout>; max?: ReturnType<typeof setTimeout> }>({});
  const endReason = useRef<"stop" | "silence" | "timeout">("stop");
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const delivered = useRef(false);

  const clear = () => { clearTimeout(timers.current.silence); clearTimeout(timers.current.max); };
  const stop = useCallback((reason: "stop" | "silence" | "timeout" = "stop") => {
    endReason.current = reason;
    clear();
    try { rec.current?.stop(); } catch { /* already stopped */ }
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) { dispatch({ type: "error", error: "audio-capture" }); return; }
    if (rec.current) return;
    const r = new Ctor();
    r.lang = lang; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    let finals = "";
    endReason.current = "stop";
    delivered.current = false;
    r.onstart = () => {
      dispatch({ type: "listening" });
      clear();
      timers.current.max = setTimeout(() => stop("timeout"), VOICE_MAX_MS);
      timers.current.silence = setTimeout(() => stop("silence"), VOICE_NO_SPEECH_MS);
    };
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finals = `${finals} ${res[0].transcript}`; else interim += res[0].transcript;
      }
      dispatch({ type: "result", final: finals.trim(), interim: interim.trim() });
      clearTimeout(timers.current.silence); // quiet this long AFTER speech → done (pauses between words are fine)
      timers.current.silence = setTimeout(() => stop("silence"), VOICE_SILENCE_TIMEOUT_MS);
    };
    r.onerror = (e) => dispatch({ type: "error", error: e.error });
    r.onend = () => { clear(); rec.current = null; dispatch({ type: "end", reason: endReason.current }); };
    rec.current = r;
    dispatch({ type: "start" });
    try { r.start(); } catch { rec.current = null; dispatch({ type: "error", error: "audio-capture" }); }
  }, [lang, stop]);

  // hand the text over exactly once per recording
  useEffect(() => {
    if ((s.state === "ready" || s.state === "timeout") && s.text && !delivered.current) { delivered.current = true; onTextRef.current(s.text); }
  }, [s.state, s.text]);

  // panel closed / unmounted: the microphone is released at once
  useEffect(() => () => { clear(); try { rec.current?.abort(); } catch { /* */ } rec.current = null; }, []);

  return { ...s, start, stop: () => stop("stop"), reset: () => dispatch({ type: "reset" }) };
}
