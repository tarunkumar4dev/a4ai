// src/components/institute/BatchChecklist.tsx
// Batch picker shared by "Assign batches" (several students) and "Edit student" (one student): search, batches of
// the students' departments first (toggle for all), grouped by department, a subject colour dot per batch and the
// class, because batch names repeat across classes on live ("ECO" for 11 and 12, "MATHS" for 8 / 11 / 12).
import { useState } from "react";
import type { BatchState } from "@/lib/studentUpload/batchAssign";
import { batchSubjectColor, subjectVars } from "@/lib/subjectColors";

export interface ChecklistBatch {
  id: string; name: string; subject?: string | null; class_level?: string | null;
  department_id?: string | null; is_lab?: boolean | null;
}

interface Props {
  batches: ChecklistBatch[];
  departments: { id: string; name: string }[];
  studentDepts: ReadonlySet<string>;
  initial: Readonly<Record<string, BatchState>>;
  desired: Readonly<Record<string, BatchState>>;
  onToggle: (batchId: string) => void;
  className?: string;
}

export default function BatchChecklist({ batches, departments, studentDepts, initial, desired, onToggle, className }: Props) {
  const [showAll, setShowAll] = useState(studentDepts.size === 0);
  const [query, setQuery] = useState("");
  const q = query.toLowerCase().trim();

  // Batches of the students' departments (+ batches without a department, + any batch they're already in)
  const visible = batches.filter(b => {
    if (q && !`${b.name} ${b.subject ?? ""} ${b.class_level ?? ""}`.toLowerCase().includes(q)) return false;
    if (showAll || (initial[b.id] ?? "none") !== "none") return true;
    return !b.department_id || studentDepts.has(b.department_id);
  });
  const byName = (a: ChecklistBatch, b: ChecklistBatch) =>
    a.name.localeCompare(b.name) || String(a.class_level ?? "").localeCompare(String(b.class_level ?? ""), undefined, { numeric: true });
  const groups = [...departments.map(d => ({ id: d.id, name: d.name })), { id: "", name: "No department" }]
    .map(g => ({ ...g, items: visible.filter(b => (b.department_id || "") === g.id).sort(byName) }))
    .filter(g => g.items.length > 0)
    // the students' own departments first
    .sort((a, b) => Number(studentDepts.has(b.id)) - Number(studentDepts.has(a.id)));

  return (
    <div className={`flex flex-col min-h-0 ${className ?? ""}`}>
      <div className="flex items-center gap-2 mb-3">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search batches" aria-label="Search batches"
          className="flex-1 min-w-0 p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#FF7043]" />
        {studentDepts.size > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0 cursor-pointer">
            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> All departments
          </label>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100">
        {groups.length === 0 && <p className="p-6 text-center text-sm text-slate-400">No batches.</p>}
        {groups.map(g => (
          <div key={g.id || "none"} className="p-3">
            <p className="text-[11px] font-bold uppercase text-slate-400 mb-1.5">{g.name}</p>
            {g.items.map(b => {
              const st = desired[b.id] ?? "none";
              const changed = st !== (initial[b.id] ?? "none");
              const c = batchSubjectColor(b);
              return (
                <label key={b.id} className={`flex items-center gap-2.5 py-1.5 px-2 rounded-lg cursor-pointer hover:bg-slate-50 ${changed ? "bg-orange-50/60" : ""}`}>
                  <input
                    type="checkbox"
                    checked={st === "all"}
                    ref={el => { if (el) el.indeterminate = st === "some"; }}
                    onChange={() => onToggle(b.id)}
                    className="w-4 h-4 accent-[#FF7043] shrink-0"
                  />
                  <span aria-hidden className="subj-dot w-2.5 h-2.5 rounded-full shrink-0" style={subjectVars(c)} />
                  <span className="text-sm font-medium text-slate-800 flex-1 min-w-0 truncate">
                    {b.name}
                    {b.class_level && <span className="text-slate-400 font-normal"> · Class {b.class_level}</span>}
                  </span>
                  {b.is_lab && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700">lab</span>}
                  {changed && <span className="text-[10px] font-bold text-[#FF7043]">{st === "all" ? "add" : "remove"}</span>}
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
