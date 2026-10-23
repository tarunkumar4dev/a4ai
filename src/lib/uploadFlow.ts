// src/lib/uploadFlow.ts
// Student side of the assignment upload flow (contract: docs/upload-flow-api.md, migration 18_upload_flow.sql).
// Students never call the backend: 4 anon RPCs (get_assignment_link, verify_access_code, create_submission,
// my_submissions) + a direct upload to the private `submissions` bucket. Identity = the access code only.
// plain fetch, not supabase-js: keeps the student link's first load small (src/lib/uploadLink/anonRpc.ts)
import { RpcError, anonRpc } from "@/lib/uploadLink/anonRpc";
import { compressPhoto } from "@/lib/uploadLink/compressWorker";
import {
  JPEG_QUALITY, LONG_EDGE, analyzeQuality, blobBytes, classify, formatError, heicToJpeg, pdfPageCount, sizeError,
} from "@/lib/uploadLink/files";

/* ─── RPC shapes ─────────────────────────────────────────────────── */
export type LinkState = "not_found" | "inactive" | "not_open" | "closed" | "open" | "open_late";

export type LinkAssignment = {
  id: string;
  title: string;
  instructions: string | null;
  batch_name: string | null;
  opens_at: string | null;
  closes_at: string | null;
  grace_minutes: number;
  late_policy: "accept_flag" | "reject";
  count_policy: "latest" | "best";
  max_attempts: number;
  allowed_mimes: string[];
  max_mb: number;
  max_pages: number;
  max_marks: number | null;
};

export type LinkInfo = {
  state: LinkState | "invalid_code" | "locked";
  server_time?: string;
  title?: string;
  assignment?: LinkAssignment;
  student?: { state: "ok" | "not_in_class" | "invalid_code" | "locked"; name?: string; attempts_used?: number;
              attempts_left?: number; retry_after_sec?: number; scope?: "ip" | "code" };
  question_paper?: { file_url: string; file_name: string | null } | null;
  retry_after_sec?: number;
  scope?: "ip" | "code";
};

export type QuestionResult = { q_no: string; max_marks: number; marks: number; counted: boolean;
                               not_attempted: boolean; feedback: string | null; confidence: string | null };

export type Attempt = {
  id: string;
  attempt_no: number;
  label: string;
  status: string;
  is_late: boolean;
  counts?: boolean;
  submitted_at: string | null;
  files: { page_order: number; mime: string; size: number }[];
  reject_reasons: { code: string; message: string; page_order?: number }[];
  result: { marks: number; max_marks: number; percentage: number | null; feedback: string | null;
            published_at: string; per_question: QuestionResult[] } | null;
};

export type MySubmissions = {
  state: string;
  assignment?: { id: string; title: string; max_attempts: number; count_policy: string };
  attempts_used?: number;
  attempts_left?: number;
  attempts?: Attempt[];
  retry_after_sec?: number;
  scope?: "ip" | "code";
};

export type FileError = { index: number; code: string; message: string };

export type CreateResult = {
  state: string;
  submission?: Attempt;
  warnings?: { code: string; page_order: number; message: string }[];
  attempts_left?: number;
  errors?: FileError[];
  retry_after_sec?: number;
  scope?: "ip" | "code";
  opens_at?: string;
  closes_at?: string;
  max_attempts?: number;
  attempts_used?: number;
};

export type VerifiedStudent = { name: string; roll_no: string | null; class_level: string | null;
                                section_name: string | null; batch_name: string | null; lab_batch_name: string | null;
                                institute_name: string | null; email_masked: string | null };

/* ─── Limits ─────────────────────────────────────────────────────── */
export const BUCKET = "submissions";
export const BUCKET_MAX_MB = 10;              // bucket file_size_limit; a link's max_mb is 1–10
const MB = 1024 * 1024;

/* ─── Status text (what the student sees, docs §1; a failed check is still "being checked" for them) ─── */
export const STATUS_TEXT: Record<string, string> = {
  uploaded: "Uploaded",
  waiting_key: "Waiting for the teacher's answer key",
  queued: "Checking will start soon",
  checking: "Being checked",
  waiting_quota: "Will be checked tomorrow",
  checked: "Checked. Your teacher will share the result.",
  needs_review: "Checked. Your teacher will share the result.",
  published: "Result ready",
  failed: "Being checked",
  rejected: "Problem with the file",
  submitted: "Submitted",
  graded: "Graded",
};

export function fmtIST(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short",
                                                 hour: "numeric", minute: "2-digit", hour12: true }) + " IST";
}

export function fmtCountdown(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${String(s % 60).padStart(2, "0")} sec` : `${s} sec`;
}

/** A short line for every non-success state. `{countdown}` is filled live by the caller. */
export function stateMessage(r: { state: string; scope?: string; opens_at?: string | null; closes_at?: string | null;
                                  max_attempts?: number; attempts_used?: number }): string {
  switch (r.state) {
    case "invalid_code": return "Wrong access code. Check with your teacher.";
    case "locked":
      return r.scope === "code"
        ? "Too many wrong tries for this code. Try again in {countdown}."
        : "Too many wrong codes from this network. Try again in {countdown}.";
    case "too_many_requests": return "Too many submits. Try again in {countdown}.";
    case "not_found": return "This link isn't for your class. Ask your teacher for the right link.";
    case "not_in_class": return "You're not in this class. Talk to your teacher.";
    case "inactive": return "This link is closed. Talk to your teacher.";
    case "not_open": return r.opens_at ? `Uploads open on ${fmtIST(r.opens_at)}.` : "Uploads aren't open yet.";
    case "closed": return `The deadline${r.closes_at ? ` (${fmtIST(r.closes_at)})` : ""} has passed. Uploads are closed.`;
    case "max_attempts":
      return `You've used all your attempts (${r.attempts_used ?? "?"}/${r.max_attempts ?? "?"}).`;
    case "conflict": return "Two uploads clashed. Tap Submit again.";
    case "invalid_request": return "Something went wrong. Reload the page and try again.";
    default: return "Something went wrong. Try again in a moment.";
  }
}

/* ─── Idempotency key: one per attempt (assignment + access code), kept until the server accepted it ─── */
const keyName = (assignmentId: string, code: string) => `a4ai_upload_key_${assignmentId}_${code}`;

export function attemptKey(assignmentId: string, code: string): string {
  try {
    const saved = localStorage.getItem(keyName(assignmentId, code));
    if (saved && /^[A-Za-z0-9_-]{16,128}$/.test(saved)) return saved;
  } catch { /* private mode: a key per page load is still safe (the server dedupes by key) */ }
  const k = crypto.randomUUID().replace(/-/g, "");
  try { localStorage.setItem(keyName(assignmentId, code), k); } catch { /* ignore */ }
  return k;
}

export function clearAttemptKey(assignmentId: string, code: string): void {
  try { localStorage.removeItem(keyName(assignmentId, code)); } catch { /* ignore */ }
}

/* ─── Files ──────────────────────────────────────────────────────── */
export type PreparedPage = {
  blob: Blob; mime: string; ext: string; size: number; name: string;
  pages: number;                 // PDF page count (pdf.js), 1 for a photo
  warning: string | null;        // dark / tiny photo → "Photo looks unclear. Retake?"
};

const MIME_EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png",
                                           "image/webp": "webp" };

/**
 * One picked file → what will be uploaded. HEIC (iPhone) → JPEG in the browser first; every photo → ~1600 px JPEG
 * q 0.8 (smaller upload on school Wi-Fi; the canvas re-encode also drops EXIF / GPS); PDFs as they are.
 * Throws an Error with a short message the page shows next to that file ("notes.docx: only photos or PDF allowed").
 */
export async function preparePage(file: File, allowedMimes: string[], maxMb: number): Promise<PreparedPage> {
  const kind = classify(file);
  const limit = Math.min(maxMb || BUCKET_MAX_MB, BUCKET_MAX_MB);
  if (kind === "bad") throw new Error(formatError(file.name));
  if (kind === "pdf" && !allowedMimes.includes("application/pdf")) throw new Error(`${file.name}: only photos are allowed for this test`);
  if (kind !== "pdf" && !allowedMimes.some(m => m.startsWith("image/"))) throw new Error(`${file.name}: only PDF is allowed for this test`);

  if (kind === "pdf") {
    if (file.size === 0) throw new Error(`${file.name}: the file is empty`);
    if (file.size > limit * MB) throw new Error(sizeError(file.name, file.size, limit));
    const pages = await pdfPageCount(file);
    return { blob: file, mime: "application/pdf", ext: "pdf", size: file.size, name: file.name, pages, warning: null };
  }

  const src = kind === "heic"
    ? new File([await heicToJpeg(file)], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" })
    : file;
  // Web Worker (OffscreenCanvas) when available, so 20+ photos never freeze the page; else the main thread
  const { blob, type: mime, tooSmall, tooDark } = await compressPhoto(src, LONG_EDGE, JPEG_QUALITY);
  if (!MIME_EXT[mime] || !allowedMimes.includes(mime)) throw new Error(formatError(file.name));
  if (blob.size === 0) throw new Error(`${file.name}: the file is empty`);
  if (blob.size > limit * MB) throw new Error(sizeError(file.name, blob.size, limit));
  const q = tooSmall == null || tooDark == null ? await analyzeQuality(blob) : { tooSmall, tooDark };
  return { blob, mime, ext: MIME_EXT[mime], size: blob.size, name: file.name, pages: 1,
           warning: q.tooSmall || q.tooDark ? "Photo looks unclear. Retake?" : null };
}

export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blobBytes(blob));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Uploads: src/lib/uploadLink/storageUpload.ts (same Storage call over XHR, for per-file progress). A failed try
// gets a NEW uuid; the old object, if any, is never referenced and is cleaned up after 24 h.

/* ─── RPCs ───────────────────────────────────────────────────────── */
export const SERVER_ERROR = "Something went wrong. Try again or contact your teacher.";

/** The server answered with an error (4xx/5xx): generic text for the student, status + code in the console
 *  (never the server's message — it can echo row data). No answer at all: the caller's offline text. */
export function rpcFailure(name: string, e: unknown, offline: string): Error {
  if (e instanceof RpcError && e.status > 0) {
    console.error(`[upload-link] ${name} failed: HTTP ${e.status}${e.code ? ` code ${e.code}` : ""}`);
    return new Error(SERVER_ERROR);
  }
  return new Error(offline);
}

export async function getAssignmentLink(ref: string, code?: string): Promise<LinkInfo> {
  try { return await anonRpc<LinkInfo>("get_assignment_link", { p_ref: ref, ...(code ? { p_code: code } : {}) }); }
  catch (e) { throw rpcFailure("get_assignment_link", e, "Couldn't load the link. Check your internet and reload."); }
}

export async function verifyAccessCode(code: string): Promise<{ state: string; student?: VerifiedStudent;
                                                                  retry_after_sec?: number; scope?: "ip" | "code" }> {
  try { return await anonRpc("verify_access_code", { p_code: code }); }
  catch (e) { throw rpcFailure("verify_access_code", e, "Couldn't check the code. Check your internet and try again."); }
}

export async function createSubmission(code: string, assignmentId: string, key: string,
                                       files: { storage_path: string; mime: string; size: number; sha256: string;
                                                page_order: number }[]): Promise<CreateResult> {
  try {
    return await anonRpc<CreateResult>("create_submission", { p_code: code, p_assignment_id: assignmentId,
                                                             p_idempotency_key: key, p_files: files });
  } catch (e) {
    throw rpcFailure("create_submission", e, "No reply from the server. Tap Submit again — it won't be submitted twice.");
  }
}

export async function mySubmissions(code: string, assignmentId: string): Promise<MySubmissions> {
  try { return await anonRpc<MySubmissions>("my_submissions", { p_code: code, p_assignment_id: assignmentId }); }
  catch (e) { throw rpcFailure("my_submissions", e, "Couldn't load your uploads."); }
}

/** get_student_by_code (05) — only the ids the Storage path needs; null for a wrong code. */
export async function getStudentIds(code: string): Promise<{ id: string; institute_id: string } | null> {
  const row = await anonRpc<{ id: string; institute_id: string } | null>("get_student_by_code", { p_code: code });
  return row ? { id: row.id, institute_id: row.institute_id } : null;
}
