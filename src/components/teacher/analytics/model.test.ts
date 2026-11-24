import { describe, expect, it } from "vitest";
import { buildModel, type Loaded } from "./model";

// today = 24 Nov 2026 → "last 7 days" = 18–24 Nov, the previous 7 days = 11–17 Nov
const today = new Date(2026, 10, 24, 12);
const roster = [
  { id: "s1", name: "Asha", rollNo: "1", batchIds: ["b"] },
  { id: "s2", name: "Bilal", rollNo: "2", batchIds: ["b"] },
];
const rec = (sessionId: string, studentId: string, status: string, date: string) => ({ sessionId, studentId, status, date, batchId: "b" });

const loaded: Loaded = {
  roster,
  attendance: {
    error: null,
    data: {
      sessions: [{ id: "old", batchId: "b", date: "2026-11-12" }, { id: "new", batchId: "b", date: "2026-11-20" }],
      records: [
        rec("old", "s1", "absent", "2026-11-12"), rec("old", "s2", "absent", "2026-11-12"),
        rec("new", "s1", "present", "2026-11-20"), rec("new", "s2", "absent", "2026-11-20"),
      ],
    },
  },
  marks: {
    error: null,
    data: {
      assignments: [
        { id: "a-old", title: "Old", maxMarks: 10, countPolicy: "latest", createdAt: "2026-11-12T05:00:00Z", batchId: "b" },
        { id: "a-new", title: "New", maxMarks: 10, countPolicy: "latest", createdAt: "2026-11-21T05:00:00Z", batchId: "b" },
      ],
      submissions: [
        { id: "x1", assignmentId: "a-old", studentId: "s1", submitterKey: null, guestName: null, guestRoll: null, grade: 4, status: "published", attemptNo: 1, submittedAt: null, sheetMax: null },
        { id: "x2", assignmentId: "a-new", studentId: "s1", submitterKey: null, guestName: null, guestRoll: null, grade: 8, status: "published", attemptNo: 1, submittedAt: null, sheetMax: null },
        { id: "x3", assignmentId: "a-new", studentId: "s2", submitterKey: null, guestName: null, guestRoll: null, grade: null, status: "uploaded", attemptNo: 1, submittedAt: null, sheetMax: null },
      ],
      sheets: [],
    },
  },
};

describe("buildModel splits this period from the previous one", () => {
  const m = buildModel(loaded, { range: "7", target: 75, pass: 33, batchName: new Map([["b", "10-A"]]), today });

  it("attendance: only this period in the numbers, the period before only in the comparison", () => {
    expect(m.periodStart).toBe("2026-11-18");
    expect(m.att!.sessionsHeld).toBe(1);
    expect(m.att!.rate).toBe(50);
    expect(m.prevAttRate).toBe(0);
    expect(m.prevHeld).toBe(1);
    expect(m.attRecords).toHaveLength(2);
    expect(m.prevLabel).toBe("previous 7 days");
  });

  it("marks + tracker + counted attempts from this period's assignments", () => {
    expect(m.marks!.avg).toBe(80);
    expect(m.prevMarksAvg).toBe(40);
    expect(m.pending).toBe(1);
    expect(m.assignmentsGiven).toBe(1);
    expect(m.tracker.map((t) => [t.id, t.submitted, t.expected])).toEqual([["a-new", 2, 2]]);
    expect([...m.countedSubmissionIds].sort()).toEqual(["x2", "x3"]);
    expect(m.insights.map((i) => i.id)).toContain("marks-up");
  });

  it("all time → no comparison", () => {
    const all = buildModel(loaded, { range: "all", target: 75, pass: 33, batchName: new Map(), today });
    expect(all.prevLabel).toBeNull();
    expect(all.prevAttRate).toBeNull();
    expect(all.prevMarksAvg).toBeNull();
    expect(all.att!.sessionsHeld).toBe(2);
  });

  it("a failed section stays null instead of looking empty", () => {
    const failed = buildModel({ ...loaded, attendance: { data: null, error: "boom" } }, { range: "7", target: 75, pass: 33, batchName: new Map(), today });
    expect(failed.att).toBeNull();
    expect(failed.marks).not.toBeNull();
  });
});
