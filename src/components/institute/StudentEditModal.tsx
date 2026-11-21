// src/components/institute/StudentEditModal.tsx
// Admin: edit one student — details (students row, RLS stu_update) and batches (set_student_batches, migration 33)
// in one dialog. Only changed fields are sent; an update that RLS filters to 0 rows is reported, not shown as saved.
import React, { useMemo, useState } from "react";
import { toast } from "@/pages/institute/instituteToast";
import { supabase } from "@/lib/supabaseClient";
import { type BatchState, membershipState, nextState, planBatchChange } from "@/lib/studentUpload/batchAssign";
import BatchChecklist, { type ChecklistBatch } from "@/components/institute/BatchChecklist";
import { batchSaveError, studentPatch, toStudentForm, type EditableStudent, type StudentField as Field, type StudentForm as Form } from "@/components/institute/studentEditing";

interface Props {
  student: EditableStudent;
  batches: ChecklistBatch[];
  departments: { id: string; name: string }[];
  sections: { id: string; department_id: string; name: string; year: number | null }[];
  memberships: ReadonlyMap<string, ReadonlySet<string>>;
  onSaved: () => void;
  onClose: () => void;
}

export default function StudentEditModal({ student, batches, departments, sections, memberships, onSaved, onClose }: Props) {
  // Snapshot at open: a background refetch must not turn into changes the admin didn't make
  const [before] = useState(student);
  const [form, setForm] = useState<Form>(() => toStudentForm(student));
  const [saving, setSaving] = useState(false);
  const set = (f: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [f]: e.target.value }));

  const ids = useMemo(() => [student.id], [student.id]);
  const [initial] = useState(() => Object.fromEntries(batches.map(b => [b.id, membershipState(ids, memberships, b.id)])) as Record<string, BatchState>);
  const [desired, setDesired] = useState<Record<string, BatchState>>(initial);
  const plan = planBatchChange(initial, desired);
  const batchChanges = plan.add.length + plan.remove.length;
  const patch = studentPatch(before, form);
  const detailChanges = Object.keys(patch).length;
  const studentDepts = useMemo(() => new Set([form.department_id].filter(Boolean)), [form.department_id]);
  const deptSections = sections.filter(s => s.department_id === form.department_id);
  const nameMissing = !form.name.trim();

  const save = async () => {
    if (nameMissing) return;
    if (detailChanges === 0 && batchChanges === 0) { onClose(); return; }
    setSaving(true);
    if (detailChanges > 0) {
      const { data, error } = await supabase.from("students").update(patch).eq("id", student.id).select("id");
      if (error || !data?.length) {
        setSaving(false);
        toast.error(error ? error.message : "Not saved — you may not have permission to edit this student.");
        return;
      }
    }
    if (batchChanges > 0) {
      const { error } = await supabase.rpc("set_student_batches", { p_student_ids: ids, p_add: plan.add, p_remove: plan.remove });
      if (error) {
        setSaving(false);
        if (detailChanges > 0) onSaved(); // the details did save
        toast.error(detailChanges > 0 ? `Details saved, batches not: ${batchSaveError(error)}` : batchSaveError(error));
        return;
      }
    }
    setSaving(false);
    toast.success(`${form.name.trim()} updated`);
    onSaved();
    onClose();
  };

  const label = "block text-[11px] font-bold text-slate-500 mb-1";
  const input = "field !py-2.5"; // .field = 16px text on phones (no iOS zoom on focus)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-slate-900/40" role="dialog" aria-modal="true" aria-labelledby="edit-student-title">
      <div className="bg-white rounded-[28px] p-6 max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 id="edit-student-title" className="text-xl font-black text-slate-900 truncate">Edit {student.name}</h3>
            <p className="text-xs text-slate-500 mt-1">Change details, department / section and batches. Nothing is saved until you press Save.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 shrink-0">✕</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={label} htmlFor="es-name">Name *</label>
              <input id="es-name" className={input} value={form.name} onChange={set("name")} autoComplete="off" />
              {nameMissing && <p className="text-[11px] text-red-500 mt-1">Name is required.</p>}
            </div>
            <div>
              <label className={label} htmlFor="es-roll">Roll no.</label>
              <input id="es-roll" className={input} value={form.roll_no} onChange={set("roll_no")} autoComplete="off" />
            </div>
            <div>
              <label className={label} htmlFor="es-class">Class</label>
              <input id="es-class" className={input} value={form.class_level} onChange={set("class_level")} autoComplete="off" />
            </div>
            <div>
              <label className={label} htmlFor="es-phone">Student phone</label>
              <input id="es-phone" className={input} value={form.phone} onChange={set("phone")} inputMode="tel" autoComplete="off" />
            </div>
            <div>
              <label className={label} htmlFor="es-email">Email</label>
              <input id="es-email" className={input} value={form.email} onChange={set("email")} type="email" autoComplete="off" />
            </div>
            <div>
              <label className={label} htmlFor="es-pname">Parent name</label>
              <input id="es-pname" className={input} value={form.parent_name} onChange={set("parent_name")} autoComplete="off" />
            </div>
            <div>
              <label className={label} htmlFor="es-pphone">Parent phone</label>
              <input id="es-pphone" className={input} value={form.parent_phone} onChange={set("parent_phone")} inputMode="tel" autoComplete="off" />
            </div>
            {departments.length > 0 && (
              <>
                <div>
                  <label className={label} htmlFor="es-dept">Department</label>
                  <select id="es-dept" className={`${input} cursor-pointer`} value={form.department_id}
                    onChange={e => setForm(p => ({ ...p, department_id: e.target.value, section_id: "" }))}>
                    <option value="">No department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label} htmlFor="es-section">Section</label>
                  <select id="es-section" className={`${input} cursor-pointer`} value={form.section_id} onChange={set("section_id")}
                    disabled={deptSections.length === 0}>
                    <option value="">{form.department_id ? (deptSections.length ? "No section" : "No sections in this department") : "Pick a department first"}</option>
                    {deptSections.map(s => <option key={s.id} value={s.id}>{s.name}{s.year ? ` · Y${s.year}` : ""}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="mt-5">
            <p className="text-[13px] font-bold text-slate-800 mb-2">Batches / subjects</p>
            <BatchChecklist
              className="h-64"
              batches={batches}
              departments={departments}
              studentDepts={studentDepts}
              initial={initial}
              desired={desired}
              onToggle={id => setDesired(d => ({ ...d, [id]: nextState(d[id] ?? "none") }))}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 mt-3 border-t border-slate-100">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Cancel</button>
          <button onClick={save} disabled={saving || nameMissing || detailChanges + batchChanges === 0}
            className="px-5 py-2.5 rounded-xl bg-[#FF7043] text-white font-bold text-sm hover:bg-[#F4511E] disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? "Saving…" : detailChanges + batchChanges === 0 ? "No changes" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
