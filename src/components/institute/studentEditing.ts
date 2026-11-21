// src/components/institute/studentEditing.ts
// Saving helpers shared by the institute's student / batch dialogs (StudentBatchAssignModal, StudentEditModal,
// BatchStudentsModal). Kept out of the component files so they stay fast-refresh friendly and unit-testable.
import { supabase } from "@/lib/supabaseClient";

/** Message for a failed set_student_batches call (migration 33). */
export function batchSaveError(error: { code?: string; message: string }) {
  const missing = error.code === "PGRST202" || error.code === "42883";
  return missing ? "The server isn't updated for batch assignment yet (migration 33_student_batches.sql)."
    : error.code === "42501" ? "Only an institute admin can change batches."
    : error.message;
}

export const STUDENT_FIELDS = ["name", "roll_no", "class_level", "phone", "email", "parent_name", "parent_phone", "department_id", "section_id"] as const;
export type StudentField = (typeof STUDENT_FIELDS)[number];
export type StudentForm = Record<StudentField, string>;
export type EditableStudent = { id: string; name: string } & Partial<Record<StudentField, string | null>>;

export const toStudentForm = (s: EditableStudent): StudentForm =>
  Object.fromEntries(STUDENT_FIELDS.map(f => [f, String(s[f] ?? "")])) as StudentForm;

/** Changed fields only; empty → null (name is required and never null). */
export function studentPatch(before: EditableStudent, form: StudentForm): Partial<Record<StudentField, string | null>> {
  const patch: Partial<Record<StudentField, string | null>> = {};
  for (const f of STUDENT_FIELDS) {
    const next = form[f].trim();
    if (next !== String(before[f] ?? "").trim()) patch[f] = next === "" ? null : next;
  }
  return patch;
}

const CHUNK = 500; // set_student_batches limit

/** One batch's member change, sent in ≤ 500-student calls (removals first); stops at the first error. */
export async function saveBatchMembers(batchId: string, add: string[], remove: string[]) {
  let added = 0, removed = 0;
  const run = async (ids: string[], p_add: string[], p_remove: string[]) => {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const { data, error } = await supabase.rpc("set_student_batches", { p_student_ids: ids.slice(i, i + CHUNK), p_add, p_remove });
      if (error) return error;
      added += (data as { added?: number })?.added ?? 0;
      removed += (data as { removed?: number })?.removed ?? 0;
    }
    return null;
  };
  const error = (await run(remove, [], [batchId])) ?? (await run(add, [batchId], []));
  return { added, removed, error };
}
