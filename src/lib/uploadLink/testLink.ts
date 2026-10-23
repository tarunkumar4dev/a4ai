// src/lib/uploadLink/testLink.ts
// "📸 Checking Link" straight from a test: test + class → the class's assignment for that test (reused, else made with
// the same write paths as the Assignments form) → question paper + answer key from the saved questions → upload link
// switched on with its settings (same update the Copy Submissions tab saves). Contract: docs/upload-flow-api.md;
// assignments.test_id = migration 20.

import { supabase } from "@/lib/supabaseClient";
import { attachAnswerKey, uploadAssignmentFile } from "@/lib/assignments";
import { exportTestPdfBlob, fetchQuestionsForTest, type TestPaperMeta, type TestQuestionData } from "@/utils/testPdfExporter";
import { saveLinkSettings, type LinkSettings } from "./teacher";

/** Today (IST) + 2 days, 11:59 PM IST — as an ISO UTC string. */
export function defaultDeadlineIST(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + 330 * 60_000);          // wall clock in IST, read with UTC getters
  const utc = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 2, 23, 59) - 330 * 60_000;
  return new Date(utc).toISOString();
}

const filled = (v: unknown) =>
  v != null && (typeof v === "string" ? v.trim() !== "" : Array.isArray(v) ? v.length > 0
    : typeof v === "object" ? Object.keys(v as object).length > 0 : true);

/** How many questions carry something to check against (correct answer, model answer or marking scheme). */
export function keyCoverage(questions: { correct_answer?: unknown; correctAnswer?: unknown; model_answer?: unknown; marking_scheme?: unknown }[]) {
  const withKey = questions.filter(q => filled(q.correct_answer) || filled(q.correctAnswer)
    || filled(q.model_answer) || filled(q.marking_scheme)).length;
  return { total: questions.length, withKey, empty: withKey === 0 };
}

export interface TestRef { id: string; title: string; subject?: string | null; class_grade?: string | null; board?: string | null; total_marks?: number | null; paper_date?: string | null }

export interface LinkChoice {
  batchId: string;
  deadline: string | null;
  settings: Pick<LinkSettings, "max_attempts" | "late_policy" | "auto_publish" | "max_mb" | "max_pages" | "allowed_mimes" | "count_policy">;
}

export interface ExistingAssignment { id: string; file_url: string | null; link_token: string; has_key: boolean }

export interface LinkDeps {
  findAssignment: (testId: string, batchId: string) => Promise<ExistingAssignment | null>;
  insertAssignment: (row: Record<string, unknown>) => Promise<ExistingAssignment>;
  setPaper: (assignmentId: string, url: string, name: string) => Promise<void>;
  uploadPaper: (folder: string, blob: Blob, name: string) => Promise<{ url: string; name: string }>;
  attachKey: (assignmentId: string, userId: string, blob: Blob, name: string) => Promise<void>;
  fetchQuestions: (testId: string, userId: string) => Promise<TestQuestionData[]>;
  exportPdf: (meta: TestPaperMeta, questions: TestQuestionData[], isKey: boolean) => Promise<Blob>;
  saveSettings: (assignmentId: string, patch: Partial<LinkSettings>) => Promise<void>;
}

export interface LinkResult { assignmentId: string; token: string; reused: boolean; keyMissing: boolean }

const safeName = (t: string) => (t || "Test").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60);

export async function createOrReuseCheckingLink(
  input: { test: TestRef; choice: LinkChoice; userId: string; instituteId: string },
  deps: LinkDeps = defaultDeps,
): Promise<LinkResult> {
  const { test, choice, userId, instituteId } = input;
  const questions = await deps.fetchQuestions(test.id, userId);
  if (!questions.length) throw new Error("Is test ke questions save nahi hue. Test pehle save karo.");
  const cov = keyCoverage(questions);
  const meta: TestPaperMeta = {
    id: test.id, exam_title: test.title, subject: test.subject || undefined, class_grade: test.class_grade || undefined,
    board: test.board || undefined, total_marks: test.total_marks || undefined, paper_date: test.paper_date || undefined,
  };

  let asg = await deps.findAssignment(test.id, choice.batchId);
  const reused = !!asg;
  if (!asg) {
    asg = await deps.insertAssignment({
      title: test.title, description: "Test ki answer copy (saare pages) is link par upload karo.",
      institute_id: instituteId, batch_id: choice.batchId, created_by: userId, status: "active",
      max_marks: test.total_marks ?? null, deadline: choice.deadline, test_id: test.id,
    });
  }
  if (!asg.file_url) {
    const paper = await deps.uploadPaper(instituteId || userId, await deps.exportPdf(meta, questions, false), `${safeName(test.title)}.pdf`);
    await deps.setPaper(asg.id, paper.url, paper.name);
  }
  if (!asg.has_key && !cov.empty) {
    await deps.attachKey(asg.id, userId, await deps.exportPdf(meta, questions, true), `${safeName(test.title)}_AnswerKey.pdf`);
  }
  await deps.saveSettings(asg.id, {
    ...choice.settings, deadline: choice.deadline, upload_link_enabled: true, status: "active",
  });
  return { assignmentId: asg.id, token: asg.link_token, reused, keyMissing: cov.empty && !asg.has_key };
}

async function toExisting(row: { id: string; file_url: string | null; link_token: string }): Promise<ExistingAssignment> {
  const { data } = await supabase.from("assignment_ai_keys").select("assignment_id").eq("assignment_id", row.id).maybeSingle();
  return { id: row.id, file_url: row.file_url, link_token: row.link_token, has_key: !!data };
}

const defaultDeps: LinkDeps = {
  findAssignment: async (testId, batchId) => {
    const { data } = await supabase.from("assignments").select("id, file_url, link_token")
      .eq("test_id", testId).eq("batch_id", batchId).order("created_at", { ascending: false }).limit(1);
    return data?.[0] ? toExisting(data[0]) : null;
  },
  insertAssignment: async row => {
    const { data, error } = await supabase.from("assignments").insert(row).select("id, file_url, link_token").single();
    if (error) throw new Error(error.message);
    return { ...data, has_key: false };
  },
  setPaper: async (id, url, name) => {
    const { error } = await supabase.from("assignments").update({ file_url: url, file_name: name }).eq("id", id);
    if (error) throw new Error(error.message);
  },
  uploadPaper: uploadAssignmentFile,
  attachKey: (id, uid, blob, name) => attachAnswerKey(id, uid, blob, name),
  fetchQuestions: fetchQuestionsForTest,
  exportPdf: exportTestPdfBlob,
  saveSettings: saveLinkSettings,
};

export interface TestLinkInfo { assignmentId: string; token: string; deadline: string | null; batchName: string | null; title: string }

/** Upload links already made from these tests (only the ones this teacher can see), newest first per test. */
export async function testLinks(testIds: string[]): Promise<Record<string, TestLinkInfo[]>> {
  if (!testIds.length) return {};
  const { data } = await supabase.from("assignments")
    .select("id, test_id, link_token, deadline, title, upload_link_enabled, batches(name)")
    .in("test_id", testIds).eq("upload_link_enabled", true).order("created_at", { ascending: false });
  const out: Record<string, TestLinkInfo[]> = {};
  (data || []).forEach((r: { id: string; test_id: string; link_token: string; deadline: string | null; title: string; batches: { name: string } | { name: string }[] | null }) => {
    const b = Array.isArray(r.batches) ? r.batches[0] : r.batches;
    (out[r.test_id] ||= []).push({ assignmentId: r.id, token: r.link_token, deadline: r.deadline, batchName: b?.name ?? null, title: r.title });
  });
  return out;
}

/** Where "Submissions dekho" goes: the assignment's Copy Submissions tab. */
export const submissionsHref = (assignmentId: string) => `/dashboard?tab=assignments&assignment=${assignmentId}&view=copies`;
