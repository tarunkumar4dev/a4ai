import { describe, expect, it } from "vitest";
import { PRIMARY_CHECKER_MODEL, REVIEW_LABEL, awaitingReview, isFinal, markedByBackupModel, needsPolling, pickCounted, studentBadge, teacherBadge } from "../status";
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
      fallback_model: "Backup AI model",
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

describe("fix/checker-p0: backup model badge + review gate", () => {
  it("badges copies not marked by the primary model (also old rows without the reason)", () => {
    expect(markedByBackupModel({ model_version: "gemini-3-flash-preview", needs_review_reasons: [] })).toBe(true);
    expect(markedByBackupModel({ model_version: PRIMARY_CHECKER_MODEL, needs_review_reasons: ["fallback_model"] })).toBe(true);
    expect(markedByBackupModel({ model_version: PRIMARY_CHECKER_MODEL, needs_review_reasons: ["low_confidence"] })).toBe(false);
    expect(markedByBackupModel({ model_version: null })).toBe(false);
    expect(markedByBackupModel(null)).toBe(false);
    expect(REVIEW_LABEL.fallback_model).toBe("Backup AI model");
  });

  it("a flagged copy waits for review until approved or edited", () => {
    expect(awaitingReview({ status: "needs_review", sheet: { review_approved_at: null } })).toBe(true);
    expect(awaitingReview({ status: "needs_review", sheet: {} })).toBe(true);
    expect(awaitingReview({ status: "needs_review", sheet: { review_approved_at: "2026-10-27T10:00:00Z" } })).toBe(false);
    expect(awaitingReview({ status: "checked", sheet: null })).toBe(false);
    expect(awaitingReview({ status: "published", sheet: { review_approved_at: null } })).toBe(false);
  });
});
