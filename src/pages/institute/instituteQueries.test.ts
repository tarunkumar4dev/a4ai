import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = [string, ...unknown[]];
type Responder = (calls: Call[]) => unknown;
const responders: Record<string, Responder[]> = {};
const fromCalls: { table: string; calls: Call[] }[] = [];

/** supabase.from(table) → chainable builder that records every call and resolves with the next responder */
function builder(table: string) {
  const calls: Call[] = [];
  fromCalls.push({ table, calls });
  const b: any = {};
  for (const m of ["select", "eq", "in", "is", "order", "range", "limit", "single"]) {
    b[m] = (...a: unknown[]) => { calls.push([m, ...a]); return b; };
  }
  b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
    const r = responders[table]?.shift();
    return Promise.resolve(r ? r(calls) : { data: [], error: null }).then(res, rej);
  };
  return b;
}
vi.mock("@/lib/supabaseClient", () => ({ supabase: { from: (t: string) => builder(t), rpc: vi.fn() } }));

import {
  INVALIDATES, invalidateInstitute, instKey, fetchStudents, fetchStudentCounts, resolveInstitute, STUDENT_PAGE,
  type InstituteResource,
} from "./instituteQueries";

const RESOURCES: InstituteResource[] = [
  "meta", "teachers", "batches", "students", "studentCounts", "departments", "sections", "subjects", "teaching",
  "proctors", "branding",
];

beforeEach(() => {
  for (const k of Object.keys(responders)) delete responders[k];
  fromCalls.length = 0;
});

describe("invalidation contract", () => {
  it("every mutation names only real resources, keys are scoped to the institute", async () => {
    for (const [m, rs] of Object.entries(INVALIDATES)) {
      expect(rs.length, m).toBeGreaterThan(0);
      for (const r of rs) expect(RESOURCES, `${m} → ${r}`).toContain(r);
    }
    const qc = { invalidateQueries: vi.fn().mockResolvedValue(undefined) };
    await invalidateInstitute(qc as any, "inst-A", "addStudent");
    expect(qc.invalidateQueries.mock.calls.map(c => c[0].queryKey)).toEqual([
      ["institute", "inst-A", "students"], ["institute", "inst-A", "studentCounts"],
    ]);
    expect(instKey("inst-A", "students")).not.toEqual(instKey("inst-B", "students"));
  });

  it("FK side effects: deleting a department or section refreshes the rows that lose it", () => {
    for (const r of RESOURCES.filter(r => r !== "branding")) expect(INVALIDATES.deleteDept).toContain(r);
    for (const r of ["sections", "batches", "students", "studentCounts", "teachers"] as const) {
      expect(INVALIDATES.deleteSection).toContain(r);
    }
    expect(INVALIDATES.bulkUpload).toEqual(expect.arrayContaining(["students", "studentCounts"]));
  });
});

describe("fetchStudents", () => {
  it("reads every page until the server count is reached (no silent 1000-row cut)", async () => {
    const total = 2 * STUDENT_PAGE + 5;
    const page = (calls: Call[]) => {
      const [, from, to] = calls.find(c => c[0] === "range") as [string, number, number];
      const n = Math.max(0, Math.min(to, total - 1) - from + 1);
      const withCount = (calls.find(c => c[0] === "select") as Call)[2] as { count?: string } | undefined;
      return {
        data: Array.from({ length: n }, (_, i) => ({ id: `s${from + i}`, name: "x", batches: i % 2 ? { name: "B" } : null })),
        error: null, count: withCount?.count === "exact" ? total : null,
      };
    };
    responders.students = [page, page, page, page];
    const rows = await fetchStudents("inst-A");
    expect(rows).toHaveLength(total);
    expect(fromCalls).toHaveLength(3);
    expect(fromCalls.map(f => f.calls.find(c => c[0] === "range"))).toEqual([
      ["range", 0, STUDENT_PAGE - 1], ["range", STUDENT_PAGE, 2 * STUDENT_PAGE - 1], ["range", 2 * STUDENT_PAGE, 3 * STUDENT_PAGE - 1],
    ]);
    // same filters as before + a stable order
    expect(fromCalls[0].calls).toEqual(expect.arrayContaining([
      ["eq", "institute_id", "inst-A"], ["eq", "is_active", true], ["order", "name", { ascending: true }], ["order", "id", { ascending: true }],
    ]));
    expect(rows[0].batch_name).toBe("Unassigned");
    expect(rows[1].batch_name).toBe("B");
  });

  it("throws on error (the query shows it instead of an empty list)", async () => {
    responders.students = [() => ({ data: null, error: { message: "boom" }, count: null })];
    await expect(fetchStudents("inst-A")).rejects.toMatchObject({ message: "boom" });
  });
});

describe("fetchStudentCounts", () => {
  it("uses server head counts with the list's filters", async () => {
    responders.students = [() => ({ count: 1234, error: null }), () => ({ count: 7, error: null })];
    expect(await fetchStudentCounts("inst-A")).toEqual({ total: 1234, unassigned: 7 });
    expect(fromCalls[0].calls[0]).toEqual(["select", "id", { count: "exact", head: true }]);
    expect(fromCalls[1].calls).toContainEqual(["is", "batch_id", null]);
    for (const f of fromCalls) expect(f.calls).toContainEqual(["eq", "is_active", true]);
  });
});

describe("resolveInstitute", () => {
  it("owner first, then membership (HOD keeps its department)", async () => {
    responders.institutes = [() => ({ data: [{ id: "own" }], error: null })];
    expect(await resolveInstitute("u1")).toEqual({ id: "own", isHod: false, hodDeptId: null });

    responders.institutes = [() => ({ data: [], error: null })];
    responders.institute_members = [() => ({ data: [{ institute_id: "m", role: "hod", department_id: "d1" }], error: null })];
    expect(await resolveInstitute("u1")).toEqual({ id: "m", isHod: true, hodDeptId: "d1" });

    responders.institutes = [() => ({ data: [], error: null })];
    responders.institute_members = [() => ({ data: [], error: null })];
    expect(await resolveInstitute("u1")).toEqual({ id: null, isHod: false, hodDeptId: null });
  });

  it("a failed membership lookup is an error, not 'no institute' (which would offer to create one)", async () => {
    responders.institutes = [() => ({ data: [], error: null })];
    responders.institute_members = [() => ({ data: null, error: { message: "network" } })];
    await expect(resolveInstitute("u1")).rejects.toMatchObject({ message: "network" });
  });
});
