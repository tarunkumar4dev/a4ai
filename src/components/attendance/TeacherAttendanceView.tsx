// src/components/attendance/TeacherAttendanceView.tsx
// Mobile-first teacher attendance — session-based schema
// Flow: Calendar + Today's classes / Manual pick → Attendance sheet → Save via save_class_attendance() RPC
//
// ACCESS (enforced server-side in attendance_access.sql):
//   Teacher → only the (batch, subject) pairs assigned to them (teaching_assignments / timetable_slots)
//   HOD     → + every class in their department     Admin/owner → + every class in the institute
//   Legacy subject-named batches (no section) are hidden in 'full' hierarchy institutes.

import React, { useState, useMemo, useCallback, useEffect, memo, useRef } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";

/* ───── TYPES ───── */
type Status = "present" | "absent" | "leave";

interface Student {
  id: string;
  name: string;
  rollNo?: string;
  status: Status;
  pct?: number;
}

interface SessionTarget {
  batchId: string;
  batchName: string;
  sectionName?: string | null;
  subjectId: string;
  subjectName: string;
  subjectCode?: string;
  timetableSlotId?: string | null;
  sessionId?: string | null;
  studentCount?: number;
  timeSlot?: string;
  room?: string;
  isMarked?: boolean;
  isMine?: boolean;
}

// "ECE-1" or "ECE-1 · Lab A" when the batch is a lab batch of the section
const classLabel = (t: { batchName: string; sectionName?: string | null }) =>
  t.sectionName && t.sectionName !== t.batchName ? `${t.sectionName} · ${t.batchName}` : t.batchName;

/* ───── CONSTANTS ───── */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STATUS_CFG: Record<Status, { label: string; full: string; bg: string; text: string; ring: string; dot: string; rowBg: string }> = {
  present: { label: "P", full: "Present", bg: "bg-emerald-500", text: "text-white", ring: "ring-emerald-400/60", dot: "bg-emerald-500", rowBg: "bg-emerald-50/60 dark:bg-emerald-950/20" },
  absent:  { label: "A", full: "Absent",  bg: "bg-red-500",     text: "text-white", ring: "ring-red-400/60",     dot: "bg-red-500",     rowBg: "bg-red-50/60 dark:bg-red-950/20" },
  leave:   { label: "L", full: "Leave",   bg: "bg-blue-500",    text: "text-white", ring: "ring-blue-400/60",    dot: "bg-blue-500",    rowBg: "bg-blue-50/60 dark:bg-blue-950/20" },
};

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ───── INLINE SVG ICONS ───── */
const Icon = {
  Back: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  Calendar: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>,
  Users: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  ChevL: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  ChevR: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Clock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Save: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  Undo: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>,
  Spin: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  X: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Book: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
};

/* ───── TOAST ───── */
type Toast = { id: number; msg: string; type: string };
let _tid = 0;

function Toasts({ items, onDismiss }: { items: Toast[]; onDismiss: (id: number) => void }) {
  if (!items.length) return null;
  return (
    <div className="fixed top-3 left-3 right-3 sm:left-auto sm:right-4 sm:top-4 sm:w-80 z-[9999] flex flex-col gap-2 pointer-events-none">
      {items.map(t => (
        <div key={t.id} onClick={() => onDismiss(t.id)}
          className={`rounded-2xl px-4 py-3 text-[13px] font-semibold shadow-xl pointer-events-auto cursor-pointer flex items-center gap-2 ${
            t.type === "error" ? "bg-red-900 text-red-100" : t.type === "info" ? "bg-slate-800 text-slate-100" : "bg-emerald-800 text-emerald-100"
          }`}>
          <span>{t.type === "error" ? "⚠️" : t.type === "info" ? "ℹ️" : "✅"}</span>
          <span className="flex-1 min-w-0">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

/* ───── CONFIRM MODAL ───── */
function Confirm({ open, onClose, onOk, title, msg, ok = "Confirm", warn = false }: {
  open: boolean; onClose: () => void; onOk: () => void; title: string; msg: string; ok?: string; warn?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl p-6 shadow-2xl animate-[slideUp_0.25s_ease-out] sm:animate-[popIn_0.2s_ease-out]">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-sm text-slate-500 mt-2">{msg}</p>
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 active:bg-slate-100 dark:active:bg-slate-800 touch-manipulation">Cancel</button>
          <button onClick={() => { onOk(); onClose(); }}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white touch-manipulation active:scale-95 ${warn ? "bg-red-500" : "bg-blue-500"}`}>{ok}</button>
        </div>
      </div>
    </div>
  );
}

/* ───── STUDENT CARD (mobile + desktop) ───── */
const StudentCard = memo(({ s, idx, onMark }: { s: Student; idx: number; onMark: (id: string, st: Status) => void }) => {
  const initials = s.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const hue = (idx * 37) % 360;
  const pct = s.pct ?? 0;
  const cfg = STATUS_CFG[s.status];

  return (
    <div className={`rounded-2xl p-3 sm:p-4 border border-slate-200/60 dark:border-white/5 transition-colors ${cfg.rowBg}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0"
          style={{ background: `hsl(${hue}, 50%, 50%)` }}>{initials}</div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{s.name}</p>
          <p className="text-[11px] text-slate-400 font-medium">
            #{idx + 1}{s.rollNo ? ` · ${s.rollNo}` : ""} ·{" "}
            <span className={pct >= 75 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-500"}>{pct}% this month</span>
          </p>
        </div>
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
      </div>
      <div className="flex gap-2">
        {(["present", "absent", "leave"] as Status[]).map(st => {
          const active = s.status === st;
          const c = STATUS_CFG[st];
          return (
            <button key={st} onClick={() => onMark(s.id, st)}
              className={`flex-1 h-12 rounded-xl font-bold text-sm transition-all active:scale-[0.96] touch-manipulation select-none ${
                active ? `${c.bg} ${c.text} shadow-md ring-2 ${c.ring}` : "bg-white/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
              }`}>{c.full}</button>
          );
        })}
      </div>
    </div>
  );
});
StudentCard.displayName = "StudentCard";

/* ═══════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════ */
export default function TeacherAttendanceView() {
  const { user } = useAuth();
  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Teacher";

  const [selected, setSelected] = useState<SessionTarget | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [original, setOriginal] = useState<Student[]>([]);
  const [date, setDate] = useState(() => new Date());
  const [calM, setCalM] = useState(() => new Date().getMonth());
  const [calY, setCalY] = useState(() => new Date().getFullYear());

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<{ title: string; msg: string; ok: string; warn: boolean; fn: () => void } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [saving, setSaving] = useState(false);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const [instId, setInstId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionTarget[]>([]);
  const [assigns, setAssigns] = useState<SessionTarget[]>([]);
  // batch_id → class teacher (proctor) name, so the teacher knows who receives the marks
  const [classTeachers, setClassTeachers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [pickBatch, setPickBatch] = useState("");
  const [pickSubj, setPickSubj] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const toast = useCallback((msg: string, type = "success") => {
    const id = ++_tid;
    setToasts(p => [...p.slice(-3), { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  // ── Load data (scope decided by the server from the caller's role) ──
  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      let targetInstId: string | null = null;

      const { data: mem } = await supabase.from("institute_members")
        .select("institute_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (mem?.institute_id) {
        targetInstId = mem.institute_id;
      } else {
        const { data: ownedInst } = await supabase.from("institutes")
          .select("id").eq("owner_id", user.id).limit(1).maybeSingle();
        targetInstId = ownedInst?.id ?? null;
      }

      if (!targetInstId) { setLoading(false); return; }
      setInstId(targetInstId);
      const ds = toDateStr(date);

      const [sessRes, tgtRes, ctRes] = await Promise.all([
        // 1. My timetable sessions for the selected date (server auto-generates them)
        supabase.rpc("get_teacher_day_sessions", { p_institute_id: targetInstId, p_date: ds }),
        // 2. Classes I'm allowed to mark (manual pick)
        supabase.rpc("get_my_teaching_targets", { p_institute_id: targetInstId }),
        // 3. Who is the class teacher (proctor) of each of my classes — proctor_dashboard.sql
        supabase.rpc("get_my_class_teachers", { p_institute_id: targetInstId }),
      ]);
      if (sessRes.error) console.error("get_teacher_day_sessions:", sessRes.error);
      if (tgtRes.error) console.error("get_my_teaching_targets:", tgtRes.error);
      if (ctRes.error) console.error("get_my_class_teachers:", ctRes.error);
      const ct: Record<string, string> = {};
      (ctRes.data || []).forEach((r: any) => {
        if (r.proctor_user_id) ct[r.batch_id] = r.proctor_user_id === user.id ? "you" : (r.proctor_name || "—");
      });
      setClassTeachers(ct);

      setSessions((sessRes.data || []).map((r: any): SessionTarget => ({
        batchId: r.batch_id, batchName: r.batch_name, sectionName: r.section_name,
        subjectId: r.subject_id, subjectName: r.subject_name, subjectCode: r.subject_code || undefined,
        timetableSlotId: r.timetable_slot_id, sessionId: r.session_id,
        studentCount: Number(r.student_count) || 0,
        timeSlot: r.start_time ? String(r.start_time).slice(0, 5) : undefined,
        room: r.room || undefined, isMarked: r.is_marked, isMine: true,
      })));

      setAssigns((tgtRes.data || []).map((r: any): SessionTarget => ({
        batchId: r.batch_id, batchName: r.batch_name, sectionName: r.section_name,
        subjectId: r.subject_id, subjectName: r.subject_name, subjectCode: r.subject_code || undefined,
        studentCount: Number(r.student_count) || 0, isMine: !!r.is_mine,
      })));
    } catch (e) { console.error(e); toast("Failed to load", "error"); }
    setLoading(false);
  }, [user?.id, date, toast]);

  useEffect(() => { load(); }, [load]);

  const batches = useMemo(() => {
    const m = new Map<string, { nm: string; mine: boolean }>();
    assigns.forEach(a => {
      const cur = m.get(a.batchId);
      if (!cur) m.set(a.batchId, { nm: classLabel(a), mine: !!a.isMine });
      else if (a.isMine) cur.mine = true;
    });
    return Array.from(m, ([id, v]) => ({ id, ...v }));
  }, [assigns]);
  const myBatches = useMemo(() => batches.filter(b => b.mine), [batches]);
  const otherBatches = useMemo(() => batches.filter(b => !b.mine), [batches]);
  const isFuture = toDateStr(date) > toDateStr(new Date());
  const myCount = useMemo(() => assigns.filter(a => a.isMine).length, [assigns]);

  const subjects = useMemo(() => assigns.filter(a => a.batchId === pickBatch), [assigns, pickBatch]);

  // Auto-select subject if batch only has one subject
  useEffect(() => {
    if (pickBatch && subjects.length === 1 && (!pickSubj || pickSubj !== subjects[0].subjectId)) {
      setPickSubj(subjects[0].subjectId);
    }
  }, [pickBatch, subjects, pickSubj]);

  // ── Open session ──
  const open = useCallback(async (t: SessionTarget) => {
    setSelected(t); setStudents([]); setDirty(false); setSearch(""); setFilter("all"); setLastSaved(null); setLoadingSheet(true);
    try {
      const ds = toDateStr(date);
      const { data: stu } = await supabase.from("students").select("id, name, roll_no")
        .eq("batch_id", t.batchId).eq("is_active", true).order("roll_no");
      if (!stu?.length) { toast(`${classLabel(t)} has no students`, "info"); setOriginal([]); setLoadingSheet(false); return; }

      let sid = t.sessionId ?? null;
      if (!sid) {
        const { data: s } = await supabase.from("class_sessions").select("id")
          .eq("batch_id", t.batchId).eq("subject_id", t.subjectId).eq("session_date", ds)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        sid = s?.id ?? null;
      }
      const saved: Record<string, Status> = {};
      if (sid) {
        const { data: recs } = await supabase.from("attendance_records").select("student_id, status").eq("session_id", sid);
        recs?.forEach((r: any) => { saved[r.student_id] = r.status as Status; });
      }

      const pctMap: Record<string, number> = {};
      try {
        const { data: mon } = await supabase.rpc("get_monthly_attendance", {
          p_batch_id: t.batchId, p_month: date.getMonth() + 1, p_year: date.getFullYear(), p_subject_id: t.subjectId,
        });
        mon?.forEach((m: any) => { pctMap[m.student_id] = Number(m.percentage) || 0; });
      } catch {}

      const loaded: Student[] = stu.map((s: any) => ({
        id: s.id, name: s.name, rollNo: s.roll_no || undefined,
        status: saved[s.id] || "present", pct: pctMap[s.id] ?? 0,
      }));
      setStudents(loaded); setOriginal(JSON.parse(JSON.stringify(loaded)));
      if (sid) setSelected(prev => (prev ? { ...prev, sessionId: sid } : prev));
      toast(`${classLabel(t)} · ${t.subjectName} — ${loaded.length} students${sid && Object.keys(saved).length ? " (previously marked)" : ""}`, "info");
    } catch (e: any) { console.error(e); toast("Failed to load students", "error"); }
    setLoadingSheet(false);
  }, [date, user?.id, toast]);

  const openManual = useCallback(() => {
    const t = assigns.find(a => a.batchId === pickBatch && a.subjectId === pickSubj);
    if (!t) { toast("Pick batch & subject first", "info"); return; }
    open(t);
  }, [assigns, pickBatch, pickSubj, open, toast]);

  const back = useCallback(() => {
    if (dirty) { setConfirm({ title: "Discard changes?", msg: "Unsaved attendance will be lost.", ok: "Discard", warn: true, fn: () => { setSelected(null); setDirty(false); } }); }
    else { setSelected(null); load(); }
  }, [dirty, load]);

  const mark = useCallback((id: string, st: Status) => { setStudents(p => p.map(s => s.id === id ? { ...s, status: st } : s)); setDirty(true); }, []);

  const markAll = useCallback(() => {
    setConfirm({ title: "Mark all present?", msg: `All ${students.length} students will be marked present.`, ok: "Mark All", warn: false,
      fn: () => { setStudents(p => p.map(s => ({ ...s, status: "present" as Status }))); setDirty(true); toast("All marked present"); }
    });
  }, [students.length, toast]);

  const undo = useCallback(() => { if (original.length) { setStudents(JSON.parse(JSON.stringify(original))); setDirty(false); toast("Reverted", "info"); } }, [original, toast]);

  const save = useCallback(async () => {
    if (!selected || !instId) return;
    if (isFuture) { toast("Can't mark attendance for a future date", "error"); return; }
    setSaving(true);
    try {
      const { data: sid, error } = await supabase.rpc("save_class_attendance", {
        p_institute_id: instId,
        p_batch_id: selected.batchId,
        p_subject_id: selected.subjectId,
        p_date: toDateStr(date),
        p_timetable_slot_id: selected.timetableSlotId ?? null,
        p_session_id: selected.sessionId ?? null,
        p_records: students.map(s => ({ student_id: s.id, status: s.status })),
      });
      if (error) throw new Error(error.message);

      setSelected(prev => (prev ? { ...prev, sessionId: sid as string, isMarked: true } : prev));
      setOriginal(JSON.parse(JSON.stringify(students))); setDirty(false);
      setLastSaved(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      const ctName = classTeachers[selected.batchId];
      toast(`Saved — ${selected.subjectName} · ${classLabel(selected)}${ctName && ctName !== "you" ? ` · sent to ${ctName}` : ""}`);
    } catch (e: any) { toast(e.message || "Save failed", "error"); }
    setSaving(false);
  }, [students, selected, instId, date, isFuture, toast, classTeachers]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!selected) return;
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); if (dirty && !saving && !isFuture) save(); }
      if (e.key === "Escape") back();
      if ((e.ctrlKey || e.metaKey) && e.key === "f") { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [selected, dirty, saving, isFuture, save, back]);

  // Calendar
  const calDays = useMemo(() => {
    const first = new Date(calY, calM, 1);
    const last = new Date(calY, calM + 1, 0);
    const pad = first.getDay();
    const cells: (number | null)[] = Array(pad).fill(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(d);
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [calM, calY]);

  const isToday = (d: number) => { const n = new Date(); return d === n.getDate() && calM === n.getMonth() && calY === n.getFullYear(); };
  const isSel = (d: number) => d === date.getDate() && calM === date.getMonth() && calY === date.getFullYear();

  // Filtered students
  const filtered = useMemo(() => {
    let f = students;
    if (filter !== "all") f = f.filter(s => s.status === filter);
    if (search.trim()) { const q = search.toLowerCase(); f = f.filter(s => s.name.toLowerCase().includes(q)); }
    return f;
  }, [students, filter, search]);

  const pCount = useMemo(() => students.filter(s => s.status === "present").length, [students]);
  const aCount = useMemo(() => students.filter(s => s.status === "absent").length, [students]);
  const lCount = useMemo(() => students.filter(s => s.status === "leave").length, [students]);
  const pct = students.length ? Math.round((pCount / students.length) * 100) : 0;
  const changed = useMemo(() => dirty ? students.reduce((a, s, i) => s.status !== original[i]?.status ? a + 1 : a, 0) : 0, [students, original, dirty]);

  /* ═══ CSS (injected once) ═══ */
  const css = `
    @keyframes popIn{from{opacity:0;transform:scale(.96) translateY(6px)}to{opacity:1;transform:none}}
    @keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:none}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
    .glass{background:rgba(255,255,255,.65);border:1px solid rgba(255,255,255,.3);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
    .dark .glass{background:rgba(15,23,42,.65);border-color:rgba(255,255,255,.06)}
    .pill{background:rgba(0,0,0,.04)}.dark .pill{background:rgba(255,255,255,.06)}
  `;

  /* ═══ LANDING ═══ */
  if (!selected) {
    return (
      <>
        <style>{css}</style>
        <Toasts items={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />
        <div className="space-y-4 sm:space-y-6 animate-[popIn_.3s_ease-out]">

          {/* Teacher info (compact on mobile) */}
          <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex items-center gap-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white font-black text-xl sm:text-2xl shrink-0"
              style={{ background: "linear-gradient(135deg, var(--theme-start, #3b82f6), var(--theme-end, #8b5cf6))" }}>
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">{name}</h3>
              <p className="text-xs text-slate-500 font-medium">{loading ? "Loading…" : `${myCount} assigned class${myCount !== 1 ? "es" : ""} · ${sessions.length} on this day`}</p>
            </div>
          </div>

          {/* Calendar */}
          <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <span className="text-slate-400"><Icon.Calendar /></span> {MONTHS[calM]} {calY}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => { if (calM === 0) { setCalM(11); setCalY(calY - 1); } else { setCalM(calM - 1); } }}
                  className="p-2 rounded-xl pill active:scale-90 touch-manipulation"><Icon.ChevL /></button>
                <button onClick={() => { if (calM === 11) { setCalM(0); setCalY(calY + 1); } else { setCalM(calM + 1); } }}
                  className="p-2 rounded-xl pill active:scale-90 touch-manipulation"><Icon.ChevR /></button>
                <button onClick={() => { setCalM(new Date().getMonth()); setCalY(new Date().getFullYear()); setDate(new Date()); }}
                  className="ml-1 px-2.5 py-1.5 rounded-lg pill text-[11px] font-bold text-slate-500 active:scale-95 touch-manipulation">Today</button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {DAYS.map((d, i) => <div key={i} className="text-[10px] font-bold text-slate-400 py-1">{d}</div>)}
              {calDays.map((d, i) => {
                if (d === null) return <div key={i} className="h-9" />;
                const sel = isSel(d); const tdy = isToday(d);
                return (
                  <button key={i} onClick={() => setDate(new Date(calY, calM, d))}
                    className={`h-9 rounded-lg text-[13px] font-bold transition-all active:scale-90 touch-manipulation ${
                      sel ? "text-white shadow-md" : tdy ? "pill ring-1 ring-blue-400 text-blue-600 dark:text-blue-400"
                      : "text-slate-600 dark:text-slate-300 active:bg-slate-100 dark:active:bg-slate-800"
                    }`}
                    style={sel ? { background: "linear-gradient(135deg, var(--theme-start, #3b82f6), var(--theme-end, #8b5cf6))" } : undefined}>
                    {d}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 pill rounded-xl px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300">
              {DAYS_FULL[date.getDay()]}, {date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </div>
          </div>

          {/* Today's scheduled classes */}
          <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">{toDateStr(date) === toDateStr(new Date()) ? "Today's classes" : "Classes on this day"}</h3>
              <span className="text-[11px] font-bold text-slate-400 pill px-3 py-1.5 rounded-full">{sessions.length} scheduled</span>
            </div>
            {loading ? <p className="py-6 text-center text-slate-400 text-sm font-medium">Loading…</p>
            : sessions.length === 0 ? <p className="py-4 text-center text-slate-400 text-sm">No timetable classes{assigns.length ? ". Use manual pick below." : "."}</p>
            : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sessions.map((s, i) => (
                  <button key={s.sessionId || i} onClick={() => open(s)}
                    className="glass rounded-2xl p-4 text-left active:scale-[0.98] touch-manipulation transition-transform">
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-[11px] shrink-0"
                        style={{ background: "linear-gradient(135deg, var(--theme-start, #3b82f6), var(--theme-end, #8b5cf6))" }}>
                        {s.subjectCode?.slice(0, 3) || s.subjectName.slice(0, 2).toUpperCase()}
                      </div>
                      {s.isMarked
                        ? <span className="text-[10px] font-bold text-emerald-600 pill px-2 py-1 rounded-full flex items-center gap-1"><Icon.Check /> Done</span>
                        : <span className="text-[10px] font-bold text-amber-600 pill px-2 py-1 rounded-full">Pending</span>}
                    </div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white truncate">{s.subjectName}</h4>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{classLabel(s)}{s.room ? ` · ${s.room}` : ""}</p>
                    {classTeachers[s.batchId] && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">Class teacher: <b className="text-slate-500">{classTeachers[s.batchId]}</b></p>
                    )}
                    <div className="flex gap-3 mt-2 text-[11px] text-slate-400 font-medium">
                      {s.timeSlot && <span className="flex items-center gap-1"><Icon.Clock />{s.timeSlot}</span>}
                      <span className="flex items-center gap-1"><Icon.Users />{s.studentCount}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Manual pick */}
          <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mb-1">Mark a class</h3>
            <p className="text-xs text-slate-500 mb-3">
              {isFuture ? "Future date — you can view, but not mark." : "Only classes assigned to you are listed."}
            </p>
            {!loading && assigns.length === 0 ? (
              <div className="pill rounded-xl px-4 py-4 text-center">
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No classes assigned to you yet</p>
                <p className="text-xs text-slate-400 mt-1">Ask your HOD to assign you a subject in a section.</p>
              </div>
            ) : (
            <div className="flex flex-col sm:flex-row gap-2.5">
              <select value={pickBatch} onChange={e => { setPickBatch(e.target.value); setPickSubj(""); }}
                className="pill rounded-xl px-3 py-3 text-sm font-bold text-slate-700 dark:text-white bg-transparent outline-none flex-1 min-w-0">
                <option value="">Section / batch…</option>
                {otherBatches.length === 0
                  ? myBatches.map(b => <option key={b.id} value={b.id}>{b.nm}</option>)
                  : <>
                      {myBatches.length > 0 && <optgroup label="My classes">{myBatches.map(b => <option key={b.id} value={b.id}>{b.nm}</option>)}</optgroup>}
                      <optgroup label="Other classes (HOD / admin access)">{otherBatches.map(b => <option key={b.id} value={b.id}>{b.nm}</option>)}</optgroup>
                    </>}
              </select>
              <select value={pickSubj} onChange={e => setPickSubj(e.target.value)} disabled={!pickBatch}
                className="pill rounded-xl px-3 py-3 text-sm font-bold text-slate-700 dark:text-white bg-transparent outline-none flex-1 min-w-0 disabled:opacity-40">
                <option value="">Subject…</option>
                {subjects.map(s => <option key={s.subjectId} value={s.subjectId}>{s.subjectName}{s.subjectCode ? ` (${s.subjectCode})` : ""}</option>)}
              </select>
              <button onClick={openManual} disabled={!pickBatch || !pickSubj}
                className="rounded-xl px-5 py-3 text-sm font-bold text-white active:scale-95 disabled:opacity-40 touch-manipulation shrink-0"
                style={{ background: "linear-gradient(135deg, var(--theme-start, #3b82f6), var(--theme-end, #8b5cf6))" }}>
                Open →
              </button>
            </div>
            )}
          </div>
        </div>
      </>
    );
  }

  /* ═══ ATTENDANCE SHEET ═══ */
  return (
    <>
      <style>{css}</style>
      <Toasts items={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />
      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onOk={() => confirm?.fn()} title={confirm?.title || ""} msg={confirm?.msg || ""} ok={confirm?.ok} warn={confirm?.warn} />

      <div className="space-y-4 sm:space-y-6 animate-[popIn_.25s_ease-out]">
        {/* Header — sticky on mobile */}
        <div className="sticky top-0 z-20 -mx-2 px-2 py-2 backdrop-blur-xl bg-white/70 dark:bg-slate-950/70 sm:static sm:mx-0 sm:px-0 sm:py-0 sm:backdrop-blur-none sm:bg-transparent rounded-b-2xl sm:rounded-none">
          <div className="flex items-start gap-2">
            <button onClick={back} className="p-2 rounded-xl pill text-slate-600 dark:text-slate-300 active:scale-90 touch-manipulation shrink-0 mt-0.5"><Icon.Back /></button>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white truncate">
                {selected.subjectName} <span className="text-slate-400 font-bold text-sm">· {classLabel(selected)}</span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                {DAYS_FULL[date.getDay()]}, {date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {students.length} students
                {selected.timeSlot && ` · ${selected.timeSlot}`}
                {classTeachers[selected.batchId] && ` · Class teacher: ${classTeachers[selected.batchId]}`}
              </p>
            </div>
          </div>
          {/* Action buttons — horizontal scroll on mobile */}
          <div className="flex items-center justify-between sm:justify-start gap-1.5 mt-3 sm:mt-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
            <button onClick={undo} disabled={!dirty} className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 sm:py-2 rounded-xl pill font-bold text-xs sm:text-sm text-slate-600 dark:text-slate-300 disabled:opacity-30 active:scale-95 touch-manipulation"><Icon.Undo /><span>Undo</span></button>
            <button onClick={markAll} className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 sm:py-2 rounded-xl pill font-bold text-xs sm:text-sm text-slate-600 dark:text-slate-300 active:scale-95 touch-manipulation"><Icon.Check /><span>All P</span></button>
            <button onClick={save} disabled={!dirty || saving || isFuture}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 sm:py-2 rounded-xl font-bold text-xs sm:text-sm text-white disabled:opacity-30 active:scale-95 touch-manipulation sm:ml-auto"
              style={{ background: "linear-gradient(135deg, var(--theme-start, #3b82f6), var(--theme-end, #8b5cf6))" }}>
              {saving ? <Icon.Spin /> : <Icon.Save />}{saving ? "Saving…" : "Save"}
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-bold">
            <span className={`w-1.5 h-1.5 rounded-full ${saving ? "bg-amber-500" : lastSaved ? "bg-emerald-500" : dirty ? "bg-amber-500" : "bg-slate-300"}`} />
            <span className={saving ? "text-amber-600" : lastSaved ? "text-emerald-600" : dirty ? "text-amber-600" : "text-slate-400"}>
              {saving ? "Saving…" : lastSaved ? `Saved ${lastSaved}` : dirty ? `${changed} changed` : "Saved"}
            </span>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "P", val: pCount, color: "text-emerald-600" },
            { label: "A", val: aCount, color: "text-red-600" },
            { label: "L", val: lCount, color: "text-blue-600" },
            { label: "%", val: `${pct}`, color: "text-slate-800 dark:text-white" },
          ].map((s, i) => (
            <div key={i} className="glass rounded-2xl p-3 text-center">
              <span className={`text-xl sm:text-2xl font-black tabular-nums ${s.color}`}>{s.val}</span>
              <span className="block text-[9px] font-bold text-slate-400 uppercase mt-0.5">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2 pill rounded-xl px-3 py-2.5 flex-1 min-w-0">
            <Icon.Search />
            <input ref={searchRef} type="search" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
              className="bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-white placeholder-slate-400 w-full min-w-0" />
            {search && <button onClick={() => setSearch("")} className="text-slate-400 active:text-slate-600 touch-manipulation p-0.5"><Icon.X /></button>}
          </div>
          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-0.5">
            {(["all", "present", "absent", "leave"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-lg text-[12px] font-bold whitespace-nowrap shrink-0 active:scale-95 touch-manipulation ${
                  filter === f ? "text-white shadow-sm" : "pill text-slate-500"
                }`}
                style={filter === f ? { background: "linear-gradient(135deg, var(--theme-start, #3b82f6), var(--theme-end, #8b5cf6))" } : undefined}>
                {f === "all" ? "All" : STATUS_CFG[f].full}
              </button>
            ))}
          </div>
        </div>

        {/* Student list */}
        <div className="space-y-2">
          {loadingSheet ? <p className="py-8 text-center text-slate-400 text-sm font-medium">Loading students…</p>
          : filtered.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-slate-400 font-bold text-sm">No students found</p>
              <p className="text-slate-400 text-xs mt-1">Adjust search or filter</p>
            </div>
          ) : filtered.map(s => (
            <StudentCard key={s.id} s={s} idx={students.indexOf(s)} onMark={mark} />
          ))}
        </div>

        {/* Attendance bar */}
        {students.length > 0 && (
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">Present rate</span>
              <span className="text-xs font-black text-slate-800 dark:text-white tabular-nums">{pct}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${(pCount / students.length) * 100}%` }} />
              <div className="h-full bg-blue-500 transition-[width] duration-300" style={{ width: `${(lCount / students.length) * 100}%` }} />
              <div className="h-full bg-red-500 transition-[width] duration-300" style={{ width: `${(aCount / students.length) * 100}%` }} />
            </div>
            <div className="flex gap-4 mt-2.5 text-[11px] font-bold text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />Present: {pCount}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />Leave: {lCount}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Absent: {aCount}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}