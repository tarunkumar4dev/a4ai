// Everything the Analytics views show, derived once from the loaded rows (this period + the previous one).
// Pure: the reads are in src/lib/teacherAnalyticsData.ts, the maths in src/lib/teacherAnalytics.ts.

import {
  attendanceRate, buildInsights, buildMarkResults, combineStudents, countedAttempts, rangeStartDate,
  rangeStartTimestamp, summarizeAttendance, summarizeMarks, trackAssignments,
  type AssignmentTrack, type AttendanceSummary, type AttRecord, type AttSession, type Insight, type MarkResult,
  type MarksSummary, type RosterStudent, type StudentRow, type TimeRange,
} from "@/lib/teacherAnalytics";
import type { MarksData } from "@/lib/teacherAnalyticsData";

export type Section<T> = { data: T | null; error: string | null };

export interface Loaded {
  roster: RosterStudent[];
  attendance: Section<{ sessions: AttSession[]; records: AttRecord[] }>;
  marks: Section<MarksData>;
}

export interface ModelOptions {
  range: TimeRange; target: number; pass: number; batchName: Map<string, string>; today?: Date;
}

export interface AnalyticsModel {
  target: number; pass: number;
  /** "previous 30 days"; null for all time (no comparison) */
  prevLabel: string | null;
  /** first day of the period (YYYY-MM-DD), null = all time */
  periodStart: string | null;
  batchName: Map<string, string>;
  roster: RosterStudent[];

  att: AttendanceSummary | null;
  /** this period's marks (for the student drawer) */
  attRecords: AttRecord[];
  prevAttRate: number | null;
  prevHeld: number | null;

  marks: MarksSummary | null;
  results: MarkResult[];
  prevMarksAvg: number | null;
  prevPassRate: number | null;
  pending: number;
  assignmentsGiven: number;
  copyChecks: number;
  tracker: AssignmentTrack[];
  /** counted attempts of this period's assignments (question-wise data reads only these) */
  countedSubmissionIds: Set<string>;

  rows: StudentRow[];
  insights: Insight[];
}

export function buildModel(loaded: Loaded, o: ModelOptions): AnalyticsModel {
  const today = o.today ?? new Date();
  const start = rangeStartDate(o.range, today);
  const startTs = rangeStartTimestamp(o.range, today);
  const startMs = startTs ? new Date(startTs).getTime() : null;
  const isCurDay = (d: string) => !start || d >= start;
  const isCurTs = (t: string) => startMs == null || new Date(t).getTime() >= startMs;
  const prevLabel = o.range === "all" ? null : `previous ${o.range} days`;
  const rosterById = new Map(loaded.roster.map((s) => [s.id, s]));

  /* attendance */
  const a = loaded.attendance.data;
  const sessions = (a?.sessions ?? []).filter((s) => isCurDay(s.date));
  const records = (a?.records ?? []).filter((r) => isCurDay(r.date));
  const att = a ? summarizeAttendance(sessions, records, loaded.roster, o.target) : null;
  const prevAttRate = a && start ? attendanceRate(a.records.filter((r) => !isCurDay(r.date))) : null;
  const prevHeld = a && start ? a.sessions.filter((s) => !isCurDay(s.date)).length : null;

  /* marks */
  const d = loaded.marks.data;
  let marks: MarksSummary | null = null;
  let results: MarkResult[] = [];
  let prevMarksAvg: number | null = null;
  let prevPassRate: number | null = null;
  let pending = 0, assignmentsGiven = 0, copyChecks = 0;
  let tracker: AssignmentTrack[] = [];
  const countedSubmissionIds = new Set<string>();
  if (d) {
    const asgCur = d.assignments.filter((x) => isCurTs(x.createdAt));
    const asgPrev = d.assignments.filter((x) => !isCurTs(x.createdAt));
    const curIds = new Set(asgCur.map((x) => x.id));
    const prevIds = new Set(asgPrev.map((x) => x.id));
    const subsCur = d.submissions.filter((s) => curIds.has(s.assignmentId));
    const subsPrev = d.submissions.filter((s) => prevIds.has(s.assignmentId));
    const sheetsCur = d.sheets.filter((s) => isCurTs(s.sessionCreatedAt));
    const sheetsPrev = d.sheets.filter((s) => !isCurTs(s.sessionCreatedAt));

    const build = buildMarkResults(asgCur, subsCur, sheetsCur, rosterById);
    results = build.results;
    pending = build.pending;
    marks = summarizeMarks(build.results, o.pass);
    if (startMs != null) {
      const prev = summarizeMarks(buildMarkResults(asgPrev, subsPrev, sheetsPrev, rosterById).results, o.pass);
      prevMarksAvg = prev.avg;
      prevPassRate = prev.passRate;
    }
    assignmentsGiven = asgCur.length;
    copyChecks = new Set(sheetsCur.map((s) => s.sessionId)).size;
    tracker = trackAssignments(asgCur, subsCur, loaded.roster, today);
    for (const s of countedAttempts(subsCur, new Map(asgCur.map((x) => [x.id, x.countPolicy])))) countedSubmissionIds.add(s.id);
  }

  const rows = combineStudents(att, marks, loaded.roster, o.target, o.pass);
  const insights = buildInsights({
    att, prevAttRate, marks, prevMarksAvg, pending, rows, target: o.target, pass: o.pass, prevLabel,
  });

  return {
    target: o.target, pass: o.pass, prevLabel, periodStart: start, batchName: o.batchName, roster: loaded.roster,
    att, attRecords: records, prevAttRate, prevHeld,
    marks, results, prevMarksAvg, prevPassRate, pending, assignmentsGiven, copyChecks, tracker, countedSubmissionIds,
    rows, insights,
  };
}

export type AnalyticsView = "overview" | "marks" | "attendance" | "students";

export interface ViewProps {
  m: AnalyticsModel;
  dark: boolean;
  /** "All my classes" is selected (batch names are shown next to students) */
  allClasses: boolean;
  go: (view: AnalyticsView) => void;
  openStudent: (key: string) => void;
  /** teacher dashboard → Assignments (optionally one assignment's submissions) */
  openAssignments: (assignmentId?: string) => void;
  openCheckCopies: () => void;
  openMarkAttendance: () => void;
}
