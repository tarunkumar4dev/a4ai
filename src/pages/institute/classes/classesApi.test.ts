import { describe, expect, it } from "vitest";
import {
  createBatch, createClass, createSubject, setBatchTeacher, addTeacherToBatch, deleteBatch, explain, ClassesError,
  subjectBlockers, renameClass,
} from "./classesApi";

type Rec = { table: string; op: string; payload?: unknown; filters: [string, unknown][] };

/** Fake db: records every call; `fail` decides the error per (table, op). */
function fakeDb(fail: (r: Rec) => { code?: string; message: string } | null = () => null, counts: Record<string, number> = {}) {
  const log: Rec[] = [];
  const db = {
    from(table: string) {
      const rec: Rec = { table, op: "select", filters: [] };
      log.push(rec);
      const b: any = {
        insert: (p: unknown) => { rec.op = "insert"; rec.payload = p; return b; },
        update: (p: unknown) => { rec.op = "update"; rec.payload = p; return b; },
        delete: () => { rec.op = "delete"; return b; },
        select: (_c?: string, o?: { head?: boolean }) => { if (o?.head) rec.op = "count"; return b; },
        eq: (c: string, v: unknown) => { rec.filters.push([`eq:${c}`, v]); return b; },
        neq: (c: string, v: unknown) => { rec.filters.push([`neq:${c}`, v]); return b; },
        single: () => b,
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
          const error = fail(rec);
          const out = rec.op === "count" ? { count: counts[`${table}`] ?? 0, error }
            : { data: error ? null : { id: `${table}-new` }, error };
          return Promise.resolve(out).then(res, rej);
        },
      };
      return b;
    },
  };
  return { db, log };
}

describe("never swallow errors", () => {
  it("createSubject surfaces a database error (the old handleAddBatch ignored it)", async () => {
    const { db } = fakeDb(r => (r.table === "subjects" ? { code: "42501", message: "row-level security" } : null));
    await expect(createSubject(db, "i1", "c1", "Economics", [])).rejects.toThrow(/not allowed/);
  });
  it("createSubject retries once with the next free code when the code collides", async () => {
    let n = 0;
    const { db, log } = fakeDb(r => (r.table === "subjects" && n++ === 0 ? { code: "23505", message: 'duplicate key "subjects_institute_id_code_key" (code)' } : null));
    await expect(createSubject(db, "i1", "c1", "Maths", ["MATHS"])).resolves.toBe("subjects-new");
    const codes = log.filter(r => r.op === "insert").map(r => (r.payload as any).code);
    expect(codes).toHaveLength(2);
    expect(codes[0]).not.toBe(codes[1]);
  });
  it("createClass / renameClass: duplicate names get a readable message; empty names are refused before any request", async () => {
    const dup = fakeDb(() => ({ code: "23505", message: "dup" }));
    await expect(createClass(dup.db, "i1", "11th Commerce")).rejects.toThrow(/already exists/);
    const none = fakeDb();
    await expect(createClass(none.db, "i1", "   ")).rejects.toBeInstanceOf(ClassesError);
    await expect(renameClass(none.db, "c1", "")).rejects.toThrow(/required/);
    expect(none.log).toHaveLength(0);
  });
});

describe("batch = subject; the teacher is assigned to the batch only", () => {
  it("createBatch sends subject_id + class, never a free-text subject", async () => {
    const { db, log } = fakeDb();
    await createBatch(db, { instituteId: "i1", classId: "c1", className: "11th Commerce", subjectId: "s1", name: "Eco Batch A" });
    const p = log[0].payload as Record<string, unknown>;
    expect(p).toMatchObject({ institute_id: "i1", name: "Eco Batch A", subject_id: "s1", department_id: "c1", class_level: "11", is_active: true });
    expect("subject" in p).toBe(false);
  });
  it("setBatchTeacher inserts (teacher, batch) WITHOUT a subject, then removes the other teachers", async () => {
    const { db, log } = fakeDb();
    await setBatchTeacher(db, "i1", "b1", "t1");
    const ins = log.find(r => r.op === "insert")!;
    expect(ins.payload).toEqual({ institute_id: "i1", teacher_id: "t1", batch_id: "b1" });
    expect("subject_id" in (ins.payload as object)).toBe(false);
    const del = log.find(r => r.op === "delete")!;
    expect(del.filters).toContainEqual(["neq:teacher_id", "t1"]);
    expect(log.findIndex(r => r.op === "insert")).toBeLessThan(log.findIndex(r => r.op === "delete"));
  });
  it("setBatchTeacher(null) removes every teacher of the batch", async () => {
    const { db, log } = fakeDb();
    await setBatchTeacher(db, "i1", "b1", null);
    expect(log.filter(r => r.op === "insert")).toHaveLength(0);
    expect(log.find(r => r.op === "delete")!.filters.some(f => f[0] === "neq:teacher_id")).toBe(false);
  });
  it("a batch without a subject gives a clear message, and the old teacher is NOT removed", async () => {
    const { db, log } = fakeDb(r => (r.op === "insert" ? { code: "23514", message: "This batch has no subject yet. Set the batch's subject first." } : null));
    await expect(setBatchTeacher(db, "i1", "b1", "t1")).rejects.toThrow(/no subject yet/);
    expect(log.some(r => r.op === "delete")).toBe(false);
    await expect(addTeacherToBatch(db, "i1", "b1", "t1")).rejects.toThrow(/no subject yet/);
  });
  it("an already-assigned teacher (23505) is re-activated, not reported as an error", async () => {
    const { db, log } = fakeDb(r => (r.op === "insert" ? { code: "23505", message: "dup" } : null));
    await expect(addTeacherToBatch(db, "i1", "b1", "t1")).resolves.toBeUndefined();
    expect(log.some(r => r.op === "update" && (r.payload as any).is_active === true)).toBe(true);
  });
});

describe("deletes", () => {
  it("deleteBatch removes the batch's teacher rows first, then soft-deletes (no orphan assignments)", async () => {
    const { db, log } = fakeDb();
    await deleteBatch(db, "i1", "b1");
    expect(log.map(r => `${r.table}:${r.op}`)).toEqual(["teaching_assignments:delete", "batches:update"]);
    expect(log[1].payload).toEqual({ is_active: false });
  });
  it("subjectBlockers counts sessions, timetable slots and ALL batches (also inactive ones)", async () => {
    const { db, log } = fakeDb(() => null, { class_sessions: 2, timetable_slots: 1, batches: 3 });
    await expect(subjectBlockers(db, "s1")).resolves.toEqual({ sessions: 2, slots: 1, allBatches: 3 });
    expect(log.map(r => r.table).sort()).toEqual(["batches", "class_sessions", "timetable_slots"]);
  });
});

describe("explain", () => {
  it("maps RLS and FK errors to sentences", () => {
    expect(explain({ code: "42501", message: "x" }, "Could not X").message).toMatch(/only the institute admin/);
    expect(explain({ message: "new row violates row-level security policy" }, "Could not X").message).toMatch(/not allowed/);
    expect(explain({ code: "23503", message: "fk" }, "Could not X").message).toMatch(/still depends/);
    expect(explain(null, "Could not X").message).toMatch(/unknown error/);
  });
});
