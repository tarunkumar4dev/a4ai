// The voice session reducer (pure): what the dock shows. Wraps the push-to-talk machine (./ptt) with the transcript
// strip (auto-send countdown / "Maine suna … Sahi hai?" / clarify chips / "Dobara boliye") and the error line.
import { AUTO_SEND_PAUSE_MS, transition, type Event as PttEvent, type VoiceState } from "./ptt";

export type Notice =
  | { kind: "repeat" }                        // nothing usable: "Dobara boliye"
  | { kind: "confirm"; text: string }         // low confidence: "Maine suna: … Sahi hai?"
  | { kind: "pick"; text: string; question: string; chips: { label: string; value: string; hint?: string | null }[] }
  | { kind: "auto"; text: string; sendAt: number }  // sending after the pause unless Edit is tapped
  | { kind: "denied" }                        // mic permission refused
  | { kind: "unsupported" }                   // no MediaRecorder
  | { kind: "limit"; message: string; retryAt: number | null }
  | { kind: "down"; message: string }         // STT / network down: type instead
  | { kind: "network"; text: string | null }  // dropped mid-way: keep the transcript, offer retry / typing
  | null;

export interface VoiceSession {
  state: VoiceState;
  level: number;          // 0..1 for the meter
  transcript: string | null;
  notice: Notice;
  lastError: string | null;
}

export const initialSession: VoiceSession = { state: "idle", level: 0, transcript: null, notice: null, lastError: null };

export type SessionAction =
  | { type: "ptt"; ev: PttEvent; at?: number }
  | { type: "level"; rms: number }
  | { type: "transcript"; text: string; next: "auto" | "confirm" | "repeat" | "pick"; clarify?: { question: string; chips: { label: string; value: string; hint?: string | null }[] } | null; at?: number }
  | { type: "notice"; notice: Notice }
  | { type: "edit" }           // user tapped Edit on the auto-send strip
  | { type: "sent" }
  | { type: "clear" };

export function sessionReducer(s: VoiceSession, a: SessionAction): VoiceSession {
  const at = "at" in a && typeof a.at === "number" ? a.at : Date.now();
  switch (a.type) {
    case "ptt": {
      const t = transition(s.state, a.ev);
      const next: VoiceSession = { ...s, state: t.state };
      if (a.ev.type === "tap" && s.state === "idle") return { ...next, transcript: null, notice: null, lastError: null, level: 0 };
      if (t.action === "say_repeat") return { ...next, level: 0, notice: { kind: "repeat" } };
      if (t.action === "discard") return { ...next, level: 0, notice: { kind: "down", message: "Recording bahut lambi ho gayi. Chhota bol kar try karein." } };
      if (a.ev.type === "denied") return { ...next, level: 0, notice: { kind: "denied" } };
      if (a.ev.type === "error") return { ...next, level: 0 };
      if (t.state !== "listening") return { ...next, level: 0 };
      return next;
    }
    case "level": return s.state === "listening" ? { ...s, level: Math.min(1, Math.max(0, a.rms)) } : s;
    case "transcript": {
      const t = transition(s.state, { type: "transcript", next: a.next });
      const base: VoiceSession = { ...s, state: t.state, level: 0, transcript: a.text || null };
      if (a.next === "repeat") return { ...base, notice: { kind: "repeat" } };
      if (a.next === "pick" && a.clarify) return { ...base, notice: { kind: "pick", text: a.text, question: a.clarify.question, chips: a.clarify.chips } };
      if (a.next === "confirm") return { ...base, notice: { kind: "confirm", text: a.text } };
      return { ...base, state: "transcribing", notice: { kind: "auto", text: a.text, sendAt: at + AUTO_SEND_PAUSE_MS } };
    }
    case "notice": return { ...s, state: "idle", level: 0, notice: a.notice };
    case "edit": return { ...s, state: "idle", notice: null };
    case "sent": return { ...s, state: "thinking", notice: null };
    case "clear": return { ...initialSession };
    default: return s;
  }
}

/** Text for the one aria-live transcript region (also the caption for speech). Pure. */
export function liveText(s: VoiceSession, speech: string | null): string {
  if (s.state === "speaking" && speech) return speech;
  if (s.notice?.kind === "confirm") return `Maine suna: ${s.notice.text}. Sahi hai?`;
  if (s.notice?.kind === "repeat") return "Dobara boliye.";
  if (s.notice?.kind === "auto") return s.notice.text;
  if (s.notice?.kind === "pick") return s.notice.question;
  return s.transcript ?? "";
}
