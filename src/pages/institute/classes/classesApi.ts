// src/pages/institute/classes/classesApi.ts
// Writes of the Classes screen. Rule: an error is NEVER swallowed — every function throws an Error with a message the
// UI shows in a toast (the old handleAddBatch ignored the subject insert and silently left batches without subjects).
// The teacher is assigned to a BATCH only: the subject column of teaching_assignments is filled by the database trigger
// (migration 40) from batches.subject_id, so this file never writes it.
import { newSubjectCode } from "@/lib/teachingAssign";
import { classLevelOf } from "./classTree";

/** The slice of the supabase client used here (so tests can pass a fake). */
export type Db = { from: (table: string) => any };

export class ClassesError extends Error {
  code?: string;
  constructor(message: string, code?: string) { super(message); this.code = code; }
}

/** Postgres / PostgREST error → sentence for the toast. */
export function explain(err: { message?: string; code?: string } | null | undefined, what: string): ClassesError {
  const msg = err?.message || "unknown error";
  if (err?.code === "23505") return new ClassesError(`${what}: that name or code already exists.`, err.code);
  if (err?.code === "42501" || /row-level security/i.test(msg)) return new ClassesError(`${what}: you are not allowed to do this (only the institute admin can).`, err?.code);
  if (err?.code === "23503") return new ClassesError(`${what}: something still depends on it (${msg}).`, err.code);
  return new ClassesError(`${what}: ${msg}`, err?.code);
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const randCode = (n: number) => Array.from({ length: n }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[(Math.random() * 32) | 0]).join("");
const deptCode = (name: string, kind: "STU" | "TCH") => `A4I-${name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "CLS"}-${kind}-${randCode(4)}`;

function need(name: string, label: string): string {
  const n = clean(name);
  if (!n) throw new ClassesError(`${label} name is required.`);
  if (n.length > 80) throw new ClassesError(`${label} name is too long (max 80 characters).`);
  return n;
}

/* ───────────── class (departments row) ───────────── */
export async function createClass(db: Db, instituteId: string, name: string): Promise<string> {
  const n = need(name, "Class");
  const { data, error } = await db.from("departments")
    .insert({ institute_id: instituteId, name: n, student_code: deptCode(n, "STU"), teacher_code: deptCode(n, "TCH") })
    .select("id").single();
  if (error) throw explain(error, `Could not create class "${n}"`);
  return data.id as string;
}

export async function renameClass(db: Db, id: string, name: string): Promise<void> {
  const n = need(name, "Class");
  const { error } = await db.from("departments").update({ name: n }).eq("id", id);
  if (error) throw explain(error, "Could not rename the class");
}

/* ───────────── subject ───────────── */
export async function createSubject(db: Db, instituteId: string, classId: string, name: string, takenCodes: string[]): Promise<string> {
  const n = need(name, "Subject");
  let codes = takenCodes;
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newSubjectCode(n, codes);
    const { data, error } = await db.from("subjects")
      .insert({ institute_id: instituteId, department_id: classId, name: n, code, is_active: true })
      .select("id").single();
    if (!error) return data.id as string;
    // code collision with a subject we have not loaded (another admin / another class): try the next free code once more
    if (error.code === "23505" && /code/i.test(error.message || "")) { codes = [...codes, code]; continue; }
    throw explain(error, `Could not create subject "${n}"`);
  }
  throw new ClassesError(`Could not create subject "${n}": no free subject code.`);
}

export async function renameSubject(db: Db, id: string, name: string): Promise<void> {
  const n = need(name, "Subject");
  const { error } = await db.from("subjects").update({ name: n }).eq("id", id);   // trigger 39 re-syncs the batches' text
  if (error) throw explain(error, "Could not rename the subject");
}

/* ───────────── batch ───────────── */
export async function createBatch(db: Db, p: { instituteId: string; classId: string; className: string; subjectId: string; name: string }): Promise<string> {
  const n = need(p.name, "Batch");
  const { data, error } = await db.from("batches")
    .insert({
      institute_id: p.instituteId, name: n, subject_id: p.subjectId,
      department_id: p.classId,                           // trigger 39 forces it to equal subject.department_id
      class_level: classLevelOf(p.className), is_active: true,
    })
    .select("id").single();
  if (error) throw explain(error, `Could not create batch "${n}"`);
  return data.id as string;
}

export async function renameBatch(db: Db, id: string, name: string): Promise<void> {
  const n = need(name, "Batch");
  const { error } = await db.from("batches").update({ name: n }).eq("id", id);
  if (error) throw explain(error, "Could not rename the batch");
}

/** Legacy batch without a subject → give it one (the trigger copies the subject's class onto the batch). */
export async function setBatchSubject(db: Db, batchId: string, subjectId: string): Promise<void> {
  const { error } = await db.from("batches").update({ subject_id: subjectId }).eq("id", batchId);
  if (error) throw explain(error, "Could not set the batch's subject");
}

/* ───────────── teacher ↔ batch (subject comes from the batch) ───────────── */
/** Make `teacherUserId` the batch's teacher. Inserts first, then removes the other teachers, so a failure never leaves the batch empty. */
export async function setBatchTeacher(db: Db, instituteId: string, batchId: string, teacherUserId: string | null): Promise<void> {
  if (teacherUserId) {
    const { error } = await db.from("teaching_assignments")
      .insert({ institute_id: instituteId, teacher_id: teacherUserId, batch_id: batchId });
    if (error && error.code !== "23505") {
      if (/no subject yet/i.test(error.message || "")) throw new ClassesError("This batch has no subject yet. Give it a subject first.", error.code);
      throw explain(error, "Could not assign the teacher");
    }
    // a 23505 means the teacher was already on the batch (possibly as an inactive legacy row) — make sure it is live
    const { error: reErr } = await db.from("teaching_assignments").update({ is_active: true })
      .eq("batch_id", batchId).eq("teacher_id", teacherUserId).eq("institute_id", instituteId);
    if (reErr) throw explain(reErr, "Could not assign the teacher");
  }
  let del = db.from("teaching_assignments").delete().eq("batch_id", batchId).eq("institute_id", instituteId);
  if (teacherUserId) del = del.neq("teacher_id", teacherUserId);
  const { error: delErr } = await del;
  if (delErr) throw explain(delErr, "Could not remove the previous teacher");
}

/** Teachers tab: add one more batch to a teacher (a batch may have several teachers). */
export async function addTeacherToBatch(db: Db, instituteId: string, batchId: string, teacherUserId: string): Promise<void> {
  const { error } = await db.from("teaching_assignments").insert({ institute_id: instituteId, teacher_id: teacherUserId, batch_id: batchId });
  if (error && error.code !== "23505") {
    if (/no subject yet/i.test(error.message || "")) throw new ClassesError("This batch has no subject yet. Give it a subject in Classes first.", error.code);
    throw explain(error, "Could not add the batch");
  }
  if (error?.code === "23505") {
    const { error: reErr } = await db.from("teaching_assignments").update({ is_active: true })
      .eq("batch_id", batchId).eq("teacher_id", teacherUserId).eq("institute_id", instituteId);
    if (reErr) throw explain(reErr, "Could not add the batch");
  }
}

export async function removeTeacherFromBatch(db: Db, instituteId: string, batchId: string, teacherUserId: string): Promise<void> {
  const { error } = await db.from("teaching_assignments").delete()
    .eq("batch_id", batchId).eq("teacher_id", teacherUserId).eq("institute_id", instituteId);
  if (error) throw explain(error, "Could not remove the batch from the teacher");
}

/* ───────────── deletes (callers check the guards in classTree.ts first; the DB is the last line) ───────────── */
async function count(db: Db, table: string, col: string, id: string): Promise<number> {
  const { count: n, error } = await db.from(table).select("id", { count: "exact", head: true }).eq(col, id);
  if (error) throw explain(error, `Could not check ${table}`);
  return n ?? 0;
}

export const sessionsOfBatch = (db: Db, batchId: string) => count(db, "class_sessions", "batch_id", batchId);
export async function subjectBlockers(db: Db, subjectId: string) {
  const [sessions, slots, allBatches] = await Promise.all([
    count(db, "class_sessions", "subject_id", subjectId),
    count(db, "timetable_slots", "subject_id", subjectId),
    count(db, "batches", "subject_id", subjectId),
  ]);
  return { sessions, slots, allBatches };
}

/** Soft delete (is_active = false), like the rest of the app, and drop the batch's teacher rows so none are left behind. */
export async function deleteBatch(db: Db, instituteId: string, batchId: string): Promise<void> {
  const { error: taErr } = await db.from("teaching_assignments").delete().eq("batch_id", batchId).eq("institute_id", instituteId);
  if (taErr) throw explain(taErr, "Could not remove the batch's teachers");
  const { error } = await db.from("batches").update({ is_active: false }).eq("id", batchId);
  if (error) throw explain(error, "Could not delete the batch");
}

export async function deleteSubject(db: Db, subjectId: string): Promise<void> {
  const { error } = await db.from("subjects").delete().eq("id", subjectId);
  if (error) throw explain(error, "Could not delete the subject");
}

export async function deleteClass(db: Db, classId: string): Promise<void> {
  const { error } = await db.from("departments").delete().eq("id", classId);
  if (error) throw explain(error, "Could not delete the class");
}
