// The bundled NCERT flashcard set (src/data/ncertFlashcards.ts, 1,118 cards; 11 without an answer are skipped) in one shape.
// The raw card ids repeat across classes and subjects ("C1_001" exists several times — only 604 of 1,118 are
// unique), which made one "mastered" tick light up cards in other chapters. Every card here gets a key that
// includes class, subject and chapter position.
import { allFlashcards } from "@/data/ncertFlashcards";
import type { Chapter, Flashcard } from "@/data/flashcardTypes";

export interface Card {
  key: string;
  rawId: string;
  type: string;
  front: string;
  back: string;
  title: string | null;
  formula: string | null;
  units: string | null;
  note: string | null;
  examples: string | null;
}
export interface Deck { cls: string; subject: string; index: number; number: number; name: string; cards: Card[] }

const DATA = allFlashcards as unknown as Record<string, Record<string, Chapter[]>>;
const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export const cardKey = (cls: string, subject: string, index: number, rawId: string) => `${cls}|${subject}|${index}|${rawId}`;

function toCard(cls: string, subject: string, index: number, f: Flashcard, i: number): Card | null {
  const front = s(f.question) ?? s(f.front) ?? s(f.title);
  const back = s(f.answer) ?? s(f.back);
  if (!front || !back) return null;
  const rawId = f.id != null ? String(f.id) : `#${i + 1}`;
  return {
    key: cardKey(cls, subject, index, rawId),
    rawId,
    type: s(f.type) ?? "concept",
    front,
    back,
    title: s(f.front) && s(f.title) ? s(f.title) : null,
    formula: s(f.formula),
    units: s(f.units),
    note: s(f.conditions_or_notes),
    examples: s(f.examples_or_comparison),
  };
}

const deckCache = new Map<string, Deck[]>();

export const FLASHCARD_CLASSES = Object.keys(DATA).sort((a, b) => Number(a) - Number(b));
export const subjectsFor = (cls: string) => Object.keys(DATA[cls] ?? {});

/** Chapters of one subject, in book order; index = 1-based position (stable key part). */
export function decksFor(cls: string, subject: string): Deck[] {
  const k = `${cls}|${subject}`;
  const hit = deckCache.get(k);
  if (hit) return hit;
  const decks = (DATA[cls]?.[subject] ?? []).map((ch, i): Deck => {
    const index = i + 1;
    const seen = new Set<string>();
    const cards = (ch.flashcards ?? [])
      .map((f, j) => toCard(cls, subject, index, f, j))
      .filter((c): c is Card => !!c && !seen.has(c.key) && !!seen.add(c.key));
    return { cls, subject, index, number: ch.chapter_number ?? index, name: s(ch.chapter_name) ?? s(ch.chapter) ?? `Chapter ${index}`, cards };
  }).filter((d) => d.cards.length > 0);
  deckCache.set(k, decks);
  return decks;
}

export const deckFor = (cls: string, subject: string, index: number) => decksFor(cls, subject).find((d) => d.index === index) ?? null;

export function subjectTotals(cls: string, subject: string) {
  const decks = decksFor(cls, subject);
  return { decks: decks.length, cards: decks.reduce((a, d) => a + d.cards.length, 0) };
}

export function allCards(): Card[] {
  return FLASHCARD_CLASSES.flatMap((c) => subjectsFor(c).flatMap((sub) => decksFor(c, sub).flatMap((d) => d.cards)));
}

/** Old URL /dashboard/flashcards/:subject/:chapter had no class: the first class that has this chapter. */
export function findLegacyDeck(subject: string, chapterNumber: number): { cls: string; index: number } | null {
  for (const cls of FLASHCARD_CLASSES) {
    const sub = subjectsFor(cls).find((x) => x.toLowerCase() === subject.toLowerCase());
    if (!sub) continue;
    const d = decksFor(cls, sub).find((x) => x.number === chapterNumber);
    if (d) return { cls, index: d.index };
  }
  return null;
}

export const deckHref = (p: { cls: string; subject: string; index: number; card?: number }) => {
  const q = new URLSearchParams({ class: p.cls, subject: p.subject, chapter: String(p.index) });
  if (p.card) q.set("card", String(p.card));
  return `/dashboard/flashcards/deck?${q}`;
};
