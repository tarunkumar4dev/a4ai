// CLASS_SUBJECT_BATCH_ENABLED (src/config/features.ts): default OFF → production unchanged.
import { describe, expect, it } from "vitest";
import { CLASS_SUBJECT_BATCH_ENABLED, sectionsVisible } from "./features";
import { INSTITUTE_TABS, readInstituteView } from "@/pages/institute/instituteUrlState";

describe("class → subject → batch flag", () => {
  it("ships OFF", () => {
    expect(CLASS_SUBJECT_BATCH_ENABLED).toBe(false);
  });
  it("sections: always visible with the flag off; with it on only for 'full' (college) institutes", () => {
    expect(sectionsVisible("simple", false)).toBe(true);
    expect(sectionsVisible(undefined, false)).toBe(true);
    expect(sectionsVisible("full", false)).toBe(true);
    expect(sectionsVisible("simple", true)).toBe(false);
    expect(sectionsVisible(undefined, true)).toBe(false);   // column not there yet = simple
    expect(sectionsVisible("full", true)).toBe(true);
  });
  it("the old tabs are still in the URL contract; 'classes' is only an addition", () => {
    for (const t of ["overview", "departments", "teachers", "students", "batches", "attendance", "analytics"]) expect(INSTITUTE_TABS).toContain(t);
    expect(readInstituteView(new URLSearchParams("tab=classes")).tab).toBe("classes");
    expect(readInstituteView(new URLSearchParams("tab=nope")).tab).toBe("overview");
  });
});
