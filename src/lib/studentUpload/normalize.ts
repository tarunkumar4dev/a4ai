// src/lib/studentUpload/normalize.ts
// Matching spreadsheet text ("X", "Class 10", "10th", "science, maths 10") to the institute's REAL departments,
// sections and batches. Everything is built from the lists passed in at upload time — no ids or names are hard-coded.
// Pure functions (no network), unit-tested in normalize.test.ts.

export interface DeptLite { id: string; name: string }
export interface SectionLite { id: string; name: string; department_id: string }
export interface BatchLite {
  id: string;
  name: string;
  department_id?: string | null;
  section_id?: string | null;
  is_lab?: boolean | null;
}

/** exact = same text after normalising · alias = same class number / stream ("X" → "10th class") · fuzzy = unique partial batch name */
export type MatchHow = "exact" | "alias" | "fuzzy";

export type Match<T> =
  | { status: "empty" }
  | { status: "matched"; item: T; how: MatchHow }
  | { status: "ambiguous"; candidates: T[] }
  | { status: "none" }
  /** the name exists, but only in another department (batches) */
  | { status: "other_dept"; item: T };

/** Lowercase, Unicode-normalised, every dash → "-", spaces collapsed. */
export function normText(value: string): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Letters and digits only ("ECE - 2" → "ece2"). */
export function compact(value: string): string {
  return normText(value).replace(/[^\p{L}\p{N}]/gu, "");
}

const ROMAN: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12,
};
const WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12,
};
/** Words that only say "this is a class" and carry no meaning for matching. */
const CLASS_WORDS = new Set(["class", "cls", "std", "standard", "grade", "the"]);

/** "11th" → "11", other tokens unchanged. */
function canonToken(token: string): string {
  const m = /^(\d{1,3})(st|nd|rd|th)$/.exec(token);
  return m ? m[1] : token;
}

function tokens(value: string): string[] {
  return normText(value)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    // "class10" / "std10" → "10"
    .map(t => t.replace(/^(class|cls|std|grade)(?=\d)/, ""))
    .filter(Boolean);
}

function tokenNumber(token: string): number | null {
  const t = canonToken(token);
  if (/^\d{1,2}$/.test(t)) {
    const n = Number(t);
    return n >= 1 && n <= 12 ? n : null;
  }
  const roman = /^([ivx]+)(th)?$/.exec(t);
  if (roman && ROMAN[roman[1]] !== undefined) return ROMAN[roman[1]];
  return WORDS[t] ?? null;
}

/**
 * Class number (1–12) + the other words ("XII - Commerce" → { num: 12, rest: ["commerce"] }).
 * Only the FIRST number-like token counts as the class.
 */
export function parseClass(value: string): { num: number | null; rest: string[] } {
  let num: number | null = null;
  const rest: string[] = [];
  for (const t of tokens(value)) {
    if (CLASS_WORDS.has(t)) continue;
    const n = num === null ? tokenNumber(t) : null;
    if (n !== null) num = n;
    else rest.push(canonToken(t));
  }
  return { num, rest };
}

/** Every word of `want` appears in `have` (prefix allowed for ≥ 3 letters: "comm" → "commerce"). */
function wordsCovered(want: string[], have: string[]): boolean {
  return want.every(w => have.some(h => h === w || (w.length >= 3 && h.startsWith(w))));
}

function byText<T extends { name: string }>(value: string, items: T[]): T[] {
  const n = normText(value);
  const c = compact(value);
  const exact = items.filter(i => normText(i.name) === n);
  return exact.length > 0 ? exact : (c ? items.filter(i => compact(i.name) === c) : []);
}

/**
 * Department from a "class" / "department" cell. Built from the institute's departments at upload time.
 * "X", "10", "10th", "Class 10", "tenth", "  x  " → "10th class"; "XII-Commerce" → "XII – Commerce".
 */
export function matchDepartment(value: string, departments: DeptLite[]): Match<DeptLite> {
  if (!normText(value)) return { status: "empty" };

  const exact = byText(value, departments);
  if (exact.length === 1) return { status: "matched", item: exact[0], how: "exact" };
  if (exact.length > 1) return { status: "ambiguous", candidates: exact };

  const want = parseClass(value);
  if (want.num === null) return { status: "none" };

  const sameNum = departments.filter(d => parseClass(d.name).num === want.num);
  if (sameNum.length === 0) return { status: "none" };

  if (want.rest.length > 0) {
    const withStream = sameNum.filter(d => wordsCovered(want.rest, parseClass(d.name).rest));
    if (withStream.length === 1) return { status: "matched", item: withStream[0], how: "alias" };
    if (withStream.length > 1) return { status: "ambiguous", candidates: withStream };
    // "10th A" → the extra word may be a section letter. Accept only a dept that has no stream of its own,
    // so "XI Science" never lands in "XI - Commerce".
    const plain = sameNum.filter(d => parseClass(d.name).rest.length === 0);
    return plain.length === 1 ? { status: "matched", item: plain[0], how: "alias" } : { status: "none" };
  }

  if (sameNum.length === 1) return { status: "matched", item: sameNum[0], how: "alias" };
  return { status: "ambiguous", candidates: sameNum };
}

/** Section by name, only inside the given department (or all sections when the department is unknown). */
export function matchSection(value: string, sections: SectionLite[], departmentId: string | null): Match<SectionLite> {
  if (!normText(value)) return { status: "empty" };
  const pool = departmentId ? sections.filter(s => s.department_id === departmentId) : sections;
  const hits = byText(value, pool);
  if (hits.length === 1) return { status: "matched", item: hits[0], how: "exact" };
  if (hits.length > 1) return { status: "ambiguous", candidates: hits };
  return { status: "none" };
}

/** "science, maths 10; olympiad" → ["science", "maths 10", "olympiad"] (comma, semicolon, pipe or new line). */
export function splitList(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of (value ?? "").split(/[,;|\n]/)) {
    const v = part.replace(/\s+/g, " ").trim();
    if (v && !seen.has(compact(v))) {
      seen.add(compact(v));
      out.push(v);
    }
  }
  return out;
}

/** A batch the row may use: same department, or a batch that has no department yet. */
const inDept = (b: BatchLite, departmentId: string | null) =>
  !departmentId || !b.department_id || b.department_id === departmentId;

/** Prefer the row's section when the same name exists more than once. */
function pickOne(hits: BatchLite[], sectionId: string | null): BatchLite[] {
  if (hits.length <= 1 || !sectionId) return hits;
  const sameSection = hits.filter(b => b.section_id === sectionId);
  return sameSection.length > 0 ? sameSection : hits;
}

/**
 * One batch name → batch. Exact / compact name first; then a unique partial match on words
 * ("economics 11" → "ECONOMICS BATCH 11th"), never a lab batch and never across departments.
 */
export function matchBatch(
  value: string,
  batches: BatchLite[],
  departmentId: string | null,
  sectionId: string | null,
): Match<BatchLite> {
  if (!normText(value)) return { status: "empty" };

  const exactAll = byText(value, batches);
  const exact = pickOne(exactAll.filter(b => inDept(b, departmentId)), sectionId);
  if (exact.length === 1) return { status: "matched", item: exact[0], how: "exact" };
  if (exact.length > 1) return { status: "ambiguous", candidates: exact };
  if (exactAll.length > 0) return { status: "other_dept", item: exactAll[0] };

  const want = tokens(value).map(canonToken).filter(t => !CLASS_WORDS.has(t));
  if (want.length === 0 || compact(value).length < 3) return { status: "none" };
  const fuzzy = pickOne(
    batches.filter(b => !b.is_lab && inDept(b, departmentId) && wordsCovered(want, tokens(b.name).map(canonToken))),
    sectionId,
  );
  if (fuzzy.length === 1) return { status: "matched", item: fuzzy[0], how: "fuzzy" };
  if (fuzzy.length > 1) return { status: "ambiguous", candidates: fuzzy };
  return { status: "none" };
}

/**
 * Lab batch inside the row's section: the full name ("ECE-2 A") or just the letter ("A"),
 * which is tried as "<section> A" and "<main batch> A".
 */
export function matchLabBatch(
  value: string,
  batches: BatchLite[],
  sectionId: string | null,
  sectionName: string | null,
  mainBatch: BatchLite | null,
): Match<BatchLite> {
  if (!normText(value)) return { status: "empty" };
  if (!sectionId) return { status: "none" };
  const pool = batches.filter(b => b.section_id === sectionId && b.id !== mainBatch?.id);
  const names = [value, sectionName ? `${sectionName} ${value}` : "", mainBatch ? `${mainBatch.name} ${value}` : ""].filter(Boolean);
  for (const n of names) {
    const hits = byText(n, pool);
    if (hits.length === 1) return { status: "matched", item: hits[0], how: "exact" };
    if (hits.length > 1) return { status: "ambiguous", candidates: hits };
  }
  return { status: "none" };
}
