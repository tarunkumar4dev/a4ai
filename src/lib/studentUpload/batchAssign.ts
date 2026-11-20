// src/lib/studentUpload/batchAssign.ts
// Manual assign / unassign for several students: each batch checkbox is "all" (every selected student is in it),
// "none", or "some". The admin turns a batch to all or none; batches left as they were are not sent.
// The server (set_student_batches, migration 33) applies add/remove to every selected student in one transaction.

export type BatchState = "all" | "some" | "none";

export function membershipState(
  studentIds: string[],
  memberships: ReadonlyMap<string, ReadonlySet<string>>,
  batchId: string,
): BatchState {
  if (studentIds.length === 0) return "none";
  const n = studentIds.filter(id => memberships.get(id)?.has(batchId)).length;
  return n === 0 ? "none" : n === studentIds.length ? "all" : "some";
}

/** Next state on click: some → all → none → all … */
export const nextState = (s: BatchState): BatchState => (s === "all" ? "none" : "all");

export function planBatchChange(
  initial: Readonly<Record<string, BatchState>>,
  desired: Readonly<Record<string, BatchState>>,
): { add: string[]; remove: string[] } {
  const add: string[] = [];
  const remove: string[] = [];
  for (const [batchId, want] of Object.entries(desired)) {
    if (want === initial[batchId] || want === "some") continue;
    (want === "all" ? add : remove).push(batchId);
  }
  return { add: add.sort(), remove: remove.sort() };
}

/**
 * Dept / section filter for the students list. A student matches through their own department_id / section_id
 * OR through any batch they're in (student_batches): e.g. section "Maths" lists everyone in the "Mathematics"
 * batch even when students.section_id is empty. "" = no filter, "none" = no department / section at all.
 */
export function studentMatchesFilter(
  student: { department_id?: string | null; section_id?: string | null },
  batchIds: Iterable<string> | undefined,
  batchById: ReadonlyMap<string, { department_id?: string | null; section_id?: string | null }>,
  deptFilter: string,
  sectionFilter: string,
): boolean {
  const own = [...(batchIds ?? [])].map(id => batchById.get(id)).filter(Boolean) as { department_id?: string | null; section_id?: string | null }[];
  const depts = new Set([student.department_id, ...own.map(b => b.department_id)].filter(Boolean));
  const secs = new Set([student.section_id, ...own.map(b => b.section_id)].filter(Boolean));
  const ok = (filter: string, set: Set<unknown>) => !filter || (filter === "none" ? set.size === 0 : set.has(filter));
  return ok(deptFilter, depts) && ok(sectionFilter, secs);
}

/** Memberships by student. Without student_batches (migration 33 not run) the main + lab columns are used. */
export function membershipMap(
  rows: { student_id: string; batch_id: string }[] | null | undefined,
  students: { id: string; batch_id?: string | null; lab_batch_id?: string | null }[],
): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  const add = (s: string, b: string | null | undefined) => {
    if (!b) return;
    if (!m.has(s)) m.set(s, new Set());
    m.get(s)!.add(b);
  };
  if (rows) for (const r of rows) add(r.student_id, r.batch_id);
  else for (const s of students) { add(s.id, s.batch_id); add(s.id, s.lab_batch_id); }
  return m;
}
