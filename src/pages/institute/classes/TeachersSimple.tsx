// src/pages/institute/classes/TeachersSimple.tsx
// Teachers tab of the Class → Subject → Batch model (behind CLASS_SUBJECT_BATCH_ENABLED): a list of teachers and, under each,
// a READ-ONLY "Class → Subject → Batch" view plus ONE "Add batch" picker grouped Class › Subject. No department dropdown,
// no "+ Subject" dropdown — the subject is whatever the batch has (the DB trigger fills teaching_assignments.subject_id).
import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/pages/institute/instituteToast";
import { teacherDisplayName } from "@/lib/teacherName";
import { batchPickerOptions, groupTeacherBatches, type ClassTree } from "./classTree";
import { addTeacherToBatch, removeTeacherFromBatch } from "./classesApi";
import type { TeacherLite } from "./ClassesTab";

interface Props {
  instituteId: string;
  teachers: (TeacherLite & { status?: string; joined_at?: string | null })[];
  tree: ClassTree;
  onChanged: () => void | Promise<unknown>;
  onRemoveTeacher: (memberId: string, userId?: string) => void;
  onOpenClasses: () => void;
}

export default function TeachersSimple({ instituteId, teachers, tree, onChanged, onRemoveTeacher, onOpenClasses }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const options = useMemo(() => batchPickerOptions(tree), [tree]);

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast.success(ok); await onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(null); }
  };

  if (teachers.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center card-shadow border border-slate-50">
        <p className="text-sm text-slate-500 font-medium">No teachers yet. Share the join code above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="teachers-simple">
      {options.length === 0 && (
        <p className="text-[12px] text-slate-500 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          No batch with a subject exists yet.{" "}
          <button className="font-bold text-[#FF7043] hover:underline" onClick={onOpenClasses}>Create classes, subjects and batches</button> first.
        </p>
      )}
      {teachers.map(t => {
        const groups = groupTeacherBatches(t.user_id, tree);
        const mine = new Set(groups.flatMap(g => g.subjects.flatMap(s => s.batches.map(b => b.id))));
        const free = options.filter(o => !mine.has(o.batchId));
        // optgroups: one per Class › Subject
        const byGroup = new Map<string, typeof free>();
        for (const o of free) byGroup.set(`${o.className} › ${o.subjectName}`, [...(byGroup.get(`${o.className} › ${o.subjectName}`) ?? []), o]);
        return (
          <div key={t.id} className="bg-white rounded-2xl p-4 card-shadow border border-slate-50" data-testid={`teacher-${t.user_id}`}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-800 truncate">{teacherDisplayName(t as never)}</p>
                <p className="text-[11px] font-medium text-slate-400">{groups.length === 0 ? "No batches yet" : `${mine.size} batch${mine.size === 1 ? "" : "es"}`}</p>
              </div>
              <select
                aria-label={`Add batch for ${teacherDisplayName(t as never)}`}
                className="text-[12px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none cursor-pointer hover:border-[#FF7043] max-w-[260px]"
                value="" disabled={busy !== null || free.length === 0}
                onChange={e => e.target.value && act(`${t.user_id}:${e.target.value}`, () => addTeacherToBatch(supabase, instituteId, e.target.value, t.user_id), "Batch added")}
              >
                <option value="">+ Add batch</option>
                {[...byGroup.entries()].map(([label, opts]) => (
                  <optgroup key={label} label={label}>
                    {opts.map(o => <option key={o.batchId} value={o.batchId}>{o.batchName} ({o.students} students)</option>)}
                  </optgroup>
                ))}
              </select>
              <button onClick={() => onRemoveTeacher(t.id, t.user_id)} title="Remove teacher from the institute" aria-label="Remove teacher"
                className="text-[11px] font-bold px-2 py-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">Remove</button>
            </div>
            {groups.length > 0 && (
              <div className="mt-3 space-y-2">
                {groups.map(g => (
                  <div key={g.classId ?? "none"}>
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">{g.className}</p>
                    {g.subjects.map(s => (
                      <div key={s.subjectId ?? "none"} className="ml-3 mt-1">
                        <p className="text-[12px] font-bold text-slate-700">{s.subjectName}</p>
                        <div className="ml-3 flex flex-wrap gap-1.5 mt-0.5">
                          {s.batches.map(b => (
                            <span key={b.id} className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              {b.name} · {b.students}
                              <button aria-label={`Remove ${b.name}`} className="text-indigo-300 hover:text-red-500"
                                onClick={() => { if (confirm(`Remove ${teacherDisplayName(t as never)} from "${b.name}"?`)) act(`${t.user_id}:${b.id}`, () => removeTeacherFromBatch(supabase, instituteId, b.id, t.user_id), "Batch removed"); }}>×</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
