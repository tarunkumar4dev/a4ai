import { describe, expect, it } from "vitest";
import {
  attendanceBands, attendanceRate, buildInsights, combineStudents, pearson, rangeStartDate, submissionStage,
  summarizeAttendance, summarizeMarks, summarizeQuestions, trackAssignments,
  type AssignmentRow, type AttRecord, type AttSession, type MarkResult, type RosterStudent, type SubmissionRow,
} from "./teacherAnalytics";

const roster: RosterStudent[] = [
  { id: "s1", name: "Asha", rollNo: "1", batchName: "10-A", batchIds: ["b"], parentPhone: "9876500001" },
  { id: "s2", name: "Bilal", rollNo: "2", batchName: "10-A", batchIds: ["b"] },
  { id: "s3", name: "Chitra", rollNo: "3", batchName: "10-A", batchIds: ["b", "lab"] },
];
const rec = (sessionId: string, studentId: string, status: string, date: string, batchId = "b"): AttRecord =>
  ({ sessionId, studentId, status, date, batchId });

describe("previous period window", () => {
  it("periods = 2 starts the N days before this period", () => {
    const today = new Date(2026, 10, 24, 10);
    expect(rangeStartDate("30", today)).toBe("2026-10-26");
    expect(rangeStartDate("30", today, 2)).toBe("2026-09-26");
    expect(rangeStartDate("7", today, 2)).toBe("2026-11-11");
    expect(rangeStartDate("all", today, 2)).toBeNull();
  });
});

describe("attendance: streaks, recent dots, bands, per batch", () => {
  const sessions: AttSession[] = ["01", "02", "03", "04", "05"].map((d) => ({ id: `c${d}`, batchId: "b", date: `2026-11-${d}` }));
  sessions.push({ id: "lab1", batchId: "lab", date: "2026-11-03" });
  const records: AttRecord[] = [
    // Asha: present every class → perfect
    ...sessions.filter((s) => s.batchId === "b").map((s) => rec(s.id, "s1", "present", s.date)),
    // Bilal: present, then absent ×4 → streak 4 (records arrive out of order on purpose)
    rec("c05", "s2", "absent", "2026-11-05"), rec("c01", "s2", "present", "2026-11-01"),
    rec("c03", "s2", "absent", "2026-11-03"), rec("c02", "s2", "absent", "2026-11-02"), rec("c04", "s2", "absent", "2026-11-04"),
    // Chitra: absent, absent, LEAVE (ends the run), absent → streak 1; lab class present
    rec("c01", "s3", "absent", "2026-11-01"), rec("c02", "s3", "absent", "2026-11-02"),
    rec("c03", "s3", "leave", "2026-11-03"), rec("c04", "s3", "absent", "2026-11-04"),
    rec("lab1", "s3", "present", "2026-11-03", "lab"),
  ];
  const a = summarizeAttendance(sessions, records, roster, 75);
  const by = (id: string) => a.students.find((s) => s.id === id)!;

  it("absent run up to the latest class; leave / late / present end it", () => {
    expect(by("s2").absentStreak).toBe(4);
    expect(by("s3").absentStreak).toBe(1);
    expect(by("s1").absentStreak).toBe(0);
    expect(a.streaks.map((s) => s.id)).toEqual(["s2"]);
  });

  it("recent statuses oldest → newest, by date", () => {
    expect(by("s2").recent).toEqual(["present", "absent", "absent", "absent", "absent"]);
  });

  it("perfect attendance needs 3+ marked classes at 100 %", () => {
    expect(a.perfect.map((s) => s.id)).toEqual(["s1"]);
  });

  it("per batch rate + classes held", () => {
    const b = a.byBatch.find((x) => x.batchId === "b")!;
    const lab = a.byBatch.find((x) => x.batchId === "lab")!;
    expect(b.held).toBe(5);
    expect(b.marked).toBe(14);
    expect(lab).toEqual({ batchId: "lab", rate: 100, marked: 1, held: 1 });
  });

  it("every roster student is in exactly one band", () => {
    const total = a.bands.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(roster.length);
    expect(a.bands.find((b) => b.key === "great")!.count).toBe(1); // Asha 100
    expect(a.bands.find((b) => b.key === "risk")!.count).toBe(2); // Bilal 20, Chitra 40
  });

  it("bands around an 85 % / 90 % target leave no gap", () => {
    const studs = [100, 89.9, 85, 84.9, 75, 74.9, 0].map((pct, i) => ({ ...by("s1"), id: `x${i}`, pct }));
    for (const target of [75, 80, 85, 90]) {
      const bands = attendanceBands(studs, target);
      expect(bands.reduce((s, b) => s + b.count, 0)).toBe(studs.length);
    }
    expect(attendanceBands(studs, 90).map((b) => b.label)).toEqual(["90% +", "80–89%", "Below 80%", "Not marked"]);
  });

  it("attendanceRate = the same rule, null when nothing is marked", () => {
    expect(attendanceRate([rec("c", "s", "present", "d"), rec("c", "t", "late", "d"), rec("c", "u", "leave", "d")])).toBe(66.7);
    expect(attendanceRate([])).toBeNull();
  });
});

describe("marks: trends per student and spread per assessment", () => {
  const r = (assessmentId: string, date: string, personKey: string, pct: number): MarkResult =>
    ({ assessmentId, title: assessmentId, kind: "copies", date, personKey, name: personKey, rollNo: "", guest: false, pct });
  const results = [
    r("t2", "2026-11-10", "s:s1", 80), r("t1", "2026-11-01", "s:s1", 50), r("t3", "2026-11-20", "s:s1", 90),
    r("t1", "2026-11-01", "s:s2", 70), r("t3", "2026-11-20", "s:s2", 40),
    r("t1", "2026-11-01", "n:guest|", 30),
  ];
  const m = summarizeMarks(results, 33);

  it("trend is in date order; delta = latest − first", () => {
    const a = m.students.find((s) => s.key === "s:s1")!;
    expect(a.trend).toEqual([50, 80, 90]);
    expect(a.delta).toBe(40);
    expect(a.studentId).toBe("s1");
    expect(m.students.find((s) => s.key === "n:guest|")!.delta).toBeNull();
  });

  it("improvers / slipping need ±5 points", () => {
    expect(m.improvers.map((s) => s.key)).toEqual(["s:s1"]);
    expect(m.slipping.map((s) => s.key)).toEqual(["s:s2"]);
  });

  it("assessment min / max / passed", () => {
    const t1 = m.assessments.find((a) => a.id === "t1")!;
    expect([t1.min, t1.max, t1.passed, t1.n]).toEqual([30, 70, 2, 3]); // 50 and 70 are at or above 33
  });
});

describe("assignment tracker", () => {
  const asg: AssignmentRow[] = [
    { id: "a1", title: "HW", maxMarks: 20, countPolicy: "latest", createdAt: "2026-11-01T09:00:00Z", batchId: "b", deadline: "2026-11-05T18:00:00Z" },
    { id: "a2", title: "Lab", maxMarks: 10, countPolicy: "latest", createdAt: "2026-11-10T09:00:00Z", batchId: "lab", deadline: null },
  ];
  const sub = (id: string, assignmentId: string, studentId: string | null, status: string | null, grade: number | null, extra: Partial<SubmissionRow> = {}): SubmissionRow => ({
    id, assignmentId, studentId, submitterKey: studentId ? null : `k-${id}`, guestName: null, guestRoll: null, grade, status,
    attemptNo: 1, submittedAt: "2026-11-04T10:00:00Z", sheetMax: null, ...extra,
  });
  const subs = [
    sub("x1", "a1", "s1", "published", 18),
    sub("x2", "a1", "s2", "uploaded", null, { attemptNo: 1 }),
    sub("x3", "a1", "s2", "needs_review", null, { attemptNo: 2, isLate: true }),
    sub("x4", "a1", null, "checking", null),
  ];
  const [lab, hw] = trackAssignments(asg, subs, roster, new Date("2026-11-20T00:00:00Z"));

  it("expected = the batch's students; missing = the rest; newest assignment first", () => {
    expect(hw.id).toBe("a1");
    expect([hw.expected, hw.submitted, hw.guests, hw.late]).toEqual([3, 2, 1, 1]);
    expect(hw.notSubmitted.map((s) => s.id)).toEqual(["s3"]);
    expect(hw.closed).toBe(true);
    expect(lab.expected).toBe(1); // only Chitra is in the lab batch
    expect(lab.closed).toBeNull();
  });

  it("stages count the counted attempt only", () => {
    expect(hw.stages).toEqual({ marked: 1, review: 1, checking: 1, failed: 0 });
  });

  it("status → stage", () => {
    expect(submissionStage({ status: "waiting_key", grade: null })).toBe("checking");
    expect(submissionStage({ status: null, grade: 12 })).toBe("marked"); // old portal, graded by hand
    expect(submissionStage({ status: null, grade: null })).toBe("review");
    expect(submissionStage({ status: "failed", grade: null })).toBe("failed");
  });
});

describe("question-wise analysis", () => {
  it("marks per question from per_question, concepts from graded_questions, natural order", () => {
    const q = summarizeQuestions([
      { perQuestion: [{ q_no: "10", marks: 1, max_marks: 2 }, { q_no: "2", marks: 0, max_marks: 4, not_attempted: true }, { q_no: "9", marks: 3, max_marks: 3 }],
        graded: [{ q_no: "2", key_concepts_missed: ["Ohm's law", "Ohm's  Law"] }, { q_no: "9", key_concepts_found: ["Power"] }] },
      { perQuestion: [{ q_no: "10", marks: 2, max_marks: 2 }, { q_no: "2", marks: 2, max_marks: 4 }, { q_no: "9", marks: 0, max_marks: 3 }, { q_no: "11", marks: 5, max_marks: 5, counted: false }],
        graded: [{ q_no: "2", key_concepts_missed: ["ohm's law"] }] },
    ]);
    expect(q.sheets).toBe(2);
    expect(q.questions.map((x) => x.q)).toEqual(["2", "9", "10"]); // "11" not counted (internal choice)
    const q2 = q.questions[0];
    expect([q2.pct, q2.scored, q2.available, q2.attempted, q2.skipped]).toEqual([25, 2, 8, 1, 1]);
    expect(q.questions[2].pct).toBe(75);
    expect(q.missed).toEqual([{ concept: "Ohm's law", students: 2, questions: ["2"] }]); // once per copy, any case / spacing
    expect(q.strong).toEqual([{ concept: "Power", students: 1, questions: ["9"] }]);
  });

  it("falls back to graded_questions when per_question is missing; skips copies with nothing", () => {
    const q = summarizeQuestions([
      { perQuestion: null, graded: [{ q_no: "1", marks_awarded: 1.5, max_marks: 2 }, { marks_awarded: 0, max_marks: 1 }] },
      { perQuestion: null, graded: null },
    ]);
    expect(q.sheets).toBe(1);
    expect(q.questions.map((x) => [x.q, x.pct])).toEqual([["1", 75], ["2", 0]]);
  });
});

describe("one row per student", () => {
  const sessions: AttSession[] = ["01", "02", "03"].map((d) => ({ id: `c${d}`, batchId: "b", date: `2026-11-${d}` }));
  const att = summarizeAttendance(sessions, [
    rec("c01", "s1", "present", "2026-11-01"), rec("c02", "s1", "present", "2026-11-02"), rec("c03", "s1", "present", "2026-11-03"),
    rec("c01", "s2", "absent", "2026-11-01"), rec("c02", "s2", "absent", "2026-11-02"), rec("c03", "s2", "absent", "2026-11-03"),
  ], roster, 75);
  const marks = summarizeMarks([
    { assessmentId: "t", title: "T", kind: "assignment", date: "2026-11-02", personKey: "s:s1", name: "Asha", rollNo: "1", guest: false, pct: 30 },
    { assessmentId: "t", title: "T", kind: "assignment", date: "2026-11-02", personKey: "g:k1", name: "Ravi", rollNo: "9", guest: true, pct: 70 },
  ], 33);
  const rows = combineStudents(att, marks, roster, 75, 33);
  const by = (k: string) => rows.find((r) => r.key === k)!;

  it("flags and risk", () => {
    expect(by("s:s2").flags).toEqual(["low-attendance", "absent-streak"]);
    expect(by("s:s2").risk).toBe("high");
    expect(by("s:s1").flags).toEqual(["low-marks"]);
    expect(by("s:s1").risk).toBe("watch");
    expect(by("s:s3").risk).toBe("none"); // nothing marked, no marks
  });

  it("guests from marks are appended; needs-attention first", () => {
    expect(by("g:k1")).toMatchObject({ guest: true, att: null, risk: "ok", parentPhone: null });
    expect(rows.map((r) => r.risk)).toEqual(["high", "watch", "ok", "none"]);
    expect(by("s:s1").parentPhone).toBe("9876500001");
  });
});

describe("pearson", () => {
  it("r for clean lines, null when it can't be computed", () => {
    expect(pearson([{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }])).toBe(1);
    expect(pearson([{ x: 1, y: 3 }, { x: 2, y: 2 }, { x: 3, y: 1 }])).toBe(-1);
    expect(pearson([{ x: 1, y: 1 }, { x: 2, y: 2 }])).toBeNull();
    expect(pearson([{ x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }])).toBeNull();
  });
});

describe("insights", () => {
  const base = { att: null, prevAttRate: null, marks: null, prevMarksAvg: null, pending: 0, rows: [], target: 75, pass: 33, prevLabel: "previous 30 days" };

  it("nothing to say → nothing said", () => {
    expect(buildInsights(base)).toEqual([]);
  });

  it("vs previous only with a previous number and a period to name", () => {
    const sessions: AttSession[] = [{ id: "c1", batchId: "b", date: "2026-11-02" }];
    const att = summarizeAttendance(sessions, [rec("c1", "s1", "present", "2026-11-02"), rec("c1", "s2", "present", "2026-11-02")], roster, 75);
    expect(buildInsights({ ...base, att, prevAttRate: 60 }).map((i) => i.title)).toContain("Attendance is up 40 points");
    expect(buildInsights({ ...base, att, prevAttRate: 98.5 }).map((i) => i.id)).not.toContain("att-up"); // +1.5 < 3
    expect(buildInsights({ ...base, att, prevAttRate: 60, prevLabel: null }).map((i) => i.id)).not.toContain("att-up");
  });

  it("weakest weekday needs enough marks and a 10-point gap", () => {
    const days = ["2026-11-02", "2026-11-09", "2026-11-06", "2026-11-13"]; // Mon, Mon, Fri, Fri
    const sessions = days.map((d, i) => ({ id: `c${i}`, batchId: "b", date: d }));
    const records: AttRecord[] = [];
    sessions.forEach((s, i) => {
      for (let k = 0; k < 3; k++) records.push(rec(s.id, `p${i}${k}`, s.date.endsWith("06") || s.date.endsWith("13") ? (k === 0 ? "present" : "absent") : "present", s.date));
    });
    const att = summarizeAttendance(sessions, records, roster, 75);
    const weak = buildInsights({ ...base, att }).find((i) => i.id === "weak-day");
    expect(weak?.title).toBe("Fridays are your weakest day");
    expect(weak?.detail).toBe("33.3% attend on Fridays vs 100% on Mondays.");
  });

  it("pending submissions point to assignments", () => {
    const i = buildInsights({ ...base, pending: 2 });
    expect(i).toEqual([expect.objectContaining({ id: "pending", action: "assignments", title: "2 submissions waiting for marks" })]);
  });
});
