// src/pages/institute/classes/ClassesTab.tsx
// The whole hierarchy on ONE screen: Class → Subject → Batch, with the batch's teacher and student count on each batch row.
// Shown only behind CLASS_SUBJECT_BATCH_ENABLED. Data comes from the dashboard's own queries (props); every write goes through
// classesApi.ts and any error is shown, never swallowed. Deletes are blocked (with the reason) while students / attendance exist.
import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/pages/institute/instituteToast";
import { teacherDisplayName } from "@/lib/teacherName";
import {
  buildClassTree, classDeleteBlock, subjectDeleteBlock, batchDeleteBlock,
  type BatchRow, type ClassRow, type SubjectRow, type TeachingRow, type ClassNode, type SubjectNode, type BatchNode,
} from "./classTree";
import * as api from "./classesApi";

export interface TeacherLite { id: string; user_id: string; user_name?: string | null; user_email?: string | null; role?: string }

export interface ClassesTabProps {
  instituteId: string;
  classes: ClassRow[];
  subjects: SubjectRow[];
  batches: BatchRow[];
  teaching: TeachingRow[];
  teachers: TeacherLite[];
  studentCount: (batchId: string) => number;
  studentsInClass: (classId: string) => number;
  /** refetch dashboard data after a write */
  onChanged: () => void | Promise<unknown>;
}

const row = "flex flex-wrap items-center gap-2";
const ghostBtn = "text-[11px] font-bold px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors";
const dangerBtn = "text-[11px] font-bold px-2 py-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors";

/** "+ Add …" → input + Add / Cancel. Calls onAdd(name) and keeps itself open (clears) so several can be added in a row. */
function InlineAdd({ label, placeholder, onAdd }: { label: string; placeholder: string; onAdd: (name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return <button className={ghostBtn} onClick={() => setOpen(true)}>+ {label}</button>;
  const submit = async () => {
    if (!value.trim() || busy) return;
    setBusy(true);
    try { await onAdd(value); setValue(""); } catch { /* the caller already toasted the reason; keep the text so it can be fixed */ }
    setBusy(false);
  };
  return (
    <span className={row}>
      <input autoFocus className="field-soft !py-1 !px-2 text-[12px] w-44" placeholder={placeholder} value={value} maxLength={80}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setOpen(false); setValue(""); } }} />
      <button className="btn-orange px-3 py-1 rounded-lg text-[11px]" disabled={busy || !value.trim()} onClick={submit}>Add</button>
      <button className={ghostBtn} onClick={() => { setOpen(false); setValue(""); }}>Done</button>
    </span>
  );
}

/** Name that turns into an input on "Rename". */
function RenameName({ name, className, onSave }: { name: string; className: string; onSave: (n: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const save = async () => {
    if (!value.trim() || value.trim() === name) { setEditing(false); setValue(name); return; }
    try { await onSave(value); setEditing(false); } catch { /* toasted by the caller; stay in edit mode */ }
  };
  if (!editing) {
    return (
      <span className={row}>
        <span className={className}>{name}</span>
        <button className={ghostBtn} aria-label={`Rename ${name}`} onClick={() => { setValue(name); setEditing(true); }}>Rename</button>
      </span>
    );
  }
  return (
    <span className={row}>
      <input autoFocus className="field-soft !py-1 !px-2 text-[12px] w-48" value={value} maxLength={80} onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") { setEditing(false); setValue(name); } }} />
      <button className="btn-orange px-3 py-1 rounded-lg text-[11px]" onClick={save}>Save</button>
      <button className={ghostBtn} onClick={() => { setEditing(false); setValue(name); }}>Cancel</button>
    </span>
  );
}

export default function ClassesTab(p: ClassesTabProps) {
  const { instituteId, teachers } = p;
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const activeIds = useMemo(() => new Set(teachers.map(t => t.user_id)), [teachers]);
  const tree = useMemo(() => buildClassTree({
    classes: p.classes, subjects: p.subjects, batches: p.batches, teaching: p.teaching,
    studentCount: p.studentCount, activeTeacherIds: activeIds,
  }), [p.classes, p.subjects, p.batches, p.teaching, p.studentCount, activeIds]);
  const teacherName = (uid: string) => {
    const t = teachers.find(x => x.user_id === uid);
    return t ? teacherDisplayName(t as never) : "Teacher";
  };

  /** Runs a write; success toast + refetch, failure toast with the reason (and rethrows so inline inputs keep their text). */
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await p.onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      throw e;
    } finally { setBusy(false); }
  };
  const quietly = (fn: () => Promise<unknown>, ok: string) => run(fn, ok).catch(() => undefined);
  const toggle = (id: string) => setCollapsed(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  /* ── deletes: check the guard first, explain, then confirm ── */
  const delBatch = async (b: BatchNode) => {
    let sessions = 0;
    try { sessions = await api.sessionsOfBatch(supabase, b.id); } catch (e) { return toast.error((e as Error).message); }
    const why = batchDeleteBlock(b, sessions);
    if (why) return toast.error(why);
    if (!confirm(`Delete batch "${b.name}"? ${b.teacherIds.length ? "Its teacher is removed from it. " : ""}This cannot be undone.`)) return;
    quietly(() => api.deleteBatch(supabase, instituteId, b.id), "Batch deleted");
  };
  const delSubject = async (s: SubjectNode) => {
    let why: string | null;
    try { why = subjectDeleteBlock(s, await api.subjectBlockers(supabase, s.id)); } catch (e) { return toast.error((e as Error).message); }
    if (why) return toast.error(why);
    if (!confirm(`Delete subject "${s.name}"?`)) return;
    quietly(() => api.deleteSubject(supabase, s.id), "Subject deleted");
  };
  const delClass = (c: ClassNode) => {
    const why = classDeleteBlock(c, p.studentsInClass(c.id));
    if (why) return toast.error(why);
    if (!confirm(`Delete class "${c.name}"?`)) return;
    quietly(() => api.deleteClass(supabase, c.id), "Class deleted");
  };

  const allSubjectOptions = tree.classes.flatMap(c => c.subjects.map(s => ({ id: s.id, label: `${c.name} › ${s.name}` })));

  const batchRow = (b: BatchNode) => {
    const current = b.teacherIds[0] ?? "";
    return (
      <div key={b.id} className={`${row} py-1.5 pl-2 border-l-2 border-slate-100`} data-testid={`batch-${b.id}`}>
        <RenameName name={b.name} className="text-[13px] font-bold text-slate-700" onSave={n => run(() => api.renameBatch(supabase, b.id, n), "Batch renamed")} />
        <span className="text-[11px] font-medium text-slate-400">{b.students} student{b.students === 1 ? "" : "s"}</span>
        <select
          aria-label={`Teacher of ${b.name}`}
          className="ml-auto text-[12px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none cursor-pointer hover:border-[#FF7043] max-w-[200px]"
          value={current} disabled={busy}
          onChange={e => quietly(() => api.setBatchTeacher(supabase, instituteId, b.id, e.target.value || null), e.target.value ? "Teacher assigned" : "Teacher removed")}
        >
          <option value="">No teacher</option>
          {teachers.map(t => <option key={t.user_id} value={t.user_id}>{teacherName(t.user_id)}</option>)}
        </select>
        {b.teacherIds.length > 1 && (
          <span className="text-[10px] font-bold text-amber-600" title={b.teacherIds.map(teacherName).join(", ")}>+{b.teacherIds.length - 1} more</span>
        )}
        <button className={dangerBtn} aria-label={`Delete ${b.name}`} onClick={() => delBatch(b)}>Delete</button>
      </div>
    );
  };

  const subjectBlock = (c: ClassNode, s: SubjectNode) => (
    <div key={s.id} className="mt-2 ml-3 sm:ml-5">
      <div className={row}>
        <button className="text-slate-400 text-[11px] w-4" aria-label={collapsed.has(s.id) ? "Expand subject" : "Collapse subject"} onClick={() => toggle(s.id)}>{collapsed.has(s.id) ? "▸" : "▾"}</button>
        <RenameName name={s.name} className="text-[14px] font-extrabold text-slate-800" onSave={n => run(() => api.renameSubject(supabase, s.id, n), "Subject renamed")} />
        <span className="text-[11px] font-medium text-slate-400">{s.batches.length} batch{s.batches.length === 1 ? "" : "es"} · {s.students} student{s.students === 1 ? "" : "s"}</span>
        <span className="ml-auto" />
        <button className={dangerBtn} aria-label={`Delete subject ${s.name}`} onClick={() => delSubject(s)}>Delete</button>
      </div>
      {!collapsed.has(s.id) && (
        <div className="ml-5 mt-1 space-y-0.5">
          {s.batches.map(batchRow)}
          <InlineAdd label="Add batch" placeholder="Batch name, e.g. Eco Batch A"
            onAdd={n => run(() => api.createBatch(supabase, { instituteId, classId: c.id, className: c.name, subjectId: s.id, name: n }), "Batch created")} />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4" data-testid="classes-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] text-slate-500 font-bold">Class → Subject → Batch → Teacher</p>
          <p className="text-[12px] text-slate-400 font-medium">Everything on one screen. A teacher is assigned to a batch; the subject comes from the batch.</p>
        </div>
        <InlineAdd label="Add class" placeholder="e.g. 11th Commerce" onAdd={n => run(() => api.createClass(supabase, instituteId, n), "Class created")} />
      </div>

      {tree.classes.length === 0 && (
        <div className="bg-white rounded-2xl p-10 text-center card-shadow border border-slate-50">
          <p className="text-sm text-slate-500 font-medium">No classes yet. Add one (for example "11th Commerce"), then its subjects and batches.</p>
        </div>
      )}

      {tree.classes.map(c => (
        <section key={c.id} className="bg-white rounded-2xl p-4 card-shadow border border-slate-50" data-testid={`class-${c.id}`}>
          <div className={row}>
            <button className="text-slate-400 text-[12px] w-4" aria-label={collapsed.has(c.id) ? "Expand class" : "Collapse class"} onClick={() => toggle(c.id)}>{collapsed.has(c.id) ? "▸" : "▾"}</button>
            <RenameName name={c.name} className="text-[16px] font-extrabold text-slate-900" onSave={n => run(() => api.renameClass(supabase, c.id, n), "Class renamed")} />
            <span className="text-[11px] font-medium text-slate-400">{c.subjects.length} subject{c.subjects.length === 1 ? "" : "s"} · {c.students} student{c.students === 1 ? "" : "s"}</span>
            <span className="ml-auto" />
            <button className={dangerBtn} aria-label={`Delete class ${c.name}`} onClick={() => delClass(c)}>Delete</button>
          </div>
          {!collapsed.has(c.id) && (
            <>
              {c.subjects.map(s => subjectBlock(c, s))}
              {c.looseBatches.length > 0 && (
                <div className="mt-3 ml-3 sm:ml-5 p-2 rounded-xl bg-amber-50/60 border border-amber-100">
                  <p className="text-[11px] font-bold text-amber-700 mb-1">Batches without a subject (old data): pick a subject for each</p>
                  {c.looseBatches.map(b => (
                    <div key={b.id} className={`${row} py-1`}>
                      <span className="text-[13px] font-bold text-slate-700">{b.name}</span>
                      <span className="text-[11px] text-slate-400">{b.students} students</span>
                      <select aria-label={`Subject for ${b.name}`} className="ml-auto text-[12px] font-bold bg-white border border-amber-200 rounded-lg px-2 py-1" value="" disabled={busy}
                        onChange={e => e.target.value && quietly(() => api.setBatchSubject(supabase, b.id, e.target.value), "Subject set")}>
                        <option value="">Choose subject…</option>
                        {c.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 ml-3 sm:ml-5">
                <InlineAdd label="Add subject" placeholder="e.g. Economics"
                  onAdd={n => run(() => api.createSubject(supabase, instituteId, c.id, n, p.subjects.map(s => s.code)), "Subject created")} />
              </div>
            </>
          )}
        </section>
      ))}

      {(tree.unassigned.some(b => !b.classId) || tree.classless.length > 0) && (
        <section className="bg-white rounded-2xl p-4 card-shadow border border-amber-100">
          <p className="text-[13px] font-extrabold text-amber-700">Old data without a class</p>
          <p className="text-[11px] text-slate-400 mb-2">These batches / subjects have no class. Pick a subject (inside a class above) for each batch; classless subjects can be moved by recreating them under a class.</p>
          {tree.unassigned.filter(b => !b.classId).map(b => (
            <div key={b.id} className={`${row} py-1`}>
              <span className="text-[13px] font-bold text-slate-700">{b.name}</span>
              <span className="text-[11px] text-slate-400">{b.students} students</span>
              <select aria-label={`Subject for ${b.name}`} className="ml-auto text-[12px] font-bold bg-white border border-amber-200 rounded-lg px-2 py-1" value="" disabled={busy}
                onChange={e => e.target.value && quietly(() => api.setBatchSubject(supabase, b.id, e.target.value), "Subject set")}>
                <option value="">Choose class › subject…</option>
                {allSubjectOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          ))}
          {tree.classless.map(s => <p key={s.id} className="text-[12px] text-slate-500 py-0.5">Subject without a class: <b>{s.name}</b> ({s.batches.length} batches)</p>)}
        </section>
      )}
    </div>
  );
}
