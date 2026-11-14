// Flashcard progress on THIS device, per user: each card is "known" or "learning" (or untouched = new).
// Marking again replaces the state (no double counting). The old app kept one global set under
// "flashcardMastered" keyed by the repeating raw card ids; it is imported once per user — every card with such a
// raw id becomes "known", exactly what the old screen showed.
import { createDeviceStore, dayOf } from "@/lib/deviceStore";
import { allCards, type Deck } from "@/lib/flashcardData";

export type CardState = "known" | "learning";
export interface CardEntry { s: CardState; t: number }
export interface LastDeck { cls: string; subject: string; index: number; card: number; t: number }
export interface FlashcardStore { v: 1; cards: Record<string, CardEntry>; last: LastDeck | null; migrated: boolean }

const EMPTY: FlashcardStore = { v: 1, cards: {}, last: null, migrated: false };
const store = createDeviceStore<FlashcardStore>("a4ai_flashcards_v1_", EMPTY, (p) => {
  const o = p as Partial<FlashcardStore> | null;
  return o && o.v === 1 && o.cards && typeof o.cards === "object"
    ? { v: 1, cards: o.cards, last: o.last ?? null, migrated: o.migrated === true } : null;
});

export const getFlashcardProgress = store.get;
export const useFlashcardProgress = store.use;

export function setCardState(uid: string | null, key: string, s: CardState, now = Date.now()) {
  store.update(uid, (cur) => ({ ...cur, cards: { ...cur.cards, [key]: { s, t: now } } }));
}

export function clearCardState(uid: string | null, key: string) {
  store.update(uid, (cur) => {
    if (!cur.cards[key]) return cur;
    const cards = { ...cur.cards };
    delete cards[key];
    return { ...cur, cards };
  });
}

export function setLastDeck(uid: string | null, last: Omit<LastDeck, "t">, now = Date.now()) {
  const cur = store.get(uid).last;
  if (cur && cur.cls === last.cls && cur.subject === last.subject && cur.index === last.index && cur.card === last.card) return;
  store.update(uid, (s) => ({ ...s, last: { ...last, t: now } }));
}

/** One-time import of the old global "flashcardMastered" list (raw ids) into this user's store. */
export function migrateLegacyMastered(uid: string | null, now = Date.now()) {
  const cur = store.get(uid);
  if (cur.migrated) return;
  let ids: string[] = [];
  try { const raw = localStorage.getItem("flashcardMastered"); ids = raw ? (JSON.parse(raw) as unknown[]).map(String) : []; } catch { ids = []; }
  const set = new Set(ids);
  const cards = { ...cur.cards };
  if (set.size) for (const c of allCards()) if (set.has(c.rawId) && !cards[c.key]) cards[c.key] = { s: "known", t: now };
  store.set(uid, { ...cur, cards, migrated: true });
}

export function deckStats(s: FlashcardStore, deck: Pick<Deck, "cards">) {
  let known = 0, learning = 0;
  for (const c of deck.cards) {
    const e = s.cards[c.key];
    if (e?.s === "known") known++;
    else if (e?.s === "learning") learning++;
  }
  return { known, learning, fresh: deck.cards.length - known - learning, total: deck.cards.length };
}

export function flashcardSummary(s: FlashcardStore, now = Date.now()) {
  const today = dayOf(now);
  let known = 0, learning = 0, todayCount = 0;
  for (const e of Object.values(s.cards)) {
    if (e.s === "known") known++; else learning++;
    if (dayOf(e.t) === today) todayCount++;
  }
  return { known, learning, today: todayCount };
}
