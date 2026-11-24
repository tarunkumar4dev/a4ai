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

/** First day (YYYY-MM-DD, local calendar) of "last N days", today included. null = all time. For `date` columns.
 *  periods = 2 → the start of the N days BEFORE that (this period + the previous one, for "vs previous"). */
export function rangeStartDate(range: TimeRange, today: Date = new Date(), periods = 1): string | null {
  if (range === "all") return null;
  return isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (Number(range) * periods - 1)));
}

/** Same start as rangeStartDate, as an instant (local midnight). For timestamptz columns. */
export function rangeStartTimestamp(range: TimeRange, today: Date = new Date(), periods = 1): string | null {
  if (range === "all") return null;
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - (Number(range) * periods - 1)).toISOString();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
export interface AttRecord { sessionId: string; studentId: string; status: string; date: string; batchId?: string }
export interface RosterStudent {
  id: string; name: string; rollNo: string; batchName?: string;
  /** every batch in my scope the student is in (main, lab, extra) */
  batchIds?: string[];
  parentName?: string | null; parentPhone?: string | null;
}

/** A student is flagged only after this many marked classes (one absence out of two isn't a pattern). */
export const MIN_MARKED_FOR_ALERT = 3;
/** "Absent N classes in a row" alert from this many (leave / late / present break the run). */
export const STREAK_ALERT = 3;
/** Statuses kept per student for the "recent classes" dots. */
export const RECENT_CLASSES = 10;

export const isAttended = (status: string) => status === "present" || status === "late";

/** Classes a student must attend in a row to reach `threshold` % (0 if already there). */
export function classesNeeded(attended: number, total: number, threshold: number): number {
  if (attended * 100 >= threshold * total) return 0;
  if (threshold >= 100) return Infinity;
  return Math.ceil((threshold * total - 100 * attended) / (100 - threshold));
}

export interface StudentAttendance {
  id: string; name: string; rollNo: string; batchName?: string; parentPhone?: string | null;
  attended: number; total: number; pct: number | null; needed: number;
  /** last RECENT_CLASSES statuses, oldest → newest */
  recent: string[];
  /** absences in a row up to the latest marked class */
  absentStreak: number;
}

export interface AttBand { key: string; label: string; min: number; max: number; color: string; count: number }

export interface AttendanceSummary {
  sessionsHeld: number;
  marked: number;
  counts: { present: number; absent: number; leave: number; late: number };
  /** attended / marked, % */
  rate: number | null;
  /** attended per class held */
  avgAttended: number | null;
  trend: { date: string; label: string; rate: number; marked: number }[];
  weekday: { day: string; dayLong: string; rate: number | null; marked: number }[];
  /** per batch (only batches with marked classes) */
  byBatch: { batchId: string; rate: number; marked: number; held: number }[];
  /** roster students per attendance band (+ "not marked") */
  bands: AttBand[];
  /** absent STREAK_ALERT+ classes in a row, longest run first */
  streaks: StudentAttendance[];
  /** 100 % with at least MIN_MARKED_FOR_ALERT classes marked */
  perfect: StudentAttendance[];
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
  const byBatch = new Map<string, Tally>();
  const seq = new Map<string, AttRecord[]>();

  for (const r of records) {
    if (r.status in counts) counts[r.status as keyof typeof counts] += 1;
    const ok = isAttended(r.status);
    if (ok) attended += 1;
    bump(byDate, r.date, ok);
    const d = parseDay(r.date);
    if (d) bump(byWeekday, d.getDay(), ok);
    bump(byStudent, r.studentId, ok);
    if (r.batchId) bump(byBatch, r.batchId, ok);
    const list = seq.get(r.studentId);
    if (list) list.push(r);
    else seq.set(r.studentId, [r]);
  }
  const heldByBatch = new Map<string, number>();
  for (const x of sessions) heldByBatch.set(x.batchId, (heldByBatch.get(x.batchId) ?? 0) + 1);

  const marked = records.length;
  const held = sessions.length;

  const trend = [...byDate.entries()]
    .sort((x, y) => x[0].localeCompare(y[0]))
    .map(([date, v]) => ({ date, label: shortDate(date), rate: round1((v.a / v.t) * 100), marked: v.t }));

  const weekday = [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => d !== 0 || byWeekday.has(0)) // Sunday only when a class was held on one
    .map((d) => {
      const v = byWeekday.get(d);
      return { day: WEEKDAYS[d], dayLong: WEEKDAYS_LONG[d], rate: v ? round1((v.a / v.t) * 100) : null, marked: v?.t ?? 0 };
    });

  const students: StudentAttendance[] = roster.map((s) => {
    const v = byStudent.get(s.id) ?? { a: 0, t: 0 };
    const mine = (seq.get(s.id) ?? []).sort((x, y) => x.date.localeCompare(y.date) || x.sessionId.localeCompare(y.sessionId));
    let streak = 0;
    for (let i = mine.length - 1; i >= 0 && mine[i].status === "absent"; i--) streak += 1;
    return {
      id: s.id, name: s.name, rollNo: s.rollNo, batchName: s.batchName, parentPhone: s.parentPhone ?? null,
      attended: v.a, total: v.t,
      pct: v.t > 0 ? round1((v.a / v.t) * 100) : null,
      needed: v.t > 0 ? classesNeeded(v.a, v.t, threshold) : 0,
      recent: mine.slice(-RECENT_CLASSES).map((r) => r.status),
      absentStreak: streak,
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
    byBatch: [...byBatch.entries()].map(([batchId, v]) => ({
      batchId, rate: round1((v.a / v.t) * 100), marked: v.t, held: heldByBatch.get(batchId) ?? 0,
    })),
    bands: attendanceBands(students, threshold),
    students,
    defaulters: students.filter((s) => s.pct != null && s.total >= MIN_MARKED_FOR_ALERT && s.pct < threshold),
    streaks: students.filter((s) => s.absentStreak >= STREAK_ALERT)
      .sort((x, y) => y.absentStreak - x.absentStreak || x.name.localeCompare(y.name)),
    perfect: students.filter((s) => s.pct === 100 && s.total >= MIN_MARKED_FOR_ALERT),
    offRoster,
  };
}

/** attended / marked as %, null when nothing is marked (same rule as summarizeAttendance). */
export function attendanceRate(records: AttRecord[]): number | null {
  if (!records.length) return null;
  return round1((records.filter((r) => isAttended(r.status)).length / records.length) * 100);
}

/** Roster students per band around the target (+ "Not marked"). Every student lands in exactly one band. */
export function attendanceBands(students: StudentAttendance[], target: number): AttBand[] {
  const defs: Omit<AttBand, "count">[] = [{ key: "great", label: "90% +", min: 90, max: Infinity, color: "#0ca30c" }];
  if (target < 90) defs.push({ key: "ok", label: `${target}–89%`, min: target, max: 90, color: "#2a78d6" });
  defs.push(
    { key: "close", label: `${target - 10}–${target - 1}%`, min: target - 10, max: Math.min(target, 90), color: "#fab219" },
    { key: "risk", label: `Below ${target - 10}%`, min: -Infinity, max: target - 10, color: "#d03b3b" },
  );
  const bands = defs.map((d) => ({ ...d, count: students.filter((s) => s.pct != null && s.pct >= d.min && s.pct < d.max).length }));
  bands.push({ key: "none", label: "Not marked", min: NaN, max: NaN, color: "#94a3b8", count: students.filter((s) => s.pct == null).length });
  return bands;
}

/* ─────────────────────────── Marks ─────────────────────────── */

export interface AssignmentRow {
  id: string; title: string; maxMarks: number | null; countPolicy: string | null; createdAt: string;
  batchId?: string | null; deadline?: string | null;
}

export interface SubmissionRow {
  id: string; assignmentId: string;
  studentId: string | null; submitterKey: string | null; guestName: string | null; guestRoll: string | null;
  grade: number | null; status: string | null; attemptNo: number | null; submittedAt: string | null;
  /** max_marks of the AI check sheet for this attempt, if it was checked */
  sheetMax: number | null;
  isLate?: boolean;
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

export interface StudentMarks {
  key: string; studentId: string | null; name: string; rollNo: string; guest: boolean; avg: number; count: number;
  /** % per result, oldest → newest */
  trend: number[];
  /** last − first result, in % points (null with one result) */
  delta: number | null;
  best: number; worst: number;
}
export interface AssessmentMarks {
  id: string; title: string; kind: MarkResult["kind"]; date: string; label: string;
  avg: number; n: number; min: number; max: number; passed: number;
}

/** "Improved" / "slipping" from this many % points between a student's first and latest result. */
export const TREND_MIN_POINTS = 5;

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
  /** delta ≥ +TREND_MIN_POINTS, biggest gain first */
  improvers: StudentMarks[];
  /** delta ≤ −TREND_MIN_POINTS, biggest drop first */
  slipping: StudentMarks[];
}

export function summarizeMarks(results: MarkResult[], pass: number): MarksSummary {
  const n = results.length;
  const pcts = results.map((r) => r.pct);

  const ordered = [...results].sort((x, y) => x.date.localeCompare(y.date) || x.title.localeCompare(y.title));
  const byAssessment = new Map<string, { r: MarkResult; pcts: number[] }>();
  const byPerson = new Map<string, { r: MarkResult; pcts: number[] }>();
  for (const r of ordered) {
    const a = byAssessment.get(r.assessmentId);
    if (a) a.pcts.push(r.pct);
    else byAssessment.set(r.assessmentId, { r, pcts: [r.pct] });
    const p = byPerson.get(r.personKey);
    if (p) p.pcts.push(r.pct);
    else byPerson.set(r.personKey, { r, pcts: [r.pct] });
  }
  const mean = (xs: number[]) => round1(xs.reduce((s, x) => s + x, 0) / xs.length);

  const assessments = [...byAssessment.values()]
    .map(({ r, pcts: ps }) => ({
      id: r.assessmentId, title: r.title, kind: r.kind, date: r.date, label: shortDate(r.date),
      avg: mean(ps), n: ps.length, min: Math.min(...ps), max: Math.max(...ps), passed: ps.filter((p) => p >= pass).length,
    }))
    .sort((x, y) => x.date.localeCompare(y.date) || x.title.localeCompare(y.title));

  const students = [...byPerson.entries()]
    .map(([key, { r, pcts: ps }]) => ({
      key, studentId: key.startsWith("s:") ? key.slice(2) : null,
      name: r.name, rollNo: r.rollNo, guest: r.guest, avg: mean(ps), count: ps.length,
      trend: ps, delta: ps.length > 1 ? round1(ps[ps.length - 1] - ps[0]) : null,
      best: Math.max(...ps), worst: Math.min(...ps),
    }))
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
    improvers: students.filter((s) => s.delta != null && s.delta >= TREND_MIN_POINTS)
      .sort((x, y) => y.delta! - x.delta! || x.name.localeCompare(y.name)),
    slipping: students.filter((s) => s.delta != null && s.delta <= -TREND_MIN_POINTS)
      .sort((x, y) => x.delta! - y.delta! || x.name.localeCompare(y.name)),
  };
}

/* ─────────────────────────── Assignment tracker ─────────────────────────── */

export type SubmissionStage = "marked" | "review" | "checking" | "failed";

/** Where a counted attempt is (status values of 18_upload_flow; null = old portal submit). */
export function submissionStage(s: Pick<SubmissionRow, "status" | "grade">): SubmissionStage {
  switch (s.status) {
    case "published": return "marked";
    case "checked": case "needs_review": return "review";
    case "failed": return "failed";
    case "uploaded": case "queued": case "checking": case "waiting_key": case "waiting_quota": return "checking";
    default: return s.grade != null ? "marked" : "review";
  }
}

export interface AssignmentTrack {
  id: string; title: string; batchId: string | null; deadline: string | null; createdAt: string;
  /** active students of the assignment's batch */
  expected: number;
  /** of those, how many sent at least one attempt */
  submitted: number;
  /** open-link submitters (no student account) */
  guests: number;
  late: number;
  stages: Record<SubmissionStage, number>;
  notSubmitted: RosterStudent[];
  /** deadline passed? null = no deadline */
  closed: boolean | null;
}

export function trackAssignments(
  assignments: AssignmentRow[], submissions: SubmissionRow[], roster: RosterStudent[], now: Date = new Date(),
): AssignmentTrack[] {
  const policy = new Map(assignments.map((a) => [a.id, a.countPolicy]));
  const counted = countedAttempts(submissions, policy);
  const byAssignment = new Map<string, SubmissionRow[]>();
  for (const s of counted) {
    const g = byAssignment.get(s.assignmentId);
    if (g) g.push(s);
    else byAssignment.set(s.assignmentId, [s]);
  }
  return assignments
    .map((a) => {
      const subs = byAssignment.get(a.id) ?? [];
      const inBatch = a.batchId ? roster.filter((r) => (r.batchIds ?? []).includes(a.batchId!)) : [];
      const sent = new Set(subs.filter((s) => s.studentId).map((s) => s.studentId!));
      const stages: Record<SubmissionStage, number> = { marked: 0, review: 0, checking: 0, failed: 0 };
      for (const s of subs) stages[submissionStage(s)] += 1;
      const deadline = a.deadline ?? null;
      return {
        id: a.id, title: a.title || "Assignment", batchId: a.batchId ?? null, deadline, createdAt: a.createdAt,
        expected: inBatch.length,
        submitted: inBatch.filter((r) => sent.has(r.id)).length,
        guests: subs.filter((s) => !s.studentId).length,
        late: subs.filter((s) => s.isLate).length,
        stages,
        notSubmitted: inBatch.filter((r) => !sent.has(r.id)),
        closed: deadline ? new Date(deadline).getTime() < now.getTime() : null,
      };
    })
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
}

/* ─────────────────────────── Question-wise analysis ─────────────────────────── */

export interface QuestionSheet {
  /** check_sheets.per_question: [{ q_no, marks, max_marks, counted, not_attempted, … }] */
  perQuestion: unknown;
  /** ai_result.graded_questions (older sheets; also has key_concepts_missed / _found) */
  graded: unknown;
}

export interface QuestionStat {
  q: string;
  /** marks scored / marks available across the sheets that attempted it, % */
  pct: number | null;
  scored: number; available: number;
  attempted: number; skipped: number;
}
export interface ConceptStat { concept: string; students: number; questions: string[] }
export interface QuestionSummary { sheets: number; questions: QuestionStat[]; missed: ConceptStat[]; strong: ConceptStat[] }

type QItem = { q: string; marks: number | null; max: number | null; counted: boolean; skipped: boolean; missed: string[]; found: string[] };

const toNum = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : [];

function questionItems(sheet: QuestionSheet): QItem[] {
  const pick = (raw: unknown, marksKey: "marks" | "marks_awarded"): QItem[] =>
    (Array.isArray(raw) ? raw : []).map((e: Record<string, unknown>, i: number) => ({
      q: String(e?.q_no ?? e?.question_number ?? i + 1).trim() || String(i + 1),
      marks: toNum(e?.[marksKey] ?? e?.marks ?? e?.marks_awarded),
      max: toNum(e?.max_marks),
      counted: e?.counted !== false,
      skipped: e?.not_attempted === true,
      missed: strList(e?.key_concepts_missed),
      found: strList(e?.key_concepts_found),
    }));
  const pq = pick(sheet.perQuestion, "marks");
  const gq = pick(sheet.graded, "marks_awarded");
  if (!pq.length) return gq;
  // per_question has the final (teacher-reviewed) marks; concepts only live in graded_questions
  const concepts = new Map(gq.map((g) => [g.q, g]));
  return pq.map((x) => ({ ...x, missed: concepts.get(x.q)?.missed ?? [], found: concepts.get(x.q)?.found ?? [] }));
}

const conceptKey = (c: string) => c.toLowerCase().replace(/\s+/g, " ");

export function summarizeQuestions(sheets: QuestionSheet[]): QuestionSummary {
  const qs = new Map<string, QuestionStat>();
  const missed = new Map<string, { concept: string; students: number; questions: Set<string> }>();
  const strong = new Map<string, { concept: string; students: number; questions: Set<string> }>();
  let used = 0;
  for (const sheet of sheets) {
    const items = questionItems(sheet).filter((x) => x.counted);
    if (!items.length) continue;
    used += 1;
    const seenMissed = new Set<string>();
    const seenFound = new Set<string>();
    for (const x of items) {
      const st = qs.get(x.q) ?? { q: x.q, pct: null, scored: 0, available: 0, attempted: 0, skipped: 0 };
      if (x.skipped) st.skipped += 1;
      else st.attempted += 1;
      if (x.max != null && x.max > 0) { st.available += x.max; st.scored += Math.max(0, Math.min(x.max, x.marks ?? 0)); }
      qs.set(x.q, st);
      for (const [list, into, seen] of [[x.missed, missed, seenMissed], [x.found, strong, seenFound]] as const) {
        for (const c of list) {
          const k = conceptKey(c);
          const e = into.get(k) ?? { concept: c, students: 0, questions: new Set<string>() };
          if (!seen.has(k)) { e.students += 1; seen.add(k); }
          e.questions.add(x.q);
          into.set(k, e);
        }
      }
    }
  }
  const questions = [...qs.values()]
    .map((q) => ({ ...q, scored: round1(q.scored), pct: q.available > 0 ? round1((q.scored / q.available) * 100) : null }))
    .sort((x, y) => x.q.localeCompare(y.q, undefined, { numeric: true, sensitivity: "base" }));
  const rank = (m: typeof missed) => [...m.values()]
    .map((c) => ({ concept: c.concept, students: c.students, questions: [...c.questions].sort((x, y) => x.localeCompare(y, undefined, { numeric: true })) }))
    .sort((x, y) => y.students - x.students || x.concept.localeCompare(y.concept));
  return { sheets: used, questions, missed: rank(missed), strong: rank(strong) };
}

/* ─────────────────────────── One row per student ─────────────────────────── */

export type StudentFlag = "low-attendance" | "low-marks" | "absent-streak";
export type RiskLevel = "high" | "watch" | "ok" | "none";

export interface StudentRow {
  key: string; studentId: string | null; name: string; rollNo: string; batchName?: string; guest: boolean;
  parentPhone: string | null;
  att: StudentAttendance | null;
  marks: StudentMarks | null;
  flags: StudentFlag[];
  /** high = 2+ flags, watch = 1, ok = data and no flag, none = nothing marked / no marks */
  risk: RiskLevel;
}

export const RISK_ORDER: Record<RiskLevel, number> = { high: 0, watch: 1, ok: 2, none: 3 };

export function combineStudents(
  att: AttendanceSummary | null, marks: MarksSummary | null, roster: RosterStudent[], target: number, pass: number,
): StudentRow[] {
  const attById = new Map((att?.students ?? []).map((s) => [s.id, s]));
  const marksByKey = new Map((marks?.students ?? []).map((s) => [s.key, s]));
  const rows: StudentRow[] = roster.map((r) => {
    const a = attById.get(r.id) ?? null;
    return {
      key: `s:${r.id}`, studentId: r.id, name: r.name, rollNo: r.rollNo, batchName: r.batchName, guest: false,
      parentPhone: r.parentPhone ?? null,
      att: a && a.total > 0 ? a : null,
      marks: marksByKey.get(`s:${r.id}`) ?? null,
      flags: [], risk: "none" as RiskLevel,
    };
  });
  const onRoster = new Set(rows.map((r) => r.key));
  for (const m of marks?.students ?? []) {
    if (onRoster.has(m.key)) continue;
    rows.push({
      key: m.key, studentId: m.studentId, name: m.name, rollNo: m.rollNo, guest: m.guest, parentPhone: null,
      att: null, marks: m, flags: [], risk: "none",
    });
  }
  for (const r of rows) {
    if (r.att && r.att.pct != null && r.att.total >= MIN_MARKED_FOR_ALERT && r.att.pct < target) r.flags.push("low-attendance");
    if (r.marks && r.marks.avg < pass) r.flags.push("low-marks");
    if (r.att && r.att.absentStreak >= STREAK_ALERT) r.flags.push("absent-streak");
    r.risk = r.flags.length >= 2 ? "high" : r.flags.length === 1 ? "watch" : r.att || r.marks ? "ok" : "none";
  }
  return rows.sort((x, y) => RISK_ORDER[x.risk] - RISK_ORDER[y.risk] || x.name.localeCompare(y.name));
}

/** Pearson r, null with fewer than 3 points or no spread. */
export function pearson(points: { x: number; y: number }[]): number | null {
  const n = points.length;
  if (n < 3) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const p of points) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; }
  if (sxx === 0 || syy === 0) return null;
  return Math.round((sxy / Math.sqrt(sxx * syy)) * 100) / 100;
}

/* ─────────────────────────── Insights ─────────────────────────── */

export type InsightTone = "bad" | "warn" | "good" | "info";
export type InsightIcon = "flame" | "trend-up" | "trend-down" | "calendar" | "alert" | "trophy" | "clock" | "link" | "star" | "book";
export type InsightAction = "attendance" | "marks" | "students" | "assignments";
export interface Insight { id: string; tone: InsightTone; icon: InsightIcon; title: string; detail: string; action?: InsightAction }

/** Days of the week need this many marks before one is called "the weakest". */
export const MIN_DAY_MARKS = 5;
/** Change vs the previous period worth calling out, in % points. */
export const DELTA_CALLOUT = 3;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const names = (xs: { name: string }[], k = 3) =>
  xs.slice(0, k).map((x) => x.name).join(", ") + (xs.length > k ? ` +${xs.length - k} more` : "");

export interface InsightInput {
  att: AttendanceSummary | null; prevAttRate: number | null;
  marks: MarksSummary | null; prevMarksAvg: number | null;
  pending: number; rows: StudentRow[]; target: number; pass: number;
  /** "previous 30 days"; null = no comparison (all time) */
  prevLabel: string | null;
}

/** What stands out — every line is computed from the loaded rows; nothing when there's nothing to say. */
export function buildInsights(i: InsightInput): Insight[] {
  const out: Insight[] = [];
  const { att, marks } = i;
  const high = i.rows.filter((r) => r.risk === "high");
  if (high.length)
    out.push({ id: "high-risk", tone: "bad", icon: "alert", action: "students",
      title: `${plural(high.length, "student")} need${high.length === 1 ? "s" : ""} attention on two fronts`,
      detail: `${names(high)} — low attendance, low marks or a run of absences together.` });
  if (att?.streaks.length)
    out.push({ id: "streaks", tone: "bad", icon: "flame", action: "attendance",
      title: `${plural(att.streaks.length, "student")} absent ${STREAK_ALERT}+ classes in a row`,
      detail: `${names(att.streaks)}. A call to the parents now is easier than a defaulter list later.` });
  if (att?.rate != null && i.prevAttRate != null && i.prevLabel) {
    const d = round1(att.rate - i.prevAttRate);
    if (d <= -DELTA_CALLOUT)
      out.push({ id: "att-down", tone: "bad", icon: "trend-down", action: "attendance",
        title: `Attendance is down ${Math.abs(d)} points`, detail: `${att.rate}% now vs ${i.prevAttRate}% in the ${i.prevLabel}.` });
    else if (d >= DELTA_CALLOUT)
      out.push({ id: "att-up", tone: "good", icon: "trend-up", action: "attendance",
        title: `Attendance is up ${d} points`, detail: `${att.rate}% now vs ${i.prevAttRate}% in the ${i.prevLabel}.` });
  }
  if (marks?.avg != null && i.prevMarksAvg != null && i.prevLabel) {
    const d = round1(marks.avg - i.prevMarksAvg);
    if (d <= -DELTA_CALLOUT)
      out.push({ id: "marks-down", tone: "bad", icon: "trend-down", action: "marks",
        title: `Class average is down ${Math.abs(d)} points`, detail: `${marks.avg}% now vs ${i.prevMarksAvg}% in the ${i.prevLabel}.` });
    else if (d >= DELTA_CALLOUT)
      out.push({ id: "marks-up", tone: "good", icon: "trend-up", action: "marks",
        title: `Class average is up ${d} points`, detail: `${marks.avg}% now vs ${i.prevMarksAvg}% in the ${i.prevLabel}.` });
  }
  if (att?.defaulters.length)
    out.push({ id: "below-target", tone: "warn", icon: "calendar", action: "attendance",
      title: `${plural(att.defaulters.length, "student")} below ${i.target}% attendance`,
      detail: `Lowest: ${att.defaulters[0].name} at ${att.defaulters[0].pct}% (${att.defaulters[0].attended} of ${att.defaulters[0].total}).` });
  if (marks?.needsSupport.length)
    out.push({ id: "below-pass", tone: "warn", icon: "book", action: "marks",
      title: `${plural(marks.needsSupport.length, "student")} averaging below ${i.pass}%`,
      detail: `${names(marks.needsSupport)}.` });
  const days = (att?.weekday ?? []).filter((d) => d.rate != null && d.marked >= MIN_DAY_MARKS);
  if (days.length >= 2) {
    const worst = days.reduce((w, d) => (d.rate! < w.rate! ? d : w));
    const best = days.reduce((b, d) => (d.rate! > b.rate! ? d : b));
    if (best.rate! - worst.rate! >= 10)
      out.push({ id: "weak-day", tone: "warn", icon: "calendar", action: "attendance",
        title: `${worst.dayLong}s are your weakest day`, detail: `${worst.rate}% attend on ${worst.dayLong}s vs ${best.rate}% on ${best.dayLong}s.` });
  }
  if (marks && marks.assessments.length >= 2) {
    const low = marks.assessments.reduce((w, a) => (a.avg < w.avg ? a : w));
    out.push({ id: "weak-assessment", tone: low.avg < i.pass ? "warn" : "info", icon: "book", action: "marks",
      title: `Toughest so far: ${low.title}`, detail: `Class average ${low.avg}% (${plural(low.passed, "student")} of ${low.n} at or above ${i.pass}%).` });
  }
  if (marks?.improvers.length) {
    const s = marks.improvers[0];
    out.push({ id: "improver", tone: "good", icon: "trophy", action: "marks",
      title: `${s.name} improved by ${s.delta} points`, detail: `From ${s.trend[0]}% to ${s.trend[s.trend.length - 1]}% over ${plural(s.count, "result")}.` });
  }
  if (att?.perfect.length)
    out.push({ id: "perfect", tone: "good", icon: "star", action: "attendance",
      title: `${plural(att.perfect.length, "student")} with perfect attendance`, detail: `${names(att.perfect)}.` });
  const pts = i.rows.filter((r) => r.att?.pct != null && r.marks).map((r) => ({ x: r.att!.pct!, y: r.marks!.avg }));
  const r = pts.length >= 8 ? pearson(pts) : null;
  if (r != null && r >= 0.5)
    out.push({ id: "link", tone: "info", icon: "link", action: "students",
      title: "Attendance and marks move together", detail: `In your classes, students who attend more score higher (r = ${r}, ${pts.length} students).` });
  if (i.pending > 0)
    out.push({ id: "pending", tone: "info", icon: "clock", action: "assignments",
      title: `${plural(i.pending, "submission")} waiting for marks`, detail: "Check or publish them so they count in these numbers." });
  return out;
}
