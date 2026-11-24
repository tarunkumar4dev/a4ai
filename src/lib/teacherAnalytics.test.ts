import { describe, expect, it } from "vitest";
import {
  buildMarkResults, classesNeeded, countedAttempts, parseDay, rangeStartDate, rangeStartTimestamp,
  scoreBrackets, summarizeAttendance, summarizeMarks,
  type AssignmentRow, type AttRecord, type AttSession, type CopySheetRow, type MarkResult, type RosterStudent,
  type SubmissionRow,
} from "./teacherAnalytics";

const roster: RosterStudent[] = [
  { id: "s1", name: "Asha", rollNo: "1", batchName: "10-A" },
  { id: "s2", name: "Bilal", rollNo: "2", batchName: "10-A" },
  { id: "s3", name: "Chitra", rollNo: "3", batchName: "10-A" },
];
const rosterById = new Map(roster.map((s) => [s.id, s]));

describe("range start", () => {
  const today = new Date(2026, 10, 24, 1, 30); // 24 Nov 2026, 01:30 local

  it("counts today as day 1, in the local calendar", () => {
    expect(rangeStartDate("7", today)).toBe("2026-11-18");
    expect(rangeStartDate("30", today)).toBe("2026-10-26");
    expect(rangeStartDate("all", today)).toBeNull();
  });

  it("timestamp = local midnight of the same day", () => {
    expect(new Date(rangeStartTimestamp("7", today)!).getTime()).toBe(new Date(2026, 10, 18).getTime());
    expect(rangeStartTimestamp("all", today)).toBeNull();
  });

  it("reads a bare date as a local day (not UTC)", () => {
    expect(parseDay("2026-11-23")!.getDay()).toBe(1); // Monday
    expect(parseDay("")).toBeNull();
    expect(parseDay("nope")).toBeNull();
  });
});

describe("classesNeeded", () => {
  it("smallest streak that reaches the target", () => {
    expect(classesNeeded(14, 22, 75)).toBe(10); // 24/32 = 75 %
    expect((14 + 10) / (22 + 10)).toBeGreaterThanOrEqual(0.75);
    expect((14 + 9) / (22 + 9)).toBeLessThan(0.75);
  });
  it("0 when already there", () => {
    expect(classesNeeded(3, 4, 75)).toBe(0);
    expect(classesNeeded(0, 0, 75)).toBe(0);
  });
});

describe("summarizeAttendance", () => {
  const sessions: AttSession[] = [
    { id: "c1", batchId: "b", date: "2026-11-23" }, // Mon
    { id: "c2", batchId: "b", date: "2026-11-24" }, // Tue
    { id: "c3", batchId: "b", date: "2026-11-25" }, // Wed
  ];
  const rec = (sessionId: string, studentId: string, status: string, date: string): AttRecord => ({ sessionId, studentId, status, date });
  const records: AttRecord[] = [
    rec("c1", "s1", "present", "2026-11-23"), rec("c1", "s2", "absent", "2026-11-23"),
    rec("c2", "s1", "late", "2026-11-24"), rec("c2", "s2", "absent", "2026-11-24"),
    rec("c3", "s1", "present", "2026-11-25"), rec("c3", "s2", "leave", "2026-11-25"),
    rec("c3", "gone", "present", "2026-11-25"), // left the batch since
  ];

  const a = summarizeAttendance(sessions, records, roster, 75);

  it("late = attended, leave stays in the total (get_monthly_attendance rule)", () => {
    expect(a.marked).toBe(7);
    expect(a.counts).toEqual({ present: 3, absent: 2, leave: 1, late: 1 });
    expect(a.rate).toBe(57.1); // 4 / 7
    expect(a.avgAttended).toBe(1.3); // 4 attended / 3 classes
  });

  it("per-day trend, oldest first", () => {
    expect(a.trend.map((t) => [t.date, t.rate, t.marked])).toEqual([
      ["2026-11-23", 50, 2], ["2026-11-24", 50, 2], ["2026-11-25", 66.7, 3],
    ]);
    expect(a.trend[0].label).toBe("23 Nov");
  });

  it("weekday bars: null where no class was held, no Sunday without a Sunday class", () => {
    expect(a.weekday.map((d) => d.day)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    expect(a.weekday.find((d) => d.day === "Thu")!.rate).toBeNull();
    expect(a.weekday.find((d) => d.day === "Wed")!.rate).toBe(66.7);
  });

  it("defaulters only from the roster, with enough classes marked", () => {
    expect(a.defaulters.map((s) => [s.id, s.pct, s.needed])).toEqual([["s2", 0, 9]]);
    expect(a.students.map((s) => s.id)).toEqual(["s2", "s1", "s3"]); // lowest first, unmarked last
    expect(a.students.find((s) => s.id === "s3")!.pct).toBeNull();
    expect(a.offRoster).toBe(1);
  });

  it("nothing marked → nulls, never sample numbers", () => {
    const e = summarizeAttendance([], [], roster, 75);
    expect(e.rate).toBeNull();
    expect(e.avgAttended).toBeNull();
    expect(e.trend).toEqual([]);
    expect(e.defaulters).toEqual([]);
    expect(e.weekday.every((d) => d.rate === null)).toBe(true);
  });
});

const sub = (p: Partial<SubmissionRow> & { id: string }): SubmissionRow => ({
  assignmentId: "a1", studentId: null, submitterKey: null, guestName: null, guestRoll: null,
  grade: null, status: "uploaded", attemptNo: 1, submittedAt: "2026-11-20T10:00:00Z", sheetMax: null, ...p,
});

describe("countedAttempts", () => {
  it("latest = newest non-rejected attempt, even if it has no marks yet", () => {
    const out = countedAttempts([
      sub({ id: "x1", studentId: "s1", attemptNo: 1, grade: 20, status: "published" }),
      sub({ id: "x2", studentId: "s1", attemptNo: 2, grade: null, status: "uploaded" }),
      sub({ id: "x3", studentId: "s1", attemptNo: 3, status: "rejected" }),
    ], new Map([["a1", "latest"]]));
    expect(out.map((s) => s.id)).toEqual(["x2"]);
  });

  it("best = highest published grade (tie → newer), else latest", () => {
    const policy = new Map([["a1", "best"]]);
    expect(countedAttempts([
      sub({ id: "x1", studentId: "s1", attemptNo: 1, grade: 25, status: "published" }),
      sub({ id: "x2", studentId: "s1", attemptNo: 2, grade: 18, status: "published" }),
      sub({ id: "x3", studentId: "s1", attemptNo: 3, grade: 25, status: "published" }),
    ], policy).map((s) => s.id)).toEqual(["x3"]);
    expect(countedAttempts([
      sub({ id: "y1", studentId: "s2", attemptNo: 1, status: "uploaded" }),
      sub({ id: "y2", studentId: "s2", attemptNo: 2, status: "checked" }),
    ], policy).map((s) => s.id)).toEqual(["y2"]);
  });

  it("guests are kept apart by their submitter key", () => {
    const out = countedAttempts([
      sub({ id: "g1", submitterKey: "k1", grade: 10, status: "published" }),
      sub({ id: "g2", submitterKey: "k2", grade: 12, status: "published" }),
    ], new Map());
    expect(out).toHaveLength(2);
  });
});

describe("buildMarkResults", () => {
  const assignments: AssignmentRow[] = [
    { id: "a1", title: "Ch 1 worksheet", maxMarks: 30, countPolicy: "latest", createdAt: "2026-11-10T00:00:00Z" },
    { id: "a2", title: "Old style", maxMarks: 20, countPolicy: "latest", createdAt: "2026-11-12T00:00:00Z" },
    { id: "a3", title: "No max", maxMarks: null, countPolicy: "latest", createdAt: "2026-11-13T00:00:00Z" },
  ];
  const sheets: CopySheetRow[] = [
    { id: "h1", sessionId: "cs1", sessionTitle: "Unit test", sessionCreatedAt: "2026-11-15T00:00:00Z", studentId: "s2", studentName: "Bilal K", rollNo: "2", marks: 20, max: 40 },
    { id: "h2", sessionId: "cs1", sessionTitle: "Unit test", sessionCreatedAt: "2026-11-15T00:00:00Z", studentId: null, studentName: " Ravi  Kumar ", rollNo: "9", marks: 30, max: 40 },
    { id: "h3", sessionId: "cs2", sessionTitle: "Quiz", sessionCreatedAt: "2026-11-16T00:00:00Z", studentId: null, studentName: "ravi kumar", rollNo: "9", marks: 5, max: 10 },
    { id: "h4", sessionId: "cs2", sessionTitle: "Quiz", sessionCreatedAt: "2026-11-16T00:00:00Z", studentId: null, studentName: "X", rollNo: "", marks: 5, max: null },
  ];
  const subs: SubmissionRow[] = [
    sub({ id: "x1", assignmentId: "a1", studentId: "s1", grade: 24, status: "published", sheetMax: 40 }), // sheet max wins
    sub({ id: "x2", assignmentId: "a2", studentId: "s1", grade: 15, status: "graded" }),                  // old flow → assignment max
    sub({ id: "x3", assignmentId: "a1", submitterKey: "k1", guestName: "  Meena ", guestRoll: "7", grade: 30, status: "published" }),
    sub({ id: "x4", assignmentId: "a1", studentId: "s3", status: "uploaded" }),                           // pending
    sub({ id: "x5", assignmentId: "a3", studentId: "s3", grade: 5, status: "graded" }),                   // no max → unscored
    sub({ id: "x6", assignmentId: "not-mine", studentId: "s3", grade: 5, status: "graded" }),             // ignored
  ];

  const b = buildMarkResults(assignments, subs, sheets, rosterById);

  it("uses the check sheet's max, else the assignment's", () => {
    const byId = (k: string, a: string) => b.results.find((r) => r.personKey === k && r.assessmentId === a)!;
    expect(byId("s:s1", "a1").pct).toBe(60);  // 24 / 40, not 24 / 30
    expect(byId("s:s1", "a2").pct).toBe(75);  // 15 / 20
    expect(byId("g:k1", "a1")).toMatchObject({ name: "Meena", rollNo: "7", guest: true, pct: 100 });
  });

  it("counts pending and unscored instead of inventing a number", () => {
    expect(b.pending).toBe(1);
    expect(b.unscored).toBe(2); // a3 (no max) + h4 (no max)
    expect(b.results.some((r) => r.assessmentId === "not-mine")).toBe(false);
  });

  it("roster name wins; quick-added names match on name + roll across copy checks", () => {
    expect(b.results.find((r) => r.personKey === "s:s2")!.name).toBe("Bilal");
    const ravi = b.results.filter((r) => r.personKey.startsWith("n:"));
    expect(new Set(ravi.map((r) => r.personKey)).size).toBe(1);
    expect(ravi).toHaveLength(2);
  });

  it("summary: averages, pass rate, per-assessment order, per-student lists", () => {
    const m = summarizeMarks(b.results, 33);
    // results: 60, 75, 100 (Meena), 50 (Bilal), 75 (Ravi), 50 (Ravi)
    expect(m.results).toBe(6);
    expect(m.avg).toBe(68.3);
    expect(m.highest).toBe(100);
    expect(m.passRate).toBe(100);
    expect(m.assessments.map((a) => [a.title, a.avg, a.n])).toEqual([
      ["Ch 1 worksheet", 80, 2], ["Old style", 75, 1], ["Unit test", 62.5, 2], ["Quiz", 50, 1],
    ]);
    expect(m.students.map((s) => [s.name, s.avg])).toEqual([
      ["Meena", 100], ["Asha", 67.5], ["Ravi  Kumar", 62.5], ["Bilal", 50],
    ]);
    expect(m.needsSupport).toEqual([]);
    expect(summarizeMarks(b.results, 50).needsSupport).toEqual([]);
  });

  it("no results → nulls", () => {
    const m = summarizeMarks([], 33);
    expect(m.avg).toBeNull();
    expect(m.highest).toBeNull();
    expect(m.passRate).toBeNull();
    expect(m.students).toEqual([]);
  });
});

describe("scoreBrackets", () => {
  const mk = (pct: number, i: number): MarkResult => ({
    assessmentId: "a", title: "t", kind: "assignment", date: "2026-11-01", personKey: `p${i}`, name: `P${i}`, rollNo: "", guest: false, pct,
  });

  for (const pass of [33, 40, 50]) {
    it(`every score lands in exactly one bracket (pass ${pass})`, () => {
      const scores = [0, 10, 32.9, 33, 39.9, 40, 45, 49.9, 50, 69.9, 70, 84.9, 85, 100];
      const m = summarizeMarks(scores.map(mk), pass);
      expect(m.distribution.reduce((s, d) => s + d.count, 0)).toBe(scores.length);
      expect(m.distribution.at(-1)!.label).toBe(`Below ${pass}%`);
      expect(m.needsSupport.every((s) => s.avg < pass)).toBe(true);
    });
  }

  it("no empty 'pass–49' bracket when the pass mark is 50", () => {
    expect(scoreBrackets(50).map((b) => b.label)).toEqual(["85% +", "70–84%", "50–69%", "Below 50%"]);
    expect(scoreBrackets(33).map((b) => b.label)).toContain("33–49%");
  });
});
