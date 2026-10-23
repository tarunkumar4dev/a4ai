// src/components/checker/markedCopyLayout.ts
// Where the red pen writes on a marked copy — pure functions (no canvas), so they can be tested with a fixture copy.
// Rule: nothing is ever written on the student's page image. Marks + comments go into the white margin column
// added on the right, next to the answer (page_index + y_start). A comment that doesn't fit before the next
// answer's marks gets a numbered marker (①, ②) there and is written in full under the page ("Teacher's notes",
// a white band added below the image). Nothing is cut short.

import { effectiveMarks } from "./AiGradeBreakdown";
import type { GradedQuestion } from "./AiGradeBreakdown";

/** Width of `text` in px when drawn with `font` (canvas measureText in the app, a stub in tests). */
export type Measure = (text: string, font: string) => number;

const MARKERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳"];
export const marker = (n: number) => MARKERS[n - 1] || `(${n})`;

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** Word wrap to `maxW`; a word longer than a line is split by characters. Never drops text. */
export function wrapText(text: string, maxW: number, measure: Measure, font: string): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\n+/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next, font) <= maxW) { line = next; continue; }
      if (line) lines.push(line);
      if (measure(word, font) <= maxW) { line = word; continue; }
      // one very long word: as many characters per line as fit
      let chunk = "";
      for (const ch of word) {
        if (chunk && measure(chunk + ch, font) > maxW) { lines.push(chunk); chunk = ""; }
        chunk += ch;
      }
      line = chunk;
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** "(i) 1/1 · (ii) 1.5/3 · (iii) 1/2 = 3.5/6" — only for questions graded in sub-parts. */
export function subpartLine(q: GradedQuestion): string | null {
  const subs = q.has_subparts ? q.subpart_grades || [] : [];
  if (subs.length < 2) return null;
  const label = (id: string) => {
    const bare = id.replace(new RegExp(`^Q?${q.q_no.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "").trim() || id;
    return /^\(.*\)$/.test(bare) ? bare : `(${bare.replace(/^[(]|[)]$/g, "")})`;
  };
  const parts = subs.map(s => `${label(s.sub_id)} ${fmt(s.marks_awarded)}/${fmt(s.max_marks)}`);
  return `${parts.join(" · ")} = ${fmt(effectiveMarks(q))}/${fmt(q.max_marks)}`;
}

/** The teacher's note, else the reason marks were lost, else the question's feedback — in full. */
export function questionComment(q: GradedQuestion): string | null {
  if (q.teacher_note?.trim()) return q.teacher_note.trim();
  if (q.not_attempted || effectiveMarks(q) >= q.max_marks) return null;
  const points = q.has_subparts ? (q.subpart_grades || []).flatMap(s => s.points || []) : q.points || [];
  const lost = points.filter(p => p.marks_awarded < p.max_marks && p.reason?.trim()).map(p => p.reason.trim());
  const text = (lost.length ? lost.join(" ") : q.feedback || "").trim();
  return text && text !== "See sub-part feedback" ? text : null;
}

export function marksText(q: GradedQuestion): string {
  if (q.not_attempted) return `Q${q.q_no} —`;
  const got = effectiveMarks(q);
  const tick = got >= q.max_marks ? "✓ " : got === 0 ? "✗ " : "";
  return `Q${q.q_no} ${tick}${fmt(got)}/${fmt(q.max_marks)}`;
}

export interface LayoutFonts { marks: string; sub: string; comment: string; marksH: number; subH: number; commentH: number }

export interface Placed {
  q_no: string; y: number;              // top of the block in the margin
  marks: string;                        // "Q8 ✓ 3/3" (+ " ①" when the comment went to the notes)
  sub: string[];                        // wrapped sub-part line
  comment: string[];                    // wrapped comment (empty when it went to the notes)
  height: number;
}
export interface Note { marker: string; q_no: string; text: string }
export interface PageLayout { placed: Placed[]; notes: Note[] }

/**
 * Blocks in the margin, top to bottom in answer order. A block starts at its answer's height (or right below the
 * previous block). Its comment is written there only if the whole block ends before the next answer's height and
 * before `bottom`; otherwise marker + note. A block whose marks can't fit above `bottom` goes to the notes entirely.
 */
export function layoutMargin(questions: (GradedQuestion & { prefY: number })[], opts: {
  width: number; top: number; bottom: number; gap: number; fonts: LayoutFonts; measure: Measure; firstMarker?: number;
}): PageLayout {
  const { width, top, bottom, gap, fonts, measure } = opts;
  const qs = [...questions].sort((a, b) => a.prefY - b.prefY);
  const placed: Placed[] = [];
  const notes: Note[] = [];
  let n = (opts.firstMarker || 1) - 1;
  let cursor = top;

  qs.forEach((q, i) => {
    const marks = marksText(q);
    const subRaw = subpartLine(q);
    const sub = subRaw ? wrapText(subRaw, width, measure, fonts.sub) : [];
    const comment = questionComment(q);
    const y = Math.max(q.prefY, cursor);
    const headH = fonts.marksH + sub.length * fonts.subH;
    const nextY = i + 1 < qs.length ? qs[i + 1].prefY : Infinity;

    if (y + headH > bottom) {             // no room left in this margin at all
      n += 1;
      notes.push({ marker: marker(n), q_no: q.q_no,
                   text: [marks, subRaw, comment].filter(Boolean).join(" — ") });
      return;
    }
    const lines = comment ? wrapText(comment, width, measure, fonts.comment) : [];
    const fullH = headH + lines.length * fonts.commentH;
    if (!comment || y + fullH <= Math.min(bottom, Math.max(nextY, y + headH))) {
      placed.push({ q_no: q.q_no, y, marks, sub, comment: lines, height: fullH });
      cursor = y + fullH + gap;
      return;
    }
    n += 1;
    const m = marker(n);
    placed.push({ q_no: q.q_no, y, marks: `${marks} ${m}`, sub, comment: [], height: headH });
    notes.push({ marker: m, q_no: q.q_no, text: comment });
    cursor = y + headH + gap;
  });
  return { placed, notes };
}

/** One row of the summary page. */
export interface SummaryRow { q_no: string; marks: string; max: string; sub: string | null; comment: string; review: string[] }

export const REVIEW_TEXT: Record<string, string> = {
  empty_answer: "Empty answer", illegible: "Hard to read", low_confidence: "Low confidence", key_missing: "No answer key",
  blank_pages: "Blank pages", bad_scan: "Bad scan",
};
const reviewText = (r: string) => REVIEW_TEXT[r] || r.replace(/_/g, " ");

export function summaryRows(questions: GradedQuestion[]): SummaryRow[] {
  return questions.filter(q => q.counted !== false).map(q => ({
    q_no: q.q_no,
    marks: q.not_attempted ? "—" : fmt(effectiveMarks(q)),
    max: fmt(q.max_marks),
    sub: subpartLine(q),
    comment: q.not_attempted ? "Not attempted" : questionComment(q) || (effectiveMarks(q) >= q.max_marks ? "Correct" : ""),
    review: [
      ...(q.needs_review || q.review_reasons?.length ? (q.review_reasons?.length ? q.review_reasons : ["low_confidence"]) : []),
      ...(q.has_subparts ? (q.subpart_grades || []).flatMap(s => s.review_reasons || []) : []),
      ...(q.legibility_issue ? ["illegible"] : []),
    ].filter((r, i, a) => a.indexOf(r) === i).map(reviewText),
  }));
}

/** Review flags of the whole copy: the sheet's reasons + every question that needs a look. */
export function reviewFlags(sheetReasons: string[] | null | undefined, rows: SummaryRow[]): string[] {
  const out = (sheetReasons || []).map(reviewText);
  for (const r of rows) if (r.review.length) out.push(`Q${r.q_no}: ${r.review.join(", ")}`);
  return out.filter((r, i, a) => a.indexOf(r) === i);
}
