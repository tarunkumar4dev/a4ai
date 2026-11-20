import { describe, expect, it } from "vitest";
import { displayBatchId, inBatch, mergeRosterRows } from "./teacherRoster";

describe("teacher roster", () => {
  it("a multi-batch student is in both batches, once", () => {
    const members = [
      { id: "aman", name: "Aman", batch_id: "maths", student_batches: [{ batch_id: "science" }, { batch_id: "maths" }] },
      { id: "priya", name: "Priya", batch_id: "science", student_batches: [{ batch_id: "science" }] },
    ];
    const proctorSection = [{ id: "aman", name: "Aman", batch_id: "maths", lab_batch_id: "lab-a" }];
    const rows = mergeRosterRows(members, proctorSection);
    expect(rows).toHaveLength(2);
    const aman = rows.find(r => r.id === "aman")!;
    expect(aman.batch_ids.sort()).toEqual(["lab-a", "maths", "science"]);
    expect("student_batches" in aman).toBe(false);
    expect(inBatch(aman, "science")).toBe(true);
    expect(inBatch(aman, "maths")).toBe(true);
    expect(inBatch(aman, "english")).toBe(false);
  });

  it("shows the main batch when it's mine, else my batch", () => {
    const aman = { batch_id: "maths", batch_ids: ["maths", "science"] };
    expect(displayBatchId(aman, new Set(["maths", "science"]))).toBe("maths");
    expect(displayBatchId(aman, new Set(["science"]))).toBe("science");
    expect(displayBatchId({ batch_id: null, batch_ids: [] }, new Set(["science"]))).toBeNull();
  });

  it("empty / missing lists", () => {
    expect(mergeRosterRows(null, undefined, [])).toEqual([]);
  });
});
