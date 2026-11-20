// src/lib/teachingAssign.ts
// Admin assigns a teacher to a batch in one click. Attendance (save_class_attendance / get_class_roster) needs a
// (batch, subject) pair in teaching_assignments, so a subject is picked from the batch itself — or, when nothing
// fits, the page creates one named after the batch. Pure functions, unit-tested in teachingAssign.test.ts.
import { compact } from "@/lib/studentUpload/normalize";

export interface SubjectLite { id: string; name: string; code: string; department_id?: string | null }
export interface BatchForSubject { name: string; subject?: string | null; department_id?: string | null }

const initials = (name: string) =>
  name.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(w => w[0]).join("").toLowerCase();

function sameSubject(subjectName: string, label: string): boolean {
  const a = compact(subjectName);
  const b = compact(label);
  if (!a || !b) return false;
  if (a === b) return true;
  // "Eco" ↔ "Economics", "Maths" ↔ "Mathematics" (a trailing "s" of the short form is dropped)
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  const stem = short.length > 4 && short.endsWith("s") ? short.slice(0, -1) : short;
  if (stem.length >= 3 && long.startsWith(stem)) return true;
  // "SST" / "SS" ↔ "Social Science"
  const ini = initials(subjectName);
  return ini.length >= 2 && b.length <= 4 && b.startsWith(ini);
}

/**
 * Subject for a batch: same department (or no department), matched on the batch's subject field, then its name,
 * then its section's name. One subject in the department → that one. Otherwise null (caller creates one).
 */
export function pickSubjectForBatch(
  batch: BatchForSubject,
  sectionName: string | null,
  subjects: SubjectLite[],
): SubjectLite | null {
  const pool = subjects.filter(s => !batch.department_id || !s.department_id || s.department_id === batch.department_id);
  for (const label of [batch.subject, batch.name, sectionName]) {
    if (!label) continue;
    const hits = pool.filter(s => sameSubject(s.name, label));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return hits.find(s => compact(s.name) === compact(label)) ?? hits[0];
  }
  const inDept = batch.department_id ? pool.filter(s => s.department_id === batch.department_id) : [];
  return inDept.length === 1 ? inDept[0] : null;
}

/** Short unique code for a new subject (subjects has UNIQUE(institute_id, code)). */
export function newSubjectCode(name: string, existing: string[]): string {
  const taken = new Set(existing.map(c => (c || "").toUpperCase()));
  const base = (compact(name).toUpperCase().replace(/[^A-Z0-9]/g, "") || "SUB").slice(0, 6);
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const c = `${base.slice(0, 5)}${i}`;
    if (!taken.has(c)) return c;
  }
  return `${base.slice(0, 3)}${Date.now().toString(36).slice(-4).toUpperCase()}`;
}
