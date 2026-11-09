// Google-style suggestions for the agent input (pure): match scoring, merge + rank of server suggestions with the
// local recent list and role templates, the highlighted parts, and the combobox keyboard rules.
import type { QueryHistoryItem, Suggestion, SuggestionType } from "./types";

export interface SuggestOption {
  /** stable id for aria-activedescendant / React keys */ key: string;
  type: SuggestionType; text: string; hint: string | null;
  /** recent items: history id, used by the X button */ historyId: string | null;
  section: "recent" | "try" | "match";
}

export const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const tokens = (q: string) => norm(q).split(" ").filter(Boolean);

/** Higher = better; -1 = not a match. Exact > starts with > a word starts with > contains > every word contained. */
export function matchScore(text: string, q: string): number {
  const t = norm(text), n = norm(q);
  if (!n) return 0;
  if (t === n) return 1000;
  if (t.startsWith(n)) return 800 - Math.min(t.length, 200) / 10;
  if (t.split(/[\s\-–·,()/]+/).some((w) => w.startsWith(n))) return 600 - Math.min(t.length, 200) / 10;
  if (t.includes(n)) return 400 - Math.min(t.length, 200) / 10;
  const ws = tokens(q);
  if (ws.length > 1 && ws.every((w) => t.includes(w))) return 200 - Math.min(t.length, 200) / 10;
  return -1;
}

const TYPE_RANK: Record<SuggestionType, number> = { recent: 0, entity: 1, template: 2 };
const keyOf = (type: SuggestionType, text: string) => `${type}:${norm(text)}`;

/**
 * Typed query → merged list: server suggestions + matching local recent + matching templates, one row per text
 * (recent wins, an entity's hint is kept), sorted by match score, then type (recent, entity, template), then the
 * order the server sent. Pure.
 */
export function rankSuggestions(q: string, input: { server: Suggestion[]; recent: QueryHistoryItem[]; templates: string[] }, limit = 8): SuggestOption[] {
  const n = norm(q);
  if (!n) return [];
  type Cand = SuggestOption & { score: number; order: number };
  const byText = new Map<string, Cand>();
  let order = 0;
  const offer = (type: SuggestionType, text: string, hint: string | null, historyId: string | null) => {
    const score = matchScore(text, q);
    // the server may match on things we can't see (aliases, roll numbers): keep its rows, just rank them lower
    const s = score < 0 ? (type === "entity" ? 100 : -1) : score;
    if (s < 0) return;
    const k = norm(text);
    const prev = byText.get(k);
    const cand: Cand = { key: keyOf(type, text), type, text, hint, historyId, section: "match", score: s, order: order++ };
    if (!prev) { byText.set(k, cand); return; }
    const winner = TYPE_RANK[type] < TYPE_RANK[prev.type] ? cand : prev;
    byText.set(k, { ...winner, hint: winner.hint ?? (winner === cand ? prev.hint : cand.hint), historyId: winner.historyId ?? (winner === cand ? prev.historyId : cand.historyId), score: Math.max(prev.score, s) });
  };
  for (const s of input.server) offer(s.type, s.text, s.hint ?? null, s.type === "recent" ? s.id ?? null : null);
  for (const r of input.recent) offer("recent", r.text, null, r.id);
  for (const t of input.templates) offer("template", t, null, null);
  return [...byText.values()]
    .sort((a, b) => b.score - a.score || TYPE_RANK[a.type] - TYPE_RANK[b.type] || a.order - b.order)
    .slice(0, limit)
    .map(({ score: _s, order: _o, ...o }) => o);
}

/** Empty input → "Recent" (≤ 6, newest first) then "Try" templates not already in Recent. Pure. */
export function idleOptions(recent: QueryHistoryItem[], templates: string[], maxRecent = 6, maxTry = 4): SuggestOption[] {
  const rec = recent.slice(0, maxRecent).map((r): SuggestOption => ({ key: `recent:${r.id}`, type: "recent", text: r.text, hint: null, historyId: r.id, section: "recent" }));
  const seen = new Set(rec.map((r) => norm(r.text)));
  const tries = templates.filter((t) => !seen.has(norm(t))).slice(0, maxTry)
    .map((t): SuggestOption => ({ key: keyOf("template", t), type: "template", text: t, hint: null, historyId: null, section: "try" }));
  return [...rec, ...tries];
}

export interface Part { text: string; match: boolean }

/** Text split into matched / unmatched parts for <mark>: every query word, case-insensitive, overlaps merged. */
export function highlightParts(text: string, q: string): Part[] {
  const words = [...new Set(tokens(q))].sort((a, b) => b.length - a.length);
  if (!words.length || !text) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const hit = new Array<boolean>(text.length).fill(false);
  for (const w of words) {
    let i = lower.indexOf(w);
    while (i !== -1) {
      for (let j = i; j < i + w.length; j++) hit[j] = true;
      i = lower.indexOf(w, i + w.length);
    }
  }
  const parts: Part[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.match === hit[i]) last.text += text[i];
    else parts.push({ text: text[i], match: hit[i] });
  }
  return parts;
}

// ---- keyboard (combobox) ---------------------------------------------------------------------------
export type ComboAction =
  | { type: "move"; active: number }
  | { type: "run"; index: number }
  | { type: "fill"; index: number }
  | { type: "close" }
  | { type: "open" }
  | { type: "none" };

export interface ComboKey {
  key: string; shiftKey?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; isComposing?: boolean;
  /** caret is at the end of the input with nothing selected (Right-arrow fills only then) */ caretAtEnd: boolean;
}

/**
 * What a key does while the input has focus. `active` = highlighted option (-1 = none: the input itself).
 * Down/Up move (Down from the last option goes back to the input, Up from the input to the last option);
 * Enter on an option runs it; Tab / Right-arrow (caret at the end) fill the input with it; Esc closes.
 * "none" = let the browser / composer handle the key (Enter with no option = send the typed text).
 */
export function comboKey(e: ComboKey, open: boolean, active: number, count: number): ComboAction {
  if (e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return { type: "none" };
  if (!open) return e.key === "ArrowDown" && count > 0 ? { type: "open" } : { type: "none" };
  switch (e.key) {
    case "ArrowDown":
      if (!count) return { type: "none" };
      return { type: "move", active: active >= count - 1 ? -1 : active + 1 };
    case "ArrowUp":
      if (!count) return { type: "none" };
      return { type: "move", active: active <= -1 ? count - 1 : active - 1 };
    case "Enter":
      if (e.shiftKey) return { type: "none" };
      return active >= 0 && active < count ? { type: "run", index: active } : { type: "none" };
    case "Tab":
      if (e.shiftKey) return { type: "none" };
      return active >= 0 && active < count ? { type: "fill", index: active } : { type: "none" };
    case "ArrowRight":
      return active >= 0 && active < count && e.caretAtEnd ? { type: "fill", index: active } : { type: "none" };
    case "Escape":
      return { type: "close" };
    default:
      return { type: "none" };
  }
}
