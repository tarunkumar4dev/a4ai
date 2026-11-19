// The agent panel's small typed i18n layer (no i18next: the app's src/i18n.ts is an unused stub). Promotable to the
// whole app later. Two settings, synced by default: `ui` (labels) and `reply` (what the agent answers in, sent as
// ChatRequest.language). Kept in an external store, so a switch re-renders only the text — no remount, the draft
// and the scroll position stay. Persisted in localStorage `a4ai.agent.lang` (wrapped: private mode can throw).
import { useCallback, useSyncExternalStore } from "react";
import { en } from "./en";
import { hi } from "./hi";
import { hinglish } from "./hinglish";
import { AGENT_LANGS, DEFAULT_AGENT_LANG, type AgentKey, type AgentLang, type Dict, type Params, type Plural, type PluralKey } from "./types";

export * from "./types";

export const LANG_STORAGE_KEY = "a4ai.agent.lang";
export const DICTS: Record<AgentLang, Dict> = { hinglish: hinglish as unknown as Dict, en, hi };

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

const fill = (tpl: string, p?: Params) => (p ? tpl.replace(/\{(\w+)\}/g, (m, k: string) => (k in p ? String(p[k]) : m)) : tpl);
const rules = new Map<string, Intl.PluralRules>();
const pluralRule = (l: AgentLang) => {
  const loc = l === "en" ? "en-IN" : "hi-IN";
  let r = rules.get(loc);
  if (!r) { r = new Intl.PluralRules(loc); rules.set(loc, r); }
  return r;
};
const numFmt = new Intl.NumberFormat("en-IN");
export const formatNumber = (n: number) => numFmt.format(n);

/** Pure translate: key → text in `lang`, {placeholders} filled; plural keys need params.n. Falls back to Hinglish. */
export function translate(lang: AgentLang, key: AgentKey, params?: Params): string {
  const v = (DICTS[lang] as Record<string, string | Plural>)[key] ?? (DICTS.hinglish as Record<string, string | Plural>)[key];
  if (typeof v === "string") return fill(v, params);
  const n = Number(params?.n ?? 0);
  const form = pluralRule(lang).select(n) === "one" ? v.one : v.other;
  return fill(form, { ...params, n: typeof params?.n === "number" ? formatNumber(params.n) : String(params?.n ?? 0) });
}
/** t(key, params): plural keys (PluralKey) take params.n. */
export type TFn = (key: AgentKey, params?: Params) => string;
export type { PluralKey };

export function useAgentLang(): AgentLang {
  return useSyncExternalStore(agentLang.subscribe, () => get().ui, () => DEFAULT_AGENT_LANG);
}

/** { t, lang }: t is stable per language, so memoised children re-render only when the language changes. */
export function useAgentT(): { t: TFn; lang: AgentLang } {
  const lang = useAgentLang();
  const t = useCallback(((key: AgentKey, params?: Params) => translate(lang, key, params)) as TFn, [lang]);
  return { t, lang };
}

/** Non-React callers (store, pure helpers): the current UI language. */
export const tNow: TFn = ((key: AgentKey, params?: Params) => translate(get().ui, key, params)) as TFn;
