// src/lib/teacherAnalyticsData.ts — Supabase reads for the teacher Analytics tab.
// Scope = the batches from useMyScope (RLS checks the same thing server-side). Every read checks `error`
// (a failed read must never look like "no data") and pages through all rows: the API returns at most
// 1000 rows per request (measured on live, 24 Nov 2026) and silently cuts the rest.
// Attendance and marks are read for TWO periods (this one + the one before it) so the tab can say "vs previous
// 30 days" from real rows; the component splits them at rangeStartDate(range).
// The maths is in teacherAnalytics.ts.

import { supabase } from "@/lib/supabaseClient";
import {
  rangeStartDate, rangeStartTimestamp,
  type AssignmentRow, type AttRecord, type AttSession, type CopySheetRow, type QuestionSheet, type RosterStudent,
  type SubmissionRow, type TimeRange,
} from "@/lib/teacherAnalytics";

const PAGE = 1000;
/** pages fetched at once after the first one came back full */
const PARALLEL = 3;

type PageResult = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;

async function allPages<T>(what: string, page: (from: number, to: number) => PageResult): Promise<T[]> {
  const read = async (from: number) => {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`Couldn't load ${what}: ${error.message}`);
    return (data ?? []) as T[];
  };
  const out = await read(0); // most teachers fit in one page — no speculative requests for them
  if (out.length < PAGE) return out;
  for (let from = PAGE; ; from += PAGE * PARALLEL) {
    const batch = await Promise.all(Array.from({ length: PARALLEL }, (_, i) => read(from + i * PAGE)));
    for (const rows of batch) {
      out.push(...rows);
      if (rows.length < PAGE) return out;
    }
  }
}

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Active students in these batches (main, lab and extra batches — via student_batches). */
export async function loadRoster(batchIds: string[], batchName: Map<string, string>): Promise<RosterStudent[]> {
  if (!batchIds.length) return [];
  type Row = {
    id: string; name: string | null; roll_no: string | null; batch_id: string | null;
    parent_name: string | null; parent_phone: string | null; student_batches: { batch_id: string }[];
  };
  const rows = await allPages<Row>("students", (from, to) =>
    supabase.from("students")
      .select("id, name, roll_no, batch_id, parent_name, parent_phone, student_batches!inner(batch_id)")
      .in("student_batches.batch_id", batchIds)
      .eq("is_active", true)
      .order("roll_no", { nullsFirst: false })
      .order("id")
      .range(from, to));
  return rows.map((s) => {
    const mine = (s.student_batches ?? []).map((m) => m.batch_id);
    const shown = s.batch_id && mine.includes(s.batch_id) ? s.batch_id : mine[0];
    return {
      id: s.id, name: s.name?.trim() || "Student", rollNo: s.roll_no ?? "", batchName: shown ? batchName.get(shown) : undefined,
      batchIds: mine, parentName: s.parent_name, parentPhone: s.parent_phone,
    };
  });
}

/** Conducted classes I taught in these batches + their marks — this period and the previous one. */
export async function loadAttendance(userId: string, batchIds: string[], range: TimeRange): Promise<{ sessions: AttSession[]; records: AttRecord[] }> {
  if (!batchIds.length) return { sessions: [], records: [] };
  const since = rangeStartDate(range, new Date(), 2);

  type SessRow = { id: string; batch_id: string; session_date: string };
  type RecRow = { id: string; session_id: string; student_id: string; status: string; class_sessions: { session_date: string; batch_id: string } | null };

  const [sessions, records] = await Promise.all([
    allPages<SessRow>("classes", (from, to) => {
      let q = supabase.from("class_sessions").select("id, batch_id, session_date")
        .eq("teacher_id", userId).eq("status", "conducted").in("batch_id", batchIds);
      if (since) q = q.gte("session_date", since);
      return q.order("session_date").order("id").range(from, to);
    }),
    allPages<RecRow>("attendance", (from, to) => {
      // filtered through the session (no long `session_id in (…)` list in the URL)
      let q = supabase.from("attendance_records")
        .select("id, session_id, student_id, status, class_sessions!inner(session_date, batch_id)")
        .eq("class_sessions.teacher_id", userId)
        .eq("class_sessions.status", "conducted")
        .in("class_sessions.batch_id", batchIds);
      if (since) q = q.gte("class_sessions.session_date", since);
      return q.order("id").range(from, to);
    }),
  ]);

  return {
    sessions: sessions.map((s) => ({ id: s.id, batchId: s.batch_id, date: s.session_date })),
    records: records.map((r) => ({
      sessionId: r.session_id, studentId: r.student_id, status: r.status,
      date: r.class_sessions?.session_date ?? "", batchId: r.class_sessions?.batch_id,
    })),
  };
}

export interface MarksData { assignments: AssignmentRow[]; submissions: SubmissionRow[]; sheets: CopySheetRow[] }

/**
 * My assignments in these batches (+ every non-rejected attempt, so the counted one can be picked) and my
 * approved Check Copies sheets — this period and the previous one. `includeUnbatched` adds copy checks that have
 * no class (quick-added students).
 */
export async function loadMarks(
  userId: string, batchIds: string[], range: TimeRange, includeUnbatched: boolean,
): Promise<MarksData> {
  const since = rangeStartTimestamp(range, new Date(), 2);

  type AsgRow = {
    id: string; title: string | null; max_marks: number | null; count_policy: string | null; created_at: string;
    batch_id: string | null; deadline: string | null;
  };
  type SubRow = {
    id: string; assignment_id: string; student_id: string | null; submitter_key: string | null;
    guest_name: string | null; guest_roll: string | null; grade: number | string | null; status: string | null;
    attempt_no: number | null; submitted_at: string | null; is_late: boolean | null;
    check_sheets: { max_marks: number | string | null }[] | null;
  };
  type SheetRow = {
    id: string; session_id: string; student_id: string | null; student_name: string | null; roll_no: string | null;
    final_marks: number | string; max_marks: number | string | null; ai_max: unknown;
    check_sessions: { title: string | null; batch_id: string | null; total_marks: number | string | null; created_at: string } | null;
  };

  const assignmentsP = batchIds.length
    ? allPages<AsgRow>("assignments", (from, to) => {
        let q = supabase.from("assignments").select("id, title, max_marks, count_policy, created_at, batch_id, deadline")
          .eq("created_by", userId).in("batch_id", batchIds);
        if (since) q = q.gte("created_at", since);
        return q.order("created_at").order("id").range(from, to);
      })
    : Promise.resolve([] as AsgRow[]);

  const submissionsP = batchIds.length
    ? allPages<SubRow>("submissions", (from, to) => {
        let q = supabase.from("submissions")
          .select("id, assignment_id, student_id, submitter_key, guest_name, guest_roll, grade, status, attempt_no, submitted_at, is_late, check_sheets(max_marks), assignments!inner(id)")
          .eq("assignments.created_by", userId)
          .in("assignments.batch_id", batchIds)
          .or("status.is.null,status.neq.rejected");
        if (since) q = q.gte("assignments.created_at", since);
        return q.order("id").range(from, to);
      })
    : Promise.resolve([] as SubRow[]);

  const sheetsP = allPages<SheetRow>("checked copies", (from, to) => {
    let q = supabase.from("check_sheets")
      .select("id, session_id, student_id, student_name, roll_no, final_marks, max_marks, ai_max:ai_result->max_marks, check_sessions!inner(title, batch_id, total_marks, created_at)")
      .eq("teacher_id", userId)
      .eq("status", "approved")
      .is("submission_id", null)
      .not("final_marks", "is", null);
    if (since) q = q.gte("check_sessions.created_at", since);
    return q.order("id").range(from, to);
  });

  const [asg, subs, sheets] = await Promise.all([assignmentsP, submissionsP, sheetsP]);
  const inScope = new Set(batchIds);

  return {
    assignments: asg.map((a) => ({
      id: a.id, title: a.title ?? "", maxMarks: num(a.max_marks), countPolicy: a.count_policy, createdAt: a.created_at,
      batchId: a.batch_id, deadline: a.deadline,
    })),
    submissions: subs.map((s) => ({
      id: s.id, assignmentId: s.assignment_id, studentId: s.student_id, submitterKey: s.submitter_key,
      guestName: s.guest_name, guestRoll: s.guest_roll, grade: num(s.grade), status: s.status,
      attemptNo: s.attempt_no, submittedAt: s.submitted_at, isLate: !!s.is_late,
      sheetMax: (s.check_sheets ?? []).map((c) => num(c.max_marks)).find((m) => m != null && m > 0) ?? null,
    })),
    sheets: sheets
      .filter((sh) => {
        const b = sh.check_sessions?.batch_id ?? null;
        return b ? inScope.has(b) : includeUnbatched;
      })
      .map((sh) => ({
        id: sh.id, sessionId: sh.session_id,
        sessionTitle: sh.check_sessions?.title ?? "", sessionCreatedAt: sh.check_sessions?.created_at ?? "",
        studentId: sh.student_id, studentName: sh.student_name, rollNo: sh.roll_no,
        marks: num(sh.final_marks) ?? 0,
        max: [num(sh.max_marks), num(sh.ai_max), num(sh.check_sessions?.total_marks)].find((m) => m != null && m > 0) ?? null,
      })),
  };
}

/**
 * Question-wise data of ONE assessment (loaded when the teacher opens it — ai_result.graded_questions is ~20 KB a
 * copy). Approved sheets only; for an assignment only the counted attempts (`countedSubmissionIds`).
 */
export async function loadQuestionSheets(
  userId: string, target: { kind: "assignment" | "copies"; id: string }, countedSubmissionIds: Set<string>,
): Promise<QuestionSheet[]> {
  type Row = { id: string; submission_id: string | null; per_question: unknown; graded: unknown };
  const rows = await allPages<Row>("question-wise marks", (from, to) => {
    let q = supabase.from("check_sheets")
      .select("id, submission_id, per_question, graded:ai_result->graded_questions, check_sessions!inner(assignment_id)")
      .eq("teacher_id", userId)
      .eq("status", "approved");
    q = target.kind === "copies" ? q.eq("session_id", target.id).is("submission_id", null) : q.eq("check_sessions.assignment_id", target.id);
    return q.order("id").range(from, to);
  });
  return rows
    .filter((r) => target.kind === "copies" || (r.submission_id != null && countedSubmissionIds.has(r.submission_id)))
    .map((r) => ({ perQuestion: r.per_question, graded: r.graded }));
}
