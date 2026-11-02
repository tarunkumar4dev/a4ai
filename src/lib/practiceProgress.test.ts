// Device practice progress: one entry per question (no double counting), local-day "today", per-user isolation,
// corrupt storage, other tabs.
import { beforeEach, describe, expect, it } from "vitest";
import {
  chapterMarks, clearMark, getProgress, localDay, markQuestion, setLastSession, setPracticeClass, subjectMarks, summarize,
} from "./practiceProgress";

const meta = { c: "10", s: "Mathematics", ch: "Real Numbers" };

beforeEach(() => localStorage.clear());

describe("marks", () => {
  it("marking the same question again replaces it (double click / second tab never counts twice)", () => {
    markQuestion("u1", "q1", "got", meta);
    markQuestion("u1", "q1", "got", meta);
    markQuestion("u1", "q1", "review", meta);
    const s = summarize(getProgress("u1"));
    expect(s).toMatchObject({ got: 0, review: 1, marked: 1 });
  });
  it("undo removes it", () => {
    markQuestion("u1", "q1", "got", meta);
    clearMark("u1", "q1");
    expect(summarize(getProgress("u1")).marked).toBe(0);
  });
  it("each user has their own progress (shared device)", () => {
    markQuestion("u1", "q1", "got", meta);
    expect(summarize(getProgress("u2")).marked).toBe(0);
  });
  it("corrupt storage starts fresh instead of crashing", () => {
    localStorage.setItem("a4ai_practice_v1_u1", "{not json");
    expect(getProgress("u1").marks).toEqual({});
    markQuestion("u1", "q1", "got", meta);
    expect(summarize(getProgress("u1")).got).toBe(1);
  });
  it("same data → same object (no re-render loop)", () => {
    markQuestion("u1", "q1", "got", meta);
    expect(getProgress("u1")).toBe(getProgress("u1"));
  });
  it("a write from another tab is picked up", () => {
    const before = getProgress("u1");
    localStorage.setItem("a4ai_practice_v1_u1", JSON.stringify({ v: 1, marks: { q9: { m: "got", t: Date.now(), ...{ c: "9", s: "Science", ch: "Motion" } } }, last: null, cls: "9" }));
    const after = getProgress("u1");
    expect(after).not.toBe(before);
    expect(after.cls).toBe("9");
  });
});

describe("summary", () => {
  it("today / last 7 days by the device's local date; older marks still count in totals", () => {
    const now = new Date(2026, 10, 1, 12, 0).getTime(); // 1 Nov, local noon
    markQuestion("u1", "a", "got", meta, now);
    markQuestion("u1", "b", "review", meta, new Date(2026, 10, 1, 0, 5).getTime());      // just after midnight: today
    markQuestion("u1", "c", "got", meta, new Date(2026, 9, 31, 23, 55).getTime());       // just before: yesterday
    markQuestion("u1", "d", "got", { c: "10", s: "Science", ch: "Light" }, new Date(2026, 9, 1).getTime()); // a month ago
    const s = summarize(getProgress("u1"), now);
    expect(s.today).toBe(2);
    expect(s.week).toHaveLength(7);
    expect(s.week[6]).toEqual({ day: localDay(now), count: 2 });
    expect(s.week[5].count).toBe(1);
    expect(s).toMatchObject({ got: 3, review: 1, marked: 4 });
    expect(s.bySubject[0]).toEqual({ subject: "Mathematics", got: 2, review: 1 });
  });
  it("chapter and subject counts", () => {
    markQuestion("u1", "a", "got", meta);
    markQuestion("u1", "b", "review", meta);
    markQuestion("u1", "c", "got", { ...meta, ch: "Polynomials" });
    expect(chapterMarks(getProgress("u1"), "10", "Mathematics", "Real Numbers")).toEqual({ got: 1, review: 1 });
    expect(subjectMarks(getProgress("u1"), "10", "Mathematics")).toBe(3);
  });
});

describe("last session + class", () => {
  it("are remembered", () => {
    setLastSession("u1", { c: "10", s: "Mathematics", ch: "Real Numbers", type: null, page: 2, q: 4 });
    setPracticeClass("u1", "11");
    expect(getProgress("u1")).toMatchObject({ cls: "11", last: { ch: "Real Numbers", page: 2, q: 4 } });
  });
});
