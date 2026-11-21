// The agent panel's small typed i18n layer (no i18next: the app's src/i18n.ts is an unused stub). Promotable to the
// whole app later. Two settings, synced by default: `ui` (labels) and `reply` (what the agent answers in, sent as
// ChatRequest.language). Kept in an external store, so a switch re-renders only the text — no remount, the draft
// and the scroll position stay. Persisted in localStorage `a4ai.agent.lang` (wrapped: private mode can throw).
import { useCallback } from "react";
import { en } from "./en";
import { hi } from "./hi";
import { hinglish } from "./hinglish";
import type { AgentKey, AgentLang, Dict, Params, Plural, PluralKey } from "./types";

export * from "./types";

export * from "./lang";
import { agentLang, isAgentLang, useAgentLang } from "./lang";
export const DICTS: Record<AgentLang, Dict> = { hinglish: hinglish as unknown as Dict, en, hi };

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


/** { t, lang }: t is stable per language, so memoised children re-render only when the language changes. */
export function useAgentT(): { t: TFn; lang: AgentLang } {
  const lang = useAgentLang();
  const t = useCallback(((key: AgentKey, params?: Params) => translate(lang, key, params)) as TFn, [lang]);
  return { t, lang };
}

/** Non-React callers (store, pure helpers): the current UI language. */
export const tNow: TFn = ((key: AgentKey, params?: Params) => translate(agentLang.get().ui, key, params)) as TFn;
