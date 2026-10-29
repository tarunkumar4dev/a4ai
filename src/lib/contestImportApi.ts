// src/lib/contestImportApi.ts
// "Upload PDF → Contest" (backend: supabase/migrations/24_contest_import.sql):
//   1. browser uploads the PDF to Storage  {IMPORT_BUCKET}/{uid}/contest-imports/{uuid}.pdf
//   2. POST {base}/v1/contests/import-pdf  {"path"}   → 202 {job_id}     (429 = daily limit)
//   3. GET  {base}/v1/contests/import-pdf/{job_id}    → ImportJob        (404 = not your job)
// result.questions are already in the POST /contests shape (correct_answer = bare "B") — forward them unchanged.
//
// Switches (for testing without the backend):
//   ?mockImport=1  or  VITE_CONTEST_IMPORT_MOCK=1   → canned 50-question result, no network / no Storage
//   ?mockImport=fail  → first run fails (retryable), "Try again" succeeds;  ?mockImport=fatal → fails for good
//   ?mockImport=gone  → first run fails (retryable), the retry POST says the file is gone (400) → auto re-upload
//   VITE_CONTEST_IMPORT_API=https://host/api        → other backend for the import only
//   ?importApi=http://localhost:8001/api            → same, dev builds only

import { getBackendApiBase } from "@/lib/apiBase";
import { getAuthHeaders, errorFromResponse } from "@/lib/contestApi";
import { supabase } from "@/lib/supabaseClient";

export const IMPORT_BUCKET = "answer-keys";
export const MAX_PDF_MB = 15;

export type ImportStatus = "queued" | "processing" | "done" | "failed";
export type AnswerSource = "key" | "ai" | "missing";

export interface ImportedQuestion {
  question_text: string;
  question_type: string;
  options: { label: string; text: string }[];
  correct_answer: string;
  explanation: string;
  marks: number;
  difficulty: string;
  chapter: string;
  source_number?: number | string | null;
  answer_source?: AnswerSource;
  /** false = the parser couldn't build a complete question; the teacher must fix or delete it */
  usable?: boolean;
}

/** question = the paper's source_number, or null for the whole paper */
export interface ImportWarning { question: number | string | null; code: string; message: string }

export interface ImportResult {
  title: string;
  subject: string;
  class_grade: string;
  institute?: string | null;
  board?: string | null;
  duration_minutes?: number | null;
  total_marks?: number | null;
  answer_key_found: boolean;
  answer_key_count: number;
  questions: ImportedQuestion[];
  warnings: ImportWarning[];
}

export interface ImportJob {
  status: ImportStatus;
  progress?: number | null;
  error?: string | null;
  retryable?: boolean;
  result?: ImportResult | null;
}

/** NOT_FOUND = GET 404 (not this teacher's job), LIMIT = 429, BAD_PATH = POST 400/404 (the stored file is gone / unusable) */
export class ImportError extends Error {
  kind: "NOT_FOUND" | "LIMIT" | "BAD_PATH" | "AUTH" | "OTHER";
  constructor(message: string, kind: ImportError["kind"]) { super(message); this.name = "ImportError"; this.kind = kind; }
}

/** Option label the answer points to: "B", "(b)", "B) text", or the option's own text. */
export function answerLabel(answer: string | undefined, options: { label: string; text: string }[]): string | null {
  const a = (answer || "").trim();
  if (!a) return null;
  if (/^\(?[A-Ha-h]\)?$/.test(a)) return a.replace(/[()]/g, "").toUpperCase();
  const m = a.match(/^\(?([A-Ha-h])[).:\s-]/);
  if (m) return m[1].toUpperCase();
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  return options.find((o) => norm(o.text) === norm(a))?.label.toUpperCase() ?? null;
}

const WARNING_TEXT: Record<string, string> = {
  KEY_MISMATCH_SUSPECT: "AI thinks the key may be wrong",
  KEY_GRID_MISMATCH: "The answer key disagrees with itself",
  KEY_TEXT_MISMATCH: "The answer key disagrees with itself",
  TOO_MANY_OPTIONS: "Only options A–D are shown",
  OPTION_LABELS_RENUMBERED: "Option labels were renumbered to A–D",
  DURATION_CLAMPED: "Duration was adjusted to 5–180 minutes",
  ANSWER_MISSING: "No answer found in the key",
  AI_ANSWER: "Answer was guessed by AI",
  KEY_WITHOUT_QUESTION: "The key has an answer for a question that wasn't found",
  NUMBER_UNREADABLE: "A question number couldn't be read",
  KEY_CHECK_SKIPPED: "Answer double-check was skipped",
};

/** Friendly line for a warning code; unknown codes fall back to the backend's message. */
export function warningText(w: ImportWarning): { title: string; detail: string | null } {
  const title = WARNING_TEXT[w.code];
  if (!title) return { title: w.message || w.code, detail: null };
  return { title, detail: w.message && w.message !== title ? w.message : null };
}

function query(name: string): string | null {
  try { return new URLSearchParams(window.location.search).get(name); } catch { return null; }
}

function mockMode(): "ok" | "fail" | "fatal" | "gone" | null {
  const q = query("mockImport");
  if (q === "fail" || q === "fatal" || q === "gone") return q;
  return q === "1" || import.meta.env.VITE_CONTEST_IMPORT_MOCK === "1" ? "ok" : null;
}
export const isImportMock = () => mockMode() !== null;

function importBase(): string {
  const override = (import.meta.env.DEV && query("importApi")) || (import.meta.env.VITE_CONTEST_IMPORT_API as string | undefined);
  return `${(override || getBackendApiBase()).replace(/\/+$/, "")}/v1/contests/import-pdf`;
}

/** Step 1: PDF → private Storage. Returns the storage path the backend reads. */
export async function uploadImportPdf(file: File): Promise<string> {
  if (isImportMock()) return `mock/contest-imports/${crypto.randomUUID()}.pdf`;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ImportError("Please log in again.", "AUTH");
  const path = `${user.id}/contest-imports/${crypto.randomUUID()}.pdf`;
  const { error } = await supabase.storage.from(IMPORT_BUCKET).upload(path, file, { contentType: "application/pdf" });
  if (error) throw new ImportError(`Upload failed: ${error.message}`, "OTHER");
  return path;
}

// mock: which paths already failed once (?mockImport=fail → the retry succeeds); POST count for ?mockImport=gone
const mockFailedOnce = new Set<string>();
let mockGoneCalls = 0;

/** Step 2: start the parse for an uploaded path (also used by "Try again" — same path, no re-upload). */
export async function startPdfImport(path: string, signal?: AbortSignal): Promise<string> {
  const mock = mockMode();
  if (mock) {
    if (mock === "gone") {
      mockGoneCalls += 1;
      if (mockGoneCalls === 2) throw new ImportError("This file couldn't be used (file not found). Please upload it again.", "BAD_PATH");
      return `mock-${mockGoneCalls === 1 ? "fail" : "ok"}-${Date.now()}`;
    }
    const fail = mock === "fatal" || (mock === "fail" && !mockFailedOnce.has(path));
    if (mock === "fail") mockFailedOnce.add(path);
    return `mock-${fail ? mock : "ok"}-${Date.now()}`;
  }
  const res = await fetch(importBase(), {
    method: "POST", headers: await getAuthHeaders(), body: JSON.stringify({ path }), signal,
  });
  if (!res.ok) {
    if (res.status === 429) throw new ImportError("You've reached today's import limit, try again tomorrow.", "LIMIT");
    if (res.status === 401) throw new ImportError("Please log in again.", "AUTH");
    const err = await errorFromResponse(res, "Could not start reading the PDF");
    if (res.status === 400 || res.status === 404) throw new ImportError(`This file couldn't be used (${err.message}). Please upload it again.`, "BAD_PATH");
    throw new ImportError(err.message, "OTHER");
  }
  const body = await res.json();
  if (!body?.job_id) throw new ImportError("The server did not return a job id.", "OTHER");
  return String(body.job_id);
}

export type RetryOutcome = { jobId: string; path: string; reuploaded: boolean } | { needFile: true };

/**
 * "Try again": re-POST the SAME path. If the backend says that file is gone (400/404), upload the File again to a
 * NEW path when it is still in memory; otherwise the teacher has to pick the file again ({needFile}).
 * Other errors (429, 401, 5xx) are thrown as they are.
 */
export async function retryImport(
  path: string,
  file: File | null,
  deps: { start: (path: string) => Promise<string>; upload: (file: File) => Promise<string> } = { start: (p) => startPdfImport(p), upload: uploadImportPdf },
): Promise<RetryOutcome> {
  try {
    return { jobId: await deps.start(path), path, reuploaded: false };
  } catch (e) {
    if (!(e instanceof ImportError && e.kind === "BAD_PATH")) throw e;
    if (!file) return { needFile: true };
    const fresh = await deps.upload(file);
    return { jobId: await deps.start(fresh), path: fresh, reuploaded: true };
  }
}

/** Step 3: poll. Throws ImportError("NOT_FOUND") on 404 — stop polling and forget the job. */
export async function getPdfImportJob(jobId: string, signal?: AbortSignal): Promise<ImportJob> {
  if (jobId.startsWith("mock-")) {
    const { mockImportJob } = await import("./contestImportMock");
    return mockImportJob(jobId);
  }
  const res = await fetch(`${importBase()}/${encodeURIComponent(jobId)}`, { headers: await getAuthHeaders(), signal });
  if (res.status === 404) throw new ImportError("This import isn't available any more. Please upload the PDF again.", "NOT_FOUND");
  if (res.status === 401) throw new ImportError("Please log in again.", "AUTH");
  if (!res.ok) throw new ImportError((await errorFromResponse(res, "Could not check the import")).message, "OTHER");
  return res.json();
}
