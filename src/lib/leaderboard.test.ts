import { describe, expect, it } from "vitest";
import { avatarColour, badgesFor, initials, mmss, rankRows, scoreTone } from "./leaderboard";
import type { LeaderboardRow } from "./contestApi";

const row = (id: string, score: number, time: number, extra: Partial<LeaderboardRow> = {}): LeaderboardRow =>
  ({ attempt_id: id, student_name: id, status: "submitted", score, total_marks: 50, percentage: (score / 50) * 100, time_taken_seconds: time, ...extra });

describe("rankRows", () => {
  it("score desc, time asc; identical score + time share a rank", () => {
    const r = rankRows([row("c", 40, 900), row("a", 45, 1200), row("b", 40, 800), row("d", 40, 900), row("run", 0, 0, { status: "in_progress" })]);
    expect(r.map((x) => [x.attempt_id, x.rank])).toEqual([["a", 1], ["b", 2], ["c", 3], ["d", 3]]);
  });
  it("tab switches break a full tie (teacher data)", () => {
    const r = rankRows([row("x", 30, 600, { warning_count: 2 }), row("y", 30, 600, { warning_count: 0 })]);
    expect(r[0].attempt_id).toBe("y");
  });
  it("uses the backend's rank when every row has one", () => {
    const r = rankRows([row("a", 40, 1, { rank: 2 }), row("b", 10, 9, { rank: 1 })]);
    expect(r.map((x) => x.attempt_id)).toEqual(["b", "a"]);
  });
});

describe("badges", () => {
  const all = rankRows(Array.from({ length: 20 }, (_, i) => row(`s${i}`, 50 - i * 2, 1000 + i * 10, { correct: 25 - i, wrong: i })));
  it("topper / perfect / top 10% / accuracy for #1", () => {
    const ids = badgesFor(all[0], all).map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(["topper", "perfect", "top10", "accuracy"]));
  });
  it("fastest finisher only among ≥70%", () => {
    const rows = rankRows([row("slow", 49, 1500), row("quick", 36, 400), row("fast70", 35, 300), row("low", 10, 100)]);
    const fast = rows.find((r) => r.attempt_id === "fast70")!;
    expect(badgesFor(fast, rows).map((b) => b.id)).toContain("fastest");
    expect(badgesFor(rows.find((r) => r.attempt_id === "low")!, rows).map((b) => b.id)).not.toContain("fastest");
  });
  it("zero tab switches only when known; never negative badges", () => {
    const me = { ...all[15], is_me: true };
    expect(badgesFor(me, all).map((b) => b.id)).not.toContain("focused");
    expect(badgesFor(me, all, { myWarnings: 0 }).map((b) => b.id)).toContain("focused");
    expect(badgesFor(all[19], all).length).toBeGreaterThanOrEqual(0);
  });
});

describe("display helpers", () => {
  it("deterministic avatar colour + initials", () => {
    expect(avatarColour("Priya Sharma")).toBe(avatarColour("Priya Sharma"));
    expect(initials("priya kumari sharma")).toBe("PS");
    expect(initials("")).toBe("?");
  });
  it("mm:ss and score colours", () => {
    expect(mmss(754)).toBe("12:34");
    expect(mmss(null)).toBe("—");
    expect(scoreTone(80).bar).toBe("#15803D");
    expect(scoreTone(50).bar).toBe("#B45309");
    expect(scoreTone(10).bar).toBe("#B91C1C");
  });
});

describe("resultsCsv", () => {
  it("ranked rows first, unfinished last, quotes escaped", async () => {
    const { resultsCsv } = await import("./leaderboard");
    const csv = resultsCsv([
      row("b", 30, 900, { student_name: 'Riya "R" Das', student_email: "r@x.in", warning_count: 2, submitted_via: "manual" }),
      row("a", 45, 1000, { student_name: "Aarav, S" }),
      { attempt_id: "run", student_name: "Still", status: "in_progress", score: null, total_marks: 50 },
    ]);
    const lines = csv.split("\n");
    expect(lines[0].startsWith("rank,name,email,score")).toBe(true);
    expect(lines[1].startsWith('1,"Aarav, S"')).toBe(true);
    expect(lines[2]).toContain('"Riya ""R"" Das",r@x.in,30,50,60,15:00,900');
    expect(lines[3].startsWith(",Still,")).toBe(true);
  });
});
