// Bulk upload with the Class → Subject → Batch model (UploadContext.subjectMode) — and proof that with the model OFF
// the same files resolve exactly as before.
import { describe, expect, it } from "vitest";
import { autoMapHeaders, resolveRows, UPLOAD_FIELDS, UPLOAD_FIELDS_WITH_SUBJECT, type UploadContext } from "./resolveRows";

const departments = [{ id: "c11", name: "11th Commerce" }, { id: "c12", name: "12th Commerce" }];
const batches = [
  { id: "eA", name: "Batch A", department_id: "c11", subject_id: "s-eco", subject: "Economics" },
  { id: "aA", name: "Batch A", department_id: "c11", subject_id: "s-acc", subject: "Accounts" },   // same name, other subject
  { id: "eB", name: "Eco Batch B", department_id: "c11", subject_id: "s-eco", subject: "Economics" },
  { id: "m12", name: "Maths 12", department_id: "c12", subject_id: "s-m12", subject: "Maths" },
];
const mapping = { name: "Name", class_level: "Class", batch: "Batch", subject: "Subject" } as const;
const ctx = (over: Partial<UploadContext> = {}): UploadContext => ({ departments, sections: [], batches, mapping: { ...mapping }, subjectMode: true, ...over });
const one = (row: Record<string, unknown>, c = ctx()) => resolveRows([row], c)[0];

describe("subjectMode ON", () => {
  it("the Subject column picks between same-named batches", () => {
    const r = one({ Name: "Aman", Class: "11th Commerce", Batch: "Batch A", Subject: "Accounts" });
    expect(r.status).not.toBe("error");
    expect(r.payload!.batch_ids).toEqual(["aA"]);
    expect(one({ Name: "Riya", Class: "11th Commerce", Batch: "Batch A", Subject: "Economics" }).payload!.batch_ids).toEqual(["eA"]);
  });
  it("a student in two subjects: one batch per subject (comma lists)", () => {
    const r = one({ Name: "Aman", Class: "11th Commerce", Batch: "Batch A, Eco Batch B", Subject: "Accounts, Economics" });
    expect(r.errors).toEqual([]);
    expect(r.payload!.batch_ids.sort()).toEqual(["aA", "eB"]);
  });
  it("ambiguous without a subject is still an error that tells the user what to do", () => {
    const r = one({ Name: "Aman", Class: "11th Commerce", Batch: "Batch A", Subject: "" });
    expect(r.status).toBe("error");
    expect(r.errors.join(" ")).toMatch(/matches more than one/);
  });
  it("a batch of another subject than the row's Subject is refused", () => {
    const r = one({ Name: "Aman", Class: "11th Commerce", Batch: "Eco Batch B", Subject: "Accounts" });
    expect(r.status).toBe("error");
    expect(r.errors.join(" ")).toMatch(/Economics batch, not "Accounts"/);
  });
  it("Subject without Batch: the subject's only batch in the class; several batches → asks for a Batch column", () => {
    expect(one({ Name: "X", Class: "12th Commerce", Batch: "", Subject: "Maths" }).payload!.batch_ids).toEqual(["m12"]);
    const many = one({ Name: "X", Class: "11th Commerce", Batch: "", Subject: "Accounts" });
    expect(many.payload!.batch_ids).toEqual(["aA"]);
    const eco = resolveRows([{ Name: "X", Class: "11th Commerce", Batch: "", Subject: "Economics" }], ctx({ batches: [...batches, { id: "eC", name: "Eco C", department_id: "c11", subject: "Economics" }] }))[0];
    expect(eco.status).toBe("error");
    expect(eco.errors.join(" ")).toMatch(/has 3 batches/);
  });
  it("class → department still comes from the Class column", () => {
    expect(one({ Name: "Aman", Class: "11th Commerce", Batch: "Eco Batch B", Subject: "Economics" }).payload!.department_id).toBe("c11");
  });
  it("header mapping adds Subject only when asked", () => {
    expect(autoMapHeaders(["Name", "Class", "Subject", "Batch"], { subject: true }).subject).toBe("Subject");
    expect(autoMapHeaders(["Name", "Class", "Subject", "Batch"]).subject).toBeUndefined();
    expect(UPLOAD_FIELDS_WITH_SUBJECT).toContain("subject");
  });
});

describe("subjectMode OFF = unchanged", () => {
  const off = ctx({ subjectMode: false });
  it("a Subject column is ignored (same result as a file without it)", () => {
    const withCol = resolveRows([{ Name: "Aman", Class: "11th Commerce", Batch: "Eco Batch B", Subject: "Accounts" }], off)[0];
    const without = resolveRows([{ Name: "Aman", Class: "11th Commerce", Batch: "Eco Batch B" }], { ...off, mapping: { name: "Name", class_level: "Class", batch: "Batch" } })[0];
    expect(withCol.status).toBe(without.status);
    expect(withCol.payload).toEqual(without.payload);
  });
  it("same-named batches stay ambiguous (nothing to disambiguate with)", () => {
    const r = resolveRows([{ Name: "Aman", Class: "11th Commerce", Batch: "Batch A", Subject: "Accounts" }], off)[0];
    expect(r.status).toBe("error");
  });
  it("the field list and the default header mapping are exactly the old ones", () => {
    expect(UPLOAD_FIELDS).not.toContain("subject");
    expect(UPLOAD_FIELDS).toEqual(["name", "roll_no", "class_level", "department", "section", "batch", "lab_batch", "parent_name", "parent_phone", "phone", "email"]);
    expect(autoMapHeaders(["Student Name", "Roll No", "Class", "Section", "Batch", "Subject"])).toEqual({
      name: "Student Name", roll_no: "Roll No", class_level: "Class", section: "Section", batch: "Batch",
    });
  });
});
