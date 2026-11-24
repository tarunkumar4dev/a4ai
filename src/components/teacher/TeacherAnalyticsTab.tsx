// src/components/teacher/TeacherAnalyticsTab.tsx
// Teacher Analytics: 🎯 Marks · 📅 Attendance for the batches in my scope (useMyScope; RLS enforces the same).
// Every number comes from the DB — no sample data, no made-up trends. Nothing to compute → "—" + an empty state.
//   Reads:  src/lib/teacherAnalyticsData.ts (paged, every error checked)
//   Maths:  src/lib/teacherAnalytics.ts (same attendance rule as get_monthly_attendance; unit-tested)

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { useMyScope } from "@/hooks/useMyScope";
import {
  MIN_MARKED_FOR_ALERT, buildMarkResults, summarizeAttendance, summarizeMarks,
  type AttRecord, type AttSession, type RosterStudent, type TimeRange,
} from "@/lib/teacherAnalytics";
import { loadAttendance, loadMarks, loadRoster, type MarksData } from "@/lib/teacherAnalyticsData";

export type AnalyticsMode = "marks" | "attendance";

interface TeacherAnalyticsTabProps {
  user: { id: string } | null | undefined;
  onNavigateTab?: (tab: string) => void;
}

/* ───── ICONS ───── */
const Icons = {
  Chart: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
    </svg>
  ),
  Calendar: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  ),
  Refresh: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" />
    </svg>
  ),
  Download: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Award: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  ),
  AlertTriangle: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  ),
  Users: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  CheckCircle: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  TrendingUp: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
    </svg>
  ),
};

const TOOLTIP_STYLE = {
  backgroundColor: "rgba(15, 23, 42, 0.92)", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px",
  color: "#fff", fontSize: "12px",
};
const TOOLTIP_TEXT = { color: "#fff" };

const STATUS_COLORS = { present: "#10B981", absent: "#EF4444", leave: "#3B82F6", late: "#F59E0B" } as const;
const STATUS_LABELS = { present: "Present", absent: "Absent", leave: "Leave", late: "Late" } as const;

const RANGE_LABEL: Record<TimeRange, string> = { "7": "last 7 days", "30": "last 30 days", "90": "last 90 days", all: "all time" };

const pctText = (v: number | null) => (v == null ? "—" : `${v}%`);
const shorten = (s: string, n = 16) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

type Section<T> = { data: T | null; error: string | null };

interface Loaded {
  roster: RosterStudent[];
  attendance: Section<{ sessions: AttSession[]; records: AttRecord[] }>;
  marks: Section<MarksData>;
}

const errText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

/* ───── small building blocks ───── */
function Kpi({ label, value, sub, icon, tone = "slate" }: {
  label: string; value: React.ReactNode; sub: React.ReactNode; icon: React.ReactNode;
  tone?: "blue" | "amber" | "emerald" | "purple" | "indigo" | "red" | "slate";
}) {
  const toneCls: Record<string, string> = {
    blue: "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300",
    amber: "bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300",
    emerald: "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300",
    purple: "bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300",
    indigo: "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300",
    red: "bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-300",
    slate: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
  };
  return (
    <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-slate-200/60 dark:border-white/5 shadow-xs min-w-0">
      <div className="flex items-center justify-between mb-3 gap-2">
        <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${toneCls[tone]}`}>{icon}</div>
      </div>
      <div className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">{value}</div>
      <div className="mt-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">{sub}</div>
    </div>
  );
}

function Panel({ title, sub, right, className = "", children }: {
  title: string; sub?: string; right?: React.ReactNode; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={`glass-panel rounded-3xl p-5 sm:p-7 border border-slate-200/60 dark:border-white/5 shadow-xs min-w-0 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">{title}</h3>
          {sub && <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function EmptyBox({ children, h = "h-[220px]" }: { children: React.ReactNode; h?: string }) {
  return (
    <div className={`${h} flex items-center justify-center text-center px-6 text-sm text-slate-500 dark:text-slate-400 font-medium rounded-2xl border border-dashed border-slate-200 dark:border-white/10`}>
      <div>{children}</div>
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold min-w-0">
        <span className="shrink-0"><Icons.AlertTriangle /></span>
        <span className="break-words">{message}</span>
      </div>
      <button onClick={onRetry} className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 shrink-0">Retry</button>
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */
export default function TeacherAnalyticsTab({ user, onNavigateTab }: TeacherAnalyticsTabProps) {
  const navigate = useNavigate();
  const scope = useMyScope();

  const [mode, setMode] = useState<AnalyticsMode>("marks");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("30");
  const [attThreshold, setAttThreshold] = useState<number>(75);
  const [passThreshold, setPassThreshold] = useState<number>(33);

  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const requestId = useRef(0);

  const batchName = useMemo(() => new Map(scope.batches.map((b) => [b.id, b.name])), [scope.batches]);

  // the scope can change under us (admin removes a batch) → fall back to "all"
  useEffect(() => {
    if (!scope.loading && selectedBatchId !== "all" && !scope.batchIds.includes(selectedBatchId)) setSelectedBatchId("all");
  }, [scope.loading, scope.batchIds, selectedBatchId]);

  const fetchData = useCallback(async () => {
    if (scope.loading) return;
    if (!user?.id) { setLoading(false); return; }
    const id = ++requestId.current;
    setLoading(true);

    const all = selectedBatchId === "all";
    const batchIds = all ? scope.batchIds : scope.batchIds.filter((b) => b === selectedBatchId);

    const [rosterR, attR, marksR] = await Promise.allSettled([
      loadRoster(batchIds, batchName),
      loadAttendance(user.id, batchIds, timeRange),
      loadMarks(user.id, batchIds, timeRange, all),
    ]);
    if (id !== requestId.current) return; // a newer filter change is already loading

    if (rosterR.status === "rejected") console.error("analytics roster:", rosterR.reason);
    if (attR.status === "rejected") console.error("analytics attendance:", attR.reason);
    if (marksR.status === "rejected") console.error("analytics marks:", marksR.reason);

    setRosterError(rosterR.status === "rejected" ? errText(rosterR.reason) : null);
    setLoaded({
      roster: rosterR.status === "fulfilled" ? rosterR.value : [],
      attendance: attR.status === "fulfilled" ? { data: attR.value, error: null } : { data: null, error: errText(attR.reason) },
      marks: marksR.status === "fulfilled" ? { data: marksR.value, error: null } : { data: null, error: errText(marksR.reason) },
    });
    setLoading(false);
  }, [scope.loading, scope.batchIds, batchName, user?.id, selectedBatchId, timeRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const rosterById = useMemo(() => new Map((loaded?.roster ?? []).map((s) => [s.id, s])), [loaded]);

  const marksBuild = useMemo(() => {
    const d = loaded?.marks.data;
    return d ? buildMarkResults(d.assignments, d.submissions, d.sheets, rosterById) : null;
  }, [loaded, rosterById]);

  const marks = useMemo(() => (marksBuild ? summarizeMarks(marksBuild.results, passThreshold) : null), [marksBuild, passThreshold]);

  const att = useMemo(() => {
    const d = loaded?.attendance.data;
    return d ? summarizeAttendance(d.sessions, d.records, loaded!.roster, attThreshold) : null;
  }, [loaded, attThreshold]);

  const assignmentsGiven = loaded?.marks.data?.assignments.length ?? 0;
  const copySessions = useMemo(() => new Set((loaded?.marks.data?.sheets ?? []).map((s) => s.sessionId)).size, [loaded]);
  const selectedName = selectedBatchId === "all" ? "all your classes" : batchName.get(selectedBatchId) ?? "this class";
  const periodText = `${selectedName} · ${RANGE_LABEL[timeRange]}`;
  const noBatches = !scope.loading && scope.batchIds.length === 0;
  const firstLoad = loading && !loaded;

  /* ───── EXPORT (all rows, not just what fits on screen) ───── */
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const generated = new Date().toLocaleString("en-IN");
      if (mode === "marks" && marks) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(marks.students.map((s, i) => ({
          Rank: i + 1, Student: s.name, Roll_No: s.rollNo, Guest: s.guest ? "Yes" : "", Average_Percent: s.avg, Results: s.count,
          Below_Pass_Mark: s.avg < passThreshold ? "Yes" : "",
        }))), "Students");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(marks.assessments.map((a) => ({
          Assessment: a.title, Type: a.kind === "copies" ? "Copy check" : "Assignment", Date: a.date.slice(0, 10), Results: a.n, Average_Percent: a.avg,
        }))), "Assessments");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
          { Metric: "Classes", Value: selectedName },
          { Metric: "Period", Value: RANGE_LABEL[timeRange] },
          { Metric: "Results counted", Value: marks.results },
          { Metric: "Class average %", Value: marks.avg ?? "—" },
          { Metric: "Highest %", Value: marks.highest ?? "—" },
          { Metric: `Results at or above ${passThreshold}%`, Value: marks.passRate ?? "—" },
          { Metric: "Assignments given", Value: assignmentsGiven },
          { Metric: "Copy checks", Value: copySessions },
          { Metric: "Awaiting marks", Value: marksBuild?.pending ?? 0 },
          { Metric: "Generated on", Value: generated },
        ]), "Summary");
      } else if (mode === "attendance" && att) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(att.students.map((s) => ({
          Student: s.name, Roll_No: s.rollNo, Batch: s.batchName ?? "", Attended: s.attended, Marked: s.total,
          Attendance_Percent: s.pct ?? "", [`Classes_Needed_For_${attThreshold}%`]: s.total > 0 ? s.needed : "",
        }))), "Students");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(att.trend.map((t) => ({
          Date: t.date, Marked: t.marked, Attendance_Percent: t.rate,
        }))), "By date");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
          { Metric: "Classes", Value: selectedName },
          { Metric: "Period", Value: RANGE_LABEL[timeRange] },
          { Metric: "Classes held", Value: att.sessionsHeld },
          { Metric: "Attendance % (present + late of marked)", Value: att.rate ?? "—" },
          { Metric: "Present", Value: att.counts.present },
          { Metric: "Absent", Value: att.counts.absent },
          { Metric: "Leave", Value: att.counts.leave },
          { Metric: "Late", Value: att.counts.late },
          { Metric: `Students below ${attThreshold}%`, Value: att.defaulters.length },
          { Metric: "Generated on", Value: generated },
        ]), "Summary");
      } else {
        return;
      }
      XLSX.writeFile(wb, `a4ai_${mode}_analytics_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      console.error("Export error:", e);
      alert("Couldn't export the Excel report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [mode, marks, att, marksBuild, passThreshold, attThreshold, assignmentsGiven, copySessions, selectedName, timeRange]);

  const canExport = mode === "marks" ? !!marks && marks.results > 0 : !!att && att.marked > 0;
  const modeError = mode === "marks" ? loaded?.marks.error : loaded?.attendance.error;

  const segBtn = (active: boolean) =>
    `flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl font-extrabold text-sm sm:text-base touch-manipulation ${
      active
        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md border border-slate-200/50 dark:border-white/10"
        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
    }`;
  const selectCls = "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-bold rounded-xl px-3.5 py-2.5 outline-none shadow-sm focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-full";

  /* ───── RENDER ───── */
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── TOP CONTROL BAR ── */}
      <div className="glass-panel rounded-[28px] sm:rounded-[36px] p-4 sm:p-6 shadow-sm border border-slate-200/60 dark:border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div role="group" aria-label="Analytics type" className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-white/5 w-fit shadow-inner">
            <button onClick={() => setMode("marks")} aria-pressed={mode === "marks"} className={segBtn(mode === "marks")}>
              <Icons.Chart /><span>Marks</span>
            </button>
            <button onClick={() => setMode("attendance")} aria-pressed={mode === "attendance"} className={segBtn(mode === "attendance")}>
              <Icons.Calendar /><span>Attendance</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {scope.batches.length > 0 && (
              <select aria-label="Class" value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} className={selectCls}>
                <option value="all">All my classes</option>
                {scope.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}

            <select aria-label="Period" value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)} className={selectCls}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All time</option>
            </select>

            {mode === "attendance" ? (
              <div role="group" aria-label="Attendance target" className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 shadow-sm text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="text-slate-500">Min:</span>
                {[75, 80, 85].map((th) => (
                  <button key={th} onClick={() => setAttThreshold(th)} aria-pressed={attThreshold === th}
                    className={`px-2 py-1 rounded-lg ${attThreshold === th ? "bg-red-500 text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}>
                    {th}%
                  </button>
                ))}
              </div>
            ) : (
              <div role="group" aria-label="Pass mark" className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 shadow-sm text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="text-slate-500">Pass:</span>
                {[33, 40, 50].map((th) => (
                  <button key={th} onClick={() => setPassThreshold(th)} aria-pressed={passThreshold === th}
                    className={`px-2 py-1 rounded-lg ${passThreshold === th ? "bg-emerald-600 text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}>
                    {th}%
                  </button>
                ))}
              </div>
            )}

            <button onClick={handleExport} disabled={isExporting || !canExport} aria-label="Export"
              className="flex items-center gap-2 bg-slate-900 hover:bg-black text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm disabled:opacity-50"
              title={canExport ? "Download an Excel report (every student)" : "Nothing to export yet"}>
              <Icons.Download /><span className="hidden sm:inline">{isExporting ? "Exporting…" : "Export"}</span>
            </button>

            <button onClick={() => fetchData()} disabled={loading} aria-label="Refresh"
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm disabled:opacity-50"
              title="Refresh">
              <div className={loading ? "animate-spin" : ""}><Icons.Refresh /></div>
            </button>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Showing <strong className="text-slate-700 dark:text-slate-200">{periodText}</strong>.
          {mode === "marks"
            ? " Marks come from checked copies (Check Copies) and published assignment results."
            : ` Attendance from classes you marked; present + late count as attended, leave stays in the total.`}
        </p>
        {noBatches && (
          <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
            No batch is assigned to you yet — contact your admin. Copy checks without a class still show under Marks.
          </p>
        )}
      </div>

      {rosterError && <ErrorBox message={`Student names couldn't be loaded (${rosterError}).`} onRetry={fetchData} />}
      {modeError && <ErrorBox message={modeError} onRetry={fetchData} />}

      {firstLoad && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-busy="true" aria-label="Loading analytics">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 rounded-3xl bg-slate-200/70 dark:bg-slate-800/60" />)}
        </div>
      )}

      {/* =========================================================
          MARKS
      ========================================================= */}
      {!firstLoad && mode === "marks" && marks && (
        <div className={`space-y-6 sm:space-y-8 ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            <Kpi label="Class Average" tone="blue" icon={<Icons.TrendingUp />} value={pctText(marks.avg)}
              sub={marks.results ? `from ${marks.results} result${marks.results === 1 ? "" : "s"}` : "No marks yet"} />
            <Kpi label="Highest Score" tone="amber" icon={<Icons.Award />} value={pctText(marks.highest)} sub="Best single result" />
            <Kpi label="Passing Rate" tone="emerald" icon={<Icons.CheckCircle />} value={pctText(marks.passRate)}
              sub={`Results at or above ${passThreshold}%`} />
            <Kpi label="Assessments" tone="purple" icon={<Icons.Chart />} value={assignmentsGiven + copySessions}
              sub={<>
                {assignmentsGiven} assignment{assignmentsGiven === 1 ? "" : "s"} · {copySessions} copy check{copySessions === 1 ? "" : "s"}
                {!!marksBuild?.pending && <span className="block text-amber-700 dark:text-amber-300 font-bold">{marksBuild.pending} awaiting marks</span>}
              </>} />
          </div>

          {marks.results === 0 ? (
            <Panel title="No marks in this period yet">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Marks appear here once you approve checked copies in <strong>Check Copies</strong>, or publish the results of an assignment's submit link.
                {!!marksBuild?.pending && ` ${marksBuild.pending} submission${marksBuild.pending === 1 ? " is" : "s are"} waiting to be checked or published.`}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => navigate("/dashboard/test-generator?tab=check")} className="px-3 py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-bold">Check copies</button>
                {onNavigateTab && <button onClick={() => onNavigateTab("assignments")} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200">Assignments</button>}
              </div>
            </Panel>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <Panel className="lg:col-span-7" title="Average by assessment" sub="Class average of each assignment / copy check, oldest first">
                  <div className="w-full h-[240px] sm:h-[290px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={marks.assessments.slice(-12).map((a) => ({ ...a, short: shorten(a.title) }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150,150,150,0.15)" />
                        <XAxis dataKey="short" stroke="#94A3B8" fontSize={11} tickLine={false} interval="preserveStartEnd" />
                        <YAxis domain={[0, 100]} stroke="#94A3B8" fontSize={11} tickLine={false} unit="%" />
                        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_TEXT} labelStyle={TOOLTIP_TEXT}
                          labelFormatter={(_l, p) => { const a = p?.[0]?.payload; return a ? `${a.title} · ${a.label}` : ""; }}
                          formatter={(v: number, _n, p) => [`${v}% (${p?.payload?.n} student${p?.payload?.n === 1 ? "" : "s"})`, "Average"]} />
                        <Area type="monotone" dataKey="avg" stroke="#6366F1" strokeWidth={3} fill="url(#scoreColor)" isAnimationActive={false}
                          dot={{ r: 3, fill: "#6366F1" }} activeDot={{ r: 6, fill: "#4F46E5" }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  {marks.assessments.length > 12 && <p className="mt-2 text-xs text-slate-500">Latest 12 of {marks.assessments.length} — all in the export.</p>}
                </Panel>

                <Panel className="lg:col-span-5" title="Students by average" sub={`${marks.students.length} student${marks.students.length === 1 ? "" : "s"}, by their average score`}>
                  <div className="w-full h-[240px] sm:h-[290px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={marks.distribution} layout="vertical" margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(150,150,150,0.15)" />
                        <XAxis type="number" allowDecimals={false} stroke="#94A3B8" fontSize={11} tickLine={false} />
                        <YAxis dataKey="label" type="category" stroke="#94A3B8" fontSize={11} width={80} tickLine={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_TEXT} labelStyle={TOOLTIP_TEXT} formatter={(v: number) => [v, "Students"]} />
                        <Bar dataKey="count" radius={[0, 8, 8, 0]} isAnimationActive={false}>
                          {marks.distribution.map((d) => <Cell key={d.label} fill={d.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Panel title="Top performers" sub="Highest average score">
                  <ul className="space-y-3">
                    {marks.students.slice(0, 5).map((s, i) => (
                      <li key={s.key} className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                            i === 0 ? "bg-amber-400 text-amber-950" : i === 1 ? "bg-slate-300 text-slate-800" : i === 2 ? "bg-amber-700/30 text-amber-900 dark:text-amber-200" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                          }`}>{i + 1}</div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                              {s.name}{s.guest && <span className="ml-1.5 text-[10px] font-bold uppercase text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">Guest</span>}
                            </div>
                            {s.rollNo && <div className="text-xs text-slate-500 font-mono">Roll {s.rollNo}</div>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-black text-sm text-emerald-600 dark:text-emerald-400">{s.avg}%</div>
                          <div className="text-[11px] text-slate-500 font-medium">{s.count} result{s.count === 1 ? "" : "s"}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Panel>

                <Panel title="Students needing support" sub={`Average below ${passThreshold}%`}
                  right={<span className="text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2.5 py-1 rounded-full shrink-0">{marks.needsSupport.length}</span>}>
                  {marks.needsSupport.length === 0 ? (
                    <EmptyBox h="h-[160px]">No student's average is below {passThreshold}%.</EmptyBox>
                  ) : (
                    <>
                      <ul className="space-y-3">
                        {marks.needsSupport.slice(0, 8).map((s) => (
                          <li key={s.key} className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-red-50/40 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/30">
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                {s.name}{s.guest && <span className="ml-1.5 text-[10px] font-bold uppercase text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">Guest</span>}
                              </div>
                              <div className="text-xs text-red-700 dark:text-red-400 font-medium mt-0.5">
                                {s.rollNo ? `Roll ${s.rollNo} · ` : ""}{s.count} result{s.count === 1 ? "" : "s"}
                              </div>
                            </div>
                            <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-red-600 text-white shrink-0">{s.avg}%</span>
                          </li>
                        ))}
                      </ul>
                      {marks.needsSupport.length > 8 && <p className="mt-3 text-xs text-slate-500">+{marks.needsSupport.length - 8} more in the export.</p>}
                    </>
                  )}
                </Panel>
              </div>
            </>
          )}
        </div>
      )}

      {/* =========================================================
          ATTENDANCE
      ========================================================= */}
      {!firstLoad && mode === "attendance" && att && (
        <div className={`space-y-6 sm:space-y-8 ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            <Kpi label="Attendance Rate" tone="emerald" icon={<Icons.CheckCircle />} value={pctText(att.rate)}
              sub={att.rate == null ? "Nothing marked yet"
                : att.rate >= attThreshold
                  ? <span className="text-emerald-700 dark:text-emerald-400 font-bold">Meets the {attThreshold}% target</span>
                  : <span className="text-red-700 dark:text-red-400 font-bold">Under the {attThreshold}% target</span>} />
            <Kpi label="Classes Held" tone="blue" icon={<Icons.Calendar />} value={att.sessionsHeld} sub="Conducted classes you marked" />
            <Kpi label="Avg Present" tone="indigo" icon={<Icons.Users />} value={att.avgAttended ?? "—"} sub="Students attending per class" />
            <Kpi label={`Below ${attThreshold}%`} tone="red" icon={<Icons.AlertTriangle />}
              value={<span className={att.defaulters.length ? "text-red-600 dark:text-red-400" : ""}>{att.defaulters.length}</span>}
              sub={`Students with ${MIN_MARKED_FOR_ALERT}+ classes marked`} />
          </div>

          {att.marked === 0 ? (
            <Panel title="No attendance in this period yet">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Mark attendance for your classes and the rates, trends and the students below {attThreshold}% appear here.
              </p>
              {onNavigateTab && (
                <button onClick={() => onNavigateTab("attendance")} className="mt-4 px-3 py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-bold">Mark attendance</button>
              )}
            </Panel>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <Panel className="lg:col-span-8" title="Attendance by date" sub="Share of marked students who attended, per day">
                  <div className="w-full h-[240px] sm:h-[290px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={att.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="attColor" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150,150,150,0.15)" />
                        <XAxis dataKey="label" stroke="#94A3B8" fontSize={11} tickLine={false} interval="preserveStartEnd" />
                        <YAxis domain={[0, 100]} stroke="#94A3B8" fontSize={11} tickLine={false} unit="%" />
                        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_TEXT} labelStyle={TOOLTIP_TEXT}
                          formatter={(v: number, _n, p) => [`${v}% of ${p?.payload?.marked} marked`, "Attended"]} />
                        <Area type="monotone" dataKey="rate" stroke="#10B981" strokeWidth={3} fill="url(#attColor)" isAnimationActive={false}
                          dot={{ r: 3, fill: "#10B981" }} activeDot={{ r: 6, fill: "#059669" }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel className="lg:col-span-4" title="Marking breakdown" sub={`${att.marked} marks in total`}>
                  {(() => {
                    const slices = (Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[])
                      .map((k) => ({ key: k, name: STATUS_LABELS[k], value: att.counts[k], color: STATUS_COLORS[k] }))
                      .filter((s) => s.value > 0);
                    return (
                      <>
                        <div className="w-full h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={slices} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={slices.length > 1 ? 3 : 0} dataKey="value" isAnimationActive={false}>
                                {slices.map((s) => <Cell key={s.key} fill={s.color} />)}
                              </Pie>
                              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_TEXT} labelStyle={TOOLTIP_TEXT} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <ul className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/50 dark:border-white/5">
                          {slices.map((s) => (
                            <li key={s.key} className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{s.name}: {s.value}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    );
                  })()}
                </Panel>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <Panel className="lg:col-span-5" title="By weekday" sub="Attendance % per weekday (empty = no class that day)">
                  <div className="w-full h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={att.weekday} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150,150,150,0.15)" />
                        <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} />
                        <YAxis domain={[0, 100]} stroke="#94A3B8" fontSize={11} tickLine={false} unit="%" />
                        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_TEXT} labelStyle={TOOLTIP_TEXT}
                          formatter={(v: number, _n, p) => [`${v}% of ${p?.payload?.marked} marked`, "Attended"]} />
                        <Bar dataKey="rate" fill="#3B82F6" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel className="lg:col-span-7" title={`Below ${attThreshold}%`}
                  sub={`Students with at least ${MIN_MARKED_FOR_ALERT} classes marked`}
                  right={<span className="text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2.5 py-1 rounded-full shrink-0">{att.defaulters.length} at risk</span>}>
                  {att.defaulters.length === 0 ? (
                    <EmptyBox h="h-[160px]">No student is below {attThreshold}% in this period.</EmptyBox>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-slate-200/60 dark:border-white/5 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                            <th className="pb-3">Student</th>
                            <th className="pb-3 text-center">Attended</th>
                            <th className="pb-3 text-center">%</th>
                            <th className="pb-3 text-right">To reach {attThreshold}%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                          {att.defaulters.slice(0, 15).map((s) => (
                            <tr key={s.id}>
                              <td className="py-3 font-bold text-slate-800 dark:text-slate-100">
                                <div>{s.name}</div>
                                {(s.rollNo || s.batchName) && (
                                  <div className="text-[10px] text-slate-500 font-mono">{[s.rollNo && `Roll ${s.rollNo}`, selectedBatchId === "all" && s.batchName].filter(Boolean).join(" · ")}</div>
                                )}
                              </td>
                              <td className="py-3 text-center font-medium text-slate-600 dark:text-slate-300">{s.attended} / {s.total}</td>
                              <td className="py-3 text-center font-black text-red-600 dark:text-red-400">{s.pct}%</td>
                              <td className="py-3 text-right">
                                <span className="inline-block px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                                  +{s.needed} class{s.needed === 1 ? "" : "es"} in a row
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {att.defaulters.length > 15 && <p className="mt-3 text-xs text-slate-500">+{att.defaulters.length - 15} more in the export.</p>}
                    </div>
                  )}
                </Panel>
              </div>

              {att.offRoster > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {att.offRoster} marked student{att.offRoster === 1 ? " is" : "s are"} no longer in {selectedBatchId === "all" ? "your classes" : "this class"} — counted in the totals, not in the list.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
