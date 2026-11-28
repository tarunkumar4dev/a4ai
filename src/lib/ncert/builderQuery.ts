/**
 * NCERT Test Builder: filters → request params, and the PYQ fields of the question rows.
 *
 * Backend (RAG-BACKEND test-generator):
 *   GET /test-generator/ncert-questions        source, language, year, difficulty, marks, sort (all optional)
 *   GET /test-generator/ncert-question-stats   source, language (optional) → chapters[].pyq + facets
 *   GET /test-generator/ncert-questions/by-ids no new params; rows come back in whatever language they are
 *
 * A new param is sent only when it differs from the backend default, so with every new control untouched the
 * request is byte-for-byte the one the builder sent before PYQs (same param order → same CDN cache entry).
 * An older backend ignores the new params and sends no new fields: no facets → the page hides every new control,
 * a row without `source` is NCERT, a row without `language` is English.
 */

export type QuestionSource = "ncert" | "pyq";
export type SourceFilter = "all" | QuestionSource;
export type LanguageFilter = "en" | "hi" | "all";
export type Difficulty = "easy" | "medium" | "hard";
export type DifficultyFilter = "all" | Difficulty;
export type FigureFilter = "all" | "hide" | "missing";
export type SortKey =
  | "default"
  | "chapter"
  | "marks_asc"
  | "marks_desc"
  | "difficulty_asc"
  | "difficulty_desc"
  | "year_desc";

export const DEFAULT_SOURCE: SourceFilter = "all";
export const DEFAULT_LANGUAGE: LanguageFilter = "en";
export const DEFAULT_SORT: SortKey = "default";

/** PYQ fields on a question row (list and /by-ids). All optional: an older backend sends none of them. */
export interface PyqRowFields {
  source?: QuestionSource | null;
  /** null = untagged legacy row, treated as English */
  language?: "en" | "hi" | null;
  pyq_year?: number | null;
  /** CBSE Q.P. codes the question appeared in, e.g. ["67/5/1", "67/5/2"] */
  pyq_papers?: string[] | null;
  pyq_exam?: string | null;
  /** same value on the English and the Hindi version of one question */
  pair_id?: string | null;
  question_number?: string | null;
  question_type?: string;
}

export interface FacetEntry<T extends string | number> {
  name: T;
  count: number;
}

export interface StatsFacets {
  /** whole class + subject */
  sources: FacetEntry<string>[];
  /** whole class + subject */
  languages: FacetEntry<string>[];
  /** within the source + language slice */
  years: FacetEntry<number>[];
  difficulties: FacetEntry<string>[];
  marks: FacetEntry<number>[];
}

export interface QuestionQuery {
  subject: string;
  classGrade: string;
  /** null = "All chapters": no chapter param */
  chapter: string | null;
  questionType: string;
  search: string;
  figure: FigureFilter;
  source: SourceFilter;
  language: LanguageFilter;
  year: number | null;
  difficulty: DifficultyFilter;
  marks: number | null;
  sort: SortKey;
}

/** Query string for GET /ncert-questions. Param order matches the pre-PYQ builder. */
export function questionQueryString(q: QuestionQuery, offset: number, limit: number): string {
  const params = new URLSearchParams({ subject: q.subject, class_grade: q.classGrade });
  if (q.chapter !== null) params.set("chapter", q.chapter);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (q.questionType !== "all") params.set("question_type", q.questionType);
  if (q.search) params.set("search", q.search);
  if (q.figure !== "all") params.set("figure", q.figure);
  if (q.source !== DEFAULT_SOURCE) params.set("source", q.source);
  if (q.language !== DEFAULT_LANGUAGE) params.set("language", q.language);
  if (q.year !== null) params.set("year", String(q.year));
  if (q.difficulty !== "all") params.set("difficulty", q.difficulty);
  if (q.marks !== null) params.set("marks", String(q.marks));
  if (q.sort !== DEFAULT_SORT) params.set("sort", q.sort);
  return params.toString();
}

/** Query string for GET /ncert-question-stats (same encoding as the pre-PYQ builder: encodeURIComponent). */
export function statsQueryString(
  subject: string,
  classGrade: string,
  source: SourceFilter,
  language: LanguageFilter
): string {
  let qs = `subject=${encodeURIComponent(subject)}&class_grade=${classGrade}`;
  if (source !== DEFAULT_SOURCE) qs += `&source=${source}`;
  if (language !== DEFAULT_LANGUAGE) qs += `&language=${language}`;
  return qs;
}

// ── Response parsing ─────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseEntries<T extends string | number>(raw: unknown, kind: "string" | "number"): FacetEntry<T>[] {
  if (!Array.isArray(raw)) return [];
  const out: FacetEntry<T>[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const count = Number(item.count);
    if (!Number.isFinite(count)) continue;
    if (kind === "number") {
      const n = Number(item.name);
      if (item.name === null || item.name === "" || !Number.isFinite(n)) continue;
      out.push({ name: n as T, count });
    } else {
      if (typeof item.name !== "string" || !item.name) continue;
      out.push({ name: item.name as T, count });
    }
  }
  return out;
}

/** `facets` of a stats response, or null when the backend sent none (older backend). */
export function parseFacets(raw: unknown): StatsFacets | null {
  if (!isRecord(raw)) return null;
  return {
    sources: parseEntries<string>(raw.sources, "string"),
    languages: parseEntries<string>(raw.languages, "string"),
    years: parseEntries<number>(raw.years, "number").sort((a, b) => b.name - a.name),
    difficulties: parseEntries<string>(raw.difficulties, "string"),
    marks: parseEntries<number>(raw.marks, "number").sort((a, b) => a.name - b.name),
  };
}

export function facetCount<T extends string | number>(entries: FacetEntry<T>[] | undefined, name: T): number {
  return entries?.find((e) => e.name === name)?.count ?? 0;
}

/** A row without `source` (older backend) is an NCERT question. */
export function rowSource(q: PyqRowFields): QuestionSource {
  return q.source === "pyq" ? "pyq" : "ncert";
}

/** A row without `language` (or an untagged legacy row) is English. */
export function rowLanguage(q: PyqRowFields): "en" | "hi" {
  return q.language === "hi" ? "hi" : "en";
}

export function isPyq(q: PyqRowFields): boolean {
  return rowSource(q) === "pyq";
}

/** "7(a)" → "Q7(a)" (the paper's own numbering). */
export function pyqNumberLabel(questionNumber: string | null | undefined): string | null {
  const n = (questionNumber || "").trim();
  if (!n) return null;
  return /^q/i.test(n) ? n : `Q${n}`;
}

/** "PYQ · CBSE 2026" (parts the row does not have are left out). */
export function pyqBadgeText(q: PyqRowFields): string {
  const rest = [q.pyq_exam?.trim(), q.pyq_year ? String(q.pyq_year) : ""].filter(Boolean).join(" ");
  return rest ? `PYQ · ${rest}` : "PYQ";
}

/** Tooltip for the PYQ badge: the Q.P. codes the question appeared in. */
export function pyqPapersTitle(q: PyqRowFields): string | undefined {
  const papers = Array.isArray(q.pyq_papers) ? q.pyq_papers.filter((p) => typeof p === "string" && p) : [];
  return papers.length ? `Q.P. ${papers.join(", ")}` : undefined;
}

/** True when the paper holds both English and Hindi questions. */
export function paperMixesLanguages(questions: PyqRowFields[]): boolean {
  let en = false;
  let hi = false;
  for (const q of questions) {
    if (rowLanguage(q) === "hi") hi = true;
    else en = true;
    if (en && hi) return true;
  }
  return false;
}

// ── Labels ───────────────────────────────────────────────────────

/** Types the "All Types" dropdown has always listed (in this order). */
export const BASE_TYPE_OPTIONS = ["all", "exercise", "example", "intext", "activity", "hots", "diagram"] as const;

export const TYPE_LABELS: Record<string, string> = {
  all: "All Types",
  exercise: "Exercise",
  example: "Examples",
  intext: "In-Text",
  activity: "Activities",
  hots: "HOTS",
  diagram: "Diagrams",
  mcq: "MCQ",
  assertion_reason: "Assertion–Reason",
  short_answer: "Short Answer",
  long_answer: "Long Answer",
  case_study: "Case Study",
};

/** Readable label for any question_type; an unknown one is title-cased ("case_based" → "Case Based"). */
export function typeLabel(type: string | null | undefined): string {
  const t = (type || "").trim();
  if (!t) return "Question";
  const known = TYPE_LABELS[t] ?? TYPE_LABELS[t.toLowerCase()];
  if (known) return known;
  return t
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Options for the type dropdown: the base list, then any other type the backend reports, then the current
 * selection if it is not in the list (so the select never shows a value it does not have).
 */
export function typeOptions(extraTypes: string[], current: string): { value: string; label: string }[] {
  const values: string[] = [...BASE_TYPE_OPTIONS];
  for (const t of [...extraTypes, current]) {
    if (t && !values.includes(t)) values.push(t);
  }
  return values.map((value) => ({ value, label: typeLabel(value) }));
}

export const DIFFICULTY_OPTIONS: { value: DifficultyFilter; label: string }[] = [
  { value: "all", label: "All difficulties" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const SORT_LABELS: Record<SortKey, string> = {
  default: "Default",
  chapter: "Chapter",
  marks_asc: "Marks low→high",
  marks_desc: "Marks high→low",
  difficulty_asc: "Easy→Hard",
  difficulty_desc: "Hard→Easy",
  year_desc: "Newest year",
};

/** "Newest year" only while PYQs are in view. */
export function sortOptions(pyqInView: boolean): { value: SortKey; label: string }[] {
  const keys: SortKey[] = ["default", "chapter", "marks_asc", "marks_desc", "difficulty_asc", "difficulty_desc"];
  if (pyqInView) keys.push("year_desc");
  return keys.map((value) => ({ value, label: SORT_LABELS[value] }));
}

export function marksLabel(m: number): string {
  return `${m} mark${m === 1 ? "" : "s"}`;
}

// ── Language preference (this device) ───────────────────────────

export const LANGUAGE_STORAGE_KEY = "a4ai.testBuilder.language";

export function isLanguageFilter(v: unknown): v is LanguageFilter {
  return v === "en" || v === "hi" || v === "all";
}

export function loadLanguagePref(): LanguageFilter {
  try {
    const v = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguageFilter(v) ? v : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function saveLanguagePref(v: LanguageFilter): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, v);
  } catch {
    /* private mode / storage full: the choice still holds for this visit */
  }
}

// ── "All chapters" list ─────────────────────────────────────────

/**
 * Splits a list into runs of the same chapter, in list order (the backend sorts by chapter; pages are appended,
 * so a chapter that continues on the next page stays one run).
 */
export function groupByChapter<T extends { chapter?: string | null }>(rows: T[]): { chapter: string; rows: T[] }[] {
  const groups: { chapter: string; rows: T[] }[] = [];
  for (const row of rows) {
    const chapter = row.chapter || "Other";
    const last = groups[groups.length - 1];
    if (last && last.chapter === chapter) last.rows.push(row);
    else groups.push({ chapter, rows: [row] });
  }
  return groups;
}
