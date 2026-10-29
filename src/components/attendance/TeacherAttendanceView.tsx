// src/components/attendance/TeacherAttendanceView.tsx
// Mobile-first teacher attendance — session-based schema
// Flow: Date + the day's classes / Manual pick → Attendance sheet → Save via save_class_attendance() RPC
//
// ACCESS (enforced server-side in attendance_access.sql):
//   Teacher → only the (batch, subject) pairs assigned to them (teaching_assignments / timetable_slots)
//   HOD     → + every class in their department     Admin/owner → + every class in the institute
//   Legacy subject-named batches (no section) are hidden in 'full' hierarchy institutes.
//
// SAVE STATE (what the teacher is told must match the server):
//   • A class with no saved marks opens with everyone on Present. That is a starting point, not a record:
//     it says "Not saved yet" and Save is enabled until the server confirms.
//   • If saved marks can't be loaded, the sheet does not open (it would show everyone Present and a save
//     would overwrite the real marks).
//   • A failed save stays on screen until the next save works.

import React, { useState, useMemo, useCallback, useEffect, memo, useRef } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/* ───── TYPES ───── */
type Status = "present" | "absent" | "leave";

interface Student {
  id: string;
  name: string;
  rollNo?: string;
  status: Status;
  /** this month's %, only when the server returned one */
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
const STATUS_CFG: Record<Status, { short: string; full: string; on: string; edge: string }> = {
  present: { short: "P", full: "Present", on: "bg-emerald-600 text-white border-emerald-600", edge: "border-l-transparent" },
  absent:  { short: "A", full: "Absent",  on: "bg-red-600 text-white border-red-600",         edge: "border-l-red-500" },
  leave:   { short: "L", full: "Leave",   on: "bg-blue-600 text-white border-blue-600",       edge: "border-l-blue-500" },
};
const STATUSES: Status[] = ["present", "absent", "leave"];

const LOAD_ERROR = "Couldn't load your classes. Check your connection and try again.";
const SHEET_ERROR = "Couldn't load this class. Nothing was changed. Try again.";

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const fromDateStr = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

const CARD = "rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-slate-900";
const BTN_PRIMARY = "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#111111] px-4 text-sm font-semibold text-white hover:bg-[#222222] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-[#111111] dark:hover:bg-gray-200";
const BTN_SECONDARY = "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-[#1B1B1B] hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2 dark:focus-visible:ring-white";

/* ───── INLINE SVG ICONS ───── */
const Icon = {
  Back: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>,
  ChevL: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>,
  ChevR: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>,
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Spin: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  X: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

// The teacher dashboard's own header is sticky below 1024 px (TeacherDashboardPage <main> > … > <header>).
// The sheet header sticks just under it instead of sliding behind it. 0 when that header isn't sticky or isn't found.
function useStickyOffset(ref: React.RefObject<HTMLElement>, active: boolean) {
  const [top, setTop] = useState(0);
  useEffect(() => {
    if (!active) return;
    const header = ref.current?.closest("main")?.querySelector("header") as HTMLElement | null;
    if (!header) return;
    const update = () => setTop(getComputedStyle(header).position === "sticky" ? header.offsetHeight : 0);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(header);
    window.addEventListener("resize", update);
    return () => { ro.disconnect(); window.removeEventListener("resize", update); };
  }, [ref, active]);
  return top;
}

/* ───── STUDENT ROW ───── */
const StudentRow = memo(({ s, n, onMark }: { s: Student; n: number; onMark: (id: string, st: Status) => void }) => (
  <li className={`flex items-center gap-3 border-l-4 px-3 py-2.5 sm:px-4 ${STATUS_CFG[s.status].edge}`}>
    <span className="w-6 shrink-0 text-right text-xs font-medium tabular-nums text-gray-400">{n}</span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-[#1B1B1B] dark:text-white">{s.name}</p>
      <p className="truncate text-xs text-gray-500 dark:text-slate-400">
        {s.rollNo || "No roll no."}
        {s.pct !== undefined && <> · {s.pct}% this month</>}
      </p>
    </div>
    <div role="group" aria-label={`Attendance for ${s.name}`} className="flex shrink-0 gap-1">
      {STATUSES.map(st => {
        const c = STATUS_CFG[st];
        const active = s.status === st;
        return (
          <button key={st} type="button" onClick={() => onMark(s.id, st)} aria-pressed={active} aria-label={c.full}
            className={`h-11 min-w-[44px] rounded-lg border px-2 text-sm font-semibold touch-manipulation select-none sm:min-w-[76px] ${FOCUS} ${
              active ? c.on : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400"
            }`}>
            <span className="sm:hidden">{c.short}</span>
            <span className="hidden sm:inline">{c.full}</span>
          </button>
        );
      })}
    </div>
  </li>
));
StudentRow.displayName = "StudentRow";

/* ═══════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════ */
export default function TeacherAttendanceView() {
  const { user } = useAuth();

  const [selected, setSelected] = useState<SessionTarget | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [original, setOriginal] = useState<Student[]>([]);
  const [date, setDate] = useState(() => new Date());

  const [confirm, setConfirm] = useState<{ title: string; msg: string; ok: string; fn: () => void } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [saving, setSaving] = useState(false);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  /** the server has marks for this class + date */
  const [hasSaved, setHasSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const [instId, setInstId] = useState<string | null>(null);
  const [noInstitute, setNoInstitute] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionTarget[]>([]);
  const [assigns, setAssigns] = useState<SessionTarget[]>([]);
  // batch_id → class teacher (proctor) name, so the teacher knows who receives the marks
  const [classTeachers, setClassTeachers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [pickBatch, setPickBatch] = useState("");
  const [pickSubj, setPickSubj] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const stickyTop = useStickyOffset(sheetRef, !!selected);

  // ── Load data (scope decided by the server from the caller's role) ──
  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setLoadError(null);
    try {
      let targetInstId: string | null = null;

      const { data: mem, error: memErr } = await supabase.from("institute_members")
        .select("institute_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (memErr) throw memErr;

      if (mem?.institute_id) {
        targetInstId = mem.institute_id;
      } else {
        const { data: ownedInst, error: ownErr } = await supabase.from("institutes")
          .select("id").eq("owner_id", user.id).limit(1).maybeSingle();
        if (ownErr) throw ownErr;
        targetInstId = ownedInst?.id ?? null;
      }

      setNoInstitute(!targetInstId);
      if (!targetInstId) { setSessions([]); setAssigns([]); setLoading(false); return; }
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
      // An empty list after a failed call would read as "no classes assigned"; show the failure instead.
      if (sessRes.error) throw sessRes.error;
      if (tgtRes.error) throw tgtRes.error;
      if (ctRes.error) console.error("get_my_class_teachers:", ctRes.error); // names only; the page works without them
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
    } catch (e) {
      console.error("attendance load:", e);
      setLoadError(LOAD_ERROR);
    }
    setLoading(false);
  }, [user?.id, date]);

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
  const todayStr = toDateStr(new Date());
  const isToday = toDateStr(date) === todayStr;
  const isFuture = toDateStr(date) > todayStr;
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
    setSelected(t); setStudents([]); setOriginal([]); setDirty(false); setSearch(""); setFilter("all");
    setLastSaved(null); setSaveError(null); setSheetError(null); setHasSaved(false); setLoadingSheet(true);
    try {
      const ds = toDateStr(date);
      const { data: stu, error: stuErr } = await supabase.from("students").select("id, name, roll_no")
        .eq("batch_id", t.batchId).eq("is_active", true).order("roll_no");
      if (stuErr) throw stuErr;
      if (!stu?.length) { setLoadingSheet(false); return; }

      let sid = t.sessionId ?? null;
      if (!sid) {
        const { data: s, error: sErr } = await supabase.from("class_sessions").select("id")
          .eq("batch_id", t.batchId).eq("subject_id", t.subjectId).eq("session_date", ds)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (sErr) throw sErr;
        sid = s?.id ?? null;
      }
      const saved: Record<string, Status> = {};
      if (sid) {
        // must succeed: without the saved marks everyone would show as Present, and a save would overwrite them
        const { data: recs, error: recErr } = await supabase.from("attendance_records").select("student_id, status").eq("session_id", sid);
        if (recErr) throw recErr;
        recs?.forEach((r: any) => { saved[r.student_id] = r.status as Status; });
      }

      // this month's %: optional, shown only when the server returns it
      const pctMap: Record<string, number> = {};
      try {
        const { data: mon } = await supabase.rpc("get_monthly_attendance", {
          p_batch_id: t.batchId, p_month: date.getMonth() + 1, p_year: date.getFullYear(), p_subject_id: t.subjectId,
        });
        mon?.forEach((m: any) => {
          // the RPC returns 0.00 when no class was held this month: that is "no data", not 0%
          const held = Number(m.total_held), p = Number(m.percentage);
          if (held > 0 && m.percentage !== null && Number.isFinite(p)) pctMap[m.student_id] = Math.round(p);
        });
      } catch { /* the sheet works without it */ }

      const loaded: Student[] = stu.map((s: any) => ({
        id: s.id, name: s.name, rollNo: s.roll_no || undefined,
        status: saved[s.id] || "present", pct: pctMap[s.id],
      }));
      setStudents(loaded); setOriginal(loaded.map(s => ({ ...s })));
      setHasSaved(Object.keys(saved).length > 0);
      if (sid) setSelected(prev => (prev ? { ...prev, sessionId: sid } : prev));
    } catch (e) {
      console.error("attendance sheet:", e);
      setStudents([]);
      setSheetError(SHEET_ERROR);
    }
    setLoadingSheet(false);
  }, [date]);

  const openManual = useCallback(() => {
    const t = assigns.find(a => a.batchId === pickBatch && a.subjectId === pickSubj);
    if (!t) { toast.info("Pick a class and a subject first"); return; }
    open(t);
  }, [assigns, pickBatch, pickSubj, open]);

  const unsaved = dirty || (!hasSaved && students.length > 0 && !sheetError);
  const back = useCallback(() => {
    if (unsaved && !isFuture) {
      setConfirm({
        title: "Leave without saving?",
        msg: "Attendance for this class is not saved. If you leave now, nothing is recorded.",
        ok: "Leave without saving",
        fn: () => { setSelected(null); setDirty(false); load(); },
      });
    } else { setSelected(null); load(); }
  }, [unsaved, isFuture, load]);

  const mark = useCallback((id: string, st: Status) => { setStudents(p => p.map(s => s.id === id ? { ...s, status: st } : s)); setDirty(true); }, []);

  const markAll = useCallback(() => {
    setConfirm({ title: "Mark everyone present?", msg: `All ${students.length} students will be set to Present. You still need to save.`, ok: "Mark all present",
      fn: () => { setStudents(p => p.map(s => ({ ...s, status: "present" as Status }))); setDirty(true); }
    });
  }, [students.length]);

  const undo = useCallback(() => { if (original.length) { setStudents(original.map(s => ({ ...s }))); setDirty(false); } }, [original]);

  const canSave = !!selected && students.length > 0 && !saving && !isFuture && !sheetError && (dirty || !hasSaved);

  const save = useCallback(async () => {
    if (!selected || !instId) return;
    if (isFuture) { setSaveError("You can't mark attendance for a future date."); return; }
    setSaving(true);
    setSaveError(null);
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
      setOriginal(students.map(s => ({ ...s }))); setDirty(false); setHasSaved(true);
      setLastSaved(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      const ctName = classTeachers[selected.batchId];
      toast.success(`Saved: ${selected.subjectName} · ${classLabel(selected)}${ctName && ctName !== "you" ? ` · sent to ${ctName}` : ""}`);
    } catch (e: any) {
      const msg = e?.message || "Save failed";
      setSaveError(msg);
      toast.error("Attendance not saved");
    }
    setSaving(false);
  }, [students, selected, instId, date, isFuture, classTeachers]);

  // Keyboard shortcuts (not while the confirm dialog is open; it handles its own keys)
  useEffect(() => {
    if (!selected || confirm) return;
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); if (canSave) save(); }
      // defaultPrevented: the dialog already used this Escape to close itself (else it would reopen at once)
      if (e.key === "Escape" && !e.defaultPrevented) back();
      if ((e.ctrlKey || e.metaKey) && e.key === "f") { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [selected, confirm, canSave, save, back]);

  // Filtered students
  const filtered = useMemo(() => {
    let f = students;
    if (filter !== "all") f = f.filter(s => s.status === filter);
    if (search.trim()) { const q = search.toLowerCase(); f = f.filter(s => s.name.toLowerCase().includes(q) || (s.rollNo || "").toLowerCase().includes(q)); }
    return f;
  }, [students, filter, search]);
  const position = useMemo(() => new Map(students.map((s, i) => [s.id, i + 1])), [students]);

  const pCount = useMemo(() => students.filter(s => s.status === "present").length, [students]);
  const aCount = useMemo(() => students.filter(s => s.status === "absent").length, [students]);
  const lCount = useMemo(() => students.filter(s => s.status === "leave").length, [students]);
  const pct = students.length ? Math.round((pCount / students.length) * 100) : 0;
  const changed = useMemo(() => dirty ? students.reduce((a, s, i) => s.status !== original[i]?.status ? a + 1 : a, 0) : 0, [students, original, dirty]);

  const confirmDialog = (
    <AlertDialog open={!!confirm} onOpenChange={o => { if (!o) setConfirm(null); }}>
      <AlertDialogContent className="max-w-[calc(100vw-32px)] rounded-2xl sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirm?.msg}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="min-h-[44px] rounded-xl">Cancel</AlertDialogCancel>
          <AlertDialogAction className="min-h-[44px] rounded-xl bg-[#111111] text-white hover:bg-[#222222]"
            onClick={() => { const fn = confirm?.fn; setConfirm(null); fn?.(); }}>
            {confirm?.ok}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  /* ═══ CLASS LIST ═══ */
  if (!selected) {
    const dateLabel = date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
    return (
      <div className="att-root space-y-4 text-[#1B1B1B] dark:text-white">
        {/* Date */}
        <div className={`${CARD} flex items-center gap-2 p-2 sm:p-3`}>
          <button type="button" onClick={() => setDate(d => addDays(d, -1))} aria-label="Previous day" className={`${BTN_SECONDARY} w-11 shrink-0 px-0 ${FOCUS}`}><Icon.ChevL /></button>
          <label className="min-w-0 flex-1 text-center">
            <span className="block truncate text-sm font-semibold">{isToday ? `Today · ${dateLabel}` : dateLabel}</span>
            <input type="date" value={toDateStr(date)} onChange={e => { if (e.target.value) setDate(fromDateStr(e.target.value)); }}
              aria-label="Attendance date"
              className={`mt-0.5 rounded-md bg-transparent text-center text-xs text-gray-500 dark:text-slate-400 ${FOCUS}`} />
          </label>
          <button type="button" onClick={() => setDate(d => addDays(d, 1))} aria-label="Next day" className={`${BTN_SECONDARY} w-11 shrink-0 px-0 ${FOCUS}`}><Icon.ChevR /></button>
          {!isToday && <button type="button" onClick={() => setDate(new Date())} className={`${BTN_SECONDARY} shrink-0 ${FOCUS}`}>Today</button>}
        </div>

        {loadError ? (
          <div role="alert" className={`${CARD} p-4`}>
            <p className="text-sm font-semibold">{loadError}</p>
            <button type="button" onClick={load} className={`${BTN_PRIMARY} mt-3 ${FOCUS}`}>Try again</button>
          </div>
        ) : noInstitute && !loading ? (
          <div className={`${CARD} p-4`}>
            <p className="text-sm font-semibold">You're not part of an institute yet</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Attendance works for classes in an institute. Join yours with the code from your admin or HOD.</p>
            <Link to="/join-institute" className={`${BTN_PRIMARY} mt-3 ${FOCUS}`}>Join an institute</Link>
          </div>
        ) : (
          <>
            {/* The day's classes */}
            <section className={`${CARD} p-3 sm:p-4`} aria-labelledby="att-day-title">
              <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
                <h3 id="att-day-title" className="text-base font-bold">{isToday ? "Today's classes" : "Classes on this day"}</h3>
                {!loading && <span className="text-xs text-gray-500 dark:text-slate-400">{sessions.length} scheduled · {myCount} assigned</span>}
              </div>
              {loading ? <p className="px-1 py-4 text-sm text-gray-500" aria-busy="true">Loading classes…</p>
              : sessions.length === 0 ? (
                <p className="px-1 py-3 text-sm text-gray-500 dark:text-slate-400">
                  No timetable classes on this day.{assigns.length ? " Pick a class below to mark it." : ""}
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-white/5">
                  {sessions.map((s, i) => (
                    <li key={s.sessionId || `${s.batchId}-${s.subjectId}-${i}`}>
                      <button type="button" onClick={() => open(s)}
                        className={`flex w-full items-center gap-3 rounded-xl px-1 py-3 text-left hover:bg-gray-50 dark:hover:bg-slate-800 ${FOCUS}`}>
                        <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-gray-500 dark:text-slate-400">{s.timeSlot || "—"}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{s.subjectName}</span>
                          <span className="block truncate text-xs text-gray-500 dark:text-slate-400">
                            {classLabel(s)}{s.room ? ` · Room ${s.room}` : ""} · {s.studentCount} students
                            {classTeachers[s.batchId] ? ` · Class teacher: ${classTeachers[s.batchId]}` : ""}
                          </span>
                        </span>
                        {s.isMarked
                          ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><Icon.Check />Marked</span>
                          : <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Not marked</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Manual pick */}
            <section className={`${CARD} p-3 sm:p-4`} aria-labelledby="att-pick-title">
              <h3 id="att-pick-title" className="px-1 text-base font-bold">Mark another class</h3>
              <p className="mb-3 mt-0.5 px-1 text-sm text-gray-500 dark:text-slate-400">
                {isFuture ? "Future date: you can open a class, but not mark it." : "Only classes you are allowed to mark are listed."}
              </p>
              {!loading && assigns.length === 0 ? (
                <div className="rounded-xl bg-gray-50 px-4 py-4 dark:bg-slate-800">
                  <p className="text-sm font-semibold">No classes assigned to you yet</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Ask your HOD to assign you a subject in a section.</p>
                </div>
              ) : (
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1">
                  <span className="mb-1 block px-1 text-xs font-semibold text-gray-500 dark:text-slate-400">Class</span>
                  <select value={pickBatch} onChange={e => { setPickBatch(e.target.value); setPickSubj(""); }}
                    className={`min-h-[44px] w-full rounded-xl border border-gray-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900 ${FOCUS}`}>
                    <option value="">Choose a class…</option>
                    {otherBatches.length === 0
                      ? myBatches.map(b => <option key={b.id} value={b.id}>{b.nm}</option>)
                      : <>
                          {myBatches.length > 0 && <optgroup label="My classes">{myBatches.map(b => <option key={b.id} value={b.id}>{b.nm}</option>)}</optgroup>}
                          <optgroup label="Other classes (HOD / admin access)">{otherBatches.map(b => <option key={b.id} value={b.id}>{b.nm}</option>)}</optgroup>
                        </>}
                  </select>
                </label>
                <label className="min-w-0 flex-1">
                  <span className="mb-1 block px-1 text-xs font-semibold text-gray-500 dark:text-slate-400">Subject</span>
                  <select value={pickSubj} onChange={e => setPickSubj(e.target.value)} disabled={!pickBatch}
                    className={`min-h-[44px] w-full rounded-xl border border-gray-200 bg-white px-3 text-sm disabled:opacity-50 dark:border-white/10 dark:bg-slate-900 ${FOCUS}`}>
                    <option value="">Choose a subject…</option>
                    {subjects.map(s => <option key={s.subjectId} value={s.subjectId}>{s.subjectName}{s.subjectCode ? ` (${s.subjectCode})` : ""}</option>)}
                  </select>
                </label>
                <button type="button" onClick={openManual} disabled={!pickBatch || !pickSubj} className={`${BTN_PRIMARY} shrink-0 ${FOCUS}`}>
                  Open class
                </button>
              </div>
              )}
            </section>
          </>
        )}
      </div>
    );
  }

  /* ═══ ATTENDANCE SHEET ═══ */
  const statusLine = saving ? { text: "Saving…", tone: "text-amber-700 dark:text-amber-300" }
    : saveError ? { text: `Not saved: ${saveError.replace(/\.+$/, "")}. Try Save again.`, tone: "text-red-700 dark:text-red-300" }
    : isFuture ? { text: "Future date: view only.", tone: "text-gray-500" }
    : dirty ? { text: `${changed} change${changed === 1 ? "" : "s"} not saved yet`, tone: "text-amber-700 dark:text-amber-300" }
    : !hasSaved ? { text: "Not saved yet. Everyone starts as Present: mark who is absent or on leave, then Save.", tone: "text-amber-700 dark:text-amber-300" }
    : lastSaved ? { text: `Saved at ${lastSaved}`, tone: "text-emerald-700 dark:text-emerald-300" }
    : { text: "Saved earlier. Change marks and save to update.", tone: "text-emerald-700 dark:text-emerald-300" };

  return (
    <>
      {confirmDialog}
      {/* att-sheet: index.css hides the help bubble while this is open (it sat on the P/A/L buttons) */}
      <div ref={sheetRef} className="att-root att-sheet space-y-3 text-[#1B1B1B] dark:text-white">
        {/* Header — sticky at every width so Save stays in reach after scrolling a long class */}
        <div style={{ top: stickyTop }} className="sticky z-20 -mx-2 border-b border-gray-200 bg-white px-2 py-2 dark:border-white/10 dark:bg-slate-950 sm:mx-0 sm:rounded-2xl sm:border sm:p-4 dark:sm:bg-slate-900">
          <div className="flex items-start gap-2">
            <button type="button" onClick={back} aria-label="Back to classes" className={`${BTN_SECONDARY} w-11 shrink-0 px-0 ${FOCUS}`}><Icon.Back /></button>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-bold sm:text-lg">
                {selected.subjectName} <span className="font-semibold text-gray-500 dark:text-slate-400">· {classLabel(selected)}</span>
              </h2>
              <p className="truncate text-xs text-gray-500 dark:text-slate-400">
                {date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · {students.length} students
                {selected.timeSlot && ` · ${selected.timeSlot}`}
                {classTeachers[selected.batchId] && ` · Class teacher: ${classTeachers[selected.batchId]}`}
              </p>
            </div>
          </div>
          {students.length > 0 && (
            <>
              <div className="mt-2 sm:flex sm:items-center sm:gap-2">
                <p className="text-sm tabular-nums sm:mr-auto" aria-label={`${pCount} present, ${aCount} absent, ${lCount} on leave, ${pct} percent present`}>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">{pCount} P</span>
                  <span className="text-gray-300"> · </span>
                  <span className="font-semibold text-red-700 dark:text-red-300">{aCount} A</span>
                  <span className="text-gray-300"> · </span>
                  <span className="font-semibold text-blue-700 dark:text-blue-300">{lCount} L</span>
                  <span className="text-gray-500 dark:text-slate-400"> · {pct}% present</span>
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:mt-0 sm:flex">
                  <button type="button" onClick={undo} disabled={!dirty} className={`${BTN_SECONDARY} ${FOCUS}`}>Undo</button>
                  <button type="button" onClick={markAll} disabled={isFuture} className={`${BTN_SECONDARY} ${FOCUS}`}>All present</button>
                  <button type="button" onClick={save} disabled={!canSave} className={`${BTN_PRIMARY} ${FOCUS}`}>
                    {saving && <Icon.Spin />}{saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
              <p role="status" aria-live="polite" className={`mt-1.5 text-xs font-medium ${statusLine.tone}`}>{statusLine.text}</p>
            </>
          )}
        </div>

        {loadingSheet ? <p className="py-8 text-center text-sm text-gray-500" aria-busy="true">Loading students…</p>
        : sheetError ? (
          <div role="alert" className={`${CARD} p-4`}>
            <p className="text-sm font-semibold">{sheetError}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => open(selected)} className={`${BTN_PRIMARY} ${FOCUS}`}>Try again</button>
              <button type="button" onClick={() => { setSelected(null); load(); }} className={`${BTN_SECONDARY} ${FOCUS}`}>Back to classes</button>
            </div>
          </div>
        ) : students.length === 0 ? (
          <div className={`${CARD} p-4`}>
            <p className="text-sm font-semibold">This class has no active students</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Students are added by your HOD or admin.</p>
          </div>
        ) : (
          <>
            {/* Search + filter */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className={`flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 dark:border-white/10 dark:bg-slate-900`}>
                <span className="text-gray-400"><Icon.Search /></span>
                <input ref={searchRef} type="search" placeholder="Search by name or roll no." aria-label="Search students" value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-gray-400" />
                {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className={`rounded p-1 text-gray-400 ${FOCUS}`}><Icon.X /></button>}
              </label>
              <div role="group" aria-label="Show" className="flex gap-1 overflow-x-auto">
                {(["all", "present", "absent", "leave"] as const).map(f => (
                  <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
                    className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-xl border px-3 text-sm font-semibold ${FOCUS} ${
                      filter === f ? "border-[#111111] bg-[#111111] text-white dark:border-white dark:bg-white dark:text-[#111111]" : "border-gray-200 bg-white text-gray-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
                    }`}>
                    {f === "all" ? `All ${students.length}` : `${STATUS_CFG[f].full} ${f === "present" ? pCount : f === "absent" ? aCount : lCount}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Student list */}
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">No students match. Clear the search or filter.</p>
            ) : (
              <ul className={`${CARD} divide-y divide-gray-100 overflow-hidden dark:divide-white/5`} aria-label="Students">
                {filtered.map(s => <StudentRow key={s.id} s={s} n={position.get(s.id) || 0} onMark={mark} />)}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}
