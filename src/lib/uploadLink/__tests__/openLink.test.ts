import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }));
vi.mock("@/components/checker/checkerFetch", () => ({ checkerFetch: vi.fn(), humanError: (e: unknown) => String(e) }));

import { receiptId } from "@/lib/uploadFlow";
import { cleanName, clearSubmitter, loadSubmitter, saveSubmitter } from "@/lib/uploadLink/session";
import { uploadPathIn } from "@/lib/uploadLink/storageUpload";
import { type TeacherAttempt, buildStudentRows, ownerOf, resultMessage, shareLinkMessage } from "@/lib/uploadLink/teacher";

const attempt = (over: Partial<TeacherAttempt>): TeacherAttempt => ({
  id: "00000000-0000-0000-0000-000000000000", student_id: null, owner: "", guest_name: null, guest_roll: null,
  guest_class: null, submitter_key: null, attempt_no: 1, status: "checked", is_late: false, submitted_at: "",
  files: [], reject_reasons: [], grade: null, answer_key_version: 1, sheet: null, job: null, marks: null, ...over,
});

describe("open link (23)", () => {
  beforeEach(() => localStorage.clear());

  it("receipt = first 8 hex of the attempt id, XXXX-XXXX", () => {
    expect(receiptId("3fa85f64-5717-4562-b3fc-2c963f66afa6")).toBe("3FA8-5F64");
  });

  it("names are trimmed to one line", () => {
    expect(cleanName("  Ravi \n  Kumar\t")).toBe("Ravi Kumar");
  });

  it("the device keeps its submitter per link", () => {
    expect(loadSubmitter("tok")).toBeNull();
    saveSubmitter("tok", { key: "k1", prefix: "i/a/guest/k1/", name: "Ravi", roll: "17", cls: "" });
    expect(loadSubmitter("tok")).toMatchObject({ key: "k1", name: "Ravi", roll: "17" });
    expect(loadSubmitter("other")).toBeNull();
    clearSubmitter("tok");
    expect(loadSubmitter("tok")).toBeNull();
  });

  it("corrupt storage starts fresh", () => {
    localStorage.setItem("a4ai_open_tok", "{not json");
    expect(loadSubmitter("tok")).toBeNull();
  });

  it("guest uploads go into the folder open_start gave", () => {
    expect(uploadPathIn("i/a/guest/k1/", "jpg")).toMatch(/^i\/a\/guest\/k1\/[0-9a-f-]{36}\.jpg$/);
  });

  it("teacher table: one row per guest, never merged with other guests", () => {
    const list = [
      attempt({ id: "a1", submitter_key: "k1", attempt_no: 1 }),
      attempt({ id: "a2", submitter_key: "k1", attempt_no: 2 }),
      attempt({ id: "a3", submitter_key: "k2" }),
      attempt({ id: "a4", student_id: "s1" }),
    ].map(a => ({ ...a, owner: ownerOf(a) }));
    const rows = buildStudentRows(list, {
      "guest:k1": { id: "guest:k1", name: "Ravi", roll_no: "17", class_level: null, parent_phone: null, guest: true },
      "guest:k2": { id: "guest:k2", name: "Meera", roll_no: null, class_level: null, parent_phone: null, guest: true },
      s1: { id: "s1", name: "Asha", roll_no: "1", class_level: null, parent_phone: null },
    }, "latest");
    expect(rows).toHaveLength(3);
    const ravi = rows.find(r => r.student.id === "guest:k1")!;
    expect(ravi.attempts.map(a => a.id)).toEqual(["a2", "a1"]);
    expect(ravi.counted?.id).toBe("a2");
    expect(ravi.student.guest).toBe(true);
  });

  it("share texts: name + roll line always; access code only for code links", () => {
    const code = shareLinkMessage("Test", "https://x/s/t", null);
    const open = shareLinkMessage("Test", "https://x/s/t", null, "open");
    expect(code).toContain("Write your name and roll number on every page.");
    expect(code).toContain("access code");
    expect(open).toContain("Write your name and roll number on every page.");
    expect(open).not.toContain("access code");
    expect(resultMessage("Ravi", "Test", "u", true)).toContain("phone you uploaded from");
  });
});
