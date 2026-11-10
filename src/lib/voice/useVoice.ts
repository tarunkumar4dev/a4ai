// The voice orchestrator (lazy chunk): mic → recorder → POST /agent/voice/transcribe → transcript strip →
// agentStore.sendVoice → the normal stream → `speech` event → TTS audio (or speechSynthesis on a slow network).
// Everything the UI shows comes from the pure reducer in ./session; this hook only wires the browser APIs.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AgentHttpError } from "@/lib/agent/client";
import { agentStore, useAgentStore } from "@/lib/agent/store";
import { useAgentQueryClient } from "@/lib/agent/queries";
import type { VoiceConfig } from "@/lib/agent/types";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { idempotencyKey, speak, transcribe, voiceConfig } from "./api";
import { createPlayer, synthLang, synthSupported, type Player } from "./player";
import { AUTO_SEND_PAUSE_MS, MAX_BYTES, liteVoice, recordingSupported } from "./ptt";
import { hasConsent, loadPrefs, savePrefs, withConsent, type VoicePrefs } from "./prefs";
import { MicDenied, MicUnsupported, startRecording, type Recording } from "./recorder";
import { initialSession, liveText, sessionReducer, type VoiceSession } from "./session";
import { onVoiceStartRequest } from "./surface";

export interface Voice {
  session: VoiceSession;
  config: VoiceConfig | null;        // null while loading / when voice is off
  enabled: boolean;                  // config.enabled && browser can record
  supported: boolean;
  lite: boolean;                     // slow network: no meter, speechSynthesis
  prefs: VoicePrefs;
  needsConsent: boolean;
  speech: string | null;             // caption of what is being read out
  tap: () => void;                   // the mic button
  holdStart: () => void; holdEnd: () => void; // desktop Space-to-talk
  acceptConsent: () => void;
  setPrefs: (p: Partial<VoicePrefs>) => void;
  edit: () => void;                  // auto-send strip → put the transcript in the box instead
  confirmSend: () => void;           // "Sahi hai" → send now
  pick: (value: string) => void;     // clarify chip from the transcript step
  retry: () => void;                 // network drop → send the kept transcript again
  typeInstead: () => void;           // put the transcript in the box, clear the strip
  liveText: string;
  busy: boolean;
}

const connection = () => (typeof navigator === "undefined" ? null : (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean; rtt?: number; downlink?: number } }).connection ?? null);

export function useVoice(uid: string | null): Voice {
  const store = useAgentStore(uid ?? "anon", useAgentQueryClient());
  const net = useNetworkStatus();
  const [session, dispatch] = useReducer(sessionReducer, initialSession);
  const [config, setConfig] = useState<VoiceConfig | null>(null);
  const [prefs, setPrefsState] = useState<VoicePrefs>(() => loadPrefs(uid));
  const rec = useRef<Recording | null>(null);
  const player = useRef<Player | null>(null);
  const autoSend = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const upload = useRef<AbortController | null>(null);
  const voiceTurn = useRef(false);          // the running stream is a voice turn → speak its answer
  const spokenFor = useRef<string | null>(null);
  const supported = useMemo(() => recordingSupported(), []);
  const lite = net === "slow" || liteVoice(connection());

  useEffect(() => { setPrefsState(loadPrefs(uid)); }, [uid]);
  useEffect(() => {
    if (!uid) return;
    const ac = new AbortController();
    voiceConfig(ac.signal).then(setConfig).catch(() => setConfig(null));
    return () => ac.abort();
  }, [uid]);
  useEffect(() => () => { rec.current?.cancel(); player.current?.stop(); clearTimeout(autoSend.current); upload.current?.abort(); }, []);

  const enabled = !!config?.enabled && supported;
  const needsConsent = enabled && !hasConsent(prefs, config?.consent_version ?? "");

  const setPrefs = useCallback((p: Partial<VoicePrefs>) => {
    setPrefsState((prev) => { const next = { ...prev, ...p }; savePrefs(uid, next); return next; });
  }, [uid]);
  const acceptConsent = useCallback(() => {
    setPrefsState((prev) => { const next = withConsent(prev, config?.consent_version ?? ""); savePrefs(uid, next); return next; });
  }, [uid, config?.consent_version]);

  // ---- speak the answer of a voice turn -------------------------------------------------------------------------
  const last = store.chat.turns[store.chat.turns.length - 1];
  const lastSpeech = last?.role === "assistant" && last.done ? last.speech ?? null : null;
  useEffect(() => {
    if (store.chat.busy || !voiceTurn.current || !last || last.role !== "assistant" || !last.done) return;
    voiceTurn.current = false;
    const speech = last.speech;
    const spoken = speech?.text ?? (last.blocks.find((b) => b.kind === "clarify") ? "Kaun sa? Screen par chuniye." : null);
    if (!spoken || prefs.muted || spokenFor.current === last.id) { dispatch({ type: "ptt", ev: { type: "answer_done", speech: false } }); return; }
    spokenFor.current = last.id;
    dispatch({ type: "ptt", ev: { type: "answer_done", speech: true } });
    const p = (player.current ??= createPlayer());
    const lang = speech?.language ?? "hi-en";
    void (async () => {
      try {
        if (!lite && config?.tts === "sarvam") {
          const blob = await speak({ text: spoken, language: lang as "hi" | "en" | "hi-en", speaker: prefs.speaker, pace: prefs.pace });
          if (blob) { await p.play(blob); return; }
        }
        if (synthSupported()) await p.play({ synth: spoken, lang: synthLang(lang), rate: prefs.pace });
      } catch { /* caption stays on screen */ }
      finally { dispatch({ type: "ptt", ev: { type: "speech_done" } }); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.chat.busy, last?.id, last?.done]);

  // ---- send -------------------------------------------------------------------------------------------------------
  const sendNow = useCallback((text: string) => {
    clearTimeout(autoSend.current);
    if (!text.trim()) return;
    voiceTurn.current = true;
    dispatch({ type: "sent" });
    agentStore.sendVoice(text);
  }, []);

  // ---- record → upload ----------------------------------------------------------------------------------------------
  const finishRecording = useCallback(async (r: Recording) => {
    dispatch({ type: "ptt", ev: { type: "tap" } }); // listening → transcribing, before anything else
    const blob = await r.stop();
    rec.current = null;
    if (!blob.size) { dispatch({ type: "ptt", ev: { type: "silence", empty: true } }); return; }
    if (blob.size > MAX_BYTES) { dispatch({ type: "ptt", ev: { type: "recorded", bytes: blob.size } }); return; }
    dispatch({ type: "ptt", ev: { type: "recorded", bytes: blob.size } });
    const ac = new AbortController();
    upload.current = ac;
    try {
      const t = await transcribe(blob, r.mimeType.split(";")[0], idempotencyKey(), ac.signal);
      const next = t.next ?? (t.clarify ? "pick" : "auto");
      dispatch({ type: "transcript", text: t.transcript, next, clarify: t.clarify ? { question: t.clarify.question, chips: t.clarify.chips } : null });
      if (next === "auto") {
        clearTimeout(autoSend.current);
        autoSend.current = setTimeout(() => sendNow(t.transcript), AUTO_SEND_PAUSE_MS);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof AgentHttpError) {
        if (err.status === 429) dispatch({ type: "notice", notice: { kind: "limit", message: err.message, retryAt: err.retryAfterSec ? Date.now() + err.retryAfterSec * 1000 : null } });
        else if (err.status === 503 || err.status === 403) dispatch({ type: "notice", notice: { kind: "down", message: err.message } });
        else if (err.status === 413 || err.status === 415 || err.status === 422) dispatch({ type: "notice", notice: { kind: "down", message: err.message } });
        else dispatch({ type: "notice", notice: { kind: "network", text: null } });
      } else dispatch({ type: "notice", notice: { kind: "network", text: null } });
    } finally {
      if (upload.current === ac) upload.current = null;
    }
  }, [sendNow]);

  const begin = useCallback(async () => {
    if (!enabled || store.chat.busy || rec.current) return;
    player.current?.stop();
    dispatch({ type: "ptt", ev: { type: "tap" } }); // idle → listening at once
    try {
      const r = await startRecording({
        meter: !lite,
        onLevel: (rms) => dispatch({ type: "level", rms }),
        onAutoStop: (reason) => {
          const cur = rec.current;
          if (!cur) return;
          if (reason === "empty") { rec.current = null; cur.cancel(); dispatch({ type: "ptt", ev: { type: "silence", empty: true } }); return; }
          void finishRecording(cur);
        },
      });
      rec.current = r;
    } catch (e) {
      if (e instanceof MicDenied) dispatch({ type: "ptt", ev: { type: "denied" } });
      else if (e instanceof MicUnsupported) dispatch({ type: "notice", notice: { kind: "unsupported" } });
      else dispatch({ type: "ptt", ev: { type: "error" } });
    }
  }, [enabled, lite, store.chat.busy, finishRecording]);

  const tap = useCallback(() => {
    if (session.state === "listening" && rec.current) { void finishRecording(rec.current); return; }
    if (session.state === "speaking") { player.current?.stop(); dispatch({ type: "ptt", ev: { type: "tap" } }); return; }
    if (session.state === "idle") void begin();
  }, [session.state, begin, finishRecording]);

  // floating mic (mobile dashboards) opens the sheet and asks the dock to start
  useEffect(() => onVoiceStartRequest(() => { if (session.state === "idle") void begin(); }), [session.state, begin]);

  const holdStart = useCallback(() => { if (session.state === "idle") void begin(); }, [session.state, begin]);
  const holdEnd = useCallback(() => { if (session.state === "listening" && rec.current) void finishRecording(rec.current); }, [session.state, finishRecording]);

  const edit = useCallback(() => {
    clearTimeout(autoSend.current);
    const text = session.notice?.kind === "auto" || session.notice?.kind === "confirm" ? session.notice.text : session.transcript;
    dispatch({ type: "edit" });
    if (text) agentStore.prefill(text);
  }, [session]);
  const confirmSend = useCallback(() => {
    const text = session.notice?.kind === "confirm" || session.notice?.kind === "auto" ? session.notice.text : session.transcript;
    if (text) sendNow(text);
  }, [session, sendNow]);
  const pick = useCallback((value: string) => sendNow(value), [sendNow]);
  const retry = useCallback(() => { const t = session.transcript; if (t) sendNow(t); }, [session.transcript, sendNow]);
  const typeInstead = useCallback(() => { clearTimeout(autoSend.current); const t = session.transcript; dispatch({ type: "clear" }); if (t) agentStore.prefill(t); }, [session.transcript]);

  // a network failure of the voice turn itself: keep the transcript, offer retry / typing
  useEffect(() => {
    if (store.chat.busy || !voiceTurn.current || !last || last.role !== "assistant" || !last.done) return;
    const err = last.blocks.find((b) => b.kind === "error");
    if (err && err.kind === "error" && (err.code === "network" || err.code === "offline")) {
      voiceTurn.current = false;
      dispatch({ type: "notice", notice: { kind: "network", text: store.chat.lastUserText } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.chat.busy, last?.id]);

  const speech = session.state === "speaking" ? lastSpeech?.text ?? null : null;
  return {
    session, config, enabled, supported, lite, prefs, needsConsent, speech, tap, holdStart, holdEnd, acceptConsent, setPrefs,
    edit, confirmSend, pick, retry, typeInstead, liveText: liveText(session, speech), busy: store.chat.busy,
  };
}
