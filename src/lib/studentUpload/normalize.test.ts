import { describe, expect, it } from "vitest";
import {
  type BatchLite, type DeptLite, type SectionLite,
  compact, matchBatch, matchDepartment, matchLabBatch, matchSection, normText, parseClass, splitList,
} from "./normalize";
import {
  autoMapHeaders, batchesWithoutDepartment, checkUploadFile, csvCell, failedRowsCsv, resolveRows, sanitizeCell,
} from "./resolveRows";

// Department names exactly as on live for Education Beast (20 Nov 2026)
const DEPTS: DeptLite[] = [
  { id: "d6", name: "6th class" },
  { id: "d7", name: "7th class" },
  { id: "d8", name: "8th class" },
  { id: "d10", name: "10th class" },
  { id: "d11", name: "XI - Commerce" },
  { id: "d12", name: "XII - Commerce" },
];
const SECTIONS: SectionLite[] = [
  { id: "s-sci", name: "science", department_id: "d10" },
  { id: "s-ece2", name: "ECE-2", department_id: "d11" },
];
const BATCHES: BatchLite[] = [
  { id: "b-sci", name: "science", department_id: "d10", section_id: "s-sci" },
  { id: "b-maths", name: "maths 10", department_id: "d10", section_id: null },
  { id: "b-eco", name: "ECONOMICS BATCH 11th", department_id: null, section_id: null },
  { id: "b-ece2", name: "ECE-2", department_id: "d11", section_id: "s-ece2" },
  { id: "b-ece2a", name: "ECE-2 A", department_id: "d11", section_id: "s-ece2", is_lab: true },
  { id: "b-ece2b", name: "ECE-2 B", department_id: "d11", section_id: "s-ece2", is_lab: true },
  { id: "b-acc", name: "Accounts", department_id: "d12", section_id: null },
];

const dept = (v: string) => {
  const m = matchDepartment(v, DEPTS);
  return m.status === "matched" ? m.item.name : m.status;
};

describe("normText / compact", () => {
  it("lowercases, unifies dashes and spaces", () => {
    expect(normText("  XII – Commerce ")).toBe("xii - commerce");
    expect(compact("ECE - 2")).toBe("ece2");
  });
});

describe("parseClass", () => {
  it.each([
    ["X", 10], ["10", 10], ["10th", 10], ["Class 10", 10], ["class10", 10], ["tenth", 10], ["Std. X", 10],
    ["XI - Commerce", 11], ["11th", 11], ["XII", 12], ["twelfth", 12], ["6th class", 6], ["ix", 9],
  ])("%s → %i", (v, n) => expect(parseClass(v).num).toBe(n));

  it("keeps the stream words", () => expect(parseClass("XII - Commerce").rest).toEqual(["commerce"]));
  it("no class number", () => expect(parseClass("Science").num).toBeNull());
});

describe("matchDepartment", () => {
  it.each(["X", "CLASS 10", "10th", "  x  ", "10", "Class X", "tenth", "10th Class", "class-10"])(
    '"%s" → 10th class', v => expect(dept(v)).toBe("10th class"));

  it.each([
    ["XII - Commerce", "XII - Commerce"],
    ["XII – Commerce", "XII - Commerce"],  // en dash
    ["xii commerce", "XII - Commerce"],
    ["12th commerce", "XII - Commerce"],
    ["12", "XII - Commerce"],
    ["XI", "XI - Commerce"],
    ["11th comm", "XI - Commerce"],
    ["6", "6th class"],
  ])('"%s" → %s', (v, want) => expect(dept(v)).toBe(want));

  it("a stream the department doesn't have is NOT matched", () => expect(dept("XI Science")).toBe("none"));
  it("extra section letter still finds a plain class", () => expect(dept("10th A")).toBe("10th class"));
  it("unknown department → none", () => expect(dept("NonExistentDept")).toBe("none"));
  it("class that doesn't exist → none", () => expect(dept("9th")).toBe("none"));
  it("empty → empty", () => expect(dept("   ")).toBe("empty"));
  it("two departments with the same class → ambiguous", () => {
    const m = matchDepartment("XI", [...DEPTS, { id: "d11s", name: "XI - Science" }]);
    expect(m.status).toBe("ambiguous");
  });
});

describe("matchSection", () => {
  it("only inside the department", () => {
    expect(matchSection("Science", SECTIONS, "d10").status).toBe("matched");
    expect(matchSection("Science", SECTIONS, "d11").status).toBe("none");
  });
});

describe("splitList + matchBatch", () => {
  it("splits on , ; | and drops duplicates", () => {
    expect(splitList("science, maths 10; science | olympiad")).toEqual(["science", "maths 10", "olympiad"]);
  });

  it('"science, maths 10" → two batch ids', () => {
    const ids = splitList("science, maths 10").map(n => {
      const m = matchBatch(n, BATCHES, "d10", null);
      return m.status === "matched" ? m.item.id : m.status;
    });
    expect(ids).toEqual(["b-sci", "b-maths"]);
  });

  it("partial name only when unique and never a lab batch", () => {
    const m = matchBatch("economics 11", BATCHES, "d11", null);
    expect(m).toMatchObject({ status: "matched", how: "fuzzy", item: { id: "b-eco" } });
    expect(matchBatch("ECE", BATCHES, "d11", null)).toMatchObject({ status: "matched", item: { id: "b-ece2" } });
  });

  it("main batch name never picks its lab batch", () => {
    expect(matchBatch("ECE-2", BATCHES, "d11", "s-ece2")).toMatchObject({ status: "matched", how: "exact", item: { id: "b-ece2" } });
  });

  it("batch of another department is refused", () => {
    expect(matchBatch("Accounts", BATCHES, "d10", null).status).toBe("other_dept");
  });

  it("unknown batch → none", () => expect(matchBatch("Olympiad", BATCHES, "d10", null).status).toBe("none"));

  it("lab batch by letter inside the section", () => {
    const main = BATCHES.find(b => b.id === "b-ece2")!;
    expect(matchLabBatch("A", BATCHES, "s-ece2", "ECE-2", main)).toMatchObject({ status: "matched", item: { id: "b-ece2a" } });
    expect(matchLabBatch("C", BATCHES, "s-ece2", "ECE-2", main).status).toBe("none");
  });
});

describe("resolveRows", () => {
  const ctx = (mapping: Record<string, string>, extra = {}) => ({
    departments: DEPTS, sections: SECTIONS, batches: BATCHES, mapping, ...extra,
  });
  const MAP = { name: "Name", class_level: "Class", batch: "Batch", section: "Section", lab_batch: "Lab", email: "Email" };

  it("Aman in two batches of class X", () => {
    const [r] = resolveRows([{ Name: "Aman", Class: "X", Batch: "science, maths 10" }], ctx(MAP));
    expect(r.status).toBe("ok");
    expect(r.department).toMatchObject({ item: { id: "d10" }, how: "alias" });
    expect(r.section).toMatchObject({ item: { id: "s-sci" }, how: "from batch" });
    expect(r.payload).toMatchObject({ department_id: "d10", section_id: "s-sci", batch_id: "b-sci", batch_ids: ["b-sci", "b-maths"] });
  });

  it("clear reasons for failures", () => {
    const rows = resolveRows([
      { Name: "Aman", Class: "Science" },
      { Name: "Priya", Class: "10th", Batch: "Olympiad" },
      { Name: "", Class: "10th" },
      { Name: "Ravi", Class: "10", Email: "nope" },
      { Name: "Sita" },
    ], ctx(MAP));
    expect(rows.map(r => r.status)).toEqual(["error", "error", "error", "error", "error"]);
    expect(rows[0].errors[0]).toMatch(/Class\/department "Science" not found in this institute/);
    expect(rows[1].errors[0]).toMatch(/Batch "Olympiad" not found in "10th class"/);
    expect(rows[2].errors[0]).toBe("Student name is required");
    expect(rows[3].errors[0]).toMatch(/Email "nope" is not valid/);
    expect(rows[4].errors[0]).toMatch(/No department/);
    expect(rows.every(r => !r.payload)).toBe(true);
  });

  it("department taken from the batch when the file has no class", () => {
    const [r] = resolveRows([{ Name: "A", Batch: "maths 10" }], ctx(MAP));
    expect(r.department).toMatchObject({ item: { id: "d10" }, how: "from batch" });
  });

  it("section only → its main batch; lab by letter", () => {
    const [r] = resolveRows([{ Name: "A", Class: "XI", Section: "ECE-2", Lab: "A" }], ctx(MAP));
    expect(r.payload).toMatchObject({ section_id: "s-ece2", batch_id: "b-ece2", lab_batch_id: "b-ece2a", batch_ids: ["b-ece2", "b-ece2a"] });
  });

  it("old files with the batch name in a Section column still work", () => {
    const [r] = resolveRows([{ Name: "A", Class: "10", Section: "maths 10" }], ctx({ name: "Name", class_level: "Class", section: "Section" }));
    expect(r.payload?.batch_id).toBe("b-maths");
  });

  it("batch without department → warning (and listed)", () => {
    const rows = resolveRows([{ Name: "A", Class: "XI", Batch: "ECONOMICS BATCH 11th" }], ctx(MAP));
    expect(rows[0].status).toBe("warn");
    expect(rows[0].warnings[0]).toMatch(/has no department yet/);
    expect(batchesWithoutDepartment(rows).map(b => b.id)).toEqual(["b-eco"]);
  });

  it("dropdown picks override the file", () => {
    const [r] = resolveRows([{ Name: "A", Class: "6th" }], ctx(MAP, { pickedDepartmentId: "d10", pickedBatchId: "b-maths" }));
    expect(r.payload).toMatchObject({ department_id: "d10", batch_ids: ["b-maths"] });
  });

  it("duplicate name + roll in the file", () => {
    const rows = resolveRows([{ Name: "A", Roll: "1", Class: "X" }, { Name: "a", Roll: "1", Class: "X" }],
      ctx({ ...MAP, roll_no: "Roll" }));
    expect(rows[1].errors[0]).toBe("Same name and roll no as row 2");
  });

  it("SQL-looking text is just text", () => {
    const [r] = resolveRows([{ Name: "Robert'); DROP TABLE students;--", Class: "X" }], ctx(MAP));
    expect(r.payload?.name).toBe("Robert'); DROP TABLE students;--");
  });
});

describe("file + cell checks", () => {
  it("file type, extension and size", () => {
    const xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    expect(checkUploadFile({ name: "a.xlsx", size: 100, type: xlsx })).toBeNull();
    expect(checkUploadFile({ name: "a.csv", size: 100, type: "" })).toBeNull();
    expect(checkUploadFile({ name: "a.pdf", size: 100, type: "application/pdf" })).toMatch(/Excel or CSV/);
    expect(checkUploadFile({ name: "a.xlsx", size: 100, type: "application/pdf" })).toMatch(/not a spreadsheet/);
    expect(checkUploadFile({ name: "a.xlsx", size: 6 * 1024 * 1024, type: xlsx })).toMatch(/limit is 5 MB/);
  });

  it("sanitizeCell strips control characters and our CSV apostrophe", () => {
    expect(sanitizeCell("  Am\u0000an\n ")).toBe("Aman");
    expect(sanitizeCell("'+919876543210")).toBe("+919876543210");
    expect(sanitizeCell(9876543210)).toBe("9876543210");
  });

  it("csv never starts a cell with a formula", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe('"\'=HYPERLINK(""x"")"');
    expect(failedRowsCsv(["Name"], [{ row: 3, raw: { Name: "Aman" }, reason: "Batch not found" }]))
      .toBe('﻿"Row","Name","Error"\r\n"3","Aman","Batch not found"');
  });

  it("header mapping: class → class_level, department, batches, section, lab", () => {
    expect(autoMapHeaders(["Student Name", "Class", "Department", "Batches", "Section", "Lab Batch", "Second name", "Syllabus"]))
      .toEqual({ name: "Student Name", class_level: "Class", department: "Department", batch: "Batches", section: "Section", lab_batch: "Lab Batch" });
  });
});
