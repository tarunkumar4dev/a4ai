// Look-and-feel layer of the Classes screen: pure helpers + what the DOM carries (colour hooks, states). Behaviour is covered by
// classesUi.test.ts / classesApi.test.ts, which still pass unchanged.
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({ supabase: { from: () => ({}) } }));
vi.mock("@/pages/institute/instituteToast", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

import ClassesTab from "./ClassesTab";
import TeachersSimple from "./TeachersSimple";
import { buildClassTree, isSameName, nextBatchName } from "./classTree";
import { initialsOf, personColor, subjectColorOf } from "@/lib/subjectColors";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("nextBatchName", () => {
  it("'<Subject> Batch N', N = next number under the subject", () => {
    expect(nextBatchName("Economics", [])).toBe("Economics Batch 1");
    expect(nextBatchName("Economics", ["Economics Batch 1", "Economics Batch 2"])).toBe("Economics Batch 3");
  });
  it("counts legacy names too, and never collides with the highest numbered batch", () => {
    expect(nextBatchName("BST", ["BST"])).toBe("BST Batch 2");
    expect(nextBatchName("Maths", ["Maths Batch 5"])).toBe("Maths Batch 6");
    expect(nextBatchName("Maths", ["Maths Batch 1", "Maths Batch 7", "other"])).toBe("Maths Batch 8");
  });
  it("subject names with regex characters are safe", () => {
    expect(nextBatchName("C++ (Adv)", ["C++ (Adv) Batch 2"])).toBe("C++ (Adv) Batch 3");
  });
});

describe("isSameName", () => {
  it("ignores case, spaces and punctuation", () => {
    expect(isSameName("BST", "bst")).toBe(true);
    expect(isSameName("Social  Science", "social-science")).toBe(true);
    expect(isSameName("BST", "Business Studies")).toBe(false);
    expect(isSameName("", "")).toBe(false);
  });
});

describe("colours", () => {
  it("a subject keeps one colour; a person gets a stable one; initials", () => {
    expect(subjectColorOf("Economics").fg).toBe(subjectColorOf("ECO").fg);
    expect(subjectColorOf("Economics").fg).not.toBe(subjectColorOf("Maths").fg);
    expect(personColor("Rahul Verma").fg).toBe(personColor("Rahul Verma").fg);
    expect(initialsOf("Rahul Verma")).toBe("RV");
    expect(initialsOf("Deepak")).toBe("D");
    expect(initialsOf(" ")).toBe("?");
  });
});

const data = {
  classes: [{ id: "c11", name: "11th Commerce" }],
  subjects: [{ id: "s-bst", name: "BST", code: "BST", department_id: "c11" }, { id: "s-eco", name: "Economics", code: "ECO", department_id: "c11" }],
  batches: [
    { id: "b1", name: "BST", department_id: "c11", subject_id: "s-bst" },            // legacy: same name as its subject
    { id: "b2", name: "Economics Batch 1", department_id: "c11", subject_id: "s-eco" },
    { id: "b3", name: "Economics Batch 2", department_id: "c11", subject_id: "s-eco" },
  ],
  teaching: [{ teacher_id: "u1", batch_id: "b2" }],
  teachers: [{ id: "m1", user_id: "u1", user_name: "Rahul Verma" }, { id: "m2", user_id: "u2", user_name: "Deepak" }],
};
let host: HTMLDivElement; let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const tab = () => act(() => root.render(React.createElement(ClassesTab, {
  instituteId: "i1", ...data, studentCount: id => (id === "b2" ? 12 : 0), studentsInClass: () => 0, onChanged: vi.fn(),
})));
const click = async (el: Element | null) => { await act(async () => { (el as HTMLElement).click(); }); };

describe("ClassesTab look", () => {
  it("a batch named like its subject is shown muted; others are normal chips", () => {
    tab();
    const chips = [...host.querySelectorAll(".csb-chip")].map(c => [c.textContent, c.classList.contains("csb-chip-muted")]);
    expect(chips).toContainEqual(["BST", true]);
    expect(chips).toContainEqual(["Economics Batch 1", false]);
  });
  it("each subject block carries its own colour variables and a dot", () => {
    tab();
    const blocks = [...host.querySelectorAll<HTMLElement>(".csb-subject")];
    expect(blocks).toHaveLength(2);
    expect(blocks.every(b => b.querySelector(".csb-dot") && b.style.getPropertyValue("--s-fg"))).toBe(true);
    expect(new Set(blocks.map(b => b.style.getPropertyValue("--s-fg"))).size).toBe(2);
  });
  it("class header shows coloured count pills", () => {
    tab();
    const head = host.querySelector(".csb-head")!;
    expect(head.textContent).toContain("2 subjects");
    expect(head.textContent).toContain("12 students");
    expect(head.querySelector(".csb-t-indigo")).toBeTruthy();
    expect(head.querySelector(".csb-t-orange")).toBeTruthy();
  });
  it("teacher pill: green when assigned (with initials avatar), amber when not", () => {
    tab();
    const assigned = host.querySelector('[data-testid="batch-b2"] .csb-teacher')!;
    expect(assigned.classList.contains("csb-t-green")).toBe(true);
    expect(assigned.querySelector(".csb-avatar")!.textContent).toBe("RV");
    const none = host.querySelector('[data-testid="batch-b3"] .csb-teacher')!;
    expect(none.classList.contains("csb-t-amber")).toBe(true);
    expect((none.querySelector("select") as HTMLSelectElement).value).toBe("");
  });
  it("'Add batch' opens with the suggested name '<Subject> Batch N'", async () => {
    tab();
    const eco = [...host.querySelectorAll(".csb-subject")].find(b => b.textContent!.includes("Economics"))!;
    await click(eco.querySelector(".csb-add"));
    expect((eco.querySelector("input.csb-input") as HTMLInputElement).value).toBe("Economics Batch 3");
    const bst = [...host.querySelectorAll(".csb-subject")].find(b => b.querySelector(".csb-subj-name")!.textContent === "BST")!;
    await click(bst.querySelector(".csb-add"));
    expect((bst.querySelector("input.csb-input") as HTMLInputElement).value).toBe("BST Batch 2");
  });
  it("collapsing hides the content (kept mounted, flagged closed)", async () => {
    tab();
    const eco = [...host.querySelectorAll(".csb-subject")].find(b => b.textContent!.includes("Economics"))!;
    expect(eco.querySelector(".csb-collapse")!.getAttribute("data-open")).toBe("true");
    await click(eco.querySelector('button[aria-label="Collapse subject"]'));
    expect(eco.querySelector(".csb-collapse")!.getAttribute("data-open")).toBe("false");
    expect(eco.querySelector('button[aria-label="Expand subject"]')!.getAttribute("aria-expanded")).toBe("false");
  });
  it("delete / rename are icon buttons that keep their accessible names", () => {
    tab();
    for (const label of ["Delete BST", "Rename BST", "Delete subject Economics", "Delete class 11th Commerce"]) {
      const b = host.querySelector(`button[aria-label="${label}"]`);
      expect(b, label).toBeTruthy();
      expect(b!.classList.contains("csb-icon-btn")).toBe(true);
    }
    expect(host.querySelector('button[aria-label="Delete BST"]')!.classList.contains("is-danger")).toBe(true);
  });
});

describe("TeachersSimple look", () => {
  it("same chip language: coloured subject block + dot, muted chip for a batch named like its subject, avatar with initials", () => {
    const tree = buildClassTree({ ...data, studentCount: id => (id === "b2" ? 12 : 0) });
    act(() => root.render(React.createElement(TeachersSimple, {
      instituteId: "i1", teachers: data.teachers, tree, onChanged: vi.fn(), onRemoveTeacher: vi.fn(), onOpenClasses: vi.fn(),
    })));
    const card = host.querySelector('[data-testid="teacher-u1"]')!;
    expect(card.querySelector(".csb-avatar")!.textContent).toBe("RV");
    expect(card.querySelector(".csb-subject .csb-dot")).toBeTruthy();
    expect(card.textContent).toContain("Economics Batch 1");
    expect(host.querySelector('[data-testid="teacher-u2"]')!.textContent).toContain("No batches yet");
  });
});
