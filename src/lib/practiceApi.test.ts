// NCERT practice data: odd backend rows, missing answer keys, duplicate ids, MCQ answer matching.
import { describe, expect, it } from "vitest";
import { hasQuestions, matchOption, parseQuestions, parseStats, practiceSessionHref, SUBJECTS_BY_CLASS } from "./practiceApi";

describe("parseStats", () => {
  it("keeps chapters with questions, sorted by chapter number", () => {
    const s = parseStats({ chapters: [
      { chapter: "Statistics", total: 90, chapter_no: 13, types: [{ name: "exercise", count: 60 }, { name: "x", count: 0 }] },
      { chapter: "Real Numbers", total: 40, chapter_no: 1, types: [] },
      { chapter: "", total: 5 }, { chapter: "Empty", total: 0 },
    ] });
    expect(s.map((c) => c.chapter)).toEqual(["Real Numbers", "Statistics"]);
    expect(s[1].types).toEqual([{ name: "exercise", count: 60 }]);
  });
  it("garbage → empty list", () => {
    for (const d of [null, {}, { chapters: "x" }, 7]) expect(parseStats(d)).toEqual([]);
  });
});

describe("parseQuestions", () => {
  it("normalises answers ('None' / empty = no key), options (JSON string or array) and drops duplicates", () => {
    const p = parseQuestions({ total: 3, hasMore: true, questions: [
      { id: 1, question_text: "Q1", answer: "None", options: "[\"a1\",\"a2\"]", difficulty: "easy" },
      { id: 2, question_text: "Q2", answer: "  (b) ", options: [{ text: "x" }, "y"], figure_missing: true },
      { id: 1, question_text: "Q1 again" },
      { id: 3, question_text: "" },
      { id: 4, question_text: "Q4", question_table: [["h1", "h2"], [1, null]] },
    ] });
    expect(p.questions.map((q) => q.id)).toEqual(["1", "2", "4"]);
    expect(p.questions[0]).toMatchObject({ answer: null, options: ["a1", "a2"], difficulty: "easy" });
    expect(p.questions[1]).toMatchObject({ answer: "(b)", options: ["x", "y"], figureMissing: true });
    expect(p.questions[2].table).toEqual([["h1", "h2"], ["1", ""]]);
    expect(p).toMatchObject({ total: 3, hasMore: true });
  });
  it("broken options string → no options (never throws)", () => {
    expect(parseQuestions({ questions: [{ id: 9, question_text: "Q", options: "['py list']" }] }).questions[0].options).toEqual([]);
  });
});

describe("matchOption", () => {
  const opts = ["is zero.", "decreases towards its end.", "increases towards its end.", "is the same at all points."];
  it("letters with a delimiter", () => {
    expect(matchOption("(d)", opts)).toBe(3);
    expect(matchOption("b)", opts)).toBe(1);
    expect(matchOption("C.", opts)).toBe(2);
    expect(matchOption("a", opts)).toBe(0);
    expect(matchOption("Option (b)", opts)).toBe(1);
  });
  it("the option's own text", () => {
    expect(matchOption("Is the same at all points", opts)).toBe(3);
  });
  it("never reads the word 'a' as option a, and gives up instead of guessing", () => {
    expect(matchOption("a magnet attracts iron", opts)).toBeNull();
    expect(matchOption("(f)", opts)).toBeNull();
    expect(matchOption(null, opts)).toBeNull();
    expect(matchOption("(a)", [])).toBeNull();
  });
});

describe("catalogue + links", () => {
  it("class 8 has no subjects; others do", () => {
    expect(hasQuestions("8")).toBe(false);
    expect(hasQuestions("10")).toBe(true);
    expect(SUBJECTS_BY_CLASS["7"]).toEqual(["Mathematics"]);
  });
  it("session links keep only what is set", () => {
    expect(practiceSessionHref({ c: "10", s: "Mathematics", ch: "Real Numbers" })).toBe("/practice/session?class=10&subject=Mathematics&chapter=Real+Numbers");
    expect(practiceSessionHref({ c: "10", s: "Science", ch: "Light", type: "mcq", page: 2, q: 3 })).toContain("type=mcq&page=2&q=3");
  });
});
