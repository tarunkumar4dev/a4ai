// src/components/attendance/ProctorSectionView.tsx
// ──────────────────────────────────────────────────────────────────────
// Proctor (class teacher) dashboard — auto-appears in teacher
// dashboard when logged-in user is proctor of a section (batch).
//
// Features:
//   1. Today's marking status — which subjects marked, which pending
//   2. Monthly attendance table — per student × per subject (real %)
//   3. Edit attendance within 2-day window (auto-audit logged)
//   4. One-click Excel (.xlsx) export (college-ready format)
//
// Usage in teacher dashboard:
//   import ProctorSectionView from "@/components/attendance/ProctorSectionView";
//   ...
//   {activeTab === "section" && <ProctorSectionView />}
//
// To auto-detect proctor status (for showing/hiding the tab):
//   import { useProctorCheck } from "@/components/attendance/ProctorSectionView";
//   const { isProctor, proctorBatches } = useProctorCheck();
//   {isProctor && <Tab>My Section</Tab>}
// ──────────────────────────────────────────────────────────────────────

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  memo,
} from "react";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import * as XLSX from "xlsx";

/* ───── TYPES ───── */
type Status = "present" | "absent" | "late" | "leave";

interface ProctorBatch {
  id: string;
  name: string;
  departmentName?: string;
  studentCount: number;
}

interface SessionStatus {
  sessionId: string;
  subjectName: string;
  subjectCode: string;
  teacherName: string;
  startTime?: string;
  status: string;
  isMarked: boolean;
  presentCount: number;
  absentCount: number;
  totalStudents: number;
}

interface MonthlyRow {
  studentId: string;
  studentName: string;
  rollNo: string;
  subjectName: string;
  subjectCode: string;
  totalHeld: number;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  totalLeave: number;
  percentage: number;
}

interface EditingCell {
  sessionId: string;
  studentId: string;
  studentName: string;
  currentStatus: Status;
}

/* ───── CONSTANTS ───── */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ───── ICONS ───── */
const I = {
  Check: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  Clock: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  Download: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>,
  Users: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  Edit: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>,
  Shield: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  Alert: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>,
  ChevL: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>,
  ChevR: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>,
  Spinner: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>,
  X: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
};

/* ───── TOAST ───── */
type Toast = { id: number; message: string; type?: string };
function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
      {toasts.map(t => (
        <div key={t.id} onClick={() => onDismiss(t.id)}
          style={{ background: t.type === "error" ? "#7F1D1D" : "#1E293B", color: "#fff", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", cursor: "pointer", pointerEvents: "all", maxWidth: 340, display: "flex", alignItems: "center", gap: 8 }}>
          <span>{t.type === "error" ? "⚠️" : t.type === "info" ? "ℹ️" : "✅"}</span>{t.message}
        </div>
      ))}
    </div>
  );
}

/* ───── PROCTOR CHECK HOOK ───── */
// Use in parent to conditionally render the "My Section" tab
export function useProctorCheck() {
  const { user } = useAuth();
  const [proctorBatches, setProctorBatches] = useState<ProctorBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      if (!user?.id) { setLoading(false); return; }
      // Simple query — no join, no is_active filter
      // departments join was causing 400 errors (FK not in Supabase schema cache)
      const { data, error } = await supabase
        .from("batches")
        .select("id, name, department_id")
        .eq("proctor_id", user.id);

      console.log("[useProctorCheck] data:", data, "error:", error);

      if (data && data.length > 0) {
        // Get student counts
        const batchIds = data.map((b: any) => b.id);
        const { data: stuCounts } = await supabase
          .from("students").select("batch_id")
          .in("batch_id", batchIds).eq("is_active", true);
        const countMap: Record<string, number> = {};
        stuCounts?.forEach((s: any) => { countMap[s.batch_id] = (countMap[s.batch_id] || 0) + 1; });

        setProctorBatches(data.map((b: any) => ({
          id: b.id,
          name: b.name,
          departmentName: undefined, // join removed — fetch separately if needed
          studentCount: countMap[b.id] || 0,
        })));
      }
      setLoading(false);
    }
    check();
  }, [user?.id]);

  return { isProctor: proctorBatches.length > 0, proctorBatches, loading };
}


/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function ProctorSectionView() {
  const { user } = useAuth();
  const { proctorBatches, loading: loadingCheck } = useProctorCheck();
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Proctor";

  const [activeBatch, setActiveBatch] = useState<ProctorBatch | null>(null);
  const [todayStatus, setTodayStatus] = useState<SessionStatus[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([]);
  const [loadingToday, setLoadingToday] = useState(false);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  // Edit state
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [editNewStatus, setEditNewStatus] = useState<Status>("present");
  const [editSaving, setEditSaving] = useState(false);

  // Toast
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = React.useRef(0);
  const addToast = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev.slice(-4), { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }, []);

  // Auto-select first batch
  useEffect(() => {
    if (proctorBatches.length > 0 && !activeBatch) {
      setActiveBatch(proctorBatches[0]);
    }
  }, [proctorBatches, activeBatch]);

  // ── Load today's session status ──
  const loadTodayStatus = useCallback(async () => {
    if (!activeBatch) return;
    setLoadingToday(true);
    try {
      const { data, error } = await supabase.rpc("get_proctor_section_status", {
        p_batch_id: activeBatch.id,
      });
      if (error) throw error;
      setTodayStatus((data || []).map((r: any): SessionStatus => ({
        sessionId: r.session_id,
        subjectName: r.subject_name,
        subjectCode: r.subject_code,
        teacherName: r.teacher_name,
        startTime: r.start_time ? String(r.start_time).slice(0, 5) : undefined,
        status: r.status,
        isMarked: r.is_marked,
        presentCount: Number(r.present_count),
        absentCount: Number(r.absent_count),
        totalStudents: Number(r.total_students),
      })));
    } catch (e: any) {
      console.error(e);
      addToast("Failed to load today's status", "error");
    }
    setLoadingToday(false);
  }, [activeBatch, addToast]);

  useEffect(() => { loadTodayStatus(); }, [loadTodayStatus]);

  // ── Load monthly attendance report ──
  const loadMonthlyReport = useCallback(async () => {
    if (!activeBatch) return;
    setLoadingMonthly(true);
    try {
      const { data, error } = await supabase.rpc("get_monthly_attendance", {
        p_batch_id: activeBatch.id,
        p_month: reportMonth,
        p_year: reportYear,
      });
      if (error) throw error;
      setMonthlyData((data || []).map((r: any): MonthlyRow => ({
        studentId: r.student_id,
        studentName: r.student_name,
        rollNo: r.roll_no || "",
        subjectName: r.subject_name,
        subjectCode: r.subject_code,
        totalHeld: Number(r.total_held),
        totalPresent: Number(r.total_present),
        totalAbsent: Number(r.total_absent),
        totalLate: Number(r.total_late),
        totalLeave: Number(r.total_leave),
        percentage: Number(r.percentage),
      })));
    } catch (e: any) {
      console.error(e);
      addToast("Failed to load monthly report", "error");
    }
    setLoadingMonthly(false);
  }, [activeBatch, reportMonth, reportYear, addToast]);

  useEffect(() => { loadMonthlyReport(); }, [loadMonthlyReport]);

  // ── Pivot monthly data: rows = students, columns = subjects ──
  const pivotData = useMemo(() => {
    const subjects = [...new Map(monthlyData.map(r => [r.subjectCode, { name: r.subjectName, code: r.subjectCode }])).values()];
    const students = [...new Map(monthlyData.map(r => [r.studentId, { id: r.studentId, name: r.studentName, rollNo: r.rollNo }])).values()];
    // Sort by roll number
    students.sort((a, b) => (a.rollNo || "").localeCompare(b.rollNo || "", undefined, { numeric: true }));

    const map = new Map<string, MonthlyRow>();
    monthlyData.forEach(r => map.set(`${r.studentId}_${r.subjectCode}`, r));

    return { subjects, students, map };
  }, [monthlyData]);

  // ── Edit attendance ──
  const startEdit = useCallback((sessionId: string, studentId: string, studentName: string, currentStatus: Status) => {
    setEditing({ sessionId, studentId, studentName, currentStatus });
    setEditNewStatus(currentStatus);
  }, []);

  const submitEdit = useCallback(async () => {
    if (!editing) return;
    if (editNewStatus === editing.currentStatus) { setEditing(null); return; }
    setEditSaving(true);
    try {
      const { data, error } = await supabase.rpc("edit_attendance", {
        p_session_id: editing.sessionId,
        p_student_id: editing.studentId,
        p_new_status: editNewStatus,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      addToast(`Updated ${editing.studentName}: ${editing.currentStatus} → ${editNewStatus}`);
      setEditing(null);
      // Refresh data
      loadTodayStatus();
      loadMonthlyReport();
    } catch (e: any) {
      addToast(e.message || "Edit failed", "error");
    }
    setEditSaving(false);
  }, [editing, editNewStatus, addToast, loadTodayStatus, loadMonthlyReport]);

  // ── Excel export ──
  const exportExcel = useCallback(() => {
    if (!activeBatch || pivotData.students.length === 0) {
      addToast("No data to export", "info");
      return;
    }

    const { subjects, students, map } = pivotData;

    // ── Row 1: Section info header (matches MSIT format) ──
    const sectionInfo = [
      `${activeBatch.name}   ${MONTHS[reportMonth - 1]} ${reportYear}`,
    ];

    // ── Row 2: Column headers ──
    // Format: S.No | Roll No | Name | [SubjectCode H | A] per subject | Grand Total H | Grand Total A | % | Sign
    // Matches ECE-I 4th Sem attendance Excel exactly
    const headerRow1: string[] = ["S. No", "Roll no", "Name of the student"];
    const headerRow2: string[] = ["", "", ""];  // subject names row
    const headerRow3: string[] = ["", "", ""];  // H / A labels row

    subjects.forEach(sub => {
      const label = sub.code || sub.name; // prefer code (like BS-02, EEC-206)
      headerRow1.push(label, "");          // merged cell — subject code spans H+A
      headerRow2.push(sub.name.slice(0, 20), "");
      headerRow3.push("H", "A");
    });
    headerRow1.push("Grand Total", "", "%", "Sign");
    headerRow2.push("", "", "", "");
    headerRow3.push("Total H", "Total A", "", "");

    // ── Data rows ──
    // H = sessions held (conducted), A = sessions absent
    // Late → mapped to H (attended) per MSIT convention
    const rows = students.map((stu, idx) => {
      const row: (string | number)[] = [idx + 1, stu.rollNo, stu.name];
      let grandH = 0, grandA = 0;

      subjects.forEach(sub => {
        const d = map.get(`${stu.id}_${sub.code}`);
        const held = d?.totalHeld ?? 0;
        // Absent = only pure absents (Late is treated as H/attended per college norm)
        const absent = d?.totalAbsent ?? 0;
        row.push(held, absent);
        grandH += held;
        grandA += absent;
      });

      const pct = grandH > 0
        ? parseFloat(((grandH - grandA) / grandH * 100).toFixed(2))
        : 0;

      row.push(grandH, grandA, pct, "");
      return row;
    });

    // ── Build sheet ──
    const aoa = [sectionInfo, headerRow1, headerRow2, headerRow3, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Column widths
    const colWidths: { wch: number }[] = [
      { wch: 6 },  // S.No
      { wch: 14 }, // Roll No
      { wch: 26 }, // Name
    ];
    subjects.forEach(() => { colWidths.push({ wch: 6 }, { wch: 6 }); }); // H, A per subject
    colWidths.push({ wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 14 }); // Grand H, A, %, Sign
    ws["!cols"] = colWidths;

    // Merge section info across all columns
    const totalCols = 3 + subjects.length * 2 + 4;
    if (!ws["!merges"]) ws["!merges"] = [];
    ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }); // section header

    const wb = XLSX.utils.book_new();
    const sheetName = `${activeBatch.name} ${MONTHS_SHORT[reportMonth - 1]} ${reportYear}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    XLSX.writeFile(wb, `Attendance_${activeBatch.name}_${MONTHS_SHORT[reportMonth - 1]}_${reportYear}.xlsx`);
    addToast(`Excel exported — matches MSIT proctor format`);
  }, [activeBatch, pivotData, reportMonth, reportYear, addToast]);

  // ── Today's summary counts ──
  const todaySummary = useMemo(() => {
    const total = todayStatus.length;
    const marked = todayStatus.filter(s => s.isMarked).length;
    const pending = total - marked;
    return { total, marked, pending };
  }, [todayStatus]);

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  if (loadingCheck) return <p className="text-center py-10 text-slate-400 font-semibold">Checking proctor status…</p>;
  if (proctorBatches.length === 0) return <p className="text-center py-10 text-slate-400 font-semibold">You are not assigned as proctor for any section.</p>;

  return (
    <>
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes popIn { from { opacity:0; transform:scale(0.96) translateY(6px); } to { opacity:1; transform:scale(1) translateY(0); } }
          @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
          @media (prefers-reduced-motion: reduce) { [class*="animate-"] { animation: none !important; } }
        `
      }} />

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-[popIn_0.28s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Attendance</h3>
              <button onClick={() => setEditing(null)} className="p-1 text-slate-400 hover:text-slate-600"><I.X /></button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1"><strong>{editing.studentName}</strong></p>
            <p className="text-xs text-slate-400 mb-4">Current: <span className="font-bold capitalize">{editing.currentStatus}</span></p>
            <div className="flex gap-2 mb-5">
              {(["present", "absent", "leave"] as Status[]).map(s => (
                <button key={s} onClick={() => setEditNewStatus(s)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    editNewStatus === s
                      ? s === "present" ? "bg-emerald-500 text-white ring-2 ring-emerald-400"
                        : s === "absent" ? "bg-red-500 text-white ring-2 ring-red-400"
                        : "bg-blue-500 text-white ring-2 ring-blue-400"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                  }`}>
                  {s === "present" ? "Present" : s === "absent" ? "Absent" : "Leave"}
                </button>
              ))}
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={submitEdit} disabled={editSaving || editNewStatus === editing.currentStatus}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all"
                style={{ background: "linear-gradient(135deg, var(--theme-start), var(--theme-end))" }}>
                {editSaving ? "Saving…" : "Save change"}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1"><I.Alert /> Change will be logged in audit trail</p>
          </div>
        </div>
      )}

      <div className="space-y-5 sm:space-y-8 animate-[popIn_0.35s_cubic-bezier(0.16,1,0.3,1)]">

        {/* ── Header ── */}
        <div className="glass-panel rounded-[28px] sm:rounded-[40px] lg:rounded-[48px] p-5 sm:p-7 lg:p-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-white shadow-md"
              style={{ background: "linear-gradient(135deg, var(--theme-start), var(--theme-end))" }}>
              <I.Shield />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">My Section</h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">Proctor: {displayName}</p>
            </div>
          </div>

          {/* Batch selector (if proctor of multiple) */}
          {proctorBatches.length > 1 ? (
            <div className="flex gap-2 flex-wrap">
              {proctorBatches.map(b => (
                <button key={b.id} onClick={() => setActiveBatch(b)}
                  className={`px-4 py-2 rounded-2xl text-sm font-bold transition-all ${activeBatch?.id === b.id ? "text-white shadow-sm" : "inset-pill border-none text-slate-600 dark:text-slate-300"}`}
                  style={activeBatch?.id === b.id ? { background: "linear-gradient(135deg, var(--theme-start), var(--theme-end))" } : undefined}>
                  {b.name} ({b.studentCount})
                </button>
              ))}
            </div>
          ) : activeBatch && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inset-pill border-none rounded-2xl px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200">{activeBatch.name}</span>
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1"><I.Users /> {activeBatch.studentCount} students</span>
              {activeBatch.departmentName && (
                <span className="text-xs text-slate-400 font-medium">{activeBatch.departmentName}</span>
              )}
            </div>
          )}
        </div>

        {/* ── Today's Status ── */}
        <div className="glass-panel rounded-[28px] sm:rounded-[40px] lg:rounded-[48px] p-5 sm:p-7 lg:p-8">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">Today's marking status</h3>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${todaySummary.pending > 0 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700" : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700"}`}>
                {todaySummary.pending > 0 ? `${todaySummary.pending} pending` : "All marked ✓"}
              </span>
              <span className="text-[11px] font-bold text-slate-400">{todaySummary.marked}/{todaySummary.total}</span>
            </div>
          </div>

          {loadingToday ? (
            <p className="text-center py-6 text-slate-400 font-semibold flex items-center justify-center gap-2"><I.Spinner /> Loading…</p>
          ) : todayStatus.length === 0 ? (
            <p className="text-center py-6 text-slate-400 font-semibold text-sm">No classes scheduled today for this section.</p>
          ) : (
            <div className="space-y-2.5">
              {todayStatus.map((sess) => {
                const pct = sess.totalStudents > 0 ? Math.round((sess.presentCount / sess.totalStudents) * 100) : 0;
                return (
                  <div key={sess.sessionId}
                    className={`rounded-2xl p-4 border transition-colors ${sess.isMarked ? "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-900/10" : "border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-800 dark:text-white truncate">{sess.subjectName}</h4>
                          <span className="text-[10px] font-bold text-slate-400">{sess.subjectCode}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {sess.teacherName}
                          {sess.startTime && <span className="ml-2 inline-flex items-center gap-0.5"><I.Clock /> {sess.startTime}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {sess.isMarked && (
                          <div className="text-right">
                            <span className={`text-sm font-black ${pct >= 75 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}`}>{pct}%</span>
                            <p className="text-[10px] text-slate-400">{sess.presentCount}/{sess.totalStudents}</p>
                          </div>
                        )}
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${sess.isMarked ? "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30" : "text-amber-600 bg-amber-100 dark:bg-amber-900/30"}`}>
                          {sess.isMarked ? <><I.Check /> Done</> : "Pending"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Monthly Report ── */}
        <div className="glass-panel rounded-[28px] sm:rounded-[40px] lg:rounded-[48px] p-5 sm:p-7 lg:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 sm:mb-6">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">Monthly attendance report</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Month selector */}
              <div className="flex items-center gap-1">
                <button onClick={() => { if (reportMonth === 1) { setReportMonth(12); setReportYear(y => y - 1); } else setReportMonth(m => m - 1); }}
                  className="p-1.5 rounded-lg inset-pill border-none text-slate-500 active:scale-95 touch-manipulation"><I.ChevL /></button>
                <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 min-w-[100px] text-center">
                  {MONTHS[reportMonth - 1]} {reportYear}
                </span>
                <button onClick={() => { if (reportMonth === 12) { setReportMonth(1); setReportYear(y => y + 1); } else setReportMonth(m => m + 1); }}
                  className="p-1.5 rounded-lg inset-pill border-none text-slate-500 active:scale-95 touch-manipulation"><I.ChevR /></button>
              </div>
              {/* Export button */}
              <button onClick={exportExcel}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold text-white active:scale-95 transition-all touch-manipulation"
                style={{ background: "linear-gradient(135deg, var(--theme-start), var(--theme-end))" }}>
                <I.Download /> Export Excel
              </button>
            </div>
          </div>

          {loadingMonthly ? (
            <p className="text-center py-8 text-slate-400 font-semibold flex items-center justify-center gap-2"><I.Spinner /> Loading report…</p>
          ) : pivotData.students.length === 0 ? (
            <p className="text-center py-8 text-slate-400 font-semibold text-sm">No attendance data for {MONTHS[reportMonth - 1]} {reportYear}.</p>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr>
                    <th className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest pb-2.5 pl-2 w-8">#</th>
                    <th className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest pb-2.5">Student</th>
                    {pivotData.subjects.map(sub => (
                      <th key={sub.code} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest pb-2.5 px-1">
                        <span className="block">{sub.code}</span>
                        <span className="block text-[8px] font-medium normal-case text-slate-300">{sub.name.slice(0, 12)}</span>
                      </th>
                    ))}
                    <th className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest pb-2.5 px-1">
                      <span className="block">OVERALL</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pivotData.students.map((stu, idx) => {
                    let totalHeld = 0, totalPresent = 0;
                    return (
                      <tr key={stu.id} className="border-t border-slate-100/80 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="py-2 pl-2 text-xs font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-2">
                          <span className="font-bold text-[13px] text-slate-800 dark:text-white block truncate max-w-[160px]">{stu.name}</span>
                          {stu.rollNo && <span className="text-[10px] text-slate-400">{stu.rollNo}</span>}
                        </td>
                        {pivotData.subjects.map(sub => {
                          const d = pivotData.map.get(`${stu.id}_${sub.code}`);
                          const pct = d?.percentage ?? 0;
                          totalHeld += d?.totalHeld ?? 0;
                          totalPresent += d?.totalPresent ?? 0;
                          return (
                            <td key={sub.code} className="py-2 text-center px-1">
                              <span className={`text-xs font-extrabold ${pct >= 75 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : pct > 0 ? "text-red-600" : "text-slate-300"}`}>
                                {d && d.totalHeld > 0 ? `${pct}%` : "—"}
                              </span>
                              {d && d.totalHeld > 0 && (
                                <span className="block text-[9px] text-slate-400">{d.totalPresent}/{d.totalHeld}</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2 text-center px-1">
                          {(() => {
                            const overallPct = totalHeld > 0 ? Math.round((totalPresent / totalHeld) * 100) : 0;
                            return (
                              <>
                                <span className={`text-xs font-black ${overallPct >= 75 ? "text-emerald-600" : overallPct >= 50 ? "text-amber-600" : overallPct > 0 ? "text-red-600" : "text-slate-300"}`}>
                                  {totalHeld > 0 ? `${overallPct}%` : "—"}
                                </span>
                                {totalHeld > 0 && (
                                  <span className="block text-[9px] text-slate-400">{totalPresent}/{totalHeld}</span>
                                )}
                              </>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Low attendance warning */}
              {(() => {
                const lowAttendance = pivotData.students.filter(stu => {
                  let held = 0, present = 0;
                  pivotData.subjects.forEach(sub => {
                    const d = pivotData.map.get(`${stu.id}_${sub.code}`);
                    held += d?.totalHeld ?? 0;
                    present += d?.totalPresent ?? 0;
                  });
                  return held > 0 && (present / held) * 100 < 75;
                });
                if (lowAttendance.length === 0) return null;
                return (
                  <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40">
                    <p className="text-xs font-bold text-red-700 dark:text-red-400 flex items-center gap-1.5 mb-1"><I.Alert /> Below 75% overall attendance</p>
                    <p className="text-[11px] text-red-600 dark:text-red-400/80">
                      {lowAttendance.map(s => s.name).join(", ")}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* ── Footer info ── */}
        <div className="text-center pb-4">
          <p className="text-[10px] sm:text-xs text-slate-400 font-medium">
            Edit window: 2 days from session date · All edits are logged in the audit trail
          </p>
        </div>
      </div>
    </>
  );
}