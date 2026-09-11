// src/components/attendance/HODAttendanceDashboard.tsx
// ──────────────────────────────────────────────────────────────────────
// HOD / Institute Admin attendance view — read-only
//
// Section 1: Today's teacher status
//   - All batches in institute, how many subjects marked/pending
//   - Expandable: per-subject row with teacher name, status, present count
//
// Section 2: Monthly report
//   - Batch selector + month selector
//   - Same student × subject table as ProctorSectionView
//   - Excel export (.xlsx) for any batch — admin full control
//
// Usage in InstituteDashboardPage.tsx:
//   import HODAttendanceDashboard from "@/components/attendance/HODAttendanceDashboard";
//   ...
//   {activeTab === "attendance" && <HODAttendanceDashboard instituteId={institute.id} />}
// ──────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import * as XLSX from "xlsx";

/* ───── TYPES ───── */
interface Batch { id: string; name: string; departmentName?: string; studentCount: number; }
interface SessionRow { sessionId: string; subjectName: string; subjectCode: string; teacherName: string; startTime?: string; isMarked: boolean; presentCount: number; absentCount: number; totalStudents: number; }
interface MonthlyRow { studentId: string; studentName: string; rollNo: string; subjectName: string; subjectCode: string; totalHeld: number; totalPresent: number; totalAbsent: number; percentage: number; }

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* ── Icons ── */
const I = {
  ChevDown: ({ open }: { open: boolean }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
      <path d="m6 9 6 6 6-6"/>
    </svg>
  ),
  Check: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Download: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>,
  ChevL: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  ChevR: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  Spinner: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  Refresh: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>,
};

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function HODAttendanceDashboard({ instituteId }: { instituteId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [dateFilter, setDateFilter] = useState(today);

  // Batches
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  // Today's status per batch
  const [sessionMap, setSessionMap] = useState<Record<string, SessionRow[]>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Monthly report
  const [reportBatchId, setReportBatchId] = useState("");
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── Load batches ── */
  useEffect(() => {
    async function load() {
      setLoadingBatches(true);
      const { data: bData } = await supabase
        .from("batches")
        .select("id, name, departments(name)")
        .eq("institute_id", instituteId)
        .neq("is_active", false)
        .order("name");

      const bIds = (bData || []).map((b: any) => b.id);
      const { data: stuCounts } = await supabase
        .from("students").select("batch_id")
        .in("batch_id", bIds).eq("is_active", true);
      const cMap: Record<string, number> = {};
      stuCounts?.forEach((s: any) => { cMap[s.batch_id] = (cMap[s.batch_id] || 0) + 1; });

      setBatches((bData || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        departmentName: (b.departments as any)?.name,
        studentCount: cMap[b.id] || 0,
      })));
      setLoadingBatches(false);
    }
    if (instituteId) load();
  }, [instituteId]);

  /* ── Load session status for a batch ── */
  const loadBatchSessions = useCallback(async (batchId: string, date: string) => {
    setLoadingMap(p => ({ ...p, [batchId]: true }));
    try {
      const { data, error } = await supabase.rpc("get_proctor_section_status", {
        p_batch_id: batchId,
        p_date: date,
      });
      if (error) throw error;
      setSessionMap(p => ({
        ...p,
        [batchId]: (data || []).map((r: any): SessionRow => ({
          sessionId: r.session_id,
          subjectName: r.subject_name,
          subjectCode: r.subject_code,
          teacherName: r.teacher_name || "—",
          startTime: r.start_time ? String(r.start_time).slice(0, 5) : undefined,
          isMarked: r.is_marked,
          presentCount: Number(r.present_count) || 0,
          absentCount: Number(r.absent_count) || 0,
          totalStudents: Number(r.total_students) || 0,
        })),
      }));
    } catch (e: any) {
      showToast("Failed to load: " + e.message, false);
    }
    setLoadingMap(p => ({ ...p, [batchId]: false }));
  }, []);

  /* ── Toggle expand ── */
  const toggleExpand = useCallback((batchId: string) => {
    const next = !expanded[batchId];
    setExpanded(p => ({ ...p, [batchId]: next }));
    if (next && !sessionMap[batchId]) {
      loadBatchSessions(batchId, dateFilter);
    }
  }, [expanded, sessionMap, dateFilter, loadBatchSessions]);

  /* ── Date change: reload all expanded batches ── */
  const handleDateChange = (date: string) => {
    setDateFilter(date);
    setSessionMap({});
    Object.keys(expanded).forEach(batchId => {
      if (expanded[batchId]) loadBatchSessions(batchId, date);
    });
  };

  /* ── Load monthly report ── */
  const loadMonthly = useCallback(async () => {
    if (!reportBatchId) return;
    setLoadingMonthly(true);
    try {
      const { data, error } = await supabase.rpc("get_monthly_attendance", {
        p_batch_id: reportBatchId,
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
        percentage: Number(r.percentage),
      })));
    } catch (e: any) {
      showToast("Failed to load report: " + e.message, false);
    }
    setLoadingMonthly(false);
  }, [reportBatchId, reportMonth, reportYear]);

  useEffect(() => { loadMonthly(); }, [loadMonthly]);

  /* ── Pivot monthly data ── */
  const pivotData = useMemo(() => {
    const subjects = [...new Map(monthlyData.map(r => [r.subjectCode, { name: r.subjectName, code: r.subjectCode }])).values()];
    const students = [...new Map(monthlyData.map(r => [r.studentId, { id: r.studentId, name: r.studentName, rollNo: r.rollNo }])).values()];
    students.sort((a, b) => (a.rollNo || "").localeCompare(b.rollNo || "", undefined, { numeric: true }));
    const map = new Map<string, MonthlyRow>();
    monthlyData.forEach(r => map.set(`${r.studentId}_${r.subjectCode}`, r));
    return { subjects, students, map };
  }, [monthlyData]);

  /* ── Batch summary stats ── */
  const batchSummary = useCallback((batchId: string) => {
    const sessions = sessionMap[batchId];
    if (!sessions) return null;
    const total = sessions.length;
    const marked = sessions.filter(s => s.isMarked).length;
    const pending = total - marked;
    const avgPct = sessions.filter(s => s.isMarked && s.totalStudents > 0).reduce((acc, s) => {
      return acc + Math.round((s.presentCount / s.totalStudents) * 100);
    }, 0) / (marked || 1);
    return { total, marked, pending, avgPct: marked > 0 ? Math.round(avgPct) : null };
  }, [sessionMap]);

  /* ── Excel export ── */
  const exportExcel = useCallback(() => {
    if (!reportBatchId || pivotData.students.length === 0) { showToast("No data to export", false); return; }
    const batch = batches.find(b => b.id === reportBatchId);
    const { subjects, students, map } = pivotData;

    const sectionInfo = [`${batch?.name || "Batch"}   ${MONTHS[reportMonth - 1]} ${reportYear}`];
    const headerRow1 = ["S. No", "Roll no", "Name of the student"];
    const headerRow2 = ["", "", ""];
    const headerRow3 = ["", "", ""];
    subjects.forEach(sub => {
      headerRow1.push(sub.code, "");
      headerRow2.push(sub.name.slice(0, 20), "");
      headerRow3.push("H", "A");
    });
    headerRow1.push("Grand Total", "", "%", "Sign");
    headerRow2.push("", "", "", "");
    headerRow3.push("Total H", "Total A", "", "");

    const rows = students.map((stu, idx) => {
      const row: (string | number)[] = [idx + 1, stu.rollNo, stu.name];
      let grandH = 0, grandA = 0;
      subjects.forEach(sub => {
        const d = map.get(`${stu.id}_${sub.code}`);
        const held = d?.totalHeld ?? 0;
        const absent = d?.totalAbsent ?? 0;
        row.push(held, absent);
        grandH += held; grandA += absent;
      });
      const pct = grandH > 0 ? parseFloat(((grandH - grandA) / grandH * 100).toFixed(2)) : 0;
      row.push(grandH, grandA, pct, "");
      return row;
    });

    const ws = XLSX.utils.aoa_to_sheet([sectionInfo, headerRow1, headerRow2, headerRow3, ...rows]);
    const totalCols = 3 + subjects.length * 2 + 4;
    ws["!cols"] = [{ wch: 6 }, { wch: 14 }, { wch: 26 }, ...subjects.flatMap(() => [{ wch: 6 }, { wch: 6 }]), { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 14 }];
    if (!ws["!merges"]) ws["!merges"] = [];
    ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${batch?.name || "Batch"} ${MONTHS_SHORT[reportMonth - 1]} ${reportYear}`.slice(0, 31));
    XLSX.writeFile(wb, `Attendance_${batch?.name || "Batch"}_${MONTHS_SHORT[reportMonth - 1]}_${reportYear}.xlsx`);
    showToast("Excel exported");
  }, [reportBatchId, pivotData, batches, reportMonth, reportYear]);

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: toast.ok ? "#1E293B" : "#7F1D1D", color: "#fff", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 600 }}>
          {toast.ok ? "✓" : "⚠"} {toast.msg}
        </div>
      )}

      {/* ── SECTION 1: TODAY'S TEACHER STATUS ── */}
      <div className="bg-white rounded-2xl p-5 sm:p-6" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div>
            <h3 className="text-[16px] font-bold text-slate-800">Today's marking status</h3>
            <p className="text-xs text-slate-400 mt-0.5">Which teachers have marked attendance, which are pending</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFilter}
              max={today}
              onChange={e => handleDateChange(e.target.value)}
              className="text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
            />
            <button
              onClick={() => { setSessionMap({}); Object.keys(expanded).forEach(bid => { if (expanded[bid]) loadBatchSessions(bid, dateFilter); }); }}
              className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
              title="Refresh"
            >
              <I.Refresh />
            </button>
          </div>
        </div>

        {loadingBatches ? (
          <p className="text-center py-8 text-slate-400 text-sm">Loading batches…</p>
        ) : batches.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">No batches found. Create batches first.</p>
        ) : (
          <div className="space-y-2">
            {batches.map(batch => {
              const isOpen = expanded[batch.id];
              const isLoading = loadingMap[batch.id];
              const summary = batchSummary(batch.id);
              const sessions = sessionMap[batch.id] || [];

              return (
                <div key={batch.id} style={{ border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
                  {/* Batch header row */}
                  <button
                    onClick={() => toggleExpand(batch.id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0"
                        style={{ background: "linear-gradient(135deg, #FF7043, #E64A19)" }}>
                        {batch.name.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{batch.name}</p>
                        <p className="text-[11px] text-slate-400">{batch.departmentName && `${batch.departmentName} · `}{batch.studentCount} students</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      {summary ? (
                        <>
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${summary.pending === 0 ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-700"}`}>
                            {summary.marked}/{summary.total} marked
                          </span>
                          {summary.avgPct !== null && (
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 ${summary.avgPct >= 75 ? "text-green-600" : summary.avgPct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                              avg {summary.avgPct}%
                            </span>
                          )}
                        </>
                      ) : isLoading ? (
                        <I.Spinner />
                      ) : isOpen ? null : (
                        <span className="text-[11px] font-bold text-slate-400">Click to load</span>
                      )}
                      <I.ChevDown open={isOpen} />
                    </div>
                  </button>

                  {/* Expanded session rows */}
                  {isOpen && (
                    <div className="divide-y divide-slate-100">
                      {isLoading ? (
                        <p className="text-center py-6 text-slate-400 text-sm flex items-center justify-center gap-2"><I.Spinner /> Loading…</p>
                      ) : sessions.length === 0 ? (
                        <p className="text-center py-6 text-slate-400 text-sm">No sessions scheduled for this date.</p>
                      ) : (
                        sessions.map((s, i) => {
                          const pct = s.totalStudents > 0 ? Math.round((s.presentCount / s.totalStudents) * 100) : 0;
                          return (
                            <div key={s.sessionId || i} className="flex items-center justify-between px-4 py-3 flex-wrap gap-2">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-1.5 h-10 rounded-full shrink-0 ${s.isMarked ? "bg-green-400" : "bg-amber-400"}`} />
                                <div className="min-w-0">
                                  <p className="text-[13px] font-bold text-slate-800 truncate">
                                    {s.subjectName}
                                    <span className="ml-2 text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{s.subjectCode}</span>
                                  </p>
                                  <p className="text-[11px] text-slate-400">
                                    {s.teacherName}
                                    {s.startTime && <span className="ml-2">{s.startTime}</span>}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                {s.isMarked ? (
                                  <>
                                    <div className="text-right">
                                      <p className={`text-sm font-black ${pct >= 75 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}`}>{pct}%</p>
                                      <p className="text-[10px] text-slate-400">{s.presentCount}/{s.totalStudents}</p>
                                    </div>
                                    <span className="text-[11px] font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                                      <I.Check /> Done
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">Pending</span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SECTION 2: MONTHLY REPORT ── */}
      <div className="bg-white rounded-2xl p-5 sm:p-6" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9" }}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div>
            <h3 className="text-[16px] font-bold text-slate-800">Monthly attendance report</h3>
            <p className="text-xs text-slate-400 mt-0.5">View and export any batch's attendance for any month</p>
          </div>
          <button
            onClick={exportExcel}
            disabled={!reportBatchId || pivotData.students.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg, #FF7043, #E64A19)" }}
          >
            <I.Download /> Export Excel
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <select
            value={reportBatchId}
            onChange={e => setReportBatchId(e.target.value)}
            className="text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none"
          >
            <option value="">Select batch…</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          <div className="flex items-center gap-1">
            <button onClick={() => { if (reportMonth === 1) { setReportMonth(12); setReportYear(y => y - 1); } else setReportMonth(m => m - 1); }}
              className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-500"><I.ChevL /></button>
            <div className="flex-1 text-center text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl py-2.5">
              {MONTHS[reportMonth - 1]} {reportYear}
            </div>
            <button onClick={() => { if (reportMonth === 12) { setReportMonth(1); setReportYear(y => y + 1); } else setReportMonth(m => m + 1); }}
              className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-500"><I.ChevR /></button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            {reportBatchId && !loadingMonthly && (
              <span>{pivotData.students.length} students · {pivotData.subjects.length} subjects</span>
            )}
          </div>
        </div>

        {/* Table */}
        {!reportBatchId ? (
          <div className="text-center py-10 text-slate-400 text-sm">Select a batch to view the monthly report.</div>
        ) : loadingMonthly ? (
          <p className="text-center py-8 text-slate-400 text-sm flex items-center justify-center gap-2"><I.Spinner /> Loading report…</p>
        ) : pivotData.students.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">No attendance data for {MONTHS[reportMonth - 1]} {reportYear}.</p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
                    <th style={{ textAlign: "left", padding: "8px 8px", color: "#94a3b8", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>#</th>
                    <th style={{ textAlign: "left", padding: "8px 8px", color: "#94a3b8", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Student</th>
                    {pivotData.subjects.map(sub => (
                      <th key={sub.code} style={{ textAlign: "center", padding: "8px 4px", color: "#94a3b8", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", minWidth: 60 }}>
                        <span style={{ display: "block" }}>{sub.code}</span>
                        <span style={{ display: "block", fontWeight: 400, fontSize: 9, color: "#cbd5e1", textTransform: "none", letterSpacing: 0 }}>{sub.name.slice(0, 10)}</span>
                      </th>
                    ))}
                    <th style={{ textAlign: "center", padding: "8px 8px", color: "#94a3b8", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", minWidth: 64 }}>Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {pivotData.students.map((stu, idx) => {
                    let totalH = 0, totalA = 0;
                    return (
                      <tr key={stu.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                        <td style={{ padding: "8px 8px", color: "#94a3b8", fontWeight: 700 }}>{idx + 1}</td>
                        <td style={{ padding: "8px 8px" }}>
                          <p style={{ fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap" }}>{stu.name}</p>
                          {stu.rollNo && <p style={{ fontSize: 10, color: "#94a3b8" }}>{stu.rollNo}</p>}
                        </td>
                        {pivotData.subjects.map(sub => {
                          const d = pivotData.map.get(`${stu.id}_${sub.code}`);
                          const pct = d?.percentage ?? 0;
                          totalH += d?.totalHeld ?? 0;
                          totalA += d?.totalAbsent ?? 0;
                          return (
                            <td key={sub.code} style={{ textAlign: "center", padding: "8px 4px" }}>
                              {d && d.totalHeld > 0 ? (
                                <>
                                  <span style={{ fontWeight: 800, color: pct >= 75 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626", display: "block" }}>{pct}%</span>
                                  <span style={{ fontSize: 10, color: "#94a3b8" }}>{d.totalPresent}/{d.totalHeld}</span>
                                </>
                              ) : <span style={{ color: "#e2e8f0" }}>—</span>}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: "center", padding: "8px 8px" }}>
                          {(() => {
                            const op = totalH > 0 ? Math.round(((totalH - totalA) / totalH) * 100) : 0;
                            return totalH > 0 ? (
                              <>
                                <span style={{ fontWeight: 800, color: op >= 75 ? "#16a34a" : op >= 50 ? "#d97706" : "#dc2626", display: "block" }}>{op}%</span>
                                <span style={{ fontSize: 10, color: "#94a3b8" }}>{totalH - totalA}/{totalH}</span>
                              </>
                            ) : <span style={{ color: "#e2e8f0" }}>—</span>;
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Below-75% warning */}
            {(() => {
              const low = pivotData.students.filter(stu => {
                let h = 0, a = 0;
                pivotData.subjects.forEach(sub => { const d = pivotData.map.get(`${stu.id}_${sub.code}`); h += d?.totalHeld ?? 0; a += d?.totalAbsent ?? 0; });
                return h > 0 && ((h - a) / h) * 100 < 75;
              });
              if (low.length === 0) return null;
              return (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef2f2", borderLeft: "3px solid #fca5a5", borderRadius: "0 8px 8px 0" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>⚠ Below 75% overall attendance ({low.length} students)</p>
                  <p style={{ fontSize: 11, color: "#ef4444" }}>{low.map(s => s.name).join(", ")}</p>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}