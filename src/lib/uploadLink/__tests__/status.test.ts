import { describe, expect, it } from "vitest";
import { REVIEW_LABEL, isFinal, needsPolling, pickCounted, studentBadge, teacherBadge } from "../status";
import type { AttemptStatus } from "../status";

describe("student badge (what the student sees)", () => {
  it.each([
    ["uploaded", "Check ho raha hai ⏳"], ["queued", "Check ho raha hai ⏳"], ["checking", "Check ho raha hai ⏳"],
    ["failed", "Check ho raha hai ⏳"],                          // never an error for the student
    ["checked", "Check ho gaya, teacher result bhejenge"], ["needs_review", "Check ho gaya, teacher result bhejenge"],
    ["waiting_key", "Teacher ki taraf se pending hai"], ["waiting_quota", "Teacher ki taraf se pending hai"],
    ["rejected", "File mein problem"], ["published", "Result aa gaya"],
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
  it("labels review reasons in Hinglish", () => {
    expect(REVIEW_LABEL).toEqual({
      empty_answer: "Khaali answer", illegible: "Padh nahi paya", low_confidence: "AI sure nahi",
      key_missing: "Answer key missing", blank_pages: "Khaali pages", bad_scan: "Photo kharab",
    });
  });

  it("badges every status", () => {
    expect(teacherBadge("failed").tone).toBe("red");
    expect(teacherBadge("needs_review").label).toBe("Review karein");
    expect(teacherBadge("waiting_quota").label).toBe("Kal check hoga");
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
