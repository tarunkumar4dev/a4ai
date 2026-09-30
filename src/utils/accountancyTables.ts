/**
 * accountancyTables.ts — text/table segments for Accountancy questions in the Test Builder.
 *
 * The heavy lifting (rebuilding ledgers, balance sheets, cash books and trial balances from
 * flattened NCERT text) happens on the backend in app/services/accountancy_parser.py, which also
 * drives the PDF/DOCX exporter. /ncert-questions returns its output as `structured_segments`, so
 * the preview shows exactly what will be printed.
 *
 * This module only covers what the browser can do without that parser:
 *   - a stored `question_table` (JSON)
 *   - canonical markdown tables inside `question_text` (what scripts/fix_accountancy_questions.py writes)
 */

export interface AccTable {
  headers: string[];
  rows: string[][];
  kind?: string;
  amount_cols?: number[];
  total_rows?: number[];
  section_rows?: number[];
  caption?: string;
  sides_unknown?: boolean;
  totals_verified?: boolean;
}

export type AccSegment =
  | { type: "text"; content: string }
  | { type: "table"; table: AccTable };

const AMOUNT_RE = /^\(?-?(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{1,2})?\)?$/;
const SEP_LINE_RE = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/;

/** NCERT's rupee glyph was extracted as a backtick. */
export function normalizeRupee(text: string): string {
  return (text || "").replace(/`/g, "₹");
}

function isAmount(cell: string): boolean {
  return AMOUNT_RE.test((cell || "").replace(/₹|Rs\./g, "").trim());
}

function splitPipeCells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

/** Fills amount_cols / total_rows / section_rows when a table arrives without them. */
export function inferTableMeta(input: AccTable): AccTable {
  const headers = (input.headers || []).map((h) => String(h ?? ""));
  const ncol = headers.length;
  const rows = (input.rows || []).map((r) => {
    const cells = (Array.isArray(r) ? r : [r]).map((c) => String(c ?? ""));
    return ncol ? [...cells, ...Array(Math.max(0, ncol - cells.length)).fill("")].slice(0, ncol) : cells;
  });
  const t: AccTable = { ...input, headers, rows };

  if (!t.amount_cols) {
    t.amount_cols = [];
    for (let c = 1; c < ncol; c++) {
      const vals = rows.map((r) => r[c]).filter((v) => v && v.trim());
      const h = headers[c].toLowerCase();
      if (/note|j\.?\s?f|l\.?\s?f|date|ratio/.test(h)) continue;
      const numeric = vals.length > 0 && vals.filter(isAmount).length >= vals.length * 0.6;
      if (numeric || /amount|debit|credit|₹|rs|\d{4}/.test(h)) t.amount_cols.push(c);
    }
  }
  if (!t.section_rows) {
    t.section_rows = rows
      .map((r, k) => (ncol > 1 && r[0].trim() && r.slice(1).every((c) => !c.trim()) && r[0].length <= 90 && k + 1 < rows.length ? k : -1))
      .filter((k) => k >= 0);
  }
  if (!t.total_rows) {
    const amt = t.amount_cols;
    const textCols = headers.map((_, c) => c).filter((c) => !amt.includes(c));
    t.total_rows = rows
      .map((r, k) => {
        const filledAmts = amt.filter((c) => r[c] && r[c].trim()).length;
        const label = r[0].trim();
        // T-account totals: no labels on either side, figures on both.
        const tTotal = ncol >= 4 && textCols.every((c) => !r[c]?.trim()) && filledAmts >= 2;
        return filledAmts > 0 && ((label && /^(total|grand total)\b/i.test(label)) || tTotal) ? k : -1;
      })
      .filter((k) => k >= 0);
  }
  return t;
}

/** Splits text containing markdown pipe tables (with or without |---| lines) into segments. */
export function parseMarkdownSegments(text: string): AccSegment[] {
  const lines = normalizeRupee(text).replace(/\r\n?/g, "\n").split("\n");
  const segs: AccSegment[] = [];
  let buf: string[] = [];
  const isPipe = (j: number) => lines[j].includes("|") && !SEP_LINE_RE.test(lines[j]);
  const startsTable = (j: number) => isPipe(j) && j + 1 < lines.length && SEP_LINE_RE.test(lines[j + 1]);
  const flush = () => {
    const content = buf.join("\n").trim();
    if (content) segs.push({ type: "text", content });
    buf = [];
  };

  let i = 0;
  while (i < lines.length) {
    const hasSecondRow = [1, 2, 3].some((d) => i + d < lines.length && lines[i + d].includes("|"));
    if (!isPipe(i) || !hasSecondRow) {
      buf.push(lines[i]);
      i++;
      continue;
    }
    // A short title line right above the table ("Balance Sheet of Ankit as at ...") is its caption.
    let caption: string | undefined;
    const prev = buf.length ? buf[buf.length - 1].trim() : "";
    if (
      prev &&
      prev.length < 100 &&
      prev.split(/\s+/).length <= 12 &&
      !/[:.?)]$/.test(prev) &&
      !/^(from|prepare|calculate|show|given|following|the following|find|pass|record)\b/i.test(prev) &&
      /\b(account|a\/c|statement|balances?|book|schedule|notes?)\b/i.test(prev)
    ) {
      caption = prev;
      buf.pop();
    }
    flush();
    const headers = splitPipeCells(lines[i]);
    const ncol = headers.length;
    const rows: string[][] = [];
    i++;
    while (i < lines.length) {
      if (SEP_LINE_RE.test(lines[i])) {
        i++;
        continue;
      }
      if (!isPipe(i) || (rows.length && startsTable(i))) break;
      const cells = splitPipeCells(lines[i]);
      rows.push(cells.length <= ncol ? [...cells, ...Array(ncol - cells.length).fill("")] : [...cells.slice(0, ncol - 1), cells.slice(ncol - 1).join(" ")]);
      i++;
    }
    if (rows.length && ncol >= 2) segs.push({ type: "table", table: inferTableMeta({ headers, rows, caption }) });
    else if (caption) buf.push(caption);
  }
  flush();
  return segs;
}

interface QuestionLike {
  question_text?: string | null;
  question_table?: AccTable | string | null;
  structured_segments?: AccSegment[] | null;
}

/**
 * Segments for one question. Prefers the backend's structured_segments; otherwise combines the
 * stored question_table with markdown tables found in the text (question_table replaces the first).
 */
export function getQuestionSegments(q: QuestionLike): AccSegment[] {
  if (q.structured_segments && q.structured_segments.length) {
    return q.structured_segments.map((s) => (s.type === "table" ? { type: "table", table: inferTableMeta(s.table) } : s));
  }
  let qt: AccTable | null = null;
  if (q.question_table) {
    if (typeof q.question_table === "string") {
      try {
        qt = JSON.parse(q.question_table);
      } catch {
        qt = null;
      }
    } else {
      qt = q.question_table;
    }
  }
  if (qt && !(qt.headers?.length && qt.rows?.length)) qt = null;

  const segs = q.question_text ? parseMarkdownSegments(q.question_text) : [];
  if (qt) {
    const table = inferTableMeta(qt);
    const idx = segs.findIndex((s) => s.type === "table");
    if (idx === -1) segs.push({ type: "table", table });
    else segs[idx] = { type: "table", table };
  }
  return segs.length ? segs : [{ type: "text", content: normalizeRupee(q.question_text || "") }];
}

export function hasTable(segs: AccSegment[]): boolean {
  return segs.some((s) => s.type === "table");
}
