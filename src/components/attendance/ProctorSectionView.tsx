// src/components/attendance/ProctorSectionView.tsx
// Proctor (class teacher) dashboard — one section, every subject.
//
//   Day      → pick a date (last 14 days), see each class: marked / pending / no class.
//              Tap a class → roster sheet: see marks, correct them (reason required), or
//              mark a pending class on the subject teacher's behalf.
//   Monthly  → students × subjects %, below-75% list, Excel export.
//   Edits    → audit trail of every changed mark (who, old → new, reason).
//
// Used in two places:
//   Teacher dashboard "My Section"   <ProctorSectionView />                       (proctor, can edit)
//   HOD dashboard → section detail   <ProctorSectionView sectionId={id} readOnly embedded />
//
// Server rules (proctor_dashboard.sql): proctor may change marks up to 7 days back, subject
// teacher 2 days, HOD read-only in the UI, admin unlimited. Every change is logged.
//
// Exports: default ProctorSectionView, useProctorCheck

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

/* ───── TYPES ───── */
type Status = "present" | "absent" | "leave";
type DayStatus = "marked" | "pending" | "no_class";
type View = "day" | "monthly" | "edits";

interface ProctorBatch { id: string; name: string; studentCount: number; }

interface SectionCtx {
  name: string; year: number | null; deptName: string; instId: string;
  proctorName: string | null; studentCount: number;
  role: "admin" | "proctor" | "hod";
  canEdit: boolean; windowDays: number | null; today: string;
}

interface DayClass {
  key: string; sessionId: string | null;
  batchId: string; batchName: string;
  subjectId: string; subjectName: string; subjectCode: string;
  teacherName: string; startTime?: string; status: DayStatus;
  present: number; absent: number; leave: number; total: number;
  markedBy: string | null;
}

interface RosterRow {
  studentId: string; name: string; rollNo: string;
  saved: Status | null; status: Status;
  monthHeld: number; monthPresent: number;
}

interface MonthlyCell { held: number; present: number; pct: number; }
interface MonthlyRow {
  studentId: string; name: string; rollNo: string;
  subjects: Record<string, MonthlyCell>;
  held: number; present: number; pct: number;
}

interface EditRow {
  at: string; date: string; subject: string; student: string; rollNo: string;
  from: string | null; to: string; by: string; reason: string | null;
}

/* ───── HELPERS ───── */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LOOKBACK = 14;

const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** "2026-09-28" + n days, timezone-safe */
const addDays = (ds: string, n: number) => {
  const [y, m, d] = ds.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
};
const prettyDate = (ds: string) => {
  const [y, m, d] = ds.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return `${DOW[t.getUTCDay()]}, ${d} ${MONTHS[m - 1].slice(0, 3)}`;
};
const pctColor = (p: number) => (p >= 75 ? "text-emerald-600" : p >= 50 ? "text-amber-600" : "text-red-600");
const byRoll = (a: { rollNo: string }, b: { rollNo: string }) =>
  a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true });

const STATUS_UI: Record<Status, { short: string; on: string }> = {
  present: { short: "P", on: "bg-emerald-500 text-white ring-2 ring-emerald-400/50" },
  absent:  { short: "A", on: "bg-red-500 text-white ring-2 ring-red-400/50" },
  leave:   { short: "L", on: "bg-blue-500 text-white ring-2 ring-blue-400/50" },
};

/* ───── ICONS ───── */
const I = {
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  Clock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  Download: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  Alert: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  L: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>,
  R: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>,
  X: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  Lock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
  Spin: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>,
};

const css = `
  @keyframes pvPop{from{opacity:0;transform:scale(.97) translateY(6px)}to{opacity:1;transform:none}}
  @keyframes pvUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
  @media(prefers-reduced-motion:reduce){.pv *{animation:none!important;transition:none!important}}
  .pv .glass{background:rgba(255,255,255,.7);border:1px solid rgba(0,0,0,.06);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
  .dark .pv .glass{background:rgba(15,23,42,.7);border-color:rgba(255,255,255,.06)}
  .pv .pill{background:rgba(0,0,0,.045)}.dark .pv .pill{background:rgba(255,255,255,.07)}
  .pv .grad{background:linear-gradient(135deg,var(--theme-start,#3b82f6),var(--theme-end,#8b5cf6))}
  .pv .atbl{border-collapse:separate;border-spacing:0}
  .pv .atbl th,.pv .atbl td{border-bottom:1px solid rgba(0,0,0,.06);padding:8px 10px;text-align:center;font-size:12px;white-space:nowrap}
  .dark .pv .atbl th,.dark .pv .atbl td{border-color:rgba(255,255,255,.06)}
  .pv .atbl th{position:sticky;top:0;z-index:2;font-weight:800;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;background:rgba(248,250,252,.97)}
  .dark .pv .atbl th{background:rgba(15,23,42,.97)}
  .pv .atbl td:first-child,.pv .atbl th:first-child{position:sticky;left:0;z-index:3;text-align:left}
  .pv .atbl th:first-child{z-index:4}
  .pv .atbl td:first-child{background:rgba(255,255,255,.97)}
  .dark .pv .atbl td:first-child{background:rgba(15,23,42,.97)}
`;

/* ═══ useProctorCheck — sections the logged-in user proctors ═══ */
export function useProctorCheck() {
  const { user } = useAuth();
  const [isProctor, setIsProctor] = useState(false);
  const [proctorBatches, setProctorBatches] = useState<ProctorBatch[]>([]);
  const [instId, setInstId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const { data: mem } = await supabase
          .from("institute_members").select("institute_id")
          .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
        let iid: string | null = mem?.institute_id ?? null;
        if (!iid) {
          const { data: own } = await supabase.from("institutes").select("id").eq("owner_id", user.id).limit(1).maybeSingle();
          iid = own?.id ?? null;
        }
        if (!iid) return;
        setInstId(iid);
        const { data, error } = await supabase.rpc("get_my_proctor_sections", { p_institute_id: iid });
        if (error) throw error;
        const sections: ProctorBatch[] = (data || []).map((r: any) => ({
          id: r.section_id, name: r.section_name, studentCount: Number(r.student_count) || 0,
        }));
        setProctorBatches(sections);
        setIsProctor(sections.length > 0);
      } catch (e) {
        console.error("useProctorCheck:", e);
      } finally {
        setChecked(true);
      }
    })();
  }, [user?.id]);

  return { isProctor, proctorBatches, proctorSections: proctorBatches, instId, checked };
}

/* ═══ ROSTER SHEET — view / correct / mark one class ═══ */
function RosterSheet({ instId, cls, date, editable, lockReason, onClose, onSaved }: {
  instId: string; cls: DayClass; date: string; editable: boolean; lockReason: string | null;
  onClose: () => void; onSaved: () => void;
}) {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(cls.sessionId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_class_roster", {
        p_batch_id: cls.batchId, p_subject_id: cls.subjectId, p_date: date, p_session_id: cls.sessionId,
      });
      if (error) { toast.error(error.message); setLoading(false); return; }
      const list: RosterRow[] = (data || []).map((r: any) => ({
        studentId: r.student_id, name: r.student_name, rollNo: r.roll_no || "—",
        saved: (r.status as Status) || null, status: (r.status as Status) || "present",
        monthHeld: Number(r.month_held) || 0, monthPresent: Number(r.month_present) || 0,
      }));
      list.sort(byRoll);
      setRows(list);
      setSessionId(data?.[0]?.session_id ?? cls.sessionId);
      setLoading(false);
    })();
  }, [cls, date]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const wasMarked = rows.some(r => r.saved);
  const changed = rows.filter(r => r.saved && r.saved !== r.status);
  const fresh = rows.filter(r => !r.saved);
  const dirty = changed.length > 0 || (fresh.length > 0 && editable);
  const needReason = changed.length > 0;
  const counts = useMemo(() => ({
    p: rows.filter(r => r.status === "present").length,
    a: rows.filter(r => r.status === "absent").length,
    l: rows.filter(r => r.status === "leave").length,
  }), [rows]);

  const setStatus = (id: string, st: Status) => setRows(p => p.map(r => (r.studentId === id ? { ...r, status: st } : r)));
  const allPresent = () => setRows(p => p.map(r => ({ ...r, status: "present" })));

  const save = async () => {
    if (needReason && reason.trim().length < 3) { toast.error("Add a short reason for the correction"); return; }
    setSaving(true);
    const { error } = await supabase.rpc("save_class_attendance", {
      p_institute_id: instId, p_batch_id: cls.batchId, p_subject_id: cls.subjectId, p_date: date,
      p_timetable_slot_id: null, p_session_id: sessionId,
      p_records: rows.map(r => ({ student_id: r.studentId, status: r.status })),
      p_reason: needReason ? reason.trim() : null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(changed.length
      ? `${changed.length} mark${changed.length > 1 ? "s" : ""} corrected · logged`
      : `${cls.subjectName} marked for ${cls.teacherName}`);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 w-full sm:max-w-lg max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl animate-[pvUp_.25s_ease-out]">
        {/* head */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                {cls.subjectName}{cls.subjectCode && <span className="ml-1.5 text-xs font-bold text-slate-400">{cls.subjectCode}</span>}
              </h3>
              <p className="text-xs text-slate-500 font-medium truncate">
                {prettyDate(date)} · {cls.teacherName}{cls.startTime ? ` · ${cls.startTime}` : ""}
                {cls.batchName ? ` · ${cls.batchName}` : ""}
              </p>
            </div>
            <button onClick={onClose} className="p-2 -m-1 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close"><I.X /></button>
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs font-bold flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">{counts.p} P</span>
            <span className="px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">{counts.a} A</span>
            <span className="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">{counts.l} L</span>
            {cls.markedBy && <span className="ml-auto text-[11px] font-medium text-slate-400">Marked by {cls.markedBy}</span>}
          </div>
          {!editable && lockReason && (
            <p className="mt-3 text-[11px] font-semibold text-slate-500 flex items-center gap-1.5"><I.Lock /> {lockReason}</p>
          )}
          {editable && !wasMarked && !loading && (
            <div className="mt-3 flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400">
              <span className="text-[11px] font-semibold">Not marked yet — you're marking on behalf of {cls.teacherName}.</span>
              <button onClick={allPresent} className="text-[11px] font-bold underline shrink-0">All present</button>
            </div>
          )}
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1.5">
          {loading ? (
            <div className="py-10 flex justify-center text-slate-400"><I.Spin /></div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No students in this class.</p>
          ) : rows.map(r => {
            const mp = r.monthHeld ? Math.round((r.monthPresent / r.monthHeld) * 100) : null;
            const isChanged = r.saved && r.saved !== r.status;
            return (
              <div key={r.studentId}
                className={`flex items-center gap-3 p-2.5 rounded-2xl border ${isChanged ? "border-amber-300 bg-amber-50/60 dark:bg-amber-900/10" : "border-slate-100 dark:border-white/5"}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{r.name}</p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {r.rollNo}{mp !== null && <> · <span className={pctColor(mp)}>{mp}% this month</span></>}
                    {isChanged && <span className="text-amber-600 font-bold"> · was {r.saved}</span>}
                  </p>
                </div>
                {editable ? (
                  <div className="flex gap-1 shrink-0">
                    {(["present", "absent", "leave"] as Status[]).map(st => (
                      <button key={st} onClick={() => setStatus(r.studentId, st)} aria-label={st}
                        className={`w-10 h-10 rounded-xl text-sm font-black transition-all active:scale-95 touch-manipulation ${
                          r.status === st ? STATUS_UI[st].on : "pill text-slate-400"}`}>
                        {STATUS_UI[st].short}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className={`w-10 h-10 rounded-xl text-sm font-black flex items-center justify-center shrink-0 ${
                    r.saved ? STATUS_UI[r.saved].on : "pill text-slate-300"}`}>
                    {r.saved ? STATUS_UI[r.saved].short : "–"}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* foot */}
        {editable && !loading && rows.length > 0 && (
          <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-white/5 space-y-2">
            {needReason && (
              <input value={reason} onChange={e => setReason(e.target.value)} maxLength={200}
                placeholder={`Reason for changing ${changed.length} mark${changed.length > 1 ? "s" : ""} (e.g. medical certificate)`}
                className="w-full px-3.5 py-3 rounded-xl text-sm pill outline-none focus:ring-2 focus:ring-amber-400/50 text-slate-800 dark:text-white placeholder:text-slate-400" />
            )}
            <button onClick={save} disabled={saving || !dirty}
              className="grad w-full py-3.5 rounded-2xl text-sm font-bold text-white disabled:opacity-40 active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2">
              {saving && <I.Spin />}
              {saving ? "Saving…" : needReason ? `Save ${changed.length} correction${changed.length > 1 ? "s" : ""}` : wasMarked ? "Save" : "Mark attendance"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ MAIN ═══ */
export default function ProctorSectionView({ sectionId, readOnly = false, embedded = false }: {
  /** Show this section (HOD/admin drill-down). Omit to show the caller's own proctor sections. */
  sectionId?: string;
  /** Hide all edit controls (HOD dashboard). */
  readOnly?: boolean;
  /** Compact header when shown inside another dashboard. */
  embedded?: boolean;
} = {}) {
  const { proctorBatches, checked } = useProctorCheck();
  const sectionList = useMemo<ProctorBatch[]>(
    () => (sectionId ? [{ id: sectionId, name: "", studentCount: 0 }] : proctorBatches),
    [sectionId, proctorBatches]);
  const ready = sectionId ? true : checked;

  const [selId, setSelId] = useState<string | null>(sectionId ?? null);
  const [ctx, setCtx] = useState<SectionCtx | null>(null);
  const [ctxErr, setCtxErr] = useState<string | null>(null);
  const [view, setView] = useState<View>("day");

  // day
  const [date, setDate] = useState<string>(localDate());
  const [classes, setClasses] = useState<DayClass[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [openCls, setOpenCls] = useState<DayClass | null>(null);

  // monthly
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [mRows, setMRows] = useState<MonthlyRow[]>([]);
  const [mCodes, setMCodes] = useState<string[]>([]);
  const [mNames, setMNames] = useState<Record<string, string>>({});
  const [mLoading, setMLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // edits
  const [edits, setEdits] = useState<EditRow[]>([]);
  const [eLoading, setELoading] = useState(false);

  useEffect(() => { if (sectionId) setSelId(sectionId); }, [sectionId]);
  useEffect(() => {
    if (!sectionId && !selId && proctorBatches.length) setSelId(proctorBatches[0].id);
  }, [sectionId, selId, proctorBatches]);

  /* context */
  useEffect(() => {
    if (!selId) return;
    setCtx(null); setCtxErr(null);
    (async () => {
      const { data, error } = await supabase.rpc("get_section_context", { p_section_id: selId });
      if (error || !data?.[0]) { setCtxErr(error?.message || "Section not found"); return; }
      const r = data[0];
      setCtx({
        name: r.section_name, year: r.section_year, deptName: r.department_name, instId: r.institute_id,
        proctorName: r.proctor_name, studentCount: Number(r.student_count) || 0,
        role: r.my_role, canEdit: !!r.can_edit && !readOnly,
        windowDays: r.edit_window_days == null ? null : Number(r.edit_window_days),
        today: r.today || localDate(),
      });
      setDate(r.today || localDate());
    })();
  }, [selId, readOnly]);

  const today = ctx?.today || localDate();
  const minDate = addDays(today, -DAY_LOOKBACK);
  const editOpenFor = useCallback((ds: string) => {
    if (!ctx?.canEdit || ds > today) return false;
    return ctx.windowDays == null || ds >= addDays(today, -ctx.windowDays);
  }, [ctx, today]);
  const lockReasonFor = (ds: string) =>
    readOnly ? "View only" :
    !ctx?.canEdit ? "View only — only the class teacher can correct marks" :
    ds > today ? "Future date" :
    `Edit window closed (${ctx.windowDays} days). Ask your HOD or admin.`;

  /* day */
  const loadDay = useCallback(async () => {
    if (!selId || !ctx) return;
    setDayLoading(true);
    const { data, error } = await supabase.rpc("get_proctor_section_day", { p_section_id: selId, p_date: date });
    if (error) { console.error("get_proctor_section_day:", error); toast.error(error.message); setClasses([]); }
    else setClasses((data || []).map((r: any, i: number): DayClass => ({
      key: r.session_id || `${r.batch_id}_${r.subject_id}_${i}`,
      sessionId: r.session_id, batchId: r.batch_id, batchName: r.batch_name,
      subjectId: r.subject_id, subjectName: r.subject_name, subjectCode: r.subject_code || "",
      teacherName: r.teacher_name || "—",
      startTime: r.start_time ? String(r.start_time).slice(0, 5) : undefined,
      status: r.status as DayStatus,
      present: Number(r.present_count) || 0, absent: Number(r.absent_count) || 0,
      leave: Number(r.leave_count) || 0, total: Number(r.total_students) || 0,
      markedBy: r.marked_by_name ?? null,
    })));
    setDayLoading(false);
  }, [selId, ctx, date]);

  /* monthly */
  const loadMonthly = useCallback(async () => {
    if (!selId || !ctx) return;
    setMLoading(true);
    const { data, error } = await supabase.rpc("get_proctor_section_monthly", { p_section_id: selId, p_month: month, p_year: year });
    if (error) { toast.error(error.message); setMLoading(false); return; }
    const names: Record<string, string> = {};
    const map = new Map<string, MonthlyRow>();
    for (const r of (data || []) as any[]) {
      names[r.subject_code] = r.subject_name;
      if (!map.has(r.student_id)) map.set(r.student_id, {
        studentId: r.student_id, name: r.student_name, rollNo: r.roll_no || "—", subjects: {}, held: 0, present: 0, pct: 0,
      });
      const row = map.get(r.student_id)!;
      const held = Number(r.total_held) || 0, present = Number(r.total_present) || 0;
      row.subjects[r.subject_code] = { held, present, pct: Number(r.percentage) || 0 };
      row.held += held; row.present += present;
    }
    const rows = [...map.values()].map(r => ({ ...r, pct: r.held ? Math.round((r.present / r.held) * 100) : 0 })).sort(byRoll);
    setMRows(rows); setMCodes(Object.keys(names).sort()); setMNames(names);
    setMLoading(false);
  }, [selId, ctx, month, year]);

  /* edits */
  const loadEdits = useCallback(async () => {
    if (!selId || !ctx) return;
    setELoading(true);
    const { data, error } = await supabase.rpc("get_section_edit_log", { p_section_id: selId, p_days: 30 });
    if (error) toast.error(error.message);
    setEdits((data || []).map((r: any): EditRow => ({
      at: r.edited_at, date: r.session_date, subject: r.subject_code || r.subject_name,
      student: r.student_name, rollNo: r.roll_no || "", from: r.old_status, to: r.new_status,
      by: r.edited_by_name || "—", reason: r.reason,
    })));
    setELoading(false);
  }, [selId, ctx]);

  useEffect(() => { if (view === "day") loadDay(); }, [view, loadDay]);
  useEffect(() => { if (view === "monthly") loadMonthly(); }, [view, loadMonthly]);
  useEffect(() => { if (view === "edits") loadEdits(); }, [view, loadEdits]);

  const exportExcel = async () => {
    if (!mRows.length || !ctx) return;
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const head: (string | number)[] = ["S.No", "Roll No", "Student Name"];
      mCodes.forEach(c => head.push(`${c} Held`, `${c} Present`, `${c} %`));
      head.push("Total Held", "Total Present", "Overall %", "Sign");
      const aoa: (string | number)[][] = [head];
      mRows.forEach((r, i) => {
        const row: (string | number)[] = [i + 1, r.rollNo, r.name];
        mCodes.forEach(c => { const x = r.subjects[c]; row.push(x?.held ?? 0, x?.present ?? 0, x?.held ? x.pct : "—"); });
        row.push(r.held, r.present, r.pct, "");
        aoa.push(row);
      });
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = head.map((_, i) => ({ wch: i === 2 ? 24 : i === 1 ? 11 : 8 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${ctx.name} ${MONTHS[month - 1].slice(0, 3)} ${year}`.slice(0, 31));
      XLSX.writeFile(wb, `${ctx.deptName}_${ctx.name}_Attendance_${MONTHS[month - 1]}_${year}.xlsx`.replace(/\s+/g, "_"));
    } catch (e) { console.error(e); toast.error("Export failed"); }
    setExporting(false);
  };

  /* derived */
  const held = classes.filter(c => c.status !== "no_class");
  const notHeld = classes.filter(c => c.status === "no_class");
  const markedN = held.filter(c => c.status === "marked").length;
  const dayTotals = held.reduce((t, c) => ({ p: t.p + c.present, n: t.n + c.present + c.absent + c.leave }), { p: 0, n: 0 });
  const dayPct = dayTotals.n ? Math.round((dayTotals.p / dayTotals.n) * 100) : null;
  const canEditDay = editOpenFor(date);
  const low = mRows.filter(r => r.held > 0 && r.pct < 75);
  const monthAvg = (() => {
    const h = mRows.reduce((n, r) => n + r.held, 0), p = mRows.reduce((n, r) => n + r.present, 0);
    return h ? Math.round((p / h) * 100) : null;
  })();

  /* ───── guards ───── */
  if (!ready) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-slate-300 dark:border-slate-700 border-t-blue-500 rounded-full animate-spin" /></div>;
  }
  if (!sectionId && sectionList.length === 0) {
    return (
      <div className="pv"><style>{css}</style>
        <div className="glass rounded-2xl p-6 text-center">
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">You are not the class teacher of any section</p>
          <p className="text-xs text-slate-400 mt-1">Your HOD assigns class teachers from the department dashboard.</p>
        </div>
      </div>
    );
  }
  if (ctxErr) {
    return <div className="pv"><style>{css}</style><div className="glass rounded-2xl p-6 text-center text-sm text-red-600">{ctxErr}</div></div>;
  }

  const tabBtn = (v: View, label: string) => (
    <button key={v} onClick={() => setView(v)}
      className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all active:scale-[0.97] touch-manipulation ${
        view === v ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"}`}>
      {label}
    </button>
  );

  return (
    <div className="pv space-y-4 sm:space-y-5 animate-[pvPop_.3s_ease-out]">
      <style>{css}</style>

      {/* section switcher (proctor of several sections) */}
      {!sectionId && sectionList.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {sectionList.map(s => (
            <button key={s.id} onClick={() => setSelId(s.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 active:scale-95 touch-manipulation ${
                selId === s.id ? "grad text-white shadow-sm" : "pill text-slate-600 dark:text-slate-300"}`}>
              {s.name} <span className="text-xs opacity-70">({s.studentCount})</span>
            </button>
          ))}
        </div>
      )}

      {/* header */}
      <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-5">
        {!ctx ? (
          <div className="h-12 flex items-center text-slate-400"><I.Spin /></div>
        ) : (
          <>
            {!embedded && (
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white truncate">{ctx.name}</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {ctx.deptName}{ctx.year ? ` · ${ctx.year}` : ""} · {ctx.studentCount} students
                  </p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 ${
                  ctx.canEdit ? "bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400" : "pill text-slate-500"}`}>
                  {ctx.role === "proctor" ? "Class teacher" : ctx.role === "admin" ? "Admin" : "HOD · view only"}
                </span>
              </div>
            )}
            {embedded && (
              <p className="text-xs text-slate-500 font-medium mb-3">
                Class teacher: <b className="text-slate-700 dark:text-slate-200">{ctx.proctorName || "not assigned"}</b>
                {readOnly && <span className="ml-2 inline-flex items-center gap-1 text-slate-400"><I.Lock /> view only</span>}
              </p>
            )}
            <div className="flex gap-1 pill rounded-xl p-1">
              {tabBtn("day", "Day")}{tabBtn("monthly", "Monthly")}{tabBtn("edits", "Edits")}
            </div>
          </>
        )}
      </div>

      {/* ═══ DAY ═══ */}
      {ctx && view === "day" && (
        <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-1">
              <button onClick={() => setDate(d => addDays(d, -1))} disabled={date <= minDate}
                className="p-2 rounded-xl pill text-slate-600 dark:text-slate-300 disabled:opacity-30" aria-label="Previous day"><I.L /></button>
              <div className="px-2 text-center min-w-[110px]">
                <p className="text-sm font-black text-slate-800 dark:text-white">{date === today ? "Today" : prettyDate(date)}</p>
                {date === today && <p className="text-[10px] text-slate-400 font-semibold">{prettyDate(date)}</p>}
              </div>
              <button onClick={() => setDate(d => addDays(d, 1))} disabled={date >= today}
                className="p-2 rounded-xl pill text-slate-600 dark:text-slate-300 disabled:opacity-30" aria-label="Next day"><I.R /></button>
            </div>
            <div className="flex items-center gap-2">
              {date !== today && <button onClick={() => setDate(today)} className="text-xs font-bold text-slate-500 underline">Today</button>}
              <span className="text-xs font-bold pill px-3 py-1.5 rounded-full text-slate-600 dark:text-slate-300">{markedN}/{held.length} marked</span>
            </div>
          </div>

          {dayPct !== null && (
            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              <div className="pill rounded-xl py-2"><p className={`text-lg font-black ${pctColor(dayPct)}`}>{dayPct}%</p><p className="text-[10px] font-bold text-slate-400 uppercase">Present</p></div>
              <div className="pill rounded-xl py-2"><p className="text-lg font-black text-slate-800 dark:text-white">{markedN}</p><p className="text-[10px] font-bold text-slate-400 uppercase">Marked</p></div>
              <div className="pill rounded-xl py-2"><p className={`text-lg font-black ${held.length - markedN ? "text-amber-600" : "text-slate-800 dark:text-white"}`}>{held.length - markedN}</p><p className="text-[10px] font-bold text-slate-400 uppercase">Pending</p></div>
            </div>
          )}

          {dayLoading ? (
            <p className="py-8 text-center text-slate-400 text-sm">Loading…</p>
          ) : classes.length === 0 ? (
            <p className="py-6 text-center text-slate-400 text-sm">No subjects assigned to this section yet. The HOD assigns subject teachers from the department dashboard.</p>
          ) : (
            <div className="space-y-2">
              {held.length === 0 && <p className="py-2 text-center text-slate-400 text-sm">No classes on this day.</p>}
              {held.map(c => {
                const marked = c.status === "marked";
                const pct = marked && c.total ? Math.round((c.present / c.total) * 100) : 0;
                return (
                  <button key={c.key} onClick={() => setOpenCls(c)}
                    className={`w-full text-left rounded-2xl p-3.5 border transition-colors active:scale-[0.99] touch-manipulation ${
                      marked ? "border-emerald-200/70 dark:border-emerald-800/30 bg-emerald-50/40 dark:bg-emerald-950/10 hover:bg-emerald-50"
                             : "border-amber-200/70 dark:border-amber-800/30 bg-amber-50/40 dark:bg-amber-950/10 hover:bg-amber-50"}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-sm text-slate-800 dark:text-white min-w-0 truncate">
                        {c.subjectName}
                        {c.subjectCode && <span className="ml-1.5 text-[10px] font-bold text-slate-400">{c.subjectCode}</span>}
                        {ctx && c.batchName !== ctx.name && <span className="ml-1.5 text-[10px] font-bold text-slate-400">· {c.batchName}</span>}
                      </span>
                      {marked ? (
                        <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 shrink-0"><I.Check /> {pct}%</span>
                      ) : canEditDay ? (
                        <span className="text-[11px] font-bold text-white grad px-2.5 py-1 rounded-lg shrink-0">Mark now</span>
                      ) : (
                        <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1 shrink-0"><I.Clock /> Pending</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                      <span className="truncate">{c.teacherName}</span>
                      {c.startTime && <span>{c.startTime}</span>}
                      {marked && <span className="ml-auto shrink-0">{c.present}P / {c.absent}A{c.leave ? ` / ${c.leave}L` : ""}</span>}
                    </div>
                  </button>
                );
              })}

              {notHeld.length > 0 && (
                <div className="pt-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    No class scheduled{canEditDay ? " · tap to record an extra class" : ""}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {notHeld.map(c => (
                      <button key={c.key} disabled={!canEditDay} onClick={() => setOpenCls(c)}
                        className="pill rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-500 enabled:hover:text-slate-800 dark:enabled:hover:text-white disabled:cursor-default">
                        {canEditDay && "+ "}{c.subjectCode || c.subjectName}<span className="font-medium text-slate-400"> · {c.teacherName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {held.length > 0 && (
                <div className="pt-3">
                  <div className="w-full h-2 pill rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-[width] duration-500" style={{ width: `${(markedN / held.length) * 100}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-1.5 text-center">
                    {markedN === held.length ? "All classes marked ✅" : `${held.length - markedN} pending — tap to see who hasn't marked`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ MONTHLY ═══ */}
      {ctx && view === "monthly" && (
        <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <select value={month} onChange={e => setMonth(Number(e.target.value))}
                className="pill rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 dark:text-white bg-transparent outline-none">
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select value={year} onChange={e => setYear(Number(e.target.value))}
                className="pill rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 dark:text-white bg-transparent outline-none">
                {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button onClick={exportExcel} disabled={!mRows.length || exporting}
              className="grad flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 active:scale-95 touch-manipulation">
              {exporting ? <I.Spin /> : <I.Download />}{exporting ? "Exporting…" : "Excel"}
            </button>
          </div>

          {mLoading ? (
            <p className="py-8 text-center text-slate-400 text-sm">Loading report…</p>
          ) : mRows.length === 0 ? (
            <p className="py-6 text-center text-slate-400 text-sm">No attendance marked in {MONTHS[month - 1]} {year}.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                <div className="pill rounded-xl py-2"><p className={`text-lg font-black ${pctColor(monthAvg ?? 0)}`}>{monthAvg ?? 0}%</p><p className="text-[10px] font-bold text-slate-400 uppercase">Average</p></div>
                <div className="pill rounded-xl py-2"><p className="text-lg font-black text-slate-800 dark:text-white">{mCodes.length}</p><p className="text-[10px] font-bold text-slate-400 uppercase">Subjects</p></div>
                <div className="pill rounded-xl py-2"><p className={`text-lg font-black ${low.length ? "text-red-600" : "text-emerald-600"}`}>{low.length}</p><p className="text-[10px] font-bold text-slate-400 uppercase">Below 75%</p></div>
              </div>
              <div className="overflow-auto max-h-[60vh] rounded-xl border border-slate-200/60 dark:border-white/5">
                <table className="atbl w-full">
                  <thead>
                    <tr>
                      <th className="min-w-[140px]">Student</th>
                      {mCodes.map(c => <th key={c} className="min-w-[60px]" title={mNames[c]}>{c}</th>)}
                      <th className="min-w-[56px]">Overall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mRows.map(r => (
                      <tr key={r.studentId}>
                        <td>
                          <p className="font-bold text-[12px] text-slate-700 dark:text-slate-200 truncate max-w-[130px]">{r.name}</p>
                          <p className="text-[10px] text-slate-400">{r.rollNo}</p>
                        </td>
                        {mCodes.map(c => {
                          const x = r.subjects[c];
                          return (
                            <td key={c}>
                              {x?.held ? (<><span className={`font-bold ${pctColor(x.pct)}`}>{x.pct}%</span><span className="block text-[9px] text-slate-400">{x.present}/{x.held}</span></>)
                                : <span className="text-slate-300">—</span>}
                            </td>
                          );
                        })}
                        <td>
                          <span className={`font-black text-sm ${pctColor(r.pct)}`}>{r.pct}%</span>
                          <span className="block text-[9px] text-slate-400">{r.present}/{r.held}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {low.length > 0 && (
                <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40">
                  <p className="text-xs font-bold text-red-700 dark:text-red-400 flex items-center gap-1.5 mb-1"><I.Alert /> Below 75% overall ({low.length})</p>
                  <p className="text-[11px] text-red-600 dark:text-red-400/80">{low.map(r => `${r.name} (${r.pct}%)`).join(", ")}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══ EDITS ═══ */}
      {ctx && view === "edits" && (
        <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-slate-800 dark:text-white">Changed marks · last 30 days</h4>
            <span className="text-xs font-bold pill px-3 py-1.5 rounded-full text-slate-500">{edits.length}</span>
          </div>
          {eLoading ? (
            <p className="py-8 text-center text-slate-400 text-sm">Loading…</p>
          ) : edits.length === 0 ? (
            <p className="py-6 text-center text-slate-400 text-sm">No marks were changed after being saved.</p>
          ) : (
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
              {edits.map((e, i) => (
                <div key={i} className="p-3 rounded-2xl border border-slate-100 dark:border-white/5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                      {e.student}<span className="ml-1.5 text-[10px] font-medium text-slate-400">{e.rollNo}</span>
                    </span>
                    <span className="text-[11px] font-bold shrink-0">
                      <span className="text-slate-400 line-through">{e.from || "—"}</span>{" → "}
                      <span className={e.to === "present" ? "text-emerald-600" : e.to === "absent" ? "text-red-600" : "text-blue-600"}>{e.to}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    {e.subject} · class of {prettyDate(e.date)} · by {e.by} · {new Date(e.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {e.reason && <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 italic">“{e.reason}”</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {ctx && !embedded && (
        <p className="text-center text-[10px] text-slate-400 font-medium pb-2">
          {ctx.canEdit
            ? `You can correct marks up to ${ctx.windowDays ?? "∞"} days back · every change is logged`
            : "View only · every change is logged"}
        </p>
      )}

      {openCls && ctx && (
        <RosterSheet
          instId={ctx.instId} cls={openCls} date={date}
          editable={canEditDay}
          lockReason={canEditDay ? null : lockReasonFor(date)}
          onClose={() => setOpenCls(null)}
          onSaved={() => { setOpenCls(null); loadDay(); }}
        />
      )}
    </div>
  );
}