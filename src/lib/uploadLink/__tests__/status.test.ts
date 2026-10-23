import { describe, expect, it } from "vitest";
import { REVIEW_LABEL, isFinal, needsPolling, pickCounted, studentBadge, teacherBadge } from "../status";
import type { AttemptStatus } from "../status";

describe("student badge (what the student sees)", () => {
  it.each([
    ["uploaded", "Being checked ⏳"], ["queued", "Being checked ⏳"], ["checking", "Being checked ⏳"],
    ["failed", "Being checked ⏳"],                              // never an error for the student
    ["checked", "Checked — your teacher will share the result"], ["needs_review", "Checked — your teacher will share the result"],
    ["waiting_key", "Waiting for the teacher"], ["waiting_quota", "Waiting for the teacher"],
    ["rejected", "Problem with the file"], ["published", "Result ready"],
  ])("%s → %s", (status, label) => {
    expect(studentBadge(status).label).toBe(label);
  });

  it("polls only while something can still change", () => {
    expect(needsPolling([{ status: "published" }, { status: "rejected" }])).toBe(false);
    expect(needsPolling([{ status: "published" }, { status: "checked" }])).toBe(true);
    expect(needsPolling([])).toBe(false);
    expect(isFinal("failed")).toBe(false);                       // the teacher may retry
  });
});

describe("teacher side", () => {
  it("labels review reasons in plain English", () => {
    expect(REVIEW_LABEL).toEqual({
      empty_answer: "Empty answer", illegible: "Hard to read", low_confidence: "AI not sure",
      key_missing: "Answer key missing", blank_pages: "Blank pages", bad_scan: "Poor photo",
    });
  });

  it("badges every status", () => {
    expect(teacherBadge("failed").tone).toBe("red");
    expect(teacherBadge("needs_review").label).toBe("Needs review");
    expect(teacherBadge("waiting_quota").label).toBe("Checks tomorrow");
  });

  const a = (attempt_no: number, status: AttemptStatus, marks: number | null = null) => ({ attempt_no, status, marks });

  it("count policy latest = newest attempt that was not rejected", () => {
    expect(pickCounted([a(1, "published", 8), a(2, "checking"), a(3, "rejected")], "latest")?.attempt_no).toBe(2);
  });

  it("count policy best = highest published marks, else latest", () => {
    expect(pickCounted([a(1, "published", 8), a(2, "published", 6), a(3, "checking")], "best")?.attempt_no).toBe(1);
    expect(pickCounted([a(1, "checked", 9), a(2, "queued")], "best")?.attempt_no).toBe(2);
  });
});
