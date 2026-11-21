import type { hinglish } from "./hinglish";

export type AgentLang = "en" | "hi" | "hinglish";
export const AGENT_LANGS: readonly AgentLang[] = ["hinglish", "en", "hi"] as const;
export const DEFAULT_AGENT_LANG: AgentLang = "hinglish";

export interface Plural { one: string; other: string }
type Src = typeof hinglish;
export type AgentKey = keyof Src;
/** Every language has exactly the Hinglish key set; plural keys stay plural. A missing / extra key fails tsc. */
export type Dict = { [K in AgentKey]: Src[K] extends string ? string : Plural };
export type PluralKey = { [K in AgentKey]: Src[K] extends string ? never : K }[AgentKey];
export type Params = Record<string, string | number>;
