// Dashboard / rewards numbers: never invent (null instead of 0), teacher_release scores stay hidden,
// subjects keep contest % and practice marks apart, activity is newest first without duplicates.
import { describe, expect, it } from "vitest";
import { normalizeContest, type FeedContest } from "./contestLifecycle";
import type { PracticeSummary } from "./practiceProgress";
import { buildActivity, contestStats, milestones, subjectPerformance } from "./studentData";

const c = (o: Record<string, unknown>) => normalizeContest({ id: "x", short_code: "abcd1234", title: "T", status: "active", ...o }) as FeedContest;
const noPractice: PracticeSummary = { got: 0, review: 0, marked: 0, today: 0, week: [], bySubject: [], lastAt: null };

describe("contestStats", () => {
  it("no results → average null, not 0", () => {
    expect(contestStats([])).toEqual({ finished: 0, scored: 0, average: null, best: null, basis: 0 });
  });
  it("only submitted + visible scores count; pending results are finished but unscored", () => {
    const s = contestStats([
      c({ id: "1", my_state: "submitted", my_percentage: 80 }),
      c({ id: "2", my_state: "submitted", my_percentage: 61 }),
      c({ id: "3", my_state: "submitted", results_pending: true }),
      c({ id: "4", my_state: "registered" }),
    ]);
    expect(s).toEqual({ finished: 3, scored: 2, average: 71, best: 80, basis: 4 });
  });
});

describe("subjectPerformance", () => {
  it("contest average and practice marks per subject, case-insensitive merge", () => {
    const practice = { ...noPractice, bySubject: [{ subject: "physics", got: 3, review: 1 }, { subject: "Maths", got: 2, review: 0 }] };
    const rows = subjectPerformance([
      c({ id: "1", subject: "Physics", my_state: "submitted", my_percentage: 70 }),
      c({ id: "2", subject: "Physics", my_state: "submitted", my_percentage: 90 }),
      c({ id: "3", subject: "Physics", my_state: "submitted", results_pending: true }),
    ], practice);
    expect(rows[0]).toEqual({ subject: "Physics", contestAvg: 80, contests: 2, got: 3, review: 1 });
    expect(rows[1]).toEqual({ subject: "Maths", contestAvg: null, contests: 0, got: 2, review: 0 });
  });
});

describe("buildActivity", () => {
  it("newest first, one practice row per day, no pending scores, no duplicates", () => {
    const practice = { ...noPractice, week: [{ day: "2026-10-30", count: 4 }, { day: "2026-10-31", count: 0 }] };
    const a = buildActivity(
      [c({ id: "1", my_state: "submitted", my_submitted_at: "2026-10-31T10:00:00Z", my_score: 7, total_marks: 10 }),
       c({ id: "2", my_state: "submitted", my_submitted_at: "2026-11-01T09:00:00Z", results_pending: true, my_score: 9 }),
       c({ id: "3", my_state: "registered" })],
      [{ id: "t1", type: "earn", amount: 20, description: "Welcome", createdAt: "2026-10-29T08:00:00Z" },
       { id: "t1", type: "earn", amount: 20, description: "Welcome", createdAt: "2026-10-29T08:00:00Z" },
       { id: "t2", type: "spend", amount: -5, description: "x", createdAt: "bad date" }],
      practice, (x) => `/r/${x.id}`,
    );
    expect(a.map((x) => x.id)).toEqual(["c-2", "c-1", "p-2026-10-30", "t-t1"]);
    expect(a[0]).toMatchObject({ kind: "contest", score: null, pending: true });
    expect(a[1]).toMatchObject({ score: 7, total: 10, href: "/r/1" });
  });
});

describe("milestones", () => {
  it("reached only from real submitted results", () => {
    const m = milestones([
      c({ id: "1", my_state: "submitted", my_percentage: 100 }),
      c({ id: "2", my_state: "submitted", results_pending: true, my_percentage: null }),
    ]);
    expect(Object.fromEntries(m.map((x) => [x.id, x.reached]))).toEqual({ first: true, five: false, "75": true, perfect: true });
    expect(milestones([]).every((x) => !x.reached)).toBe(true);
  });
});
