// src/lib/teacherAnalytics.ts — the numbers on the teacher Analytics tab, computed ONLY from rows the DB returned.
// No sample data and no fallbacks: a number that can't be computed is null and the UI shows "—".
//
// Attendance = the same rule as get_monthly_attendance (live, 24 Nov 2026): only `conducted` sessions count,
//   present + late = attended, leave stays in the total.
// Marks = two sources, never both for the same copy:
//   1. submissions.grade (portal / upload link; set when results are published). Out of the check sheet's
//      max_marks when the copy was AI-checked (same as a4_submission_json), else the assignment's max_marks.
//      One counted attempt per student per assignment, picked like my_submissions (count_policy latest | best).
//   2. approved Check Copies sheets that are NOT tied to a submission (final_marks out of max_marks).
// Pure functions — the Supabase reads live in teacherAnalyticsData.ts.

import { isoDate } from "@/lib/localDate";

export type TimeRange = "7" | "30" | "90" | "all";

const round1 = (n: number) => Math.round(n * 10) / 10;
const clampPct = (n: number) => Math.min(100, Math.max(0, n));

/** First day (YYYY-MM-DD, local calendar) of "last N days", today included. null = all time. For `date` columns. */
export function rangeStartDate(range: TimeRange, today: Date = new Date()): string | null {
  if (range === "all") return null;
  return isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (Number(range) - 1)));
}

/** Same start as rangeStartDate, as an instant (local midnight). For timestamptz columns. */
export function rangeStartTimestamp(range: TimeRange, today: Date = new Date()): string | null {
  if (range === "all") return null;
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - (Number(range) - 1)).toISOString();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-11-04" or an ISO timestamp → local Date (a bare date is NOT read as UTC midnight). */
export function parseDay(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** "4 Nov" */
export function shortDate(s: string | null | undefined): string {
  const d = parseDay(s);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : "";
}

/* ─────────────────────────── Attendance ─────────────────────────── */

export interface AttSession { id: string; batchId: string; date: string }
export interface AttRecord { sessionId: string; studentId: string; status: string; date: string }
export interface RosterStudent { id: string; name: string; rollNo: string; batchName?: string }

/** A student is flagged only after this many marked classes (one absence out of two isn't a pattern). */
export const MIN_MARKED_FOR_ALERT = 3;

export const isAttended = (status: string) => status === "present" || status === "late";

/** Classes a student must attend in a row to reach `threshold` % (0 if already there). */
export function classesNeeded(attended: number, total: number, threshold: number): number {
  if (attended * 100 >= threshold * total) return 0;
  if (threshold >= 100) return Infinity;
  return Math.ceil((threshold * total - 100 * attended) / (100 - threshold));
}

export interface StudentAttendance {
  id: string; name: string; rollNo: string; batchName?: string;
  attended: number; total: number; pct: number | null; needed: number;
}

export interface AttendanceSummary {
  sessionsHeld: number;
  marked: number;
  counts: { present: number; absent: number; leave: number; late: number };
  /** attended / marked, % */
  rate: number | null;
  /** attended per class held */
  avgAttended: number | null;
  trend: { date: string; label: string; rate: number; marked: number }[];
  weekday: { day: string; rate: number | null; marked: number }[];
  /** current roster, lowest % first, students with nothing marked last */
  students: StudentAttendance[];
  /** roster students below the threshold with ≥ MIN_MARKED_FOR_ALERT classes marked */
  defaulters: StudentAttendance[];
  /** marked students who are not on the current roster (counted in the totals, not in the lists) */
  offRoster: number;
}

type Tally = { a: number; t: number };
const bump = <K,>(m: Map<K, Tally>, k: K, ok: boolean) => {
  const v = m.get(k) ?? { a: 0, t: 0 };
  v.t += 1;
  if (ok) v.a += 1;
  m.set(k, v);
};

export function summarizeAttendance(
  sessions: AttSession[], records: AttRecord[], roster: RosterStudent[], threshold: number,
): AttendanceSummary {
  const counts = { present: 0, absent: 0, leave: 0, late: 0 };
  let attended = 0;
  const byDate = new Map<string, Tally>();
  const byWeekday = new Map<number, Tally>();
  const byStudent = new Map<string, Tally>();

  for (const r of records) {
    if (r.status in counts) counts[r.status as keyof typeof counts] += 1;
    const ok = isAttended(r.status);
    if (ok) attended += 1;
    bump(byDate, r.date, ok);
    const d = parseDay(r.date);
    if (d) bump(byWeekday, d.getDay(), ok);
    bump(byStudent, r.studentId, ok);
  }

  const marked = records.length;
  const held = sessions.length;

  const trend = [...byDate.entries()]
    .sort((x, y) => x[0].localeCompare(y[0]))
    .map(([date, v]) => ({ date, label: shortDate(date), rate: round1((v.a / v.t) * 100), marked: v.t }));

  const weekday = [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => d !== 0 || byWeekday.has(0)) // Sunday only when a class was held on one
    .map((d) => {
      const v = byWeekday.get(d);
      return { day: WEEKDAYS[d], rate: v ? round1((v.a / v.t) * 100) : null, marked: v?.t ?? 0 };
    });

  const students: StudentAttendance[] = roster.map((s) => {
    const v = byStudent.get(s.id) ?? { a: 0, t: 0 };
    return {
      id: s.id, name: s.name, rollNo: s.rollNo, batchName: s.batchName,
      attended: v.a, total: v.t,
      pct: v.t > 0 ? round1((v.a / v.t) * 100) : null,
      needed: v.t > 0 ? classesNeeded(v.a, v.t, threshold) : 0,
    };
  });
  students.sort((x, y) =>
    (x.pct ?? Infinity) - (y.pct ?? Infinity) || x.name.localeCompare(y.name));

  const onRoster = new Set(roster.map((s) => s.id));
  let offRoster = 0;
  for (const id of byStudent.keys()) if (!onRoster.has(id)) offRoster += 1;

  return {
    sessionsHeld: held,
    marked,
    counts,
    rate: marked > 0 ? round1((attended / marked) * 100) : null,
    avgAttended: held > 0 && marked > 0 ? round1(attended / held) : null,
    trend,
    weekday,
    students,
    defaulters: students.filter((s) => s.pct != null && s.total >= MIN_MARKED_FOR_ALERT && s.pct < threshold),
    offRoster,
  };
}

/* ─────────────────────────── Marks ─────────────────────────── */

export interface AssignmentRow {
  id: string; title: string; maxMarks: number | null; countPolicy: string | null; createdAt: string;
}

export interface SubmissionRow {
  id: string; assignmentId: string;
  studentId: string | null; submitterKey: string | null; guestName: string | null; guestRoll: string | null;
  grade: number | null; status: string | null; attemptNo: number | null; submittedAt: string | null;
  /** max_marks of the AI check sheet for this attempt, if it was checked */
  sheetMax: number | null;
}

export interface CopySheetRow {
  id: string; sessionId: string; sessionTitle: string; sessionCreatedAt: string;
  studentId: string | null; studentName: string | null; rollNo: string | null;
  marks: number;
  /** sheet max_marks, else the AI result's max, else the session's total */
  max: number | null;
}

export interface MarkResult {
  assessmentId: string; title: string; kind: "assignment" | "copies"; date: string;
  personKey: string; name: string; rollNo: string; guest: boolean;
  pct: number;
}

const attemptKey = (s: SubmissionRow) =>
  s.studentId ? `s:${s.studentId}` : s.submitterKey ? `g:${s.submitterKey}` : `x:${s.id}`;

const newestFirst = (x: SubmissionRow, y: SubmissionRow) =>
  (y.attemptNo ?? 0) - (x.attemptNo ?? 0) || (y.submittedAt ?? "").localeCompare(x.submittedAt ?? "");

/** One attempt per (assignment, student) — the one that counts. Mirrors my_submissions:
 *  rejected never counts; best = highest published grade (ties → newer attempt), else latest; latest = newest. */
export function countedAttempts(subs: SubmissionRow[], policyOf: Map<string, string | null>): SubmissionRow[] {
  const groups = new Map<string, SubmissionRow[]>();
  for (const s of subs) {
    if (s.status === "rejected") continue;
    const k = `${s.assignmentId}|${attemptKey(s)}`;
    const g = groups.get(k);
    if (g) g.push(s);
    else groups.set(k, [s]);
  }
  const out: SubmissionRow[] = [];
  for (const g of groups.values()) {
    g.sort(newestFirst);
    let pick = g[0];
    if (policyOf.get(pick.assignmentId) === "best") {
      const graded = g.filter((s) => s.status === "published" && s.grade != null);
      if (graded.length) pick = graded.reduce((best, s) => (s.grade! > best.grade! ? s : best));
    }
    out.push(pick);
  }
  return out;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export interface MarkResultsBuild {
  results: MarkResult[];
  /** counted attempts that have no marks yet (not checked / not published) */
  pending: number;
  /** results that can't be turned into a % (no max marks) */
  unscored: number;
}

export function buildMarkResults(
  assignments: AssignmentRow[], submissions: SubmissionRow[], sheets: CopySheetRow[],
  rosterById: Map<string, RosterStudent>,
): MarkResultsBuild {
  const asg = new Map(assignments.map((a) => [a.id, a]));
  const results: MarkResult[] = [];
  let pending = 0;
  let unscored = 0;

  const counted = countedAttempts(
    submissions.filter((s) => asg.has(s.assignmentId)),
    new Map(assignments.map((a) => [a.id, a.countPolicy])),
  );
  for (const s of counted) {
    const a = asg.get(s.assignmentId)!;
    if (s.grade == null) { pending += 1; continue; }
    const max = s.sheetMax ?? a.maxMarks;
    if (!max || max <= 0) { unscored += 1; continue; }
    const stu = s.studentId ? rosterById.get(s.studentId) : undefined;
    const guest = !s.studentId;
    results.push({
      assessmentId: a.id, title: a.title || "Assignment", kind: "assignment", date: a.createdAt,
      personKey: attemptKey(s),
      name: guest ? (s.guestName?.trim() || "Guest") : (stu?.name ?? "Student (not in your classes)"),
      rollNo: guest ? (s.guestRoll?.trim() ?? "") : (stu?.rollNo ?? ""),
      guest,
      pct: round1(clampPct((s.grade / max) * 100)),
    });
  }

  for (const sh of sheets) {
    if (!sh.max || sh.max <= 0) { unscored += 1; continue; }
    const stu = sh.studentId ? rosterById.get(sh.studentId) : undefined;
    results.push({
      assessmentId: sh.sessionId, title: sh.sessionTitle || "Copy check", kind: "copies", date: sh.sessionCreatedAt,
      // quick-added names (no roster link) are matched on name + roll across your copy checks
      personKey: sh.studentId ? `s:${sh.studentId}` : `n:${norm(sh.studentName)}|${norm(sh.rollNo)}`,
      name: stu?.name ?? (sh.studentName?.trim() || "Student"),
      rollNo: stu?.rollNo ?? (sh.rollNo?.trim() ?? ""),
      guest: false,
      pct: round1(clampPct((sh.marks / sh.max) * 100)),
    });
  }

  return { results, pending, unscored };
}

export interface ScoreBracket { label: string; min: number; max: number; color: string }

/** Brackets that cover 0–100 with no gap for any pass mark (33 / 40 / 50). */
export function scoreBrackets(pass: number): ScoreBracket[] {
  const b: ScoreBracket[] = [
    { label: "85% +", min: 85, max: Infinity, color: "#10B981" },
    { label: "70–84%", min: 70, max: 85, color: "#3B82F6" },
    { label: "50–69%", min: 50, max: 70, color: "#F59E0B" },
  ];
  if (pass < 50) b.push({ label: `${pass}–49%`, min: pass, max: 50, color: "#FB923C" });
  b.push({ label: `Below ${pass}%`, min: -Infinity, max: pass, color: "#EF4444" });
  return b;
}

export interface StudentMarks { key: string; name: string; rollNo: string; guest: boolean; avg: number; count: number }
export interface AssessmentMarks { id: string; title: string; kind: MarkResult["kind"]; date: string; label: string; avg: number; n: number }

export interface MarksSummary {
  results: number;
  avg: number | null;
  highest: number | null;
  /** % of results at or above the pass mark */
  passRate: number | null;
  /** oldest → newest */
  assessments: AssessmentMarks[];
  /** best average first */
  students: StudentMarks[];
  /** students whose average is below the pass mark, lowest first */
  needsSupport: StudentMarks[];
  distribution: (ScoreBracket & { count: number })[];
}

export function summarizeMarks(results: MarkResult[], pass: number): MarksSummary {
  const n = results.length;
  const pcts = results.map((r) => r.pct);

  const byAssessment = new Map<string, { r: MarkResult; sum: number; n: number }>();
  const byPerson = new Map<string, { r: MarkResult; sum: number; n: number }>();
  for (const r of results) {
    const a = byAssessment.get(r.assessmentId) ?? { r, sum: 0, n: 0 };
    a.sum += r.pct; a.n += 1;
    byAssessment.set(r.assessmentId, a);
    const p = byPerson.get(r.personKey) ?? { r, sum: 0, n: 0 };
    p.sum += r.pct; p.n += 1;
    byPerson.set(r.personKey, p);
  }

  const assessments = [...byAssessment.values()]
    .map(({ r, sum, n: k }) => ({ id: r.assessmentId, title: r.title, kind: r.kind, date: r.date, label: shortDate(r.date), avg: round1(sum / k), n: k }))
    .sort((x, y) => x.date.localeCompare(y.date) || x.title.localeCompare(y.title));

  const students = [...byPerson.entries()]
    .map(([key, { r, sum, n: k }]) => ({ key, name: r.name, rollNo: r.rollNo, guest: r.guest, avg: round1(sum / k), count: k }))
    .sort((x, y) => y.avg - x.avg || x.name.localeCompare(y.name));

  const distribution = scoreBrackets(pass).map((b) => ({
    ...b, count: students.filter((s) => s.avg >= b.min && s.avg < b.max).length,
  }));

  return {
    results: n,
    avg: n ? round1(pcts.reduce((s, p) => s + p, 0) / n) : null,
    highest: n ? Math.max(...pcts) : null,
    passRate: n ? round1((pcts.filter((p) => p >= pass).length / n) * 100) : null,
    assessments,
    students,
    needsSupport: students.filter((s) => s.avg < pass).sort((x, y) => x.avg - y.avg || x.name.localeCompare(y.name)),
    distribution,
  };
}
