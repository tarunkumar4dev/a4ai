import { describe, expect, it } from "vitest";
import { patchInstituteView, readInstituteView, recallScroll, rememberScroll } from "./instituteUrlState";
import { studentPatch } from "@/components/institute/studentEditing";

describe("institute URL view", () => {
  it("reads tab / filters / search, unknown tab = overview", () => {
    expect(readInstituteView(new URLSearchParams("tab=students&dept=d1&section=s1&q=ana")))
      .toEqual({ tab: "students", dept: "d1", section: "s1", q: "ana" });
    expect(readInstituteView(new URLSearchParams("tab=nope")).tab).toBe("overview");
    expect(readInstituteView(new URLSearchParams("")).tab).toBe("overview");
  });

  it("patches without losing other keys; empty values and the default tab are removed", () => {
    const sp = new URLSearchParams("tab=students&dept=d1&section=s1&q=ana&x=1");
    expect(patchInstituteView(sp, { dept: "d2", section: "" }).toString()).toBe("tab=students&dept=d2&q=ana&x=1");
    expect(patchInstituteView(sp, { tab: "overview" }).toString()).toBe("dept=d1&section=s1&q=ana&x=1");
    expect(patchInstituteView(sp, { q: "" }).has("q")).toBe(false);
    expect(sp.get("dept")).toBe("d1"); // input untouched
  });

  it("remembers scroll per URL", () => {
    rememberScroll("/institute?tab=students", 420);
    rememberScroll("/institute?tab=batches", 10);
    expect(recallScroll("/institute?tab=students")).toBe(420);
    expect(recallScroll("/institute?tab=teachers")).toBeUndefined();
  });
});

describe("studentPatch (Edit student)", () => {
  const before = { id: "s1", name: "Aanandi", roll_no: null, class_level: "12", phone: "", parent_phone: "98", department_id: "d1", section_id: null };
  const form = (o: Partial<Record<string, string>>) => ({
    name: "Aanandi", roll_no: "", class_level: "12", phone: "", email: "", parent_name: "", parent_phone: "98",
    department_id: "d1", section_id: "", ...o,
  });

  it("sends only changed fields", () => {
    expect(studentPatch(before, form({}))).toEqual({});
    expect(studentPatch(before, form({ roll_no: " 7 ", section_id: "s2" }))).toEqual({ roll_no: "7", section_id: "s2" });
  });

  it("cleared fields become null", () => {
    expect(studentPatch(before, form({ parent_phone: "  ", department_id: "" }))).toEqual({ parent_phone: null, department_id: null });
  });
});
