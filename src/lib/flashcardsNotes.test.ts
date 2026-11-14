// Flashcards + notes data: unique card keys (the raw ids repeat), honest counts, idempotent marks, one-time import
// of the old global progress / notes, note limits and filters.
import { beforeEach, describe, expect, it } from "vitest";
import { allCards, deckFor, decksFor, findLegacyDeck, FLASHCARD_CLASSES, subjectTotals, subjectsFor } from "./flashcardData";
import { clearCardState, deckStats, flashcardSummary, getFlashcardProgress, migrateLegacyMastered, setCardState } from "./flashcardProgress";
import {
  LIMITS, cardNote, cleanTags, createNote, deleteNote, filterNotes, getNotes, migrateLegacyFlashcardNotes, setCardNote, updateNote,
} from "./studentNotes";

beforeEach(() => localStorage.clear());

describe("flashcardData", () => {
  it("every card has a unique key even though raw ids repeat across classes", () => {
    const cards = allCards();
    expect(cards.length).toBe(1107); // 1,118 in the file; 11 Class 11 Physics cards have no answer and are skipped
    expect(new Set(cards.map((c) => c.key)).size).toBe(cards.length);
    expect(new Set(cards.map((c) => c.rawId)).size).toBeLessThan(cards.length);
  });
  it("classes / subjects / totals come from the data", () => {
    expect(FLASHCARD_CLASSES).toEqual(["9", "10", "11", "12"]);
    expect(subjectsFor("11")).toEqual(["Physics"]);
    expect(subjectTotals("10", "Mathematics")).toEqual({ decks: 2, cards: 4 });
    const d = deckFor("11", "Physics", 1)!;
    expect(d.name).toBe("Units and Measurements");
    expect(d.cards[0].front.length).toBeGreaterThan(0);
    expect(d.cards[0].back.length).toBeGreaterThan(0);
  });
  it("old /:subject/:chapter links resolve to the first class with that chapter", () => {
    expect(findLegacyDeck("science", 1)).toEqual({ cls: "9", index: 1 });
    expect(findLegacyDeck("physics", 2)).toEqual({ cls: "11", index: 2 });
    expect(findLegacyDeck("history", 1)).toBeNull();
  });
});

describe("flashcardProgress", () => {
  it("one state per card; marking again replaces it; clear removes it", () => {
    const deck = decksFor("10", "Science")[0];
    const k = deck.cards[0].key;
    setCardState("u1", k, "learning");
    setCardState("u1", k, "known");
    setCardState("u1", k, "known");
    expect(deckStats(getFlashcardProgress("u1"), deck)).toMatchObject({ known: 1, learning: 0, total: deck.cards.length });
    clearCardState("u1", k);
    expect(deckStats(getFlashcardProgress("u1"), deck).known).toBe(0);
    expect(deckStats(getFlashcardProgress("u2"), deck).known).toBe(0);
  });
  it("imports the old global 'mastered' list once (every card with that raw id, like the old screen)", () => {
    const raw = decksFor("10", "Science")[0].cards[0].rawId;
    localStorage.setItem("flashcardMastered", JSON.stringify([raw]));
    migrateLegacyMastered("u1");
    const known = Object.keys(getFlashcardProgress("u1").cards);
    expect(known.length).toBe(allCards().filter((c) => c.rawId === raw).length);
    clearCardState("u1", known[0]);
    migrateLegacyMastered("u1"); // second run does nothing
    expect(Object.keys(getFlashcardProgress("u1").cards).length).toBe(known.length - 1);
  });
  it("summary counts today by local date", () => {
    const now = new Date(2026, 10, 2, 9).getTime();
    const [a, b] = decksFor("9", "Science")[0].cards;
    setCardState("u1", a.key, "known", now);
    setCardState("u1", b.key, "learning", new Date(2026, 10, 1, 23, 59).getTime());
    expect(flashcardSummary(getFlashcardProgress("u1"), now)).toEqual({ known: 1, learning: 1, today: 1 });
  });
});

describe("studentNotes", () => {
  it("create / update / delete with clamped fields and clean tags", () => {
    const id = createNote("u1", { title: "  ", body: "x".repeat(LIMITS.body + 50), tags: ["Formula", "formula", " revise later "] })!;
    const n = getNotes("u1").notes[id];
    expect(n.title).toBe("Untitled note");
    expect(n.body.length).toBe(LIMITS.body);
    expect(n.tags).toEqual(["formula", "revise-later"]);
    updateNote("u1", id, { title: "Ohm's law", pinned: true });
    expect(getNotes("u1").notes[id]).toMatchObject({ title: "Ohm's law", pinned: true });
    deleteNote("u1", id);
    expect(getNotes("u1").notes[id]).toBeUndefined();
  });
  it("one note per card: upsert, and empty text deletes it", () => {
    const meta = { cls: "10", subject: "Science", chapter: "Light", title: "What is focus?" };
    setCardNote("u1", "10|Science|1|C1_001", meta, "first");
    setCardNote("u1", "10|Science|1|C1_001", meta, "second");
    expect(Object.values(getNotes("u1").notes)).toHaveLength(1);
    expect(cardNote(getNotes("u1"), "10|Science|1|C1_001")?.body).toBe("second");
    setCardNote("u1", "10|Science|1|C1_001", meta, "   ");
    expect(Object.values(getNotes("u1").notes)).toHaveLength(0);
  });
  it("imports the old flashcard notes once as standalone notes", () => {
    localStorage.setItem("flashcardNotes", JSON.stringify({ C1_001: { keyPoints: "acid + base", comments: "", updatedAt: "2026-10-01T10:00:00Z" }, C1_002: { keyPoints: "", comments: "" } }));
    migrateLegacyFlashcardNotes("u1");
    migrateLegacyFlashcardNotes("u1");
    const notes = Object.values(getNotes("u1").notes);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ title: "Flashcard note · C1_001", tags: ["flashcards"] });
    expect(notes[0].body).toContain("acid + base");
  });
  it("filters: pinned first, search across title / body / tags, subject, flashcards", () => {
    const a = createNote("u1", { title: "Light", body: "mirror formula", subject: "Science", tags: ["formula"] }, 1)!;
    createNote("u1", { title: "Algebra", body: "identities", subject: "Mathematics", pinned: true }, 2);
    createNote("u1", { title: "Card", body: "x", cardKey: "10|Science|1|C1", tags: ["flashcards"] }, 3);
    const all = Object.values(getNotes("u1").notes);
    expect(filterNotes(all, {}).map((n) => n.title)).toEqual(["Algebra", "Card", "Light"]);
    expect(filterNotes(all, { q: "FORMULA" }).map((n) => n.id)).toEqual([a]);
    expect(filterNotes(all, { subject: "science" }).map((n) => n.title)).toEqual(["Light"]);
    expect(filterNotes(all, { filter: "flashcards" }).map((n) => n.title)).toEqual(["Card"]);
    expect(filterNotes(all, { filter: "pinned" }).map((n) => n.title)).toEqual(["Algebra"]);
    expect(filterNotes(all, { sort: "title" }).map((n) => n.title)).toEqual(["Algebra", "Card", "Light"]);
  });
  it("tag rules", () => {
    expect(cleanTags(Array.from({ length: 12 }, (_, i) => `t${i}`))).toHaveLength(LIMITS.tags);
  });
});
