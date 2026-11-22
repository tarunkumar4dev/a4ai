// src/pages/institute/classes/ClassesTab.tsx
// The whole hierarchy on ONE screen: Class → Subject → Batch, with the batch's teacher and student count on each batch row.
// Shown only behind CLASS_SUBJECT_BATCH_ENABLED. Data comes from the dashboard's own queries (props); every write goes through
// classesApi.ts and any error is shown, never swallowed. Deletes are blocked (with the reason) while students / attendance exist.
// Look: classesTheme.tsx (colour per subject, tinted blocks, pills). Behaviour is unchanged by the styling.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/pages/institute/instituteToast";
import { teacherDisplayName } from "@/lib/teacherName";
import { personColor, initialsOf, subjectColorOf, subjectVars } from "@/lib/subjectColors";
import {
  buildClassTree, classDeleteBlock, subjectDeleteBlock, batchDeleteBlock, isSameName, nextBatchName,
  type BatchRow, type ClassRow, type SubjectRow, type TeachingRow, type ClassNode, type SubjectNode, type BatchNode,
} from "./classTree";
import { ClassesStyles } from "./classesTheme";
import { CIcons } from "./classesIcons";
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

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Pill({ tone, icon, children, title }: { tone?: "orange" | "indigo" | "green" | "amber" | "slate" | "subject"; icon?: React.ReactNode; children: React.ReactNode; title?: string }) {
  return <span className={`csb-pill ${tone === "subject" ? "csb-s" : `csb-t-${tone ?? "slate"}`}`} title={title}>{icon}{children}</span>;
}

function Chevron({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  return <button className="csb-chev" data-open={open} aria-label={label} aria-expanded={open} onClick={onClick}><CIcons.Chevron /></button>;
}

/** Height-animated container (grid rows 0fr → 1fr). Closed content stays mounted but hidden (no focus, no screen reader). */
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return <div className="csb-collapse" data-open={open}><div className="csb-collapse-inner">{children}</div></div>;
}

/** "+ Add …" → input + Add / Done. Calls onAdd(name) and stays open (clears) so several can be added in a row. */
function InlineAdd({ label, placeholder, onAdd, defaultValue = "", className = "" }: {
  label: string; placeholder: string; onAdd: (name: string) => Promise<void>; defaultValue?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const lastDefault = useRef(defaultValue);
  // keep the suggested name current ("… Batch 3" → "… Batch 4" after an add) unless the user has typed something else
  useEffect(() => {
    if (open && (value === lastDefault.current || value === "")) setValue(defaultValue);
    lastDefault.current = defaultValue;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue]);
  if (!open) {
    return <button className={`csb-add ${className}`} onClick={() => { setValue(defaultValue); lastDefault.current = defaultValue; setOpen(true); }}><CIcons.Plus /> {label}</button>;
  }
  const submit = async () => {
    if (!value.trim() || busy) return;
    setBusy(true);
    try { await onAdd(value); setValue(""); } catch { /* the caller already toasted the reason; keep the text so it can be fixed */ }
    setBusy(false);
  };
  return (
    <span className={`flex flex-wrap items-center gap-2 mt-2 ${className}`}>
      <input autoFocus className="csb-input" placeholder={placeholder} value={value} maxLength={80}
        onFocus={e => e.currentTarget.select()}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setOpen(false); setValue(""); } }} />
      <button className="btn-orange px-3 py-1.5 rounded-lg text-[11px]" disabled={busy || !value.trim()} onClick={submit}>Add</button>
      <button className="csb-link" onClick={() => { setOpen(false); setValue(""); }}>Done</button>
    </span>
  );
}

/** Name that turns into an input on "Rename" (pencil icon button). */
function RenameName({ name, nameClass, onSave, chip, muted, mutedTitle }: {
  name: string; nameClass?: string; onSave: (n: string) => Promise<void>; chip?: boolean; muted?: boolean; mutedTitle?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const save = async () => {
    if (!value.trim() || value.trim() === name) { setEditing(false); setValue(name); return; }
    try { await onSave(value); setEditing(false); } catch { /* toasted by the caller; stay in edit mode */ }
  };
  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1 min-w-0">
        <span className={chip ? `csb-chip ${muted ? "csb-chip-muted" : ""}` : nameClass} title={muted ? mutedTitle : undefined}>{name}</span>
        <button className="csb-icon-btn" aria-label={`Rename ${name}`} title="Rename" onClick={() => { setValue(name); setEditing(true); }}><CIcons.Pencil /></button>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <input autoFocus className="csb-input" value={value} maxLength={80} onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") { setEditing(false); setValue(name); } }} />
      <button className="btn-orange px-3 py-1.5 rounded-lg text-[11px]" onClick={save}>Save</button>
      <button className="csb-link" onClick={() => { setEditing(false); setValue(name); }}>Cancel</button>
    </span>
  );
}

const DeleteBtn = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button className="csb-icon-btn is-danger" aria-label={label} title="Delete" onClick={onClick}><CIcons.Trash /></button>
);

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

  const teacherPicker = (b: BatchNode) => {
    const current = b.teacherIds[0] ?? "";
    const name = current ? teacherName(current) : "";
    const pc = current ? personColor(name) : null;
    return (
      <div className={`csb-teacher ${current ? "csb-t-green" : "csb-t-amber"}`}>
        {pc ? (
          <span className="csb-avatar csb-s" style={subjectVars(pc)} title={name} aria-hidden="true">{initialsOf(name)}</span>
        ) : (
          <span className="csb-avatar" title="No teacher yet" aria-hidden="true"><CIcons.Person /></span>
        )}
        <select
          aria-label={`Teacher of ${b.name}`}
          className="csb-select" data-state={current ? "assigned" : "none"}
          value={current} disabled={busy}
          onChange={e => quietly(() => api.setBatchTeacher(supabase, instituteId, b.id, e.target.value || null), e.target.value ? "Teacher assigned" : "Teacher removed")}
        >
          <option value="">No teacher</option>
          {teachers.map(t => <option key={t.user_id} value={t.user_id}>{teacherName(t.user_id)}</option>)}
        </select>
        {b.teacherIds.length > 1 && (
          <span className="text-[10px] font-bold csb-pill csb-t-amber" title={b.teacherIds.map(teacherName).join(", ")}>+{b.teacherIds.length - 1} more</span>
        )}
      </div>
    );
  };

  const batchRow = (b: BatchNode, subjectName: string) => (
    <div key={b.id} className="csb-row csb-hov" data-testid={`batch-${b.id}`}>
      <RenameName name={b.name} chip muted={isSameName(b.name, subjectName)}
        mutedTitle="Same name as the subject (old data) — rename it, e.g. “Batch 1”"
        onSave={n => run(() => api.renameBatch(supabase, b.id, n), "Batch renamed")} />
      <Pill tone="subject" icon={<CIcons.Users />}>{plural(b.students, "student")}</Pill>
      <span className="csb-grow" />
      {teacherPicker(b)}
      <DeleteBtn label={`Delete ${b.name}`} onClick={() => delBatch(b)} />
    </div>
  );

  const subjectBlock = (c: ClassNode, s: SubjectNode) => {
    const open = !collapsed.has(s.id);
    return (
      <div key={s.id} className="csb-subject" style={subjectVars(subjectColorOf(s.name))}>
        <div className="flex flex-wrap items-center gap-2 csb-hov">
          <Chevron open={open} label={open ? "Collapse subject" : "Expand subject"} onClick={() => toggle(s.id)} />
          <span className="csb-dot" aria-hidden="true" />
          <RenameName name={s.name} nameClass="csb-subj-name" onSave={n => run(() => api.renameSubject(supabase, s.id, n), "Subject renamed")} />
          <Pill tone="subject" icon={<CIcons.Layers />}>{plural(s.batches.length, "batch", "batches")}</Pill>
          <Pill tone="subject" icon={<CIcons.Users />}>{plural(s.students, "student")}</Pill>
          <span className="csb-grow" />
          <DeleteBtn label={`Delete subject ${s.name}`} onClick={() => delSubject(s)} />
        </div>
        <Collapse open={open}>
          <div className="pl-1 pt-1 pb-0.5">
            {s.batches.map(b => batchRow(b, s.name))}
            <InlineAdd label="Add batch" placeholder="Batch name, e.g. Eco Batch A"
              defaultValue={nextBatchName(s.name, s.batches.map(b => b.name))}
              onAdd={n => run(() => api.createBatch(supabase, { instituteId, classId: c.id, className: c.name, subjectId: s.id, name: n }), "Batch created")} />
          </div>
        </Collapse>
      </div>
    );
  };

  const subjectPicker = (b: { id: string; name: string; students: number }, options: { id: string; label: string }[], placeholder: string) => (
    <div key={b.id} className="flex flex-wrap items-center gap-2 py-1">
      <span className="csb-chip">{b.name}</span>
      <Pill tone="amber" icon={<CIcons.Users />}>{plural(b.students, "student")}</Pill>
      <select aria-label={`Subject for ${b.name}`} className="csb-select ml-auto" value="" disabled={busy}
        onChange={e => e.target.value && quietly(() => api.setBatchSubject(supabase, b.id, e.target.value), "Subject set")}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </div>
  );

  return (
    <div className="csb-root space-y-4" data-testid="classes-tab">
      <ClassesStyles />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-extrabold" style={{ color: "var(--c-text)" }}>Class → Subject → Batch → Teacher</p>
          <p className="csb-hint">Everything on one screen. A teacher is assigned to a batch; the subject comes from the batch.</p>
        </div>
        <InlineAdd label="Add class" placeholder="e.g. 11th Commerce" className="csb-add-top" onAdd={n => run(() => api.createClass(supabase, instituteId, n), "Class created")} />
      </div>

      {tree.classes.length === 0 && (
        <div className="csb-empty">
          <div className="csb-tile mx-auto mb-3"><CIcons.Cap /></div>
          No classes yet. Add one (for example "11th Commerce"), then its subjects and batches.
        </div>
      )}

      {tree.classes.map(c => {
        const open = !collapsed.has(c.id);
        return (
          <section key={c.id} className="csb-card" data-testid={`class-${c.id}`}>
            <div className="csb-head csb-hov">
              <Chevron open={open} label={open ? "Collapse class" : "Expand class"} onClick={() => toggle(c.id)} />
              <span className="csb-tile"><CIcons.Cap /></span>
              <RenameName name={c.name} nameClass="csb-title" onSave={n => run(() => api.renameClass(supabase, c.id, n), "Class renamed")} />
              <Pill tone="indigo" icon={<CIcons.Book />}>{plural(c.subjects.length, "subject")}</Pill>
              <Pill tone="orange" icon={<CIcons.Users />}>{plural(c.students, "student")}</Pill>
              <span className="csb-grow" />
              <DeleteBtn label={`Delete class ${c.name}`} onClick={() => delClass(c)} />
            </div>
            <Collapse open={open}>
              <div className="csb-body">
                {c.subjects.map(s => subjectBlock(c, s))}
                {c.looseBatches.length > 0 && (
                  <div className="csb-warn csb-t-amber">
                    <p className="text-[11px] font-extrabold mb-1">Batches without a subject (old data): pick a subject for each</p>
                    {c.looseBatches.map(b => subjectPicker(b, c.subjects.map(s => ({ id: s.id, label: s.name })), "Choose subject…"))}
                  </div>
                )}
                <InlineAdd label="Add subject" placeholder="e.g. Economics"
                  onAdd={n => run(() => api.createSubject(supabase, instituteId, c.id, n, p.subjects.map(s => s.code)), "Subject created")} />
              </div>
            </Collapse>
          </section>
        );
      })}

      {(tree.unassigned.some(b => !b.classId) || tree.classless.length > 0) && (
        <section className="csb-warn csb-t-amber">
          <p className="text-[13px] font-extrabold">Old data without a class</p>
          <p className="text-[11px] mb-2" style={{ opacity: 0.85 }}>These batches / subjects have no class. Pick a subject (inside a class above) for each batch; classless subjects can be moved by recreating them under a class.</p>
          {tree.unassigned.filter(b => !b.classId).map(b => subjectPicker(b, allSubjectOptions, "Choose class › subject…"))}
          {tree.classless.map(s => <p key={s.id} className="text-[12px] py-0.5">Subject without a class: <b>{s.name}</b> ({s.batches.length} batches)</p>)}
        </section>
      )}
    </div>
  );
}
