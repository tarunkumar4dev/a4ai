import { describe, expect, it } from "vitest";
import { batchSubjectColor, subjectColorOf } from "./subjectColors";

describe("subjectColorOf", () => {
  it("maps the batch names / subjects found on live (21 Nov)", () => {
    const cases: [string, string][] = [
      ["ACC", "accounts"], ["Accounts ", "accounts"], ["Accountancy", "accounts"],
      ["BS", "bst"], ["BST", "bst"], ["Business Studies", "bst"],
      ["ECO", "economics"], ["Eco", "economics"], ["ECONOMICS BATCH 11th", "economics"],
      ["MATHS", "maths"], ["Maths", "maths"], ["Mathematics", "maths"], ["Math", "maths"],
      ["SCI", "science"], ["Science", "science"],
      ["SST", "sst"], ["Social Science", "sst"],
      ["ENG", "english"], ["ENGLISH", "english"],
      ["History", "history"], ["ALL", "general"],
      ["Physics", "physics"], ["Chemistry", "chemistry"], ["Biology", "biology"], ["Hindi", "hindi"],
      ["Political Science", "political"], ["Computer Science", "computer"],
    ];
    for (const [text, key] of cases) expect(subjectColorOf(text).key, text).toBe(key);
  });

  it("gives the commerce subjects four different colours", () => {
    const fgs = ["ACC", "BST", "ECO", "MATHS", "ENG"].map(s => subjectColorOf(s).fg);
    expect(new Set(fgs).size).toBe(fgs.length);
  });

  it("gives the school subjects different colours", () => {
    const fgs = ["MATHS", "SCI", "SST", "ENG", "Hindi"].map(s => subjectColorOf(s).fg);
    expect(new Set(fgs).size).toBe(fgs.length);
  });

  it("is stable for unknown subjects and never uses the 'general' slate", () => {
    const a = subjectColorOf("Robotics"), b = subjectColorOf("robotics ");
    expect(a.key).toBe("other:robotics");
    expect(a.fg).toBe(b.fg);
    expect(a.fg).not.toBe(subjectColorOf("ALL").fg);
    expect(a.short).toBe("ROB");
  });

  it("empty text = general", () => {
    expect(subjectColorOf("").key).toBe("general");
    expect(subjectColorOf(null).key).toBe("general");
  });

  it("does not read 'Applied Physics' or 'AC' (ECE subject) as accounts / maths", () => {
    expect(subjectColorOf("Applied Physics").key).toBe("physics");
    expect(subjectColorOf("AC").key.startsWith("other:")).toBe(true);
  });
});

describe("batchSubjectColor", () => {
  it("uses the subject field, else the batch name", () => {
    expect(batchSubjectColor({ name: "Accounts Rahul Sir", subject: "Accounts " }).key).toBe("accounts");
    expect(batchSubjectColor({ name: "ECONOMICS BATCH 11th", subject: null }).key).toBe("economics");
    expect(batchSubjectColor({ name: "Rahul Sir 2", subject: "ECO" }).key).toBe("economics");
    expect(batchSubjectColor({ name: "MATHS", subject: "XYZ" }).key).toBe("maths"); // unknown subject, known name
    expect(batchSubjectColor({ name: "Batch A", subject: "Robotics" }).key).toBe("other:robotics");
  });

  it("same subject → same colour whatever the batch is called", () => {
    expect(batchSubjectColor({ name: "ECO", subject: "ECO" }).fg).toBe(batchSubjectColor({ name: "ECONOMICS BATCH 11th", subject: "Eco" }).fg);
  });
});
