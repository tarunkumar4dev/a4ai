import { describe, expect, it } from "vitest";
import {
  buildClassTree, batchDeleteBlock, subjectDeleteBlock, classDeleteBlock, batchPickerOptions, groupTeacherBatches, classLevelOf,
} from "./classTree";

const classes = [{ id: "c11", name: "11th Commerce" }, { id: "c12", name: "12th Commerce" }];
const subjects = [
  { id: "s-eco", name: "Economics", code: "ECO", department_id: "c11" },
  { id: "s-acc", name: "Accounts", code: "ACC", department_id: "c11" },
  { id: "s-old", name: "Old", code: "OLD", department_id: null },
];
const batches = [
  { id: "b1", name: "Eco Batch A", department_id: "c11", subject_id: "s-eco" },
  { id: "b2", name: "Eco Batch B", department_id: "c11", subject_id: "s-eco" },
  { id: "b3", name: "Acc Batch A", department_id: "c11", subject_id: "s-acc" },
  { id: "b4", name: "Legacy (class only)", department_id: "c11", subject_id: null },
  { id: "b5", name: "Legacy (nothing)", department_id: null, subject_id: null },
  { id: "bx", name: "Deleted", department_id: "c11", subject_id: "s-eco", is_active: false },
  { id: "lab", name: "Lab", department_id: "c11", subject_id: "s-eco", is_lab: true },
];
const teaching = [
  { teacher_id: "t1", batch_id: "b1" }, { teacher_id: "t2", batch_id: "b3" },
  { teacher_id: "t1", batch_id: "b3" }, { teacher_id: "ghost", batch_id: "b2" }, { teacher_id: "t1", batch_id: "b4" },
];
const counts: Record<string, number> = { b1: 12, b2: 3, b3: 5, b4: 2 };
const tree = () => buildClassTree({
  classes, subjects, batches, teaching, studentCount: id => counts[id] ?? 0, activeTeacherIds: new Set(["t1", "t2"]),
});

describe("buildClassTree", () => {
  it("Class → Subject → Batch, with many batches per subject", () => {
    const c = tree().classes.find(x => x.id === "c11")!;
    expect(c.subjects.map(s => s.name)).toEqual(["Accounts", "Economics"]);
    expect(c.subjects.find(s => s.id === "s-eco")!.batches.map(b => b.name)).toEqual(["Eco Batch A", "Eco Batch B"]);
    expect(tree().classes.find(x => x.id === "c12")!.subjects).toEqual([]);
  });
  it("student counts roll up; inactive and lab batches are not listed", () => {
    const eco = tree().classes[0].subjects.find(s => s.id === "s-eco")!;
    expect(eco.students).toBe(15);
    expect(tree().classes[0].students).toBe(12 + 3 + 5 + 2);
    const names = JSON.stringify(tree());
    expect(names).not.toContain("Deleted");
    expect(names).not.toContain('"Lab"');
  });
  it("teachers come from the assignments; non-members (ghosts) are ignored", () => {
    const eco = tree().classes[0].subjects.find(s => s.id === "s-eco")!;
    expect(eco.batches.find(b => b.id === "b1")!.teacherIds).toEqual(["t1"]);
    expect(eco.batches.find(b => b.id === "b2")!.teacherIds).toEqual([]);
  });
  it("batches without a subject are collected, never lost", () => {
    const t = tree();
    expect(t.unassigned.map(b => b.name).sort()).toEqual(["Legacy (class only)", "Legacy (nothing)"]);
    expect(t.classes[0].looseBatches.map(b => b.name)).toEqual(["Legacy (class only)"]);
    expect(t.classless.map(s => s.name)).toEqual(["Old"]);
  });
});

describe("delete guards", () => {
  const t = tree();
  const eco = t.classes[0].subjects.find(s => s.id === "s-eco")!;
  it("batch: blocked while students are enrolled or attendance exists", () => {
    expect(batchDeleteBlock(eco.batches[0], 0)).toMatch(/12 students are enrolled/);
    expect(batchDeleteBlock({ ...eco.batches[0], students: 1 }, 0)).toMatch(/1 student is enrolled/);
    expect(batchDeleteBlock({ ...eco.batches[0], students: 0 }, 4)).toMatch(/Attendance exists/);
    expect(batchDeleteBlock({ ...eco.batches[0], students: 0 }, 0)).toBeNull();
  });
  it("subject: blocked by batches, old batches, attendance, timetable", () => {
    expect(subjectDeleteBlock(eco, { sessions: 0, slots: 0, allBatches: 2 })).toMatch(/2 batches/);
    const empty = { ...eco, batches: [] };
    expect(subjectDeleteBlock(empty, { sessions: 0, slots: 0, allBatches: 1 })).toMatch(/Old \(deleted\) batches/);
    expect(subjectDeleteBlock(empty, { sessions: 3, slots: 0, allBatches: 0 })).toMatch(/Attendance exists/);
    expect(subjectDeleteBlock(empty, { sessions: 0, slots: 1, allBatches: 0 })).toMatch(/timetable/);
    expect(subjectDeleteBlock(empty, { sessions: 0, slots: 0, allBatches: 0 })).toBeNull();
  });
  it("class: blocked by subjects, loose batches and students", () => {
    const c11 = t.classes[0];
    expect(classDeleteBlock(c11, 0)).toMatch(/2 subjects/);
    expect(classDeleteBlock({ ...c11, subjects: [] }, 0)).toMatch(/without a subject/);
    expect(classDeleteBlock({ ...c11, subjects: [], looseBatches: [] }, 5)).toMatch(/5 students belong/);
    expect(classDeleteBlock(t.classes[1], 0)).toBeNull();
  });
});

describe("teachers view", () => {
  it("picker lists every live batch as Class › Subject › Batch", () => {
    const o = batchPickerOptions(tree());
    expect(o.map(x => x.label)).toEqual([
      "11th Commerce › Accounts › Acc Batch A",
      "11th Commerce › Economics › Eco Batch A",
      "11th Commerce › Economics › Eco Batch B",
    ]);
  });
  it("a teacher's batches are grouped Class → Subject → Batch; no-subject batches are labelled", () => {
    const g = groupTeacherBatches("t1", tree());
    expect(g).toHaveLength(1);
    expect(g[0].className).toBe("11th Commerce");
    expect(g[0].subjects.map(s => [s.subjectName, s.batches.map(b => b.name)])).toEqual([
      ["Accounts", ["Acc Batch A"]], ["Economics", ["Eco Batch A"]], ["No subject yet", ["Legacy (class only)"]],
    ]);
    expect(groupTeacherBatches("t2", tree())[0].subjects.map(s => s.subjectName)).toEqual(["Accounts"]);
    expect(groupTeacherBatches("nobody", tree())).toEqual([]);
  });
});

describe("classLevelOf", () => {
  it("takes the leading number", () => {
    expect(classLevelOf("11th Commerce")).toBe("11");
    expect(classLevelOf("6th class")).toBe("6");
    expect(classLevelOf("Olympiad")).toBeNull();
  });
});
