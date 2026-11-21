// src/components/institute/StudentBatchAssignModal.tsx
// Admin: put the selected students into one or more batches, or take them out (the students are never deleted).
// Saves with ONE call to set_student_batches (migration 33: admin only, RLS applies, one transaction).
import React, { useMemo, useState } from "react";
import { toast } from "@/pages/institute/instituteToast";
import { supabase } from "@/lib/supabaseClient";
import { type BatchState, membershipState, nextState, planBatchChange } from "@/lib/studentUpload/batchAssign";
import BatchChecklist, { type ChecklistBatch } from "@/components/institute/BatchChecklist";
import { batchSaveError } from "@/components/institute/studentEditing";

interface Props {
  students: { id: string; name: string; department_id?: string | null }[];
  batches: ChecklistBatch[];
  departments: { id: string; name: string }[];
  memberships: ReadonlyMap<string, ReadonlySet<string>>;
  onSaved: () => void;
  onClose: () => void;
}

export default function StudentBatchAssignModal({ students, batches, departments, memberships, onSaved, onClose }: Props) {
  const ids = useMemo(() => students.map(s => s.id), [students]);
  const studentDepts = useMemo(() => new Set(students.map(s => s.department_id).filter(Boolean) as string[]), [students]);
  const [saving, setSaving] = useState(false);

  // Snapshot at open: a background refetch must not turn into changes the admin didn't make
  const [initial] = useState(() => Object.fromEntries(batches.map(b => [b.id, membershipState(ids, memberships, b.id)])) as Record<string, BatchState>);
  const [desired, setDesired] = useState<Record<string, BatchState>>(initial);

  const plan = planBatchChange(initial, desired);
  const changes = plan.add.length + plan.remove.length;

  const save = async () => {
    if (changes === 0) { onClose(); return; }
    setSaving(true);
    const { data, error } = await supabase.rpc("set_student_batches", {
      p_student_ids: ids, p_add: plan.add, p_remove: plan.remove,
    });
    setSaving(false);
    if (error) { toast.error(batchSaveError(error)); return; }
    const r = data as { added: number; removed: number };
    toast.success(`Saved: ${r.added} added, ${r.removed} removed`);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-slate-900/40" role="dialog" aria-modal="true" aria-labelledby="assign-title">
      <div className="bg-white rounded-[28px] p-6 max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100">
        <div className="mb-4">
          <h3 id="assign-title" className="text-xl font-black text-slate-900">Batches for {students.length === 1 ? students[0].name : `${students.length} students`}</h3>
          <p className="text-xs text-slate-500 mt-1">
            Tick every batch they should be in. <span className="font-bold">–</span> = only some of them are in it (left as is unless you click it).
          </p>
        </div>

        <BatchChecklist
          className="flex-1"
          batches={batches}
          departments={departments}
          studentDepts={studentDepts}
          initial={initial}
          desired={desired}
          onToggle={id => setDesired(d => ({ ...d, [id]: nextState(d[id] ?? "none") }))}
        />

        <p className="text-[11px] text-slate-400 mt-3">
          Removing a student's main batch makes another of their batches the main one (used for attendance).
        </p>

        <div className="flex justify-end gap-3 pt-4 mt-3 border-t border-slate-100">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Cancel</button>
          <button onClick={save} disabled={saving || changes === 0}
            className="px-5 py-2.5 rounded-xl bg-[#FF7043] text-white font-bold text-sm hover:bg-[#F4511E] disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? "Saving…" : changes === 0 ? "No changes" : `Save ${changes} change${changes !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
