// Written notes on THIS device, per user (the Notes page and the per-card note in Flashcards share them).
// Why not files: the old Notes page uploaded into one PUBLIC folder per class + subject (every student's file
// visible to everyone) and on live the bucket has no upload policy, so uploads failed anyway.
// The old per-card notes ("flashcardNotes", keyed by the repeating raw card ids) are imported once as
// standalone notes so nothing is lost.
import { createDeviceStore } from "@/lib/deviceStore";

export interface Note {
  id: string;
  title: string;
  body: string;
  cls: string | null;
  subject: string | null;
  chapter: string | null;
  /** set when the note belongs to a flashcard (one note per card) */
  cardKey: string | null;
  tags: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}
export interface NotesStore { v: 1; notes: Record<string, Note>; migrated: boolean }

export const LIMITS = { title: 120, body: 20_000, tags: 8, tag: 24, notes: 1000 };
const EMPTY: NotesStore = { v: 1, notes: {}, migrated: false };
const store = createDeviceStore<NotesStore>("a4ai_notes_v1_", EMPTY, (p) => {
  const o = p as Partial<NotesStore> | null;
  return o && o.v === 1 && o.notes && typeof o.notes === "object" ? { v: 1, notes: o.notes, migrated: o.migrated === true } : null;
});
export const getNotes = store.get;
export const useNotesStore = store.use;

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `n${Date.now()}${Math.random().toString(36).slice(2, 8)}`);
export const cleanTags = (tags: string[]) =>
  Array.from(new Set(tags.map((t) => t.trim().toLowerCase().replace(/\s+/g, "-").slice(0, LIMITS.tag)).filter(Boolean))).slice(0, LIMITS.tags);

type Draft = Partial<Pick<Note, "title" | "body" | "cls" | "subject" | "chapter" | "tags" | "pinned" | "cardKey">>;

function clamp(d: Draft): Draft {
  const out: Draft = { ...d };
  if (d.title != null) out.title = d.title.slice(0, LIMITS.title);
  if (d.body != null) out.body = d.body.slice(0, LIMITS.body);
  if (d.tags) out.tags = cleanTags(d.tags);
  return out;
}

/** Returns the new id, or null when the device already holds the maximum number of notes. */
export function createNote(uid: string | null, d: Draft, now = Date.now()): string | null {
  const cur = store.get(uid);
  if (Object.keys(cur.notes).length >= LIMITS.notes) return null;
  const id = newId();
  const c = clamp(d);
  const note: Note = {
    id, title: c.title?.trim() || "Untitled note", body: c.body ?? "", cls: c.cls ?? null, subject: c.subject ?? null,
    chapter: c.chapter ?? null, cardKey: c.cardKey ?? null, tags: c.tags ?? [], pinned: !!c.pinned, createdAt: now, updatedAt: now,
  };
  store.set(uid, { ...cur, notes: { ...cur.notes, [id]: note } });
  return id;
}

export function updateNote(uid: string | null, id: string, d: Draft, now = Date.now()) {
  store.update(uid, (cur) => {
    const n = cur.notes[id];
    if (!n) return cur;
    const c = clamp(d);
    return { ...cur, notes: { ...cur.notes, [id]: { ...n, ...c, title: (c.title ?? n.title).trim() || "Untitled note", updatedAt: now } } };
  });
}

export function deleteNote(uid: string | null, id: string) {
  store.update(uid, (cur) => {
    if (!cur.notes[id]) return cur;
    const notes = { ...cur.notes };
    delete notes[id];
    return { ...cur, notes };
  });
}

export const cardNote = (s: NotesStore, cardKey: string) => Object.values(s.notes).find((n) => n.cardKey === cardKey) ?? null;

/** One note per flashcard: create, update, or (empty text) delete. */
export function setCardNote(uid: string | null, cardKey: string, meta: { cls: string; subject: string; chapter: string; title: string }, body: string, now = Date.now()) {
  const existing = cardNote(store.get(uid), cardKey);
  if (!body.trim()) { if (existing) deleteNote(uid, existing.id); return; }
  if (existing) updateNote(uid, existing.id, { body }, now);
  else createNote(uid, { title: meta.title, body, cls: meta.cls, subject: meta.subject, chapter: meta.chapter, cardKey, tags: ["flashcards"] }, now);
}

/** One-time import of the old "flashcardNotes" ({rawId: {keyPoints, comments, updatedAt}}). */
export function migrateLegacyFlashcardNotes(uid: string | null, now = Date.now()) {
  const cur = store.get(uid);
  if (cur.migrated) return;
  let legacy: Record<string, { keyPoints?: string; comments?: string; updatedAt?: string }> = {};
  try { legacy = JSON.parse(localStorage.getItem("flashcardNotes") || "{}") ?? {}; } catch { legacy = {}; }
  const notes = { ...cur.notes };
  for (const [rawId, v] of Object.entries(legacy)) {
    const body = [v?.keyPoints?.trim() && `Key points:\n${v.keyPoints.trim()}`, v?.comments?.trim() && `Comments:\n${v.comments.trim()}`].filter(Boolean).join("\n\n");
    if (!body) continue;
    const t = Date.parse(v.updatedAt ?? "") || now;
    const id = newId();
    notes[id] = { id, title: `Flashcard note · ${rawId}`.slice(0, LIMITS.title), body: body.slice(0, LIMITS.body), cls: null, subject: null, chapter: null,
      cardKey: null, tags: ["flashcards"], pinned: false, createdAt: t, updatedAt: t };
  }
  store.set(uid, { ...cur, notes, migrated: true });
}

export type NotesFilter = "all" | "pinned" | "flashcards";
export type NotesSort = "updated" | "title";

/** Search title / body / tags / subject; pinned first, then the chosen order. */
export function filterNotes(list: Note[], o: { q?: string; filter?: NotesFilter; subject?: string | null; sort?: NotesSort }) {
  const q = (o.q ?? "").trim().toLowerCase();
  return list
    .filter((n) => o.filter !== "pinned" || n.pinned)
    .filter((n) => o.filter !== "flashcards" || n.cardKey != null || n.tags.includes("flashcards"))
    .filter((n) => !o.subject || (n.subject ?? "").toLowerCase() === o.subject.toLowerCase())
    .filter((n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || n.tags.some((t) => t.includes(q)) || (n.subject ?? "").toLowerCase().includes(q))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (o.sort === "title" ? a.title.localeCompare(b.title) : b.updatedAt - a.updatedAt));
}
