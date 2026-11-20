// src/lib/studentUpload/resolveRows.ts
// Spreadsheet rows → what will be uploaded (department / section / batches per row), with a clear reason for every
// row that can't be uploaded. Nothing here talks to the network; the server (bulk_add_students, migration 33)
// checks everything again under RLS — this is for the preview and the report.
import {
  type BatchLite, type DeptLite, type Match, type MatchHow, type SectionLite,
  matchBatch, matchDepartment, matchLabBatch, matchSection, splitList,
} from "./normalize";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 500;
export const MAX_BATCHES_PER_STUDENT = 20;
const ALLOWED_EXT = ["xlsx", "xls", "csv"] as const;
const ALLOWED_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "text/plain",                 // some browsers label .csv like this
  "application/octet-stream",   // and some don't know the type at all
  "",
]);

/** File checks before reading it: extension AND type must both be a spreadsheet, ≤ 5 MB. */
export function checkUploadFile(file: { name: string; size: number; type: string }): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!(ALLOWED_EXT as readonly string[]).includes(ext)) return "Please upload an Excel or CSV file (.xlsx, .xls or .csv).";
  if (!ALLOWED_MIME.has(file.type)) return `This file type (${file.type}) is not a spreadsheet.`;
  if (file.size === 0) return "The file is empty.";
  if (file.size > MAX_FILE_BYTES) return `The file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`;
  return null;
}

/** Cell → plain text: control characters removed, trimmed, and the "'" our failed-rows CSV adds is taken off again. */
export function sanitizeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
  return /^'[=+\-@]/.test(s) ? s.slice(1) : s;
}

export type UploadField =
  | "name" | "roll_no" | "class_level" | "department" | "section" | "batch" | "lab_batch"
  | "parent_name" | "parent_phone" | "phone" | "email";

export const UPLOAD_FIELDS: UploadField[] = [
  "name", "roll_no", "class_level", "department", "section", "batch", "lab_batch",
  "parent_name", "parent_phone", "phone", "email",
];

/**
 * Header aliases. Order matters for the loose (includes) pass: more specific fields first —
 * parent_phone before phone ("parent mobile"), lab_batch before batch ("lab_batch").
 */
const FIELD_ALIASES: [UploadField, string[]][] = [
  ["name", ["name", "student name", "student_name", "full name", "fullname", "studentsname", "candidate name", "student"]],
  ["roll_no", ["roll", "roll no", "roll_no", "roll number", "rollnumber", "rollno", "enrollment", "enrollment no", "enrollment number", "adm no", "admission no", "id"]],
  ["department", ["department", "dept", "department name", "dept name"]],
  ["class_level", ["class", "class level", "class_level", "grade", "standard", "std", "year", "sem", "semester", "branch"]],
  ["parent_name", ["parent", "parent name", "parent_name", "father", "father name", "father's name", "fathers name", "mother", "guardian"]],
  ["parent_phone", ["parent phone", "parent_phone", "parent mobile", "parent contact", "father phone", "father mobile", "mother phone", "guardian phone", "guardian mobile"]],
  ["phone", ["phone", "student phone", "student mobile", "mobile", "mobile number", "mobile no", "phone number", "contact", "contact no", "whatsapp"]],
  ["email", ["email", "student email", "email id", "mail", "email address"]],
  ["lab_batch", ["lab batch", "lab_batch", "lab group"]],
  ["section", ["section", "sec", "division", "div"]],
  ["batch", ["batch", "batches", "batch name", "batch names", "group", "class batch"]],
];

/** Header → field. Exact names win first ("phone" → phone), then loose includes-matches. One header → one field. */
export function autoMapHeaders(headers: string[]): Partial<Record<UploadField, string>> {
  const clean = (v: string) => v.toLowerCase().trim();
  const strip = (v: string) => clean(v).replace(/[^a-z0-9]/g, "");
  const mapping: Partial<Record<UploadField, string>> = {};
  const used = new Set<string>();
  const assign = (loose: boolean) => {
    for (const [field, aliases] of FIELD_ALIASES) {
      if (mapping[field]) continue;
      const header = headers.find(h => !used.has(h) && aliases.some(alias =>
        loose ? strip(h).includes(strip(alias)) && strip(alias).length >= 4
              : clean(h) === clean(alias) || strip(h) === strip(alias)));
      if (header) {
        mapping[field] = header;
        used.add(header);
      }
    }
  };
  assign(false);
  assign(true);
  return mapping;
}

export interface UploadContext {
  departments: DeptLite[];
  sections: SectionLite[];
  /** active batches of the institute */
  batches: BatchLite[];
  mapping: Partial<Record<UploadField, string>>;
  /** dropdown overrides ("" = use the file) */
  pickedDepartmentId?: string;
  pickedSectionId?: string;
  pickedBatchId?: string;
}

export interface Resolved<T> { item: T; how: MatchHow | "picked" | "from batch" | "from section" }

export interface BulkRowPayload {
  row: number;
  name: string;
  roll_no: string | null;
  class_level: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  phone: string | null;
  email: string | null;
  department_id: string | null;
  section_id: string | null;
  batch_id: string | null;
  lab_batch_id: string | null;
  batch_ids: string[];
}

export interface ResolvedRow {
  /** spreadsheet row number (the header is row 1) */
  row: number;
  name: string;
  status: "ok" | "warn" | "error";
  errors: string[];
  warnings: string[];
  department?: Resolved<DeptLite>;
  section?: Resolved<SectionLite>;
  batches: Resolved<BatchLite>[];
  lab?: Resolved<BatchLite>;
  payload?: BulkRowPayload;
  /** the row exactly as read from the file (for the failed-rows CSV) */
  raw: Record<string, unknown>;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const list = (items: { name: string }[], max = 6) =>
  items.slice(0, max).map(i => `"${i.name}"`).join(", ") + (items.length > max ? ` +${items.length - max} more` : "");

function describe<T extends { name: string }>(m: Match<T>, kind: string, value: string, where: string, all: T[]): string {
  switch (m.status) {
    case "ambiguous": return `${kind} "${value}" matches more than one: ${list(m.candidates)}. Use the full name.`;
    case "other_dept": return `${kind} "${value}" belongs to another department`;
    default: return `${kind} "${value}" not found${where}${all.length ? `. Available: ${list(all)}` : ""}`;
  }
}

export function resolveRows(rows: Record<string, unknown>[], ctx: UploadContext): ResolvedRow[] {
  const { departments, sections, batches, mapping } = ctx;
  const deptById = new Map(departments.map(d => [d.id, d]));
  const secById = new Map(sections.map(s => [s.id, s]));
  const batchById = new Map(batches.map(b => [b.id, b]));
  const get = (row: Record<string, unknown>, f: UploadField) => (mapping[f] ? sanitizeCell(row[mapping[f]!]) : "");
  const seen = new Map<string, number>();

  return rows.map((raw, i): ResolvedRow => {
    const rowNo = i + 2;
    const errors: string[] = [];
    const warnings: string[] = [];
    const name = get(raw, "name").replace(/\s+/g, " ");
    const out: ResolvedRow = { row: rowNo, name, status: "ok", errors, warnings, batches: [], raw };

    // ── plain fields
    if (!name) errors.push("Student name is required");
    else if (name.length > 120) errors.push("Name is longer than 120 characters");
    const email = get(raw, "email");
    if (email && (email.length > 254 || !EMAIL_RE.test(email))) errors.push(`Email "${email.slice(0, 60)}" is not valid`);
    const long = (["roll_no", "class_level", "parent_name", "parent_phone", "phone"] as UploadField[]).filter(f => get(raw, f).length > 200);
    if (long.length) errors.push(`Too long (max 200 characters): ${long.join(", ")}`);
    const roll = get(raw, "roll_no");
    if (name) {
      const key = `${name.toLowerCase()}|${roll.toLowerCase()}`;
      const first = seen.get(key);
      if (first) errors.push(`Same name${roll ? " and roll no" : ""} as row ${first}`);
      else seen.set(key, rowNo);
    }

    // ── department: dropdown, else "Department" column, else "Class" column
    let dept: DeptLite | null = null;
    if (ctx.pickedDepartmentId) {
      dept = deptById.get(ctx.pickedDepartmentId) ?? null;
      if (dept) out.department = { item: dept, how: "picked" };
    } else {
      const deptValue = get(raw, "department") || get(raw, "class_level");
      const m = matchDepartment(deptValue, departments);
      if (m.status === "matched") { dept = m.item; out.department = { item: m.item, how: m.how }; }
      else if (m.status !== "empty") errors.push(describe(m, "Class/department", deptValue, " in this institute", departments));
    }

    // ── section: dropdown, else "Section" column (inside the department)
    let section: SectionLite | null = null;
    const sectionValue = get(raw, "section");
    let sectionAsBatch = false; // old files put the batch name in a "Section" column
    if (ctx.pickedSectionId) {
      section = secById.get(ctx.pickedSectionId) ?? null;
      if (section) out.section = { item: section, how: "picked" };
    } else if (sectionValue) {
      const m = matchSection(sectionValue, sections, dept?.id ?? null);
      if (m.status === "matched") { section = m.item; out.section = { item: m.item, how: m.how }; }
      else if (!get(raw, "batch") && !ctx.pickedBatchId && matchBatch(sectionValue, batches, dept?.id ?? null, null).status === "matched") {
        sectionAsBatch = true;
      } else {
        const pool = dept ? sections.filter(s => s.department_id === dept!.id) : sections;
        errors.push(describe(m, "Section", sectionValue, dept ? ` in "${dept.name}"` : "", pool));
      }
    }

    // ── batches: dropdown, else comma-separated "Batch" column
    const found: Resolved<BatchLite>[] = [];
    if (ctx.pickedBatchId) {
      const b = batchById.get(ctx.pickedBatchId);
      if (b) found.push({ item: b, how: "picked" });
    } else {
      const names = splitList(sectionAsBatch ? sectionValue : get(raw, "batch"));
      if (names.length > MAX_BATCHES_PER_STUDENT) errors.push(`At most ${MAX_BATCHES_PER_STUDENT} batches per student`);
      for (const n of names.slice(0, MAX_BATCHES_PER_STUDENT)) {
        const m = matchBatch(n, batches, dept?.id ?? null, section?.id ?? null);
        if (m.status === "matched") { if (!found.some(f => f.item.id === m.item.id)) found.push({ item: m.item, how: m.how }); }
        else errors.push(describe(m, "Batch", n, dept ? ` in "${dept.name}"` : "", batches.filter(b => !dept || !b.department_id || b.department_id === dept.id)));
      }
    }

    // department from the batches when the file has none
    if (!dept && found.length > 0) {
      const ids = [...new Set(found.map(f => f.item.department_id).filter(Boolean))] as string[];
      if (ids.length === 1 && deptById.has(ids[0])) { dept = deptById.get(ids[0])!; out.department = { item: dept, how: "from batch" }; }
      else if (ids.length > 1) errors.push("The batches belong to different departments");
    }
    if (!dept && departments.length > 0 && !errors.some(e => e.startsWith("Class/department"))) {
      errors.push("No department: add a Class or Department column, or pick a department above");
    }
    if (dept && section && section.department_id !== dept.id) errors.push(`Section "${section.name}" is not in "${dept.name}"`);

    const main = found.find(f => !f.item.is_lab)?.item ?? null;
    // section from the main batch; or the section's only main batch when no batch was given
    if (!section && main?.section_id && secById.has(main.section_id)) {
      section = secById.get(main.section_id)!;
      out.section = { item: section, how: "from batch" };
    }
    if (section && found.length === 0 && !ctx.pickedBatchId) {
      const mains = batches.filter(b => b.section_id === section!.id && !b.is_lab);
      if (mains.length === 1) found.push({ item: mains[0], how: "from section" });
    }
    const mainBatch = found.find(f => !f.item.is_lab)?.item ?? null;
    if (section && mainBatch?.section_id && mainBatch.section_id !== section.id) {
      errors.push(`Batch "${mainBatch.name}" is not in section "${section.name}"`);
    }

    // ── lab batch (same section)
    let lab: BatchLite | null = found.find(f => f.item.is_lab)?.item ?? null;
    const labValue = get(raw, "lab_batch");
    if (labValue) {
      const m = matchLabBatch(labValue, batches, section?.id ?? null, section?.name ?? null, mainBatch);
      if (m.status === "matched") { lab = m.item; out.lab = { item: m.item, how: m.how }; }
      else errors.push(section
        ? describe(m, "Lab batch", labValue, ` in section "${section.name}"`, batches.filter(b => b.section_id === section!.id && b.is_lab))
        : `Lab batch "${labValue}" needs a section`);
    } else if (lab) {
      out.lab = { item: lab, how: "exact" };
    }

    for (const f of found) {
      if (!f.item.department_id) {
        warnings.push(`Batch "${f.item.name}" has no department yet — set it in the Batches tab so the department's teachers see it`);
      }
      if (f.how === "fuzzy") warnings.push(`"${f.item.name}" was picked from a partial name — check it`);
    }

    out.batches = found;
    out.status = errors.length ? "error" : warnings.length ? "warn" : "ok";
    if (!errors.length) {
      const ids = found.map(f => f.item.id);
      if (lab && !ids.includes(lab.id)) ids.push(lab.id);
      out.payload = {
        row: rowNo,
        name,
        roll_no: roll || null,
        class_level: get(raw, "class_level") || null,
        parent_name: get(raw, "parent_name") || null,
        parent_phone: get(raw, "parent_phone") || null,
        phone: get(raw, "phone") || null,
        email: email || null,
        department_id: dept?.id ?? null,
        section_id: section?.id ?? null,
        batch_id: mainBatch?.id ?? null,
        lab_batch_id: lab?.id ?? null,
        batch_ids: ids,
      };
    }
    return out;
  });
}

/** Batches that would be used but have no department (shown once above the preview, and logged). */
export function batchesWithoutDepartment(rows: ResolvedRow[]): BatchLite[] {
  const m = new Map<string, BatchLite>();
  for (const r of rows) for (const b of r.batches) if (!b.item.department_id) m.set(b.item.id, b.item);
  return [...m.values()];
}

/** CSV cell: quoted, and a leading = + - @ is neutralised so Excel never runs it as a formula. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Failed rows with the original columns + "Row" + "Error", ready to fix and upload again. */
export function failedRowsCsv(headers: string[], failed: { row: number; raw: Record<string, unknown>; reason: string }[]): string {
  const head = ["Row", ...headers, "Error"].map(csvCell).join(",");
  const body = failed.map(f => [f.row, ...headers.map(h => f.raw[h]), f.reason].map(csvCell).join(","));
  return "﻿" + [head, ...body].join("\r\n");
}
