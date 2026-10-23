import { describe, expect, it } from "vitest";
import fixture from "./fixtures/markedCopy2Page.json";
import type { GradedQuestion } from "../AiGradeBreakdown";
import {
  type LayoutFonts, type Measure, layoutMargin, questionComment, reviewFlags, subpartLine, summaryRows, wrapText,
} from "../markedCopyLayout";

// 10 px per character: deterministic stand-in for canvas measureText
const measure: Measure = t => t.length * 10;
const FONTS: LayoutFonts = { marks: "m", sub: "s", comment: "c", marksH: 40, subH: 24, commentH: 28 };
const H = fixture.page_height;
const qs = fixture.graded_questions as unknown as GradedQuestion[];
const onPage = (i: number) => qs.filter(q => q.page_index === i).map(q => ({ ...q, prefY: ((q.y_start ?? 500) / 1000) * H }));
const OPTS = { width: 310, top: 16, bottom: H - 40, gap: 12, fonts: FONTS, measure };

describe("red-pen layout on a 2-page fixture copy", () => {
  it("wraps without dropping a single word", () => {
    const text = questionComment(qs[2])!;
    const lines = wrapText(text, 310, measure, "c");
    expect(lines.join(" ")).toBe(text);
    expect(lines.every(l => measure(l, "c") <= 310)).toBe(true);
    expect(text).not.toContain("…");
  });

  it("splits a word longer than the line instead of losing it", () => {
    expect(wrapText("abcdefghij", 40, measure, "c")).toEqual(["abcd", "efgh", "ij"]);
  });

  it("page 2: crowded Q8/Q9/Q10 get markers, full comments go to the notes; nothing truncated", () => {
    const { placed, notes } = layoutMargin(onPage(1), OPTS);
    // every question has its marks in the margin
    expect(placed.map(p => p.q_no)).toEqual(["8", "9", "10", "11", "12"]);
    // Q8 starts at 210 px, Q9 at 281 px: Q8's 5-line comment can't fit before Q9 → marker + note
    const q8 = placed.find(p => p.q_no === "8")!;
    expect(q8.marks).toBe("Q8 2/4 ①");
    expect(q8.comment).toEqual([]);
    expect(notes.map(n => [n.marker, n.q_no])).toEqual([["①", "8"], ["②", "9"]]);
    expect(notes[0].text).toBe(questionComment(qs[2]));
    expect(notes[1].text).toBe(questionComment(qs[3]));
    expect(notes.every(n => !n.text.includes("…"))).toBe(true);
    // Q10 has room below it (Q11 starts far lower): its comment — the teacher's note, not the AI feedback — is
    // written in full next to the answer
    const q10 = placed.find(p => p.q_no === "10")!;
    expect(q10.marks).toBe("Q10 1/3");
    expect(q10.comment.join(" ")).toBe(questionComment(qs[4]));
    expect(q10.comment.join(" ")).toMatch(/^Given 1 mark/);
  });

  it("blocks never overlap each other and stay inside the margin's height", () => {
    const { placed } = layoutMargin(onPage(1), OPTS);
    for (let i = 1; i < placed.length; i++) expect(placed[i].y).toBeGreaterThanOrEqual(placed[i - 1].y + placed[i - 1].height);
    for (const p of placed) expect(p.y + p.height).toBeLessThanOrEqual(OPTS.bottom);
  });

  it("a comment with room next to its answer is written there, wrapped to the margin", () => {
    const { placed, notes } = layoutMargin(onPage(0), OPTS);
    const q2 = placed.find(p => p.q_no === "2")!;
    expect(q2.comment.join(" ")).toBe("Wrote the formula for kinetic energy instead of potential energy.");
    expect(q2.comment.length).toBeGreaterThan(1);
    expect(notes).toHaveLength(0);
  });

  it("sub-part marks: (i) 1/1 · (ii) 1.5/3 · (iii) 1/2 = 3.5/6", () => {
    expect(subpartLine(qs[5])).toBe("(i) 1/1 · (ii) 1.5/3 · (iii) 1/2 = 3.5/6");
    const q11 = layoutMargin(onPage(1), OPTS).placed.find(p => p.q_no === "11")!;
    expect(q11.sub.join(" ")).toBe("(i) 1/1 · (ii) 1.5/3 · (iii) 1/2 = 3.5/6");
    expect(q11.comment.join(" ")).toBe("Missing the final numerical answer with units.");
  });

  it("a margin with no room left sends the whole block to the notes", () => {
    const { placed, notes } = layoutMargin(onPage(1), { ...OPTS, bottom: 400 });
    expect(placed.map(p => p.q_no)).not.toContain("12");
    expect(notes.find(n => n.q_no === "12")?.text).toBe("Q12 —");
  });

  it("markers continue across pages", () => {
    const { notes } = layoutMargin(onPage(1), { ...OPTS, firstMarker: 3 });
    expect(notes[0].marker).toBe("③");
  });

  it("summary: one row per question with marks, max, full comment and review flags", () => {
    const rows = summaryRows(qs);
    expect(rows.map(r => [r.q_no, r.marks, r.max])).toEqual([
      ["1", "2", "2"], ["2", "1", "3"], ["8", "2", "4"], ["9", "3", "5"], ["10", "1", "3"], ["11", "3.5", "6"], ["12", "—", "2"],
    ]);
    expect(rows[0].comment).toBe("Correct");
    expect(rows[6].comment).toBe("Not attempted");
    expect(rows[5].sub).toBe("(i) 1/1 · (ii) 1.5/3 · (iii) 1/2 = 3.5/6");
    expect(rows[3].review).toEqual(["Hard to read", "Low confidence"]);
    expect(reviewFlags(["bad_scan"], rows)).toEqual(["Bad scan", "Q9: Hard to read, Low confidence", "Q11: Low confidence"]);
  });
});
