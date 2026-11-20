// src/lib/teacherRoster.ts
// Teacher-side student lists: a student belongs to EVERY batch they're in (student_batches, migration 33 — which
// also mirrors students.batch_id / lab_batch_id), not only their main batch. So Aman (main "Maths", extra
// "Science") shows up for both the maths and the science teacher. RLS (stu_select + stu_select_batch_member)
// still decides which student rows come back at all.

export interface RosterStudentRow {
  id: string;
  batch_id?: string | null;
  lab_batch_id?: string | null;
  student_batches?: { batch_id: string }[] | null;
  [key: string]: unknown;
}

export type RosterStudent = Omit<RosterStudentRow, "student_batches"> & { batch_ids: string[] };

/** Merge result lists (my batches' members, my proctor sections' students …): one row per student, all batch ids. */
export function mergeRosterRows(...lists: (RosterStudentRow[] | null | undefined)[]): RosterStudent[] {
  const byId = new Map<string, RosterStudent>();
  for (const list of lists) {
    for (const row of list ?? []) {
      const { student_batches, ...rest } = row;
      const ids = [
        ...(student_batches ?? []).map(sb => sb.batch_id),
        row.batch_id, row.lab_batch_id,
      ].filter((x): x is string => !!x);
      const prev = byId.get(row.id);
      const merged = new Set([...(prev?.batch_ids ?? []), ...ids]);
      byId.set(row.id, { ...(prev ?? rest), batch_ids: [...merged] });
    }
  }
  return [...byId.values()];
}

/** The batch to show next to a student: the main batch if it's one of mine, else the first of mine. */
export function displayBatchId(
  student: { batch_id?: string | null; batch_ids: string[] },
  myBatchIds: ReadonlySet<string>,
): string | null {
  if (student.batch_id && myBatchIds.has(student.batch_id)) return student.batch_id;
  return student.batch_ids.find(id => myBatchIds.has(id)) ?? student.batch_id ?? null;
}

export const inBatch = (student: { batch_ids?: string[]; batch_id?: string | null }, batchId: string) =>
  (student.batch_ids ?? []).includes(batchId) || student.batch_id === batchId;
