// Practice data = the NCERT question bank (ncert_questions, ~83k visible rows) through the backend's existing public,
// cached endpoints (also used by the Test Builder):
//   GET /test-generator/ncert-question-stats?subject&class_grade  → chapters with totals + question types
//   GET /test-generator/ncert-questions?class_grade&subject&chapter&question_type&limit&offset → one page
// No new API. The backend hides rows marked duplicate/junk and merges subject spellings (Physics-I/II …).
// When the backend can't answer (local dev without it, a cold start timing out, an outage) the same data is read
// straight from ncert_questions (RLS: readable by everyone), with the same visibility filter and subject spellings.
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getBackendApiBase } from "@/lib/apiBase";
import { getJson, NetError, NET_ERROR_TEXT, retryNet } from "@/lib/net";
import { supabase } from "@/lib/supabaseClient";

/** Classes and subjects that have questions in the bank (live read-only check, 1 Nov 2026). Counts load live. */
export const PRACTICE_CLASSES = ["6", "7", "8", "9", "10", "11", "12"] as const;
export const SUBJECTS_BY_CLASS: Record<string, string[]> = {
  "6": ["Mathematics", "Science"],
  "7": ["Mathematics"],
  "8": [],
  "9": ["Mathematics", "Science", "English", "Political Science", "Geography", "Economics", "History"],
  "10": ["Mathematics", "Science", "English", "History", "Political Science", "Economics", "Geography"],
  "11": ["Mathematics", "Physics", "Chemistry", "Biology", "Accountancy", "Economics", "Political Science", "History"],
  "12": ["Mathematics", "Physics", "Chemistry", "Biology", "Accountancy", "Economics", "Political Science", "History", "English"],
};
export const hasQuestions = (cls: string) => (SUBJECTS_BY_CLASS[cls] ?? []).length > 0;

export const TYPE_LABEL: Record<string, string> = {
  exercise: "Exercise", intext: "In-text", example: "Solved example", activity: "Activity", mcq: "MCQ",
  fillblank: "Fill in the blank", diagram: "Diagram", hots: "HOTS",
};
export const typeLabel = (t: string | null | undefined) => (t && TYPE_LABEL[t]) || (t ? t[0].toUpperCase() + t.slice(1) : "Question");

export interface ChapterStat { chapter: string; chapterNo: number | null; total: number; types: { name: string; count: number }[] }
export interface PracticeQuestion {
  id: string;
  number: string | null;
  text: string;
  type: string | null;
  difficulty: string | null;
  /** null: the bank has no answer key for this question (true for ~82 % of rows) */
  answer: string | null;
  options: string[];
  imageUrl: string | null;
  figureMissing: boolean;
  table: string[][] | null;
  section: string | null;
}
export interface QuestionPage { questions: PracticeQuestion[]; total: number; hasMore: boolean }

const base = () => `${getBackendApiBase()}/v1/test-generator`;
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function parseStats(data: unknown): ChapterStat[] {
  const chapters = (data as { chapters?: unknown[] } | null)?.chapters;
  if (!Array.isArray(chapters)) return [];
  return chapters
    .map((c) => c as Record<string, unknown>)
    .filter((c) => str(c.chapter) && n(c.total) > 0)
    .map((c) => ({
      chapter: str(c.chapter)!,
      chapterNo: typeof c.chapter_no === "number" ? c.chapter_no : null,
      total: n(c.total),
      types: Array.isArray(c.types)
        ? (c.types as Record<string, unknown>[]).filter((t) => str(t.name) && n(t.count) > 0).map((t) => ({ name: str(t.name)!, count: n(t.count) }))
        : [],
    }))
    .sort((a, b) => (a.chapterNo ?? 999) - (b.chapterNo ?? 999) || a.chapter.localeCompare(b.chapter));
}

const NO_ANSWER = /^(none|null|n\/a|-|undefined)$/i;
function parseOptions(v: unknown): string[] {
  let arr: unknown = v;
  if (typeof v === "string") {
    try { arr = JSON.parse(v); } catch { return []; }
  }
  return Array.isArray(arr) ? arr.map((o) => (typeof o === "string" ? o : (o as { text?: string })?.text ?? "")).filter((o) => o.trim()) : [];
}
function parseTable(v: unknown): string[][] | null {
  if (!Array.isArray(v) || !v.length || !v.every(Array.isArray)) return null;
  return (v as unknown[][]).map((r) => r.map((c) => (c == null ? "" : String(c))));
}

export function parseQuestions(data: unknown): QuestionPage {
  const d = (data ?? {}) as { questions?: unknown[]; total?: unknown; hasMore?: unknown };
  const seen = new Set<string>();
  const questions = (Array.isArray(d.questions) ? d.questions : [])
    .map((q) => q as Record<string, unknown>)
    .filter((q) => q.id != null && str(q.question_text))
    .map((q): PracticeQuestion => {
      const answer = str(q.answer);
      return {
        id: String(q.id),
        number: str(q.question_number),
        text: str(q.question_text)!,
        type: str(q.question_type),
        difficulty: str(q.difficulty),
        answer: answer && !NO_ANSWER.test(answer) ? answer : null,
        options: parseOptions(q.options),
        imageUrl: str(q.image_url),
        figureMissing: q.figure_missing === true,
        table: parseTable(q.question_table),
        section: str(q.section),
      };
    })
    .filter((q) => !seen.has(q.id) && !!seen.add(q.id)); // the backend dedupes; never show one question twice
  return { questions, total: n(d.total), hasMore: d.hasMore === true };
}

const norm = (s: string) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Which option the answer key points at: "(b)", "B.", "option c", or the option's own text. null = can't tell. */
export function matchOption(answer: string | null, options: string[]): number | null {
  if (!answer || !options.length) return null;
  const a = answer.trim();
  // a letter only with a delimiter: "(b)", "b)", "b.", "b:", "b", "option b" — never the word "a" in "a magnet …"
  const letter = a.match(/^\(\s*([a-h])\s*\)/i) || a.match(/^([a-h])\s*[).:](?:\s|$)/i) || a.match(/^([a-h])$/i) || a.match(/^option\s*\(?([a-h])\)?\b/i);
  if (letter) {
    const i = letter[1].toLowerCase().charCodeAt(0) - 97;
    if (i < options.length) return i;
  }
  const na = norm(a);
  const i = options.findIndex((o) => norm(o) === na);
  return i >= 0 ? i : null;
}

/* ─────────── direct read (fallback) ─────────── */
const SUBJECT_SPELLINGS: Record<string, string[]> = {
  physics: ["Physics", "Physics-I", "Physics-II"],
  chemistry: ["Chemistry", "Chemistry-I", "Chemistry-II"],
  "political science": ["Political Science", "Political_Science"],
};
const spellings = (subject: string) => SUBJECT_SPELLINGS[subject.trim().toLowerCase()] ?? [subject];
const VISIBLE = "quality_status.is.null,quality_status.not.in.(duplicate,junk)";
const isAbort = (e: unknown) => (e as Error)?.name === "AbortError" || /AbortError/.test(String((e as Error)?.message ?? ""));
const dbFail = (e: unknown): never => {
  if (isAbort(e)) { const a = new Error("aborted"); a.name = "AbortError"; throw a; }
  throw new NetError("server", NET_ERROR_TEXT.server);
};

/** Chapter totals from the table: only two short columns, 1,000 rows per request (a subject is ≤ ~6k rows). */
export async function statsFromDb(cls: string, subject: string, signal?: AbortSignal): Promise<ChapterStat[]> {
  const chapters = new Map<string, Map<string, number>>();
  for (let from = 0; from < 30_000; from += 1000) {
    let q = supabase.from("ncert_questions").select("chapter, question_type")
      .eq("class_grade", cls).in("subject", spellings(subject)).or(VISIBLE).order("id").range(from, from + 999);
    if (signal) q = q.abortSignal(signal);
    const { data, error } = await q;
    if (error) dbFail(error);
    for (const r of data ?? []) {
      const ch = str((r as { chapter?: unknown }).chapter);
      if (!ch) continue;
      const types = chapters.get(ch) ?? new Map<string, number>();
      const t = str((r as { question_type?: unknown }).question_type) ?? "question";
      types.set(t, (types.get(t) ?? 0) + 1);
      chapters.set(ch, types);
    }
    if ((data ?? []).length < 1000) break;
  }
  return parseStats({
    chapters: [...chapters].map(([chapter, types]) => ({
      chapter, chapter_no: Number(chapter.match(/^\s*(\d+)[.\s]/)?.[1]) || null,
      total: [...types.values()].reduce((a, b) => a + b, 0),
      types: [...types].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    })),
  });
}

export async function questionsFromDb(
  p: { cls: string; subject: string; chapter: string; type?: string | null; page: number }, signal?: AbortSignal,
): Promise<QuestionPage> {
  const from = p.page * SET_SIZE;
  let q = supabase.from("ncert_questions")
    .select("id, question_number, question_text, question_type, difficulty, answer, options, image_url, question_table, section", { count: "exact" })
    .eq("class_grade", p.cls).in("subject", spellings(p.subject)).eq("chapter", p.chapter).or(VISIBLE);
  if (p.type) q = q.eq("question_type", p.type);
  let r = q.order("id").range(from, from + SET_SIZE - 1);
  if (signal) r = r.abortSignal(signal);
  const { data, error, count } = await r;
  if (error) dbFail(error);
  const total = count ?? 0;
  return parseQuestions({ questions: data ?? [], total, hasMore: from + SET_SIZE < total });
}

/** Backend first; if it fails for any reason except a superseded request, read the table directly. */
async function withFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    return await primary();
  } catch (e) {
    if (isAbort(e)) throw e;
    try { return await fallback(); } catch (f) { if (isAbort(f)) throw f; throw e; }
  }
}

export async function fetchChapterStats(cls: string, subject: string, signal?: AbortSignal): Promise<ChapterStat[]> {
  const q = new URLSearchParams({ subject, class_grade: cls });
  return withFallback(
    async () => parseStats(await getJson(`${base()}/ncert-question-stats?${q}`, signal, 20_000)),
    () => statsFromDb(cls, subject, signal),
  );
}

export const SET_SIZE = 10;

/** Link to a practice set; page / q are 0-based. */
export const practiceSessionHref = (p: { c: string; s: string; ch: string; type?: string | null; page?: number; q?: number }) => {
  const q = new URLSearchParams({ class: p.c, subject: p.s, chapter: p.ch });
  if (p.type) q.set("type", p.type);
  if (p.page) q.set("page", String(p.page));
  if (p.q) q.set("q", String(p.q));
  return `/practice/session?${q}`;
};

export async function fetchQuestionPage(
  p: { cls: string; subject: string; chapter: string; type?: string | null; page: number }, signal?: AbortSignal,
): Promise<QuestionPage> {
  const q = new URLSearchParams({
    class_grade: p.cls, subject: p.subject, chapter: p.chapter, limit: String(SET_SIZE), offset: String(p.page * SET_SIZE),
  });
  if (p.type) q.set("question_type", p.type);
  return withFallback(
    async () => parseQuestions(await getJson(`${base()}/ncert-questions?${q}`, signal, 15_000)),
    () => questionsFromDb(p, signal),
  );
}

export const practiceKeys = {
  stats: (cls: string, subject: string) => ["practice", "stats", cls, subject] as const,
  page: (cls: string, subject: string, chapter: string, type: string | null, page: number) =>
    ["practice", "page", cls, subject, chapter, type ?? "", page] as const,
};

/** Chapter list of one subject. Long cache: the bank changes rarely and the cold backend call is slow (~6 s). */
export function useChapterStats(cls: string | null, subject: string | null) {
  return useQuery({
    queryKey: practiceKeys.stats(cls ?? "", subject ?? ""),
    enabled: !!cls && !!subject,
    queryFn: ({ signal }) => fetchChapterStats(cls!, subject!, signal),
    staleTime: 60 * 60_000,
    gcTime: 2 * 60 * 60_000,
    retry: retryNet,
  });
}

export function useQuestionPage(p: { cls: string; subject: string; chapter: string; type: string | null; page: number } | null) {
  return useQuery({
    queryKey: p ? practiceKeys.page(p.cls, p.subject, p.chapter, p.type, p.page) : ["practice", "page", "none"],
    enabled: !!p,
    queryFn: ({ signal }) => fetchQuestionPage(p!, signal),
    staleTime: 30 * 60_000,
    placeholderData: keepPreviousData,
    retry: retryNet,
  });
}
