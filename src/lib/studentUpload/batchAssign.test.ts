import { describe, expect, it } from "vitest";
import { membershipMap, membershipState, nextState, planBatchChange } from "./batchAssign";

const m = membershipMap(
  [{ student_id: "aman", batch_id: "science" }, { student_id: "aman", batch_id: "maths" }, { student_id: "priya", batch_id: "science" }],
  [],
);

describe("batch assign", () => {
  it("tri-state per batch", () => {
    expect(membershipState(["aman", "priya"], m, "science")).toBe("all");
    expect(membershipState(["aman", "priya"], m, "maths")).toBe("some");
    expect(membershipState(["aman", "priya"], m, "olympiad")).toBe("none");
    expect(membershipState([], m, "science")).toBe("none");
  });

  it("click cycles some → all → none", () => {
    expect(nextState("some")).toBe("all");
    expect(nextState("all")).toBe("none");
    expect(nextState("none")).toBe("all");
  });

  it("only changed batches are sent; one student can get several batches", () => {
    const initial = { science: "all", maths: "some", olympiad: "none", eco: "none" } as const;
    expect(planBatchChange(initial, { ...initial, maths: "all", olympiad: "all" })).toEqual({ add: ["maths", "olympiad"], remove: [] });
    expect(planBatchChange(initial, { ...initial, science: "none" })).toEqual({ add: [], remove: ["science"] });
    expect(planBatchChange(initial, initial)).toEqual({ add: [], remove: [] });
  });

  it("falls back to main + lab columns before migration 33", () => {
    const fb = membershipMap(null, [{ id: "a", batch_id: "b1", lab_batch_id: "lab" }, { id: "b", batch_id: null }]);
    expect([...fb.get("a")!]).toEqual(["b1", "lab"]);
    expect(fb.has("b")).toBe(false);
  });
});
