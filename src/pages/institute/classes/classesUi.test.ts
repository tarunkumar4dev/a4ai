// Smoke test of the two new screens with a fake supabase client: they render the tree, the guards block deletes
// BEFORE any write is sent, and a teacher is assigned to a batch without a subject.
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls: { table: string; op: string; payload?: unknown }[] = [];
let counts: Record<string, number> = {};
vi.mock("@/lib/supabaseClient", () => {
  const from = (table: string) => {
    const rec: { table: string; op: string; payload?: unknown } = { table, op: "select" };
    const b: any = {
      insert: (p: unknown) => { rec.op = "insert"; rec.payload = p; calls.push(rec); return b; },
      update: (p: unknown) => { rec.op = "update"; rec.payload = p; calls.push(rec); return b; },
      delete: () => { rec.op = "delete"; calls.push(rec); return b; },
      select: (_c?: string, o?: { head?: boolean }) => { if (o?.head) rec.op = "count"; return b; },
      eq: () => b, neq: () => b, single: () => b,
      then: (res: (v: unknown) => unknown) => Promise.resolve(rec.op === "count" ? { count: counts[table] ?? 0, error: null } : { data: { id: "new" }, error: null }).then(res),
    };
    return b;
  };
  return { supabase: { from } };
});
vi.mock("@/pages/institute/instituteToast", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

import ClassesTab from "./ClassesTab";
import TeachersSimple from "./TeachersSimple";
import { buildClassTree } from "./classTree";
import { toast } from "@/pages/institute/instituteToast";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const data = {
  classes: [{ id: "c11", name: "11th Commerce" }],
  subjects: [{ id: "s-eco", name: "Economics", code: "ECO", department_id: "c11" }, { id: "s-acc", name: "Accounts", code: "ACC", department_id: "c11" }],
  batches: [
    { id: "b1", name: "Eco Batch A", department_id: "c11", subject_id: "s-eco" },
    { id: "b2", name: "Acc Batch A", department_id: "c11", subject_id: "s-acc" },
  ],
  teaching: [{ teacher_id: "u1", batch_id: "b1" }],
  teachers: [{ id: "m1", user_id: "u1", user_name: "Rahul Verma" }, { id: "m2", user_id: "u2", user_name: "Deepak" }],
};
const students: Record<string, number> = { b1: 12, b2: 0 };

let host: HTMLDivElement; let root: Root;
beforeEach(() => { calls.length = 0; counts = {}; vi.clearAllMocks(); host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); vi.spyOn(window, "confirm").mockReturnValue(true); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });

const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });
const renderTab = () => act(() => root.render(React.createElement(ClassesTab, {
  instituteId: "i1", ...data, studentCount: id => students[id] ?? 0, studentsInClass: () => 0, onChanged: vi.fn(),
})));
const click = async (el: Element | null) => { await act(async () => { (el as HTMLElement).click(); }); await flush(); };

describe("ClassesTab", () => {
  it("shows Class → Subject → Batch with student counts and each batch's teacher", () => {
    renderTab();
    const text = host.textContent!;
    expect(text).toContain("11th Commerce");
    expect(text).toContain("Economics");
    expect(text).toContain("Eco Batch A");
    expect(text).toContain("12 students");
    const sel = host.querySelector('select[aria-label="Teacher of Eco Batch A"]') as HTMLSelectElement;
    expect(sel.value).toBe("u1");
    expect((host.querySelector('select[aria-label="Teacher of Acc Batch A"]') as HTMLSelectElement).value).toBe("");
  });
  it("deleting a batch with students is blocked with the reason — nothing is written", async () => {
    renderTab();
    await click(host.querySelector('button[aria-label="Delete Eco Batch A"]'));
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/12 students are enrolled/));
    expect(calls).toHaveLength(0);
  });
  it("deleting a batch that has attendance is blocked", async () => {
    counts = { class_sessions: 3 };
    renderTab();
    await click(host.querySelector('button[aria-label="Delete Acc Batch A"]'));
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Attendance exists/));
    expect(calls.filter(c => c.op !== "select")).toHaveLength(0);
  });
  it("deleting an empty batch removes its teacher rows then soft-deletes it", async () => {
    renderTab();
    await click(host.querySelector('button[aria-label="Delete Acc Batch A"]'));
    expect(calls.map(c => `${c.table}:${c.op}`)).toEqual(["teaching_assignments:delete", "batches:update"]);
    expect(toast.success).toHaveBeenCalledWith("Batch deleted");
  });
  it("a class with subjects cannot be deleted", async () => {
    renderTab();
    await click(host.querySelector('button[aria-label="Delete class 11th Commerce"]'));
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/2 subjects/));
    expect(calls).toHaveLength(0);
  });
  it("choosing a teacher inserts (teacher, batch) only — the subject is never sent", async () => {
    renderTab();
    const sel = host.querySelector('select[aria-label="Teacher of Acc Batch A"]') as HTMLSelectElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
      setter.call(sel, "u2");
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();
    const ins = calls.find(c => c.table === "teaching_assignments" && c.op === "insert")!;
    expect(ins.payload).toEqual({ institute_id: "i1", teacher_id: "u2", batch_id: "b2" });
  });
});

describe("TeachersSimple", () => {
  const tree = () => buildClassTree({ ...data, studentCount: id => students[id] ?? 0 });
  it("lists each teacher's batches grouped Class → Subject → Batch, with one grouped picker and no department / '+ Subject' dropdown", () => {
    act(() => root.render(React.createElement(TeachersSimple, {
      instituteId: "i1", teachers: data.teachers, tree: tree(), onChanged: vi.fn(), onRemoveTeacher: vi.fn(), onOpenClasses: vi.fn(),
    })));
    const card = host.querySelector('[data-testid="teacher-u1"]')!;
    expect(card.textContent).toContain("11th Commerce");
    expect(card.textContent).toContain("Economics");
    expect(card.textContent).toContain("Eco Batch A");
    const picker = card.querySelector('select[aria-label^="Add batch for"]') as HTMLSelectElement;
    expect([...picker.querySelectorAll("optgroup")].map(o => o.label)).toEqual(["11th Commerce › Accounts"]);   // batches he already has are not offered
    expect(host.textContent).not.toContain("+ Subject");
    expect(host.textContent).not.toContain("No dept");
    expect(host.querySelectorAll("select").length).toBe(2);                                                    // exactly one picker per teacher
  });
});
