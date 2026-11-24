// src/pages/institute/classes/TeachersSimple.tsx
// Teachers tab of the Class → Subject → Batch model: a list of teachers and, under each, a READ-ONLY "Class → Subject → Batch"
// view plus ONE "Add batch" picker grouped Class › Subject. No department dropdown, no "+ Subject" dropdown — the subject is
// whatever the batch has (the DB trigger fills teaching_assignments.subject_id). Look: classesTheme.tsx (same chip language as
// the Classes screen); behaviour is unchanged by the styling.
import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/pages/institute/instituteToast";
import { teacherDisplayName } from "@/lib/teacherName";
import { initialsOf, personColor, subjectColorOf, subjectVars } from "@/lib/subjectColors";
import { batchPickerOptions, groupTeacherBatches, isSameName, type ClassTree } from "./classTree";
import { addTeacherToBatch, removeTeacherFromBatch } from "./classesApi";
import { ClassesStyles } from "./classesTheme";
import { CIcons } from "./classesIcons";
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
      <div className="csb-root">
        <ClassesStyles />
        <div className="csb-empty">No teachers yet. Share the join code above.</div>
      </div>
    );
  }

  return (
    <div className="csb-root space-y-3" data-testid="teachers-simple">
      <ClassesStyles />
      {options.length === 0 && (
        <p className="csb-warn csb-t-amber text-[12px]">
          No batch with a subject exists yet.{" "}
          <button className="font-extrabold underline" onClick={onOpenClasses}>Create classes, subjects and batches</button> first.
        </p>
      )}
      {teachers.map(t => {
        const display = teacherDisplayName(t as never);
        const groups = groupTeacherBatches(t.user_id, tree);
        const mine = new Set(groups.flatMap(g => g.subjects.flatMap(s => s.batches.map(b => b.id))));
        const free = options.filter(o => !mine.has(o.batchId));
        // optgroups: one per Class › Subject
        const byGroup = new Map<string, typeof free>();
        for (const o of free) byGroup.set(`${o.className} › ${o.subjectName}`, [...(byGroup.get(`${o.className} › ${o.subjectName}`) ?? []), o]);
        return (
          <div key={t.id} className="csb-card" data-testid={`teacher-${t.user_id}`}>
            {/* Narrow phones: stack identity above the actions row so the "N batches" pill never
                sits on top of the "+ Add batch" select. From sm+ it stays a single row. */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-3 p-4 csb-hov">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="csb-avatar csb-s" style={{ ...subjectVars(personColor(display)), width: 38, height: 38, fontSize: 13 }} aria-hidden="true">{initialsOf(display)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-extrabold truncate" style={{ color: "var(--c-text)" }}>{display}</p>
                  <div className="mt-0.5">
                    {groups.length === 0
                      ? <span className="csb-pill csb-t-amber">No batches yet</span>
                      : <span className="csb-pill csb-t-indigo"><CIcons.Layers />{mine.size} batch{mine.size === 1 ? "" : "es"}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  aria-label={`Add batch for ${display}`}
                  className="csb-add !mt-0 w-full sm:w-auto sm:max-w-[260px] min-w-0"
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
                  className="csb-icon-btn is-danger shrink-0"><CIcons.Trash /></button>
              </div>
            </div>
            {groups.length > 0 && (
              <div className="px-4 pb-4 space-y-3">
                {groups.map(g => (
                  <div key={g.classId ?? "none"}>
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: "var(--c-accent-text)" }}>
                      <CIcons.Cap />{g.className}
                    </p>
                    {g.subjects.map(s => (
                      <div key={s.subjectId ?? "none"} className="csb-subject" style={subjectVars(subjectColorOf(s.subjectId ? s.subjectName : ""))}>
                        <p className="inline-flex items-center gap-2 text-[13px] font-extrabold">
                          <span className="csb-dot" aria-hidden="true" /><span className="csb-subj-name">{s.subjectName}</span>
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {s.batches.map(b => (
                            <span key={b.id} className={`csb-chip ${isSameName(b.name, s.subjectName) ? "csb-chip-muted" : ""} gap-2`}>
                              {b.name}
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ opacity: 0.85 }}><CIcons.Users />{b.students}</span>
                              <button aria-label={`Remove ${b.name}`} title="Remove" className="csb-icon-btn is-danger !w-5 !h-5 !rounded-full"
                                onClick={() => { if (confirm(`Remove ${display} from "${b.name}"?`)) act(`${t.user_id}:${b.id}`, () => removeTeacherFromBatch(supabase, instituteId, b.id, t.user_id), "Batch removed"); }}>×</button>
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
