// src/lib/questionBankApi.ts
// "Question Bank → Paper Builder" (backend: /api/v1/question-banks, supabase/migrations/33_question_bank.sql).
//   POST   /question-banks                         {name, questions[]}  → {bank, stats, warnings}
//   GET    /question-banks                         → {banks}
//   GET    /question-banks/{id}/questions          → {bank, questions}
//   PATCH  /question-banks/{id}/questions/{qid}    DELETE …/questions/{qid}    DELETE /question-banks/{id}
//   POST   /question-banks/{id}/build-paper        → the PDF / DOCX file (+ X-Paper-Meta header)
// The questions of a bank are the ones the teacher reviewed in "Contest from PDF" — there is no second parser.
// No request carries a user id: the backend takes the owner from the login token.

import { getBackendApiBase } from "@/lib/apiBase";
import { getAuthHeaders, errorFromResponse } from "@/lib/contestApi";
import type { ImportedQuestion } from "@/lib/contestImportApi";

export type QType = "mcq" | "true_false" | "short" | "long";
export const QTYPES: QType[] = ["mcq", "true_false", "short", "long"];
export const QTYPE_LABEL: Record<QType, string> = { mcq: "MCQ", true_false: "True / False", short: "Short answer", long: "Long answer" };
export const MAX_BANK_QUESTIONS = 300;
export const MAX_SECTIONS = 6;

export const PAPER_TEMPLATES = [
  { id: "modern", label: "Modern", hint: "Coloured section bars" },
  { id: "classic", label: "Classic", hint: "Formal, serif" },
  { id: "compact", label: "Compact", hint: "Fits more per page" },
  { id: "colorful", label: "Colorful", hint: "Institute style" },
] as const;
export type PaperTemplate = (typeof PAPER_TEMPLATES)[number]["id"];

export interface BankQuestionPayload {
  question_text: string;
  question_type: string;
  options: { label: string; text: string }[];
  correct_answer: string | null;
  answer_source: "key" | "ai" | "missing" | "teacher";
  marks: number | null;
  usable: boolean;
  source_number?: number | null;
}

export interface QuestionBank {
  id: string;
  name: string;
  source_filename: string | null;
  status: string;
  subject: string | null;
  class_grade: string | null;
  board: string | null;
  created_at: string;
  warnings: string[];
  can_edit: boolean;
  question_count?: number;
}

export interface BankQuestion {
  id: string;
  position: number;
  qtype: QType;
  question_text: string;
  options: { label: string; text: string }[];
  answer: string | null;
  answer_source: "key" | "teacher" | null;
  marks: number | null;
  exam_year: number | null;
  source_tag: string | null;
  needs_review: boolean;
  excluded: boolean;
}

export interface BankStats {
  received: number; saved: number; duplicates_removed: number; skipped_empty: number; needs_review: number;
  answers_matched: number; ai_answers_dropped: number; unresolved_answers: number; per_type: Record<QType, number>;
}

export interface PaperSection { qtype: QType; count: number; marks_each: number }

export interface BuildPaperBody {
  title: string;
  institute_name?: string | null;
  sections: PaperSection[];
  include_answer_key: boolean;
  template: PaperTemplate;
  shuffle: boolean;
  year_filter?: number | null;
  format: "pdf" | "docx";
  allow_needs_review?: boolean;
  subject?: string | null;
  class_grade?: string | null;
  board?: string | null;
}

export interface PaperMeta {
  test_id: string | null; saved_to_history: boolean; questions: number; total_marks: number;
  answers_found: number; answers_missing: number; answer_key_included: boolean;
}

export class QuestionBankError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.name = "QuestionBankError"; this.status = status; }
}

// ── pure helpers (unit tested) ───────────────────────────────────────────────

/** One reviewed question of the "Contest from PDF" screen, with what the teacher did to it. */
export interface ReviewedQuestion {
  q: ImportedQuestion;
  /** the teacher picked / typed the answer, or tapped "Answer is correct" */
  confirmed: boolean;
  /** false: the parser could not read it completely and the teacher has not fixed it */
  usable: boolean;
}

/**
 * Review screen → POST /question-banks questions. An answer the teacher confirmed is sent as "teacher"; an AI
 * guess nobody confirmed stays "ai" (the backend then saves the question WITHOUT an answer and flags it).
 */
export function toBankQuestions(items: ReviewedQuestion[]): BankQuestionPayload[] {
  return items.map(({ q, confirmed, usable }) => {
    const answer = (q.correct_answer || "").trim();
    const source = !answer ? "missing" : confirmed ? "teacher" : q.answer_source === "key" || q.answer_source === "ai" ? q.answer_source : "teacher";
    const num = Number(q.source_number);
    const marks = Number(q.marks);
    return {
      question_text: q.question_text || "",
      question_type: q.question_type || "",
      options: (q.options || []).filter((o) => o.text.trim()).map((o) => ({ label: o.label || "", text: o.text })),
      correct_answer: answer || null,
      answer_source: source,
      marks: Number.isFinite(marks) && marks > 0 && marks <= 100 ? marks : null,
      usable,
      source_number: Number.isInteger(num) && num >= 0 ? num : null,
    };
  });
}

/** Questions a paper may use, per type: not excluded, and not flagged unless the teacher allows flagged ones. */
export function availableByType(questions: BankQuestion[], opts: { allowNeedsReview?: boolean; year?: number | null } = {}): Record<QType, number> {
  const out: Record<QType, number> = { mcq: 0, true_false: 0, short: 0, long: 0 };
  for (const q of questions) {
    if (q.excluded) continue;
    if (q.needs_review && !opts.allowNeedsReview) continue;
    if (opts.year != null && q.exam_year !== opts.year) continue;
    if (q.qtype in out) out[q.qtype] += 1;
  }
  return out;
}

/** Sections to start the dialog with: one per type the bank has, in the usual paper order. */
export function defaultSections(available: Record<QType, number>): PaperSection[] {
  const marks: Record<QType, number> = { mcq: 1, true_false: 1, short: 3, long: 5 };
  const cap: Record<QType, number> = { mcq: 10, true_false: 5, short: 5, long: 3 };
  return QTYPES.filter((t) => available[t] > 0).map((t) => ({ qtype: t, count: Math.min(available[t], cap[t]), marks_each: marks[t] }));
}

/** The same message the backend gives ("Section A needs 10 MCQs, bank has 6."), before the request is sent. */
export function sectionProblems(sections: PaperSection[], available: Record<QType, number>): string[] {
  const left = { ...available };
  const out: string[] = [];
  sections.forEach((s, i) => {
    const letter = "ABCDEF"[i];
    if (!(s.count >= 1) || !Number.isInteger(s.count)) out.push(`Section ${letter}: enter how many questions.`);
    else if (!(s.marks_each >= 1) || !Number.isInteger(s.marks_each)) out.push(`Section ${letter}: enter the marks per question.`);
    else if (s.count > left[s.qtype]) out.push(`Section ${letter} needs ${s.count} ${QTYPE_LABEL[s.qtype]} question${s.count === 1 ? "" : "s"}, bank has ${Math.max(0, left[s.qtype])}.`);
    left[s.qtype] -= s.count;
  });
  return out;
}

export const paperTotals = (sections: PaperSection[]) => ({
  questions: sections.reduce((n, s) => n + (Number(s.count) || 0), 0),
  marks: sections.reduce((n, s) => n + (Number(s.count) || 0) * (Number(s.marks_each) || 0), 0),
});

/** The PDF export cannot print Hindi (its fonts have no Devanagari); Word can. */
export const hasIndicText = (texts: (string | null | undefined)[]) => texts.some((t) => /[ऀ-෿]/.test(t || ""));

export function paperFileName(title: string, format: "pdf" | "docx"): string {
  const base = (title || "").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50) || "question_paper";
  return `${base}.${format}`;
}

export function parsePaperMeta(header: string | null): PaperMeta | null {
  if (!header) return null;
  try { const m = JSON.parse(header); return m && typeof m === "object" ? (m as PaperMeta) : null; } catch { return null; }
}

// ── API ──────────────────────────────────────────────────────────────────────

const base = () => `${getBackendApiBase().replace(/\/+$/, "")}/v1/question-banks`;

async function fail(res: Response, fallback: string): Promise<never> {
  if (res.status === 401) throw new QuestionBankError("Please log in again.", 401);
  if (res.status === 429) throw new QuestionBankError("Too many requests. Please wait a minute and try again.", 429);
  const err = await errorFromResponse(res, fallback);
  throw new QuestionBankError(err.message, res.status);
}

async function call<T>(path: string, init: RequestInit, fallback: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${base()}${path}`, { ...init, headers: await getAuthHeaders() });
  } catch {
    throw new QuestionBankError("No connection to the server. Check your internet and try again.", 0);
  }
  if (!res.ok) await fail(res, fallback);
  return res.json();
}

export const listBanks = () =>
  call<{ banks: QuestionBank[]; max_banks: number }>("", { method: "GET" }, "Could not load your question banks");

export const createBank = (body: {
  name: string; questions: BankQuestionPayload[]; source_filename?: string | null; source_tag?: string | null;
  subject?: string | null; class_grade?: string | null; board?: string | null;
}) => call<{ bank: QuestionBank; stats: BankStats; warnings: string[] }>("", { method: "POST", body: JSON.stringify(body) }, "Could not save the question bank");

export const getBankQuestions = (bankId: string) =>
  call<{ bank: QuestionBank; questions: BankQuestion[] }>(`/${encodeURIComponent(bankId)}/questions`, { method: "GET" }, "Could not load the questions");

export const patchBankQuestion = (bankId: string, questionId: string, patch: {
  question_text?: string; options?: { label: string; text: string }[]; answer?: string | null; marks?: number; excluded?: boolean; reviewed?: true;
}) => call<{ question: BankQuestion }>(`/${encodeURIComponent(bankId)}/questions/${encodeURIComponent(questionId)}`, { method: "PATCH", body: JSON.stringify(patch) }, "Could not save the question");

export const deleteBankQuestion = (bankId: string, questionId: string) =>
  call<{ deleted: boolean }>(`/${encodeURIComponent(bankId)}/questions/${encodeURIComponent(questionId)}`, { method: "DELETE" }, "Could not delete the question");

export const deleteBank = (bankId: string) =>
  call<{ deleted: boolean }>(`/${encodeURIComponent(bankId)}`, { method: "DELETE" }, "Could not delete the question bank");

/** Builds the paper and returns the file. The questions are chosen by the backend, only from this bank. */
export async function buildPaper(bankId: string, body: BuildPaperBody): Promise<{ blob: Blob; fileName: string; meta: PaperMeta | null }> {
  let res: Response;
  try {
    res = await fetch(`${base()}/${encodeURIComponent(bankId)}/build-paper`, { method: "POST", headers: await getAuthHeaders(), body: JSON.stringify(body) });
  } catch {
    throw new QuestionBankError("No connection to the server. Check your internet and try again.", 0);
  }
  if (!res.ok) await fail(res, "Could not build the paper");
  const blob = await res.blob();
  if (!blob.size) throw new QuestionBankError("The server returned an empty file. Please try again.", res.status);
  return { blob, fileName: paperFileName(body.title, body.format), meta: parsePaperMeta(res.headers.get("X-Paper-Meta")) };
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
