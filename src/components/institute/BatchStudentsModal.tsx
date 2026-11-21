// src/components/institute/BatchStudentsModal.tsx
// Admin: who is in ONE batch — list them, take some out, add others. Membership = student_batches (migration 33),
// written with set_student_batches (admin only, ≤ 500 students per call → sent in chunks).
import React, { useMemo, useState } from "react";
import { toast } from "@/pages/institute/instituteToast";
import { studentMatchesFilter } from "@/lib/studentUpload/batchAssign";
import { batchSubjectColor, subjectVars } from "@/lib/subjectColors";
import { batchSaveError, saveBatchMembers } from "@/components/institute/studentEditing";

interface BatchLite {
  id: string; name: string; subject?: string | null; class_level?: string | null;
  department_id?: string | null; section_id?: string | null; is_lab?: boolean | null;
}
interface StudentLite {
  id: string; name: string; roll_no?: string | null; class_level?: string | null;
  department_id?: string | null; section_id?: string | null; batch_id?: string | null;
}

interface Props {
  batch: BatchLite;
  students: StudentLite[];
  memberships: ReadonlyMap<string, ReadonlySet<string>>;
  batchById: ReadonlyMap<string, BatchLite>;
  departments: { id: string; name: string }[];
  sections: { id: string; name: string }[];
  onSaved: () => void;
  onClose: () => void;
}

export default function BatchStudentsModal({ batch, students, memberships, batchById, departments, sections, onSaved, onClose }: Props) {
  const [view, setView] = useState<"members" | "add">("members");
  const [query, setQuery] = useState("");
  const [sameDept, setSameDept] = useState(!!batch.department_id);
  const [removeIds, setRemoveIds] = useState<Set<string>>(() => new Set());
  const [addIds, setAddIds] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);

  const c = batchSubjectColor(batch);
  const deptName = departments.find(d => d.id === batch.department_id)?.name;
  const secName = sections.find(s => s.id === batch.section_id)?.name;

  const members = useMemo(() => students.filter(s => memberships.get(s.id)?.has(batch.id)), [students, memberships, batch.id]);
  const others = useMemo(() => students.filter(s => !memberships.get(s.id)?.has(batch.id)), [students, memberships, batch.id]);

  const q = query.toLowerCase().trim();
  const matches = (s: StudentLite) => !q || s.name.toLowerCase().includes(q) || (s.roll_no || "").toLowerCase().includes(q);
  const shownMembers = members.filter(matches);
  const shownOthers = others.filter(s => matches(s)
    && (!sameDept || !batch.department_id || studentMatchesFilter(s, memberships.get(s.id), batchById, batch.department_id, "")));

  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    set(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOthersOn = shownOthers.length > 0 && shownOthers.every(s => addIds.has(s.id));
  const changes = removeIds.size + addIds.size;

  const save = async () => {
    if (changes === 0) { onClose(); return; }
    setSaving(true);
    const { added, removed, error } = await saveBatchMembers(batch.id, [...addIds], [...removeIds]);
    setSaving(false);
    if (error) {
      if (added + removed > 0) onSaved();
      toast.error(batchSaveError(error));
      return;
    }
    toast.success(`${batch.name}: ${added} added, ${removed} removed`);
    onSaved();
    onClose();
  };

  const otherBatchChips = (s: StudentLite) => [...(memberships.get(s.id) ?? [])]
    .filter(id => id !== batch.id).map(id => batchById.get(id)).filter((b): b is BatchLite => !!b).slice(0, 4);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-slate-900/40" role="dialog" aria-modal="true" aria-labelledby="batch-students-title">
      <div className="bg-white rounded-[28px] p-6 max-w-xl w-full h-[min(720px,92vh)] flex flex-col shadow-2xl border border-slate-100">
        <div className="flex items-start gap-3 mb-4">
          <div className="subj-tile w-11 h-11 rounded-xl flex items-center justify-center font-black text-[13px] shrink-0" style={subjectVars(c)} aria-hidden>
            {c.short || batch.name.slice(0, 3).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="batch-students-title" className="text-xl font-black text-slate-900 truncate">{batch.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {[batch.class_level ? `Class ${batch.class_level}` : null, c.label || null, deptName, secName].filter(Boolean).join(" · ") || "No class set"}
              {" · "}{members.length} student{members.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 shrink-0">✕</button>
        </div>

        <div role="tablist" className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-3">
          {([["members", `In this batch (${members.length - removeIds.size})`], ["add", `Add students${addIds.size ? ` (+${addIds.size})` : ""}`]] as const).map(([v, text]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`flex-1 py-2 rounded-lg text-[13px] font-bold ${view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {text}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or roll no." aria-label="Search students"
            className="flex-1 min-w-0 p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#FF7043]" />
          {view === "add" && batch.department_id && (
            <label className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0 cursor-pointer">
              <input type="checkbox" checked={sameDept} onChange={e => setSameDept(e.target.checked)} /> Only {deptName ?? "this department"}
            </label>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100">
          {view === "members" ? (
            shownMembers.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-500">{members.length === 0 ? "No students in this batch yet." : "No student matches."}</p>
                {members.length === 0 && (
                  <button onClick={() => setView("add")} className="mt-3 btn-orange px-4 py-2 rounded-xl text-[13px]">Add students</button>
                )}
              </div>
            ) : shownMembers.map(s => {
              const out = removeIds.has(s.id);
              return (
                <div key={s.id} className={`flex items-center gap-3 px-3 py-2.5 ${out ? "bg-red-50/70" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-bold truncate ${out ? "text-slate-400 line-through" : "text-slate-800"}`}>{s.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      Roll {s.roll_no || "N/A"}{s.class_level ? ` · Class ${s.class_level}` : ""}
                      {s.batch_id === batch.id ? " · main batch (attendance)" : ""}
                    </p>
                  </div>
                  <button onClick={() => toggle(setRemoveIds, s.id)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-bold shrink-0 ${out ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-red-50 text-red-600 hover:bg-red-100"}`}>
                    {out ? "Undo" : "Remove"}
                  </button>
                </div>
              );
            })
          ) : (
            <>
              {shownOthers.length > 0 && (
                <label className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 cursor-pointer text-[12px] font-bold text-slate-500">
                  <input type="checkbox" className="w-4 h-4 accent-[#FF7043]" checked={allOthersOn}
                    onChange={() => setAddIds(prev => {
                      const n = new Set(prev);
                      for (const s of shownOthers) { if (allOthersOn) n.delete(s.id); else n.add(s.id); }
                      return n;
                    })} />
                  Select all shown ({shownOthers.length})
                </label>
              )}
              {shownOthers.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">
                  {others.length === 0 ? "Every student is already in this batch." : "No student matches."}
                </p>
              ) : shownOthers.map(s => (
                <label key={s.id} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 ${addIds.has(s.id) ? "bg-orange-50/60" : ""}`}>
                  <input type="checkbox" className="w-4 h-4 accent-[#FF7043] shrink-0" checked={addIds.has(s.id)} onChange={() => toggle(setAddIds, s.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-slate-800 truncate">{s.name}</p>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      <span className="text-[11px] text-slate-400">Roll {s.roll_no || "N/A"}{s.class_level ? ` · Class ${s.class_level}` : ""}</span>
                      {otherBatchChips(s).map(b => (
                        <span key={b.id} className="subj-chip text-[10px] font-bold px-1.5 py-px rounded-full" style={subjectVars(batchSubjectColor(b))}>{b.name}</span>
                      ))}
                    </div>
                  </div>
                </label>
              ))}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 mt-3 border-t border-slate-100">
          {changes > 0 && (
            <span className="mr-auto text-[12px] font-bold text-slate-500">
              {addIds.size > 0 && <span className="text-green-600">+{addIds.size} </span>}
              {removeIds.size > 0 && <span className="text-red-500">−{removeIds.size}</span>}
            </span>
          )}
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
