import { describe, expect, it } from "vitest";
import { clearAllDrafts, DRAFT_MAX_AGE_MS, draftKey, parseDraft, pickDraft } from "./testGenDraft";

const row = { id: "r1", topic: "Polynomials", quantity: 5, marks: 1, difficulty: "Medium", format: "MCQ" };
const stored = (data: unknown, savedAt = 1_000_000, v = 1) => JSON.stringify({ v, savedAt, data });

describe("pickDraft", () => {
  it("keeps only the draft fields", () => {
    const d = pickDraft({ examTitle: "Unit 1", logo: "data:image/png;base64,AAA", paperDate: "2026-10-28", userId: "u" });
    expect(d).toEqual({ examTitle: "Unit 1" });
  });

  it("drops invalid fields and keeps the valid ones", () => {
    const d = pickDraft({ classGrade: "Class 9", simpleData: "not rows", useNCERT: "yes", subject: "" });
    expect(d).toEqual({ classGrade: "Class 9" });
  });

  it("accepts a row without a chapter yet", () => {
    expect(pickDraft({ simpleData: [{ ...row, topic: "" }] }).simpleData).toHaveLength(1);
  });

  it("rejects rows with out-of-range numbers", () => {
    expect(pickDraft({ simpleData: [{ ...row, quantity: 500 }] })).toEqual({});
  });
});

describe("parseDraft", () => {
  const now = 1_000_000 + 1000;

  it("returns the fields of a valid draft", () => {
    expect(parseDraft(stored({ classGrade: "Class 9", simpleData: [row] }), now)).toEqual({ classGrade: "Class 9", simpleData: [row] });
  });

  it("ignores missing, broken, old-version and undated drafts", () => {
    expect(parseDraft(null, now)).toBeNull();
    expect(parseDraft("{not json", now)).toBeNull();
    expect(parseDraft(stored({ examTitle: "x" }, 1_000_000, 2), now)).toBeNull();
    expect(parseDraft(JSON.stringify({ v: 1, data: { examTitle: "x" } }), now)).toBeNull();
  });

  it("ignores drafts older than the limit", () => {
    expect(parseDraft(stored({ examTitle: "x" }), 1_000_000 + DRAFT_MAX_AGE_MS + 1)).toBeNull();
  });
});

describe("clearAllDrafts", () => {
  it("removes every user's draft and nothing else", () => {
    const data = new Map<string, string>([
      [draftKey("user-a"), "1"],
      [draftKey("user-b"), "2"],
      ["a4ai.auth.token", "keep"],
      ["test-progress-t1", "keep"],
    ]);
    const storage = {
      get length() { return data.size; },
      key: (i: number) => [...data.keys()][i] ?? null,
      removeItem: (k: string) => { data.delete(k); },
    };
    clearAllDrafts(storage);
    expect([...data.keys()]).toEqual(["a4ai.auth.token", "test-progress-t1"]);
  });
});
