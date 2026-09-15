// src/components/attendance/ProctorSectionView.tsx
// Mobile-first proctor dashboard — today's marking status, monthly table, edit, Excel export
//
// Export: { default: ProctorSectionView, useProctorCheck }

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";

/* ───── TYPES ───── */
type Status = "present" | "absent" | "leave";

interface ProctorBatch { id: string; name: string; studentCount: number }

interface SessionStatus {
  sessionId: string; subjectName: string; subjectCode: string;
  teacherName: string; startTime?: string; isMarked: boolean;
  presentCount: number; absentCount: number; totalStudents: number;
}

interface MonthlyCell { totalHeld: number; totalPresent: number; percentage: number }
interface MonthlyRow {
  studentId: string; studentName: string; rollNo: string;
  subjects: Record<string, MonthlyCell>; // keyed by subjectCode
  overallHeld: number; overallPresent: number; overallPct: number;
}

/* ───── ICONS ───── */
const Icon = {
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Clock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Download: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Alert: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  ChevD: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  Spin: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const css = `
  @keyframes popIn{from{opacity:0;transform:scale(.96) translateY(6px)}to{opacity:1;transform:none}}
  @keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:none}}
  @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  .glass{background:rgba(255,255,255,.65);border:1px solid rgba(255,255,255,.3);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
  .dark .glass{background:rgba(15,23,42,.65);border-color:rgba(255,255,255,.06)}
  .pill{background:rgba(0,0,0,.04)}.dark .pill{background:rgba(255,255,255,.06)}
  .atbl{border-collapse:separate;border-spacing:0}
  .atbl th,.atbl td{border-bottom:1px solid rgba(0,0,0,.06);padding:8px 10px;text-align:center;font-size:12px;white-space:nowrap}
  .dark .atbl th,.dark .atbl td{border-color:rgba(255,255,255,.06)}
  .atbl th{position:sticky;top:0;z-index:2;font-weight:800;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8}
  .atbl th{background:rgba(248,250,252,.95)}.dark .atbl th{background:rgba(15,23,42,.95)}
  .atbl td:first-child,.atbl th:first-child{position:sticky;left:0;z-index:3;text-align:left}
  .atbl th:first-child{z-index:4}
  .atbl td:first-child{background:rgba(255,255,255,.9);font-weight:700;color:#334155}
  .dark .atbl td:first-child{background:rgba(15,23,42,.9);color:#e2e8f0}
`;

/* ═══ useProctorCheck HOOK ═══ */
export function useProctorCheck() {
  const { user } = useAuth();
  const [isProctor, setIsProctor] = useState(false);
  const [proctorBatches, setProctorBatches] = useState<ProctorBatch[]>([]);
  const [instId, setInstId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const { data: mem } = await supabase.from("institute_members").select("institute_id")
          .eq("user_id", user.id).eq("status", "active").limit(1).single();
        if (!mem) return;
        setInstId(mem.institute_id);
        const { data: b } = await supabase.from("batches").select("id, name")
          .eq("proctor_id", user.id).neq("is_active", false);
        if (b && b.length > 0) {
          // get student counts
          const batches: ProctorBatch[] = [];
          for (const batch of b) {
            const { count } = await supabase.from("students").select("id", { count: "exact", head: true })
              .eq("batch_id", batch.id).eq("is_active", true);
            batches.push({ id: batch.id, name: batch.name, studentCount: count || 0 });
          }
          setProctorBatches(batches);
          setIsProctor(true);
        }
      } catch (e) { console.error("useProctorCheck:", e); }
    })();
  }, [user?.id]);

  return { isProctor, proctorBatches, instId };
}

/* ═══ MAIN COMPONENT ═══ */
export default function ProctorSectionView() {
  const { user } = useAuth();
  const { proctorBatches, instId } = useProctorCheck();

  const [selBatch, setSelBatch] = useState<ProctorBatch | null>(null);
  const [todayStatus, setTodayStatus] = useState<SessionStatus[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([]);
  const [subjectCodes, setSubjectCodes] = useState<string[]>([]);
  const [subjectNames, setSubjectNames] = useState<Record<string, string>>({});
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [view, setView] = useState<"today" | "monthly">("today");

  // Auto-select first batch
  useEffect(() => {
    if (proctorBatches.length > 0 && !selBatch) setSelBatch(proctorBatches[0]);
  }, [proctorBatches, selBatch]);

  // Load today's status
  const loadToday = useCallback(async () => {
    if (!selBatch || !instId) return;
    setLoading(true);
    try {
      const { data } = await supabase.rpc("get_proctor_section_status", { p_batch_id: selBatch.id });
      setTodayStatus((data || []).map((r: any): SessionStatus => ({
        sessionId: r.session_id, subjectName: r.subject_name, subjectCode: r.subject_code,
        teacherName: r.teacher_name || "—",
        startTime: r.start_time ? String(r.start_time).slice(0, 5) : undefined,
        isMarked: r.is_marked,
        presentCount: Number(r.present_count) || 0, absentCount: Number(r.absent_count) || 0,
        totalStudents: Number(r.total_students) || 0,
      })));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [selBatch, instId]);

  // Load monthly report
  const loadMonthly = useCallback(async () => {
    if (!selBatch) return;
    setLoading(true);
    try {
      const { data } = await supabase.rpc("get_monthly_attendance", {
        p_batch_id: selBatch.id, p_month: month, p_year: year,
      });
      if (!data?.length) { setMonthlyRows([]); setSubjectCodes([]); setLoading(false); return; }

      const codes = new Set<string>();
      const names: Record<string, string> = {};
      const map = new Map<string, MonthlyRow>();

      for (const r of data as any[]) {
        codes.add(r.subject_code);
        names[r.subject_code] = r.subject_name;
        if (!map.has(r.student_id)) {
          map.set(r.student_id, {
            studentId: r.student_id, studentName: r.student_name, rollNo: r.roll_no || "—",
            subjects: {}, overallHeld: 0, overallPresent: 0, overallPct: 0,
          });
        }
        const row = map.get(r.student_id)!;
        row.subjects[r.subject_code] = {
          totalHeld: Number(r.total_held) || 0,
          totalPresent: Number(r.total_present) || 0,
          percentage: Number(r.percentage) || 0,
        };
        row.overallHeld += Number(r.total_held) || 0;
        row.overallPresent += Number(r.total_present) || 0;
      }

      const rows = Array.from(map.values()).map(r => ({
        ...r,
        overallPct: r.overallHeld > 0 ? Math.round((r.overallPresent / r.overallHeld) * 100) : 0,
      }));
      rows.sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true }));

      setMonthlyRows(rows);
      setSubjectCodes(Array.from(codes).sort());
      setSubjectNames(names);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [selBatch, month, year]);

  useEffect(() => { if (view === "today") loadToday(); }, [view, loadToday]);
  useEffect(() => { if (view === "monthly") loadMonthly(); }, [view, loadMonthly]);

  // Excel export
  const exportExcel = useCallback(async () => {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const headers = ["S.No", "Roll No", "Student Name"];
      subjectCodes.forEach(c => { headers.push(`${c} H`, `${c} A`); });
      headers.push("Total H", "Total A", "%", "Sign");

      const wsData = [headers];
      monthlyRows.forEach((r, i) => {
        const row: (string | number)[] = [i + 1, r.rollNo, r.studentName];
        subjectCodes.forEach(c => {
          const cell = r.subjects[c];
          row.push(cell?.totalHeld ?? 0, cell?.totalHeld ? (cell.totalHeld - cell.totalPresent) : 0);
        });
        row.push(r.overallHeld, r.overallHeld - r.overallPresent, r.overallPct, "");
        wsData.push(row);
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Column widths
      const colWidths = headers.map((h, i) => ({ wch: i <= 2 ? (i === 2 ? 24 : 8) : 6 }));
      ws["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, `${selBatch?.name || "Section"} ${MONTHS[month - 1]} ${year}`);
      XLSX.writeFile(wb, `${selBatch?.name || "Section"}_Attendance_${MONTHS[month - 1]}_${year}.xlsx`);
    } catch (e) { console.error("Export failed:", e); }
    setExporting(false);
  }, [monthlyRows, subjectCodes, selBatch, month, year]);

  const markedCount = todayStatus.filter(s => s.isMarked).length;

  return (
    <>
      <style>{css}</style>
      <div className="space-y-4 sm:space-y-6 animate-[popIn_.3s_ease-out]">

        {/* Batch selector (if multiple batches) */}
        {proctorBatches.length > 1 && (
          <div className="glass rounded-2xl p-3 sm:p-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Section</label>
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
              {proctorBatches.map(b => (
                <button key={b.id} onClick={() => setSelBatch(b)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 active:scale-95 touch-manipulation ${
                    selBatch?.id === b.id ? "text-white shadow-sm" : "pill text-slate-600 dark:text-slate-300"
                  }`}
                  style={selBatch?.id === b.id ? { background: "linear-gradient(135deg, var(--theme-start, #3b82f6), var(--theme-end, #8b5cf6))" } : undefined}>
                  {b.name} <span className="text-xs opacity-70">({b.studentCount})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Section header */}
        {selBatch && (
          <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{selBatch.name}</h3>
                <p className="text-xs text-slate-500 font-medium">{selBatch.studentCount} students · Proctor view</p>
              </div>
            </div>

            {/* Tabs: Today / Monthly */}
            <div className="flex gap-1 pill rounded-xl p-1">
              {(["today", "monthly"] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all active:scale-[0.97] touch-manipulation ${
                    view === v ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"
                  }`}>{v === "today" ? "Today" : "Monthly"}</button>
              ))}
            </div>
          </div>
        )}

        {/* TODAY view */}
        {view === "today" && selBatch && (
          <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-bold text-slate-800 dark:text-white">Marking status</h4>
              <span className="text-xs font-bold pill px-3 py-1.5 rounded-full text-slate-500">
                {markedCount}/{todayStatus.length} done
              </span>
            </div>

            {loading ? <p className="py-6 text-center text-slate-400 text-sm">Loading…</p>
            : todayStatus.length === 0 ? <p className="py-4 text-center text-slate-400 text-sm">No sessions scheduled today.</p>
            : (
              <div className="space-y-2">
                {todayStatus.map(s => {
                  const pct = s.totalStudents > 0 && s.isMarked ? Math.round((s.presentCount / s.totalStudents) * 100) : 0;
                  return (
                    <div key={s.sessionId} className={`rounded-2xl p-3.5 border transition-colors ${
                      s.isMarked ? "border-emerald-200/60 dark:border-emerald-800/30 bg-emerald-50/40 dark:bg-emerald-950/10"
                        : "border-amber-200/60 dark:border-amber-800/30 bg-amber-50/40 dark:bg-amber-950/10"
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-slate-800 dark:text-white">{s.subjectName}</span>
                        {s.isMarked
                          ? <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1"><Icon.Check /> {pct}%</span>
                          : <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1"><Icon.Clock /> Pending</span>}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                        <span>{s.teacherName}</span>
                        {s.startTime && <span>{s.startTime}</span>}
                        {s.isMarked && <span>{s.presentCount}P / {s.absentCount}A</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Progress bar */}
            {todayStatus.length > 0 && (
              <div className="mt-4">
                <div className="w-full h-2 pill rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-[width] duration-500"
                    style={{ width: `${(markedCount / todayStatus.length) * 100}%` }} />
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-1.5 text-center">
                  {markedCount === todayStatus.length ? "All classes marked ✅" : `${todayStatus.length - markedCount} pending`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* MONTHLY view */}
        {view === "monthly" && selBatch && (
          <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-6">
            {/* Month/year picker */}
            <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <select value={month} onChange={e => setMonth(Number(e.target.value))}
                  className="pill rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 dark:text-white bg-transparent outline-none">
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select value={year} onChange={e => setYear(Number(e.target.value))}
                  className="pill rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 dark:text-white bg-transparent outline-none">
                  {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <button onClick={exportExcel} disabled={!monthlyRows.length || exporting}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 active:scale-95 touch-manipulation"
                style={{ background: "linear-gradient(135deg, var(--theme-start, #3b82f6), var(--theme-end, #8b5cf6))" }}>
                {exporting ? <Icon.Spin /> : <Icon.Download />}{exporting ? "Exporting…" : "Excel"}
              </button>
            </div>

            {loading ? <p className="py-8 text-center text-slate-400 text-sm">Loading report…</p>
            : monthlyRows.length === 0 ? <p className="py-6 text-center text-slate-400 text-sm">No attendance data for this month.</p>
            : (
              <>
                {/* Scrollable table */}
                <div className="overflow-auto -mx-2 px-2 max-h-[60vh] rounded-xl border border-slate-200/60 dark:border-white/5">
                  <table className="atbl w-full">
                    <thead>
                      <tr>
                        <th className="min-w-[140px]">Student</th>
                        {subjectCodes.map(c => (
                          <th key={c} className="min-w-[60px]" title={subjectNames[c]}>{c}</th>
                        ))}
                        <th className="min-w-[50px]">Overall</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyRows.map(r => (
                        <tr key={r.studentId}>
                          <td>
                            <div className="min-w-0">
                              <p className="font-bold text-[12px] text-slate-700 dark:text-slate-200 truncate max-w-[130px]">{r.studentName}</p>
                              <p className="text-[10px] text-slate-400">{r.rollNo}</p>
                            </div>
                          </td>
                          {subjectCodes.map(c => {
                            const cell = r.subjects[c];
                            if (!cell || cell.totalHeld === 0) return <td key={c} className="text-slate-300">—</td>;
                            return (
                              <td key={c}>
                                <span className={`font-bold ${cell.percentage >= 75 ? "text-emerald-600" : cell.percentage >= 50 ? "text-amber-600" : "text-red-600"}`}>
                                  {cell.percentage}%
                                </span>
                                <span className="block text-[9px] text-slate-400">{cell.totalPresent}/{cell.totalHeld}</span>
                              </td>
                            );
                          })}
                          <td>
                            <span className={`font-black text-sm ${r.overallPct >= 75 ? "text-emerald-600" : r.overallPct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                              {r.overallPct}%
                            </span>
                            <span className="block text-[9px] text-slate-400">{r.overallPresent}/{r.overallHeld}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Below-75% warning */}
                {(() => {
                  const low = monthlyRows.filter(r => r.overallPct < 75 && r.overallHeld > 0);
                  if (!low.length) return null;
                  return (
                    <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40">
                      <p className="text-xs font-bold text-red-700 dark:text-red-400 flex items-center gap-1.5 mb-1"><Icon.Alert /> Below 75% overall</p>
                      <p className="text-[11px] text-red-600 dark:text-red-400/80">{low.map(s => s.studentName).join(", ")}</p>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-400 font-medium pb-2">
          Edit window: 2 days · All edits audited
        </p>
      </div>
    </>
  );
}