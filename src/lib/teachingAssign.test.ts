import { describe, expect, it } from "vitest";
import { newSubjectCode, pickSubjectForBatch } from "./teachingAssign";

// Education Beast, live 20 Nov 2026: subjects of "10th class" (d10) + one without department
const SUBJECTS = [
  { id: "maths", name: "Maths", code: "MTH", department_id: "d10" },
  { id: "sci", name: "Science", code: "SCI", department_id: "d10" },
  { id: "sst", name: "Social Science", code: "SST", department_id: "d10" },
  { id: "eng", name: "ENGLISH", code: "ENG", department_id: "d10" },
  { id: "eco", name: "Eco", code: "ECO", department_id: null },
  { id: "acc", name: "ACC", code: "ACC", department_id: "d11" },
];

const pick = (name: string, dept: string | null, extra: { subject?: string; section?: string } = {}) =>
  pickSubjectForBatch({ name, subject: extra.subject, department_id: dept }, extra.section ?? null, SUBJECTS)?.id ?? null;

describe("pickSubjectForBatch", () => {
  it.each([
    ["Science", "d10", "sci"],
    ["Mathematics", "d10", "maths"],   // prefix
    ["SST", "d10", "sst"],             // initials
    ["English", "d10", "eng"],         // case
    ["ECONOMICS BATCH 11th", "d11", "eco"], // "Eco" has no department → allowed everywhere
    ["Olympiad", "d10", null],         // nothing fits → the page creates a subject
  ])("%s → %s", (name, dept, want) => expect(pick(name, dept)).toBe(want));

  it("subject field first, then section", () => {
    expect(pick("Batch A", "d10", { subject: "Maths" })).toBe("maths");
    expect(pick("Morning", "d10", { section: "Science" })).toBe("sci");
  });

  it("never a subject of another department", () => {
    expect(pick("ACC", "d10")).toBeNull();
    expect(pick("ACC", "d11")).toBe("acc");
  });

  it("only subject of the department is used", () => {
    expect(pickSubjectForBatch({ name: "Batch X", department_id: "d11" }, null, SUBJECTS)?.id).toBe("acc");
  });
});

describe("newSubjectCode", () => {
  it("short, upper-case and unique", () => {
    expect(newSubjectCode("Economics batch", [])).toBe("ECONOM");
    expect(newSubjectCode("Eco", ["ECO"])).toBe("ECO2");
    expect(newSubjectCode("Eco", ["eco", "ECO2"])).toBe("ECO3");
    expect(newSubjectCode("—", [])).toBe("SUB");
  });
});
