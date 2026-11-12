// Voice preferences, per user, on this device only (v1): speaker, speed, mute, and the consent acceptance timestamp.
// Keys live under the agent's own prefix so sign-out (clearAgentStorage) removes them with everything else.
// No transcript, no audio, nothing from a conversation is ever stored here.
import { isSafeId } from "@/lib/agent/persist";

export const VOICE_PREFIX = "a4ai.agent.v3";  // same family as persist.ts → cleared on sign-out
export const PACES = [0.9, 1.0, 1.1] as const;
export type Pace = (typeof PACES)[number];

export interface VoicePrefs {
  speaker: string | null;   // registry id from GET /agent/voice/config (null = server default)
  pace: Pace;
  muted: boolean;           // spoken replies off (one tap)
  consentAt: string | null; // ISO timestamp of "Theek hai"
  consentVersion: string | null;
}

export const DEFAULT_PREFS: VoicePrefs = { speaker: null, pace: 1.0, muted: false, consentAt: null, consentVersion: null };

function store(): Storage | null {
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
}
const key = (uid: string) => `${VOICE_PREFIX}.${uid}.pref.voice`;

/** Pure: a stored blob → safe prefs (bad values fall back to defaults). */
export function parsePrefs(raw: unknown): VoicePrefs {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_PREFS };
  const r = raw as Record<string, unknown>;
  const pace = PACES.find((p) => p === r.pace) ?? 1.0;
  return {
    speaker: typeof r.speaker === "string" && /^[a-z0-9_]{1,64}$/.test(r.speaker) ? r.speaker : null,
    pace,
    muted: r.muted === true,
    consentAt: typeof r.consentAt === "string" && Number.isFinite(Date.parse(r.consentAt)) ? r.consentAt : null,
    consentVersion: typeof r.consentVersion === "string" && r.consentVersion.length <= 20 ? r.consentVersion : null,
  };
}

export function loadPrefs(uid: string | null | undefined): VoicePrefs {
  if (!uid || !isSafeId(uid)) return { ...DEFAULT_PREFS };
  try {
    const raw = store()?.getItem(key(uid));
    return raw ? parsePrefs(JSON.parse(raw)) : { ...DEFAULT_PREFS };
  } catch { return { ...DEFAULT_PREFS }; }
}

export function savePrefs(uid: string | null | undefined, prefs: VoicePrefs): void {
  if (!uid || !isSafeId(uid)) return;
  try { store()?.setItem(key(uid), JSON.stringify(parsePrefs(prefs))); } catch { /* blocked / full: prefs are optional */ }
}

/** Consent is per version of the data note: a new version asks again. Pure. */
export function hasConsent(p: VoicePrefs, version: string): boolean {
  return !!p.consentAt && p.consentVersion === version;
}

export function withConsent(p: VoicePrefs, version: string, now = new Date()): VoicePrefs {
  return { ...p, consentAt: now.toISOString(), consentVersion: version };
}
