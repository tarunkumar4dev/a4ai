// src/lib/uploadLink/teacher.ts
// Teacher side of the upload link ("Copy Submissions" tab). Rows through the staff client (RLS: the assignment's
// class), actions through the RPCs in docs/upload-flow-api.md §3 (+ 19: retry_checks, submission_mark_history),
// re-grade through the backend (api doc §4.4: POST /internal/regrade with the teacher's JWT).

import { supabase } from "@/lib/supabaseClient";
import { backendRootUrl } from "@/lib/apiBase";
import { checkerFetch, humanError } from "@/components/checker/checkerFetch";
import { fmtIST } from "@/lib/uploadFlow";
import { pickCounted, type AttemptStatus, type CountPolicy, type ReviewReason } from "./status";

export interface LinkSettings {
  upload_link_enabled: boolean;
  link_token: string;
  opens_at: string | null;
  deadline: string | null;            // = closes_at
  status: string;                     // 'active' = link active
  max_attempts: number;
  allowed_mimes: string[];
  max_mb: number;
  max_pages: number;
  late_policy: "accept_flag" | "reject";
  count_policy: CountPolicy;
  auto_publish: boolean;
}

export interface AttemptFile { storage_path: string; mime: string; size: number; sha256: string; page_order: number; dup_other_student?: boolean }

export interface TeacherAttempt {
  id: string; student_id: string; attempt_no: number; status: AttemptStatus; is_late: boolean; submitted_at: string;
  files: AttemptFile[]; reject_reasons: { code: string; message: string; page_order?: number }[];
  grade: number | null; answer_key_version: number | null;
  sheet: {
    id: string; session_id: string; status: string; ai_marks: number | null; max_marks: number | null;
    final_marks: number | null; needs_review_reasons: ReviewReason[]; published: boolean; error: string | null;
  } | null;
  job: { state: string; last_error_code: string | null; error: string | null; updated_at: string } | null;
  marks: number | null;               // what counts: final (published) else AI
}

export interface StudentInfo { id: string; name: string; roll_no: string | null; class_level: string | null; parent_phone: string | null }
export interface StudentRow { student: StudentInfo; attempts: TeacherAttempt[]; counted: TeacherAttempt | null }

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(humanError(error));
  return data as T;
}

export async function loadCopySubmissions(assignmentId: string): Promise<{
  attempts: TeacherAttempt[]; students: Record<string, StudentInfo>; keyVersion: number | null;
}> {
  const [subsRes, keyRes] = await Promise.all([
    supabase.from("submissions")
      .select("id, student_id, attempt_no, status, is_late, submitted_at, files, reject_reasons, grade, answer_key_version")
      .eq("assignment_id", assignmentId).not("idempotency_key", "is", null)
      .order("attempt_no", { ascending: false }),
    supabase.from("assignment_ai_keys").select("version").eq("assignment_id", assignmentId).maybeSingle(),
  ]);
  if (subsRes.error) throw new Error(humanError(subsRes.error));
  const subs = subsRes.data || [];
  const ids = subs.map(s => s.id);
  const studentIds = [...new Set(subs.map(s => s.student_id))];
  const none = ["00000000-0000-0000-0000-000000000000"];
  const [sheetsRes, jobsRes, studentsRes] = await Promise.all([
    supabase.from("check_sheets")
      .select("id, session_id, submission_id, status, ai_marks, max_marks, final_marks, needs_review_reasons, published, error")
      .in("submission_id", ids.length ? ids : none),
    supabase.from("check_jobs").select("submission_id, state, last_error_code, error, updated_at")
      .in("submission_id", ids.length ? ids : none).order("updated_at", { ascending: false }),
    supabase.from("students").select("id, name, roll_no, class_level, parent_phone").in("id", studentIds.length ? studentIds : none),
  ]);
  const sheetBy = new Map((sheetsRes.data || []).map(s => [s.submission_id as string, s]));
  const jobBy = new Map<string, TeacherAttempt["job"]>();
  (jobsRes.data || []).forEach(j => { if (!jobBy.has(j.submission_id)) jobBy.set(j.submission_id, j); });
  const students: Record<string, StudentInfo> = {};
  (studentsRes.data || []).forEach(s => { students[s.id] = s; });

  const attempts: TeacherAttempt[] = subs.map(s => {
    const sheet = sheetBy.get(s.id) || null;
    const marks = sheet ? (sheet.published ? sheet.final_marks : sheet.ai_marks) : null;
    return {
      ...s, files: s.files || [], reject_reasons: s.reject_reasons || [],
      sheet: sheet ? { ...sheet, needs_review_reasons: sheet.needs_review_reasons || [] } : null,
      job: jobBy.get(s.id) || null, marks: marks == null ? null : Number(marks),
    } as TeacherAttempt;
  });
  return { attempts, students, keyVersion: keyRes.data?.version ?? null };
}

/** One row per student; `counted` = the attempt the count policy picks (latest / best). */
export function buildStudentRows(attempts: TeacherAttempt[], students: Record<string, StudentInfo>, policy: CountPolicy): StudentRow[] {
  const by = new Map<string, TeacherAttempt[]>();
  attempts.forEach(a => by.set(a.student_id, [...(by.get(a.student_id) || []), a]));
  return [...by.entries()].map(([sid, list]) => {
    const sorted = [...list].sort((a, b) => b.attempt_no - a.attempt_no);
    return {
      student: students[sid] || { id: sid, name: "Student", roll_no: null, class_level: null, parent_phone: null },
      attempts: sorted,
      counted: pickCounted(sorted, policy),
    };
  }).sort((a, b) => (a.student.roll_no || a.student.name).localeCompare(b.student.roll_no || b.student.name, "en", { numeric: true }));
}

export async function loadLinkSettings(assignmentId: string): Promise<LinkSettings> {
  const { data, error } = await supabase.from("assignments")
    .select("upload_link_enabled, link_token, opens_at, deadline, status, max_attempts, allowed_mimes, max_mb, max_pages, late_policy, count_policy, auto_publish")
    .eq("id", assignmentId).single();
  if (error) throw new Error(humanError(error));
  return data as LinkSettings;
}

export async function saveLinkSettings(assignmentId: string, patch: Partial<LinkSettings>): Promise<void> {
  const { error } = await supabase.from("assignments").update(patch).eq("id", assignmentId);
  if (error) throw new Error(/check constraint/i.test(error.message)
    ? "Check the settings: opening time before the deadline, max 10 MB, max 30 pages, at least one format."
    : humanError(error));
}

export type PublishResult = { state: string; published?: string[]; blocked?: { id: string; status: string }[];
                              skipped?: { id: string; status: string | null; reason: string }[] };

export const publishResults = (args: { assignmentId?: string; submissionIds?: string[] }) =>
  rpc<PublishResult>("publish_results", args.assignmentId ? { p_assignment_id: args.assignmentId } : { p_submission_ids: args.submissionIds });

export const unpublishResults = (submissionIds: string[], reason: string) =>
  rpc<{ state: string; unpublished?: string[]; skipped?: { id: string; reason: string }[]; message?: string }>(
    "unpublish_results", { p_submission_ids: submissionIds, p_reason: reason });

export const overrideMarks = (submissionId: string, qNo: string, marks: number, note?: string) =>
  rpc<{ state: string; total?: number; published?: boolean; message?: string }>(
    "override_marks", { p_submission_id: submissionId, p_q_no: qNo, p_marks: marks, p_note: note?.trim() || null });

export const retryChecks = (submissionIds: string[]) =>
  rpc<{ state: string; queued?: string[]; skipped?: { id: string; reason: string }[] }>("retry_checks", { p_submission_ids: submissionIds });

export interface MarkEvent { at: string; type: string; by_me: boolean; total: number | null; remarks: string | null; details: Record<string, unknown> }
export const markHistory = (submissionId: string) =>
  rpc<{ state: string; events?: MarkEvent[] }>("submission_mark_history", { p_submission_id: submissionId });

/** api doc §4.4: attempts whose key version is older than the key get a new job; old marks go to the audit. */
export const regradeSubmissions = (assignmentId: string, submissionIds: string[]) =>
  checkerFetch(backendRootUrl("/internal/regrade"), "POST", { assignment_id: assignmentId, submission_ids: submissionIds }) as
    Promise<Record<string, unknown>>;

export async function signedSubmissionUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await supabase.storage.from("submissions").createSignedUrls(paths, 600);
  const out: Record<string, string> = {};
  (data || []).forEach(d => { if (d.path && d.signedUrl) out[d.path] = d.signedUrl; });
  return out;
}

export const linkUrl = (token: string) => `${window.location.origin}/s/${token}`;

export const shareLinkMessage = (title: string, url: string, deadline: string | null) =>
  `📝 ${title}\nUpload photos or a PDF of your answer copy here:\n${url}\n` +
  `${deadline ? `⏰ Deadline: ${fmtIST(deadline)}\n` : ""}Keep your access code ready.`;

export const resultMessage = (studentName: string, title: string, url: string) =>
  `📊 ${studentName}'s result for "${title}" is ready.\nOpen the link and enter the access code to see it:\n${url}`;
