// src/components/checker/StudentPicker.tsx
// "Add students" for institute teachers: pick a class/section the teacher is assigned to (useMyScope →
// get_my_access: teaching_assignments, timetable slots, proctor sections), then tick its students.
// The list comes through the students RLS (only the teacher's own sections), and migration 17 makes the
// database refuse any other student_id, so this is not a UI-only rule.

import React, { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useMyScope } from "@/hooks/useMyScope";
import { humanError } from "./checkerFetch";
import type { CheckSession, CheckSheet } from "./copyCheckerApi";

type Student = { id: string; name: string; roll_no: string | null };

const byRoll = (a: Student, b: Student) =>
  (a.roll_no || "￿").localeCompare(b.roll_no || "￿", undefined, { numeric: true }) || a.name.localeCompare(b.name);

export default function StudentPicker({ session, existing, preselectAll, onAdded, onClose }: {
  session: CheckSession;
  existing: CheckSheet[];
  /** right after creating a check: everyone starts ticked, the teacher unticks absentees */
  preselectAll?: boolean;
  onAdded: (rows: CheckSheet[], batchId: string) => void;
  onClose: () => void;
}) {
  const scope = useMyScope();
  const [batchId, setBatchId] = useState<string>(session.batch_id || "");
  const [students, setStudents] = useState<Student[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const already = useMemo(() => new Set(existing.map(s => s.student_id).filter(Boolean) as string[]), [existing]);

  // default class: the check's class, else the only/first one
  useEffect(() => {
    if (!batchId && scope.batches.length) setBatchId(scope.batches[0].id);
  }, [scope.batches, batchId]);

  useEffect(() => {
    if (!batchId) return;
    let cancelled = false;
    setStudents(null);
    setLoadError(null);
    supabase.from("students").select("id, name, roll_no")
      .or(`batch_id.eq.${batchId},lab_batch_id.eq.${batchId}`)
      .eq("is_active", true)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setLoadError(humanError(error)); setStudents([]); return; }
        const list = ((data || []) as Student[]).sort(byRoll);
        setStudents(list);
        setPicked(preselectAll ? new Set(list.filter(s => !already.has(s.id)).map(s => s.id)) : new Set());
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  const q = query.trim().toLowerCase();
  const visible = (students || []).filter(s => !q || s.name.toLowerCase().includes(q) || (s.roll_no || "").toLowerCase().includes(q));
  const pickable = visible.filter(s => !already.has(s.id));
  const allVisiblePicked = pickable.length > 0 && pickable.every(s => picked.has(s.id));

  const toggle = (id: string) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setPicked(prev => {
    const next = new Set(prev);
    pickable.forEach(s => (allVisiblePicked ? next.delete(s.id) : next.add(s.id)));
    return next;
  });

  async function add() {
    const chosen = (students || []).filter(s => picked.has(s.id) && !already.has(s.id));
    if (!chosen.length) return;
    setSaving(true);
    setSaveError(null);
    const { data, error } = await supabase.from("check_sheets")
      .insert(chosen.map(s => ({ session_id: session.id, student_id: s.id, student_name: s.name.slice(0, 120), roll_no: s.roll_no })))
      .select("*");
    if (!error && !session.batch_id) {
      // remember the class on the check (links results to the class; migration 17 checks it's the teacher's)
      await supabase.from("check_sessions").update({ batch_id: batchId }).eq("id", session.id);
    }
    setSaving(false);
    if (error) {
      setSaveError(error.code === "23505" ? "Some of these students are already in this check. Reopen the list and try again." : humanError(error));
      return;
    }
    onAdded((data || []) as CheckSheet[], batchId);
  }

  const n = [...picked].filter(id => !already.has(id)).length;

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex sm:items-center sm:justify-center" onClick={onClose}>
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[88vh] sm:max-w-lg sm:rounded-3xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
          <p className="flex-1 text-sm font-black text-gray-900">Add students</p>
          <button onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-3 border-b border-gray-100">
          <div>
            <label className="text-xs font-bold text-gray-500">Class / section</label>
            <select value={batchId} onChange={e => setBatchId(e.target.value)} disabled={scope.loading}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm bg-white">
              {scope.batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">Only the classes you are assigned to are listed.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-xl border border-gray-200 px-3">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or roll no"
                className="w-full py-2.5 text-sm outline-none bg-transparent" />
            </div>
            <button onClick={toggleAll} disabled={!pickable.length}
              className="shrink-0 px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 disabled:opacity-40">
              {allVisiblePicked ? "Clear all" : "Select all"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 min-h-[200px]">
          {students === null ? <p className="p-6 text-center text-sm text-gray-400">Loading students…</p>
            : loadError ? <p className="p-6 text-center text-sm text-red-600">{loadError}</p>
            : visible.length === 0 ? <p className="p-6 text-center text-sm text-gray-500">{students.length ? "No match." : "No students in this class yet."}</p>
            : visible.map(s => {
              const isIn = already.has(s.id);
              return (
                <label key={s.id} className={`flex items-center gap-3 px-4 py-3 ${isIn ? "opacity-60" : "cursor-pointer active:bg-gray-50"}`}>
                  <input type="checkbox" className="h-5 w-5 accent-gray-900 shrink-0" disabled={isIn}
                    checked={isIn || picked.has(s.id)} onChange={() => toggle(s.id)} />
                  <span className="w-10 shrink-0 text-xs font-black text-gray-500">{s.roll_no || "—"}</span>
                  <span className="flex-1 text-sm font-bold text-gray-900 truncate">{s.name}</span>
                  {isIn && <span className="text-[11px] font-bold text-gray-500">already added</span>}
                </label>
              );
            })}
        </div>

        <div className="p-3 border-t border-gray-200 space-y-2" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
          <button onClick={add} disabled={!n || saving}
            className="w-full py-3.5 rounded-2xl bg-gray-900 text-white text-sm font-black disabled:bg-gray-300">
            {saving ? "Adding…" : n ? `Add ${n} student${n > 1 ? "s" : ""}` : "Select students"}
          </button>
        </div>
      </div>
    </div>
  );
}
