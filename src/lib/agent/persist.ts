// What the a4ai Agent keeps on this device — and what it never does.
// The SERVER owns chats, messages, feedback and query history. Locally we keep only UI prefs, per user:
//   a4ai.agent.v3.<uid>.pref.historyCollapsed = "1" | "0"
//   a4ai.agent.v3.<uid>.pref.lastSession      = <session id>   (to reopen the last chat after a refresh)
// Never: message text, answers, feedback notes, recent queries, drafts — not in localStorage, sessionStorage or
// IndexedDB. Older builds (v1/v2) cached chat content under a4ai.agent.v1.* (and the mock under a4ai.agent.mock.v2):
// `purgeLegacyAgentStorage` deletes those on start. Sign-out / user switch → `clearAgentStorage`.
// Every storage call is wrapped in try/catch: a blocked or full storage just means "no prefs".
export const PREFIX = "a4ai.agent.v3";
const ALL_AGENT_KEYS = "a4ai.agent.";

function ls(): Storage | null {
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
}
function ss(): Storage | null {
  try { return typeof window !== "undefined" ? window.sessionStorage : null; } catch { return null; }
}

export type PrefName = "historyCollapsed" | "lastSession";
const prefKey = (uid: string, name: PrefName) => `${PREFIX}.${uid}.pref.${name}`;

export function loadPref(uid: string, name: PrefName): string | null {
  try { return ls()?.getItem(prefKey(uid, name)) ?? null; } catch { return null; }
}
export function savePref(uid: string, name: PrefName, value: string | null) {
  try {
    const s = ls();
    if (!s) return;
    if (value === null) s.removeItem(prefKey(uid, name)); else s.setItem(prefKey(uid, name), value);
  } catch { /* blocked / full: prefs are optional */ }
}

/** Only ids go into prefs (a session id is a uuid/hex; never text). */
export const isSafeId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-zA-Z_-]{8,80}$/.test(v);

function removeMatching(store: Storage | null, match: (k: string) => boolean) {
  if (!store) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && match(k)) keys.push(k); }
    keys.forEach((k) => { try { store.removeItem(k); } catch { /* ignore */ } });
  } catch { /* ignore */ }
}

/** Sign-out / user switch: every agent key on this device (all users, all versions), both storages. */
export function clearAgentStorage() {
  removeMatching(ls(), (k) => k.startsWith(ALL_AGENT_KEYS));
  removeMatching(ss(), (k) => k.startsWith(ALL_AGENT_KEYS));
}

/** Content written by older builds (chat caches, the v2 sign-in draft, the v2 mock DB). Run once per page load. */
let purged = false;
export function purgeLegacyAgentStorage() {
  if (purged) return;
  purged = true;
  removeMatching(ls(), (k) => k.startsWith(ALL_AGENT_KEYS) && !k.startsWith(`${PREFIX}.`));
  removeMatching(ss(), (k) => k.startsWith(ALL_AGENT_KEYS));
}

/** Tests only. */
export const _resetPurgeFlag = () => { purged = false; };

/** "Sharma ma'am ki attendance kya hai?" → first line, max 60 chars (a fallback title before the server's). */
export function titleFrom(text: string): string {
  const line = text.trim().split(/\n/)[0].replace(/\s+/g, " ").trim();
  if (!line) return "New chat";
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line;
}
