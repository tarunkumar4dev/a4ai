// Practice progress on THIS device (per user). There is no server table for NCERT practice yet
// (supabase/migrations/31_practice_progress.sql is written, not applied) — every screen that shows these numbers
// says "on this device". Marks are the student's own ("I got it" / "Review later"), never an auto-grade.
//   - one entry per question: marking again replaces it (a double click or a second tab never counts twice)
//   - "today" = the device's local date of each mark, so midnight / time-zone changes need no reset job
//   - other tabs follow through the storage event
import { useCallback, useSyncExternalStore } from "react";

export type Mark = "got" | "review";
export interface MarkEntry { m: Mark; t: number; c: string; s: string; ch: string }
export interface LastSession { c: string; s: string; ch: string; type: string | null; page: number; q: number; t: number }
export interface PracticeStore { v: 1; marks: Record<string, MarkEntry>; last: LastSession | null; cls: string | null }

const MAX_MARKS = 5000;
const EMPTY: PracticeStore = { v: 1, marks: {}, last: null, cls: null };
const keyFor = (uid: string | null) => `a4ai_practice_v1_${uid || "guest"}`;
const EVENT = "a4ai-practice-progress";

const cache = new Map<string, { raw: string | null; value: PracticeStore }>();

function read(uid: string | null): PracticeStore {
  const key = keyFor(uid);
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { /* private mode / blocked */ }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value; // same object for the same data (useSyncExternalStore)
  let value = EMPTY;
  try {
    const p = raw ? JSON.parse(raw) : null;
    if (p && p.v === 1 && p.marks && typeof p.marks === "object") {
      value = { v: 1, marks: p.marks, last: p.last ?? null, cls: typeof p.cls === "string" ? p.cls : null };
    }
  } catch { /* corrupt → start fresh */ }
  cache.set(key, { raw, value });
  return value;
}

function write(uid: string | null, next: PracticeStore) {
  const entries = Object.entries(next.marks);
  if (entries.length > MAX_MARKS) {
    entries.sort((a, b) => b[1].t - a[1].t);
    next = { ...next, marks: Object.fromEntries(entries.slice(0, MAX_MARKS)) };
  }
  try { localStorage.setItem(keyFor(uid), JSON.stringify(next)); } catch { /* full / blocked: progress stays in memory only */ }
  cache.delete(keyFor(uid));
  window.dispatchEvent(new Event(EVENT));
}

export function getProgress(uid: string | null): PracticeStore {
  return read(uid);
}

/** Idempotent: the same mark again only refreshes the time. */
export function markQuestion(uid: string | null, questionId: string, m: Mark, meta: { c: string; s: string; ch: string }, now = Date.now()) {
  const cur = read(uid);
  write(uid, { ...cur, marks: { ...cur.marks, [questionId]: { m, t: now, ...meta } } });
}

export function clearMark(uid: string | null, questionId: string) {
  const cur = read(uid);
  if (!cur.marks[questionId]) return;
  const marks = { ...cur.marks };
  delete marks[questionId];
  write(uid, { ...cur, marks });
}

export function setLastSession(uid: string | null, last: Omit<LastSession, "t">, now = Date.now()) {
  const cur = read(uid);
  const prev = cur.last;
  if (prev && prev.c === last.c && prev.s === last.s && prev.ch === last.ch && prev.type === last.type && prev.page === last.page && prev.q === last.q) return;
  write(uid, { ...cur, last: { ...last, t: now } });
}

export function setPracticeClass(uid: string | null, cls: string) {
  const cur = read(uid);
  if (cur.cls !== cls) write(uid, { ...cur, cls });
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => { if (!e.key || e.key.startsWith("a4ai_practice_v1_")) cb(); };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", onStorage); };
}

export function usePracticeProgress(uid: string | null): PracticeStore {
  const get = useCallback(() => read(uid), [uid]);
  return useSyncExternalStore(subscribe, get, get);
}

/* ─────────── derived numbers (pure, unit-tested) ─────────── */

export const localDay = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export interface PracticeSummary {
  got: number;
  review: number;
  marked: number;
  today: number;
  /** marks per local day, oldest → newest, the last 7 days including today */
  week: { day: string; count: number }[];
  bySubject: { subject: string; got: number; review: number }[];
  lastAt: number | null;
}

export function summarize(store: PracticeStore, now = Date.now()): PracticeSummary {
  const entries = Object.values(store.marks);
  const today = localDay(now);
  const days = Array.from({ length: 7 }, (_, i) => localDay(now - (6 - i) * 86_400_000));
  const perDay = new Map(days.map((d) => [d, 0]));
  const subj = new Map<string, { got: number; review: number }>();
  let got = 0, review = 0, lastAt: number | null = null;
  for (const e of entries) {
    if (e.m === "got") got++; else review++;
    const d = localDay(e.t);
    if (perDay.has(d)) perDay.set(d, perDay.get(d)! + 1);
    const s = subj.get(e.s) ?? { got: 0, review: 0 };
    s[e.m === "got" ? "got" : "review"]++;
    subj.set(e.s, s);
    if (lastAt == null || e.t > lastAt) lastAt = e.t;
  }
  return {
    got, review, marked: got + review,
    today: perDay.get(today) ?? 0,
    week: days.map((day) => ({ day, count: perDay.get(day) ?? 0 })),
    bySubject: [...subj].map(([subject, v]) => ({ subject, ...v })).sort((a, b) => b.got + b.review - (a.got + a.review)),
    lastAt,
  };
}

/** Marks inside one chapter (for its progress bar). */
export function chapterMarks(store: PracticeStore, c: string, s: string, ch: string) {
  let got = 0, review = 0;
  for (const e of Object.values(store.marks)) {
    if (e.c !== c || e.s !== s || e.ch !== ch) continue;
    if (e.m === "got") got++;
    else review++;
  }
  return { got, review };
}

export function subjectMarks(store: PracticeStore, c: string, s: string) {
  let n = 0;
  for (const e of Object.values(store.marks)) if (e.c === c && e.s === s) n++;
  return n;
}
