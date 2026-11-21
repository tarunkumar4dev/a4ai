// The panel language (no dictionaries here, so the eager launcher can read it without pulling ~45 KB of strings
// into the initial bundle). Persisted in localStorage `a4ai.agent.lang`; ui + reply synced.
import { useSyncExternalStore } from "react";
import { AGENT_LANGS, DEFAULT_AGENT_LANG, type AgentLang } from "./types";

export const LANG_STORAGE_KEY = "a4ai.agent.lang";

/** Option labels: always in their own script, never translated. Short codes for the header button. */
export const LANG_NAMES: Record<AgentLang, { name: string; code: string }> = {
  en: { name: "English", code: "EN" },
  hi: { name: "हिन्दी", code: "हि" },
  hinglish: { name: "Hinglish", code: "Hx" },
};

export const isAgentLang = (v: unknown): v is AgentLang => typeof v === "string" && (AGENT_LANGS as readonly string[]).includes(v);

/** BCP 47 tag for the `lang` attribute (screen readers, hyphenation, font choice). Hinglish = Hindi in Latin script. */
export const htmlLang = (l: AgentLang) => (l === "en" ? "en" : l === "hi" ? "hi" : "hi-Latn");
/** Intl locale for dates / relative times. Numbers always use Western digits with en-IN grouping. */
export const intlLocale = (l: AgentLang) => (l === "hi" ? "hi-IN" : "en-IN");
/** Speech-recognition hint: Hinglish is spoken Hindi with English words, which hi-IN models handle best. */
export const speechLang = (l: AgentLang) => (l === "en" ? "en-IN" : "hi-IN");

function readStored(): AgentLang {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(LANG_STORAGE_KEY) : null;
    return isAgentLang(v) ? v : DEFAULT_AGENT_LANG;
  } catch {
    return DEFAULT_AGENT_LANG;
  }
}

interface LangState { ui: AgentLang; reply: AgentLang }
let state: LangState | null = null;
const listeners = new Set<() => void>();
const get = (): LangState => (state ??= (() => { const l = readStored(); return { ui: l, reply: l }; })());

export const agentLang = {
  get: get,
  /** what the agent should answer in (ChatRequest.language) */
  reply: (): AgentLang => get().reply,
  /** switch both (they are synced by default) */
  set(l: AgentLang) {
    if (!isAgentLang(l)) return;
    const cur = get();
    if (cur.ui === l && cur.reply === l) return;
    state = { ui: l, reply: l };
    try { localStorage.setItem(LANG_STORAGE_KEY, l); } catch { /* private mode: the choice lasts this tab only */ }
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  /** tests */
  reset() { state = null; listeners.forEach((fn) => fn()); },
};


export function useAgentLang(): AgentLang {
  return useSyncExternalStore(agentLang.subscribe, () => get().ui, () => DEFAULT_AGENT_LANG);
}
