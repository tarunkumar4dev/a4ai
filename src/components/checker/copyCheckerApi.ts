// src/components/checker/copyCheckerApi.ts
// Data + calls for "Check Copies". Rows: check_sessions / check_sheets (owner-only RLS, migration 12).
// Files: private bucket "answer-sheets" under <teacher uid>/<session>/… . AI work: backend /copy-checker.

import { supabase } from "@/lib/supabaseClient";
import { compressImage } from "@/lib/imageCompress";
import type { AiResult } from "./AiGradeBreakdown";
import { backendUrl } from "@/lib/apiBase";
import { checkerFetch, humanError } from "./checkerFetch";

export type Strictness = "easy" | "medium" | "hard" | "extreme";
export type SheetStatus = "pending" | "uploaded" | "checking" | "checked" | "failed" | "approved";

export interface RubricPoint { id: string; text: string; expected: string; marks: number }
export interface RubricQuestion {
  q_no: string; question_text: string; marks: number; answer_type?: string;
  scheme_source?: "key" | "estimated" | "adjusted"; or_group?: string | null;
  points: RubricPoint[];
  subparts: { sub_id: string; text: string; marks: number; points: RubricPoint[] }[];
}
export interface Rubric { questions: RubricQuestion[]; total_marks: number; total_questions: number; marks_mismatch?: string }

export interface CheckSession {
  id: string; title: string; source: "test" | "upload"; test_id: string | null; batch_id: string | null;
  subject: string | null; class_grade: string | null; strictness: Strictness;
  qp_paths: string[]; key_paths: string[];
  rubric: Rubric | null; rubric_status: "pending" | "building" | "ready" | "failed"; rubric_error: string | null;
  total_marks: number | null; created_at: string;
}

export interface CheckSheet {
  id: string; session_id: string; student_id: string | null; student_name: string; roll_no: string | null;
  pages: string[]; status: SheetStatus; ai_result: AiResult | null; ai_marks: number | null; max_marks: number | null;
  final_marks: number | null; feedback: string | null; error: string | null; created_at: string; updated_at: string;
}

export const STRICTNESS_LABEL: Record<Strictness, string> = {
  easy: "Lenient", medium: "Standard", hard: "Strict", extreme: "Very strict",
};

export const MAX_PAGES = 16;
const BUCKET = "answer-sheets";
const API = backendUrl("/v1/copy-checker");

const request = (method: "POST" | "PATCH", path: string, body?: unknown) => checkerFetch(`${API}${path}`, method, body);

const post = (path: string, body?: unknown) => request("POST", path, body);

export const buildRubric = (sessionId: string, force = false) =>
  post(`/sessions/${sessionId}/rubric`, { force }) as Promise<{ rubric: { status: string; total_marks: number }; full_rubric: Rubric }>;

export const checkSheet = (sheetId: string) =>
  post(`/sheets/${sheetId}/check`) as Promise<{ sheet: CheckSheet }>;

/** Teacher sets one question's marks (AI marks are kept for comparison; every change is audit-logged). */
export const overrideMarks = (sheetId: string, qNo: string, marks: number, note?: string) =>
  request("PATCH", `/sheets/${sheetId}/questions/${encodeURIComponent(qNo)}/marks`,
    { marks_awarded: marks, teacher_note: note?.trim() || null }) as Promise<{ sheet: Pick<CheckSheet, "id" | "status" | "ai_marks" | "final_marks" | "max_marks" | "ai_result"> }>;

/** Compress (images) and upload one file into the teacher's private folder. Returns the storage path. */
export async function uploadPage(userId: string, sessionId: string, folder: string, file: File): Promise<string> {
  const { blob, ext, type } = await compressImage(file);
  if (blob.size > 15 * 1024 * 1024) throw new Error(`${file.name} is too large (max 15 MB).`);
  const path = `${userId}/${sessionId}/${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false });
  if (error) throw new Error(`Upload failed: ${humanError(error)}`);
  return path;
}

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  (data || []).forEach(d => { if (d.path && d.signedUrl) out[d.path] = d.signedUrl; });
  return out;
}

export async function removeFiles(paths: string[]) {
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}
