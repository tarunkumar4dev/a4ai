// src/components/institute/StudentBatchAssignModal.tsx
// Admin: put the selected students into one or more batches, or take them out (the students are never deleted).
// Saves with ONE call to set_student_batches (migration 33: admin only, RLS applies, one transaction).
import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { type BatchState, membershipState, nextState, planBatchChange } from "@/lib/studentUpload/batchAssign";

interface Props {
  students: { id: string; name: string; department_id?: string | null }[];
  batches: { id: string; name: string; department_id?: string | null; section_id?: string | null; is_lab?: boolean | null }[];
  departments: { id: string; name: string }[];
  memberships: ReadonlyMap<string, ReadonlySet<string>>;
  onSaved: () => void;
  onClose: () => void;
}

export default function StudentBatchAssignModal({ students, batches, departments, memberships, onSaved, onClose }: Props) {
  const ids = useMemo(() => students.map(s => s.id), [students]);
  const studentDepts = useMemo(() => new Set(students.map(s => s.department_id).filter(Boolean) as string[]), [students]);
  const [showAll, setShowAll] = useState(studentDepts.size === 0);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const initial = useMemo(() => Object.fromEntries(batches.map(b => [b.id, membershipState(ids, memberships, b.id)])) as Record<string, BatchState>,
    [batches, ids, memberships]);
  const [desired, setDesired] = useState<Record<string, BatchState>>(initial);

  const plan = planBatchChange(initial, desired);
  const changes = plan.add.length + plan.remove.length;

  // Batches of the students' departments (+ batches without a department, + any batch they're already in)
  const visible = batches.filter(b => {
    if (query && !b.name.toLowerCase().includes(query.toLowerCase().trim())) return false;
    if (showAll || initial[b.id] !== "none") return true;
    return !b.department_id || studentDepts.has(b.department_id);
  });
  const groups = [...departments.map(d => ({ id: d.id, name: d.name })), { id: "", name: "No department" }]
    .map(g => ({ ...g, items: visible.filter(b => (b.department_id || "") === g.id) }))
    .filter(g => g.items.length > 0);

  const save = async () => {
    if (changes === 0) { onClose(); return; }
    setSaving(true);
    const { data, error } = await supabase.rpc("set_student_batches", {
      p_student_ids: ids, p_add: plan.add, p_remove: plan.remove,
    });
    setSaving(false);
    if (error) {
      const missing = error.code === "PGRST202" || error.code === "42883";
      toast.error(missing ? "The server isn't updated for batch assignment yet (migration 33_student_batches.sql)."
        : error.code === "42501" ? "Only an institute admin can change batches."
        : error.message);
      return;
    }
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

        <div className="flex items-center gap-2 mb-3">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search batches"
            className="flex-1 min-w-0 p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#FF7043]" />
          {studentDepts.size > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0 cursor-pointer">
              <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> All departments
            </label>
          )}
        </div>

        <div className="flex-1 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100">
          {groups.length === 0 && <p className="p-6 text-center text-sm text-slate-400">No batches.</p>}
          {groups.map(g => (
            <div key={g.id || "none"} className="p-3">
              <p className="text-[11px] font-bold uppercase text-slate-400 mb-1.5">{g.name}</p>
              {g.items.map(b => {
                const st = desired[b.id] ?? "none";
                const changed = st !== initial[b.id];
                return (
                  <label key={b.id} className={`flex items-center gap-2.5 py-1.5 px-2 rounded-lg cursor-pointer hover:bg-slate-50 ${changed ? "bg-orange-50/60" : ""}`}>
                    <input
                      type="checkbox"
                      checked={st === "all"}
                      ref={el => { if (el) el.indeterminate = st === "some"; }}
                      onChange={() => setDesired(d => ({ ...d, [b.id]: nextState(d[b.id] ?? "none") }))}
                      className="w-4 h-4 accent-[#FF7043]"
                    />
                    <span className="text-sm font-medium text-slate-800 flex-1">{b.name}</span>
                    {b.is_lab && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700">lab</span>}
                    {changed && <span className="text-[10px] font-bold text-[#FF7043]">{st === "all" ? "add" : "remove"}</span>}
                  </label>
                );
              })}
            </div>
          ))}
        </div>

        <p className="text-[11px] text-slate-400 mt-3">
          Removing a student's main batch makes another of their batches the main one (used for attendance).
          Attendance rosters only list a student's main and lab batch for now.
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
