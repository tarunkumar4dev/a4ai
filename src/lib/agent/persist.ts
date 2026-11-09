// Local chat history for the a4ai Agent (this device only, per signed-in user). Every storage call is wrapped in
// try/catch: private windows, blocked site data or a full quota just mean "no history", never a crash.
// Keys: a4ai.agent.v1.<uid>.index  = { chats: ChatMeta[], hidden: string[], activeKey }
//       a4ai.agent.v1.<uid>.chat.<key> = { v: 1, sessionId, turns }
// Caps: 30 chats, 60 turns and ~250 KB per chat (oldest turns dropped first). Cleared on sign-out.
import type { ChatState, ChatTurn } from "./chatState";

export interface ChatMeta {
  key: string; sessionId: string | null; title: string; createdAt: number; updatedAt: number;
  /** the user renamed it — a server title never overrides it */ renamed?: boolean;
}
export interface ChatIndex { chats: ChatMeta[]; hidden: string[]; activeKey: string | null }

export const PREFIX = "a4ai.agent.v1";
export const MAX_CHATS = 30;
export const MAX_TURNS = 60;
export const MAX_CHAT_BYTES = 250_000;

const indexKey = (uid: string) => `${PREFIX}.${uid}.index`;
const chatKey = (uid: string, key: string) => `${PREFIX}.${uid}.chat.${key}`;

function ls(): Storage | null {
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
}
export function readJson(k: string): unknown {
  try { const raw = ls()?.getItem(k); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function writeRaw(k: string, v: string): boolean {
  try { const s = ls(); if (!s) return false; s.setItem(k, v); return true; } catch { return false; }
}
function remove(k: string) { try { ls()?.removeItem(k); } catch { /* ignore */ } }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** "Sharma ma'am ki attendance kya hai?" → first line, max 60 chars. */
export function titleFrom(text: string): string {
  const line = text.trim().split(/\n/)[0].replace(/\s+/g, " ").trim();
  if (!line) return "New chat";
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line;
}

export function loadIndex(uid: string): ChatIndex {
  const raw = readJson(indexKey(uid));
  if (!isObj(raw)) return { chats: [], hidden: [], activeKey: null };
  const chats = (Array.isArray(raw.chats) ? raw.chats : []).filter((c): c is ChatMeta =>
    isObj(c) && typeof c.key === "string" && typeof c.title === "string" && typeof c.updatedAt === "number")
    .map((c) => ({ ...c, sessionId: typeof c.sessionId === "string" ? c.sessionId : null, createdAt: typeof c.createdAt === "number" ? c.createdAt : c.updatedAt }));
  const hidden = (Array.isArray(raw.hidden) ? raw.hidden : []).filter((h): h is string => typeof h === "string").slice(-200);
  return { chats, hidden, activeKey: typeof raw.activeKey === "string" ? raw.activeKey : null };
}

/** Saves the index; chats beyond MAX_CHATS (oldest first) are dropped together with their turns. */
export function saveIndex(uid: string, index: ChatIndex): ChatIndex {
  const sorted = [...index.chats].sort((a, b) => b.updatedAt - a.updatedAt);
  const keep = sorted.slice(0, MAX_CHATS);
  for (const c of sorted.slice(MAX_CHATS)) remove(chatKey(uid, c.key));
  const next = { ...index, chats: keep };
  writeRaw(indexKey(uid), JSON.stringify(next));
  return next;
}

/** JSON for one chat, trimmed to the caps. Pure (exported for tests). */
export function serializeChat(state: ChatState): string {
  let turns = state.turns.slice(-MAX_TURNS);
  if (turns[0]?.role === "assistant") turns = turns.slice(1);
  let json = JSON.stringify({ v: 1, sessionId: state.sessionId, turns });
  while (json.length > MAX_CHAT_BYTES && turns.length > 2) {
    turns = turns.slice(2);
    json = JSON.stringify({ v: 1, sessionId: state.sessionId, turns });
  }
  return json;
}

/** A chat read back from storage: never busy; an interrupted stream / approval becomes a settled state. Pure. */
export function normalizeLoaded(raw: unknown): ChatState | null {
  if (!isObj(raw) || raw.v !== 1 || !Array.isArray(raw.turns)) return null;
  const turns = (raw.turns as unknown[]).filter((t): t is ChatTurn =>
    isObj(t) && typeof t.id === "string" && (t.role === "user" || t.role === "assistant") && Array.isArray(t.blocks))
    .map((t) => ({
      ...t,
      at: typeof t.at === "number" ? t.at : 0,
      done: true,
      steps: (t.steps ?? []).map((s) => (s.status === "running" ? { ...s, status: "stopped" as const } : s)),
      blocks: t.blocks.map((b) => (b.kind === "approval" && b.state === "approving"
        ? { ...b, state: "failed" as const, error: "Page reload hua, approval ka result pata nahi. Pehle check karein, phir dobara Approve karein." }
        : b)),
    }));
  const lastUser = [...turns].reverse().find((t) => t.role === "user");
  return { turns, status: null, busy: false, sessionId: typeof raw.sessionId === "string" ? raw.sessionId : null, lastUserText: lastUser?.text ?? null };
}

export function loadChat(uid: string, key: string): ChatState | null {
  return normalizeLoaded(readJson(chatKey(uid, key)));
}

/** false when storage is unavailable or full (the chat still works in memory). */
export function saveChat(uid: string, key: string, state: ChatState): boolean {
  return writeRaw(chatKey(uid, key), serializeChat(state));
}

export function removeChat(uid: string, key: string) { remove(chatKey(uid, key)); }

/** Sign-out: drop every agent key of this user from this device. */
export function clearUser(uid: string) {
  const s = ls();
  if (!s) return;
  try {
    const mine = `${PREFIX}.${uid}.`;
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k && k.startsWith(mine)) keys.push(k); }
    keys.forEach(remove);
  } catch { /* ignore */ }
}

// ---- typed text that must survive a sign-in (session expired → sign in again → back here) ---------------
// sessionStorage (this tab only, gone when the tab closes); written ONLY when the user presses "Sign in again".
const PENDING_DRAFT = "a4ai.agent.pendingDraft";

export function savePendingDraft(text: string) {
  try { if (text.trim()) sessionStorage.setItem(PENDING_DRAFT, text.slice(0, 4000)); } catch { /* blocked */ }
}

/** Read + clear. */
export function takePendingDraft(): string | null {
  try {
    const v = sessionStorage.getItem(PENDING_DRAFT);
    sessionStorage.removeItem(PENDING_DRAFT);
    return v && v.trim() ? v : null;
  } catch { return null; }
}

// ---- small per-user UI prefs (history panel collapsed) ----------------------------------------------------
export function loadPref(uid: string, name: string): string | null {
  try { return ls()?.getItem(`${PREFIX}.${uid}.pref.${name}`) ?? null; } catch { return null; }
}
export function savePref(uid: string, name: string, value: string) { writeRaw(`${PREFIX}.${uid}.pref.${name}`, value); }
