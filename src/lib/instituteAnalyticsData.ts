// src/lib/instituteAnalyticsData.ts — Supabase reads for the INSTITUTE-level Analytics tab.
// Same paging as teacherAnalyticsData.ts, but no teacher_id filter: loads attendance + marks across
// every batch in the institute so the admin sees the full picture.

import { supabase } from "@/lib/supabaseClient";
import {
  rangeStartDate, rangeStartTimestamp,
  type AssignmentRow, type AttRecord, type AttSession, type CopySheetRow,
  type SubmissionRow, type TimeRange,
} from "@/lib/teacherAnalytics";

const PAGE = 1000;
const PARALLEL = 3;

type PageResult = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;

async function allPages<T>(what: string, page: (from: number, to: number) => PageResult): Promise<T[]> {
  const read = async (from: number) => {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`Couldn't load ${what}: ${error.message}`);
    return (data ?? []) as T[];
  };
  const out = await read(0);
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

/** All conducted classes + their marks across every batch in the institute. */
export async function loadInstituteAttendance(
  instituteId: string, batchIds: string[], range: TimeRange,
): Promise<{ sessions: AttSession[]; records: AttRecord[] }> {
  if (!batchIds.length) return { sessions: [], records: [] };
  const since = rangeStartDate(range, new Date(), 2);

  type SessRow = { id: string; batch_id: string; session_date: string };
  type RecRow = {
    id: string; session_id: string; student_id: string; status: string;
    class_sessions: { session_date: string; batch_id: string } | null;
  };

  const [sessions, records] = await Promise.all([
    allPages<SessRow>("classes", (from, to) => {
      let q = supabase.from("class_sessions").select("id, batch_id, session_date")
        .eq("status", "conducted").in("batch_id", batchIds);
      if (since) q = q.gte("session_date", since);
      return q.order("session_date").order("id").range(from, to);
    }),
    allPages<RecRow>("attendance", (from, to) => {
      let q = supabase.from("attendance_records")
        .select("id, session_id, student_id, status, class_sessions!inner(session_date, batch_id)")
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

export interface InstituteMarksData { assignments: AssignmentRow[]; submissions: SubmissionRow[]; sheets: CopySheetRow[] }

/** All assignments + submissions + approved copy check sheets across every batch in the institute. */
export async function loadInstituteMarks(
  instituteId: string, batchIds: string[], range: TimeRange,
): Promise<InstituteMarksData> {
  if (!batchIds.length) return { assignments: [], submissions: [], sheets: [] };
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

  const assignmentsP = allPages<AsgRow>("assignments", (from, to) => {
    let q = supabase.from("assignments").select("id, title, max_marks, count_policy, created_at, batch_id, deadline")
      .in("batch_id", batchIds);
    if (since) q = q.gte("created_at", since);
    return q.order("created_at").order("id").range(from, to);
  });

  const submissionsP = allPages<SubRow>("submissions", (from, to) => {
    let q = supabase.from("submissions")
      .select("id, assignment_id, student_id, submitter_key, guest_name, guest_roll, grade, status, attempt_no, submitted_at, is_late, check_sheets(max_marks), assignments!inner(id)")
      .in("assignments.batch_id", batchIds)
      .or("status.is.null,status.neq.rejected");
    if (since) q = q.gte("assignments.created_at", since);
    return q.order("id").range(from, to);
  });

  const sheetsP = allPages<SheetRow>("checked copies", (from, to) => {
    let q = supabase.from("check_sheets")
      .select("id, session_id, student_id, student_name, roll_no, final_marks, max_marks, ai_max:ai_result->max_marks, check_sessions!inner(title, batch_id, total_marks, created_at)")
      .eq("status", "approved")
      .is("submission_id", null)
      .not("final_marks", "is", null)
      .in("check_sessions.batch_id", batchIds);
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
        return b ? inScope.has(b) : false;
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
