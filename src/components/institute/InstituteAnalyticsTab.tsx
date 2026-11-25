// src/components/institute/InstituteAnalyticsTab.tsx
// Institute-level analytics: reuses the teacher analytics views (Overview · Marks · Attendance · Students)
// with data loaded across ALL batches in the institute (no teacher_id filter). The admin sees every
// conducted class, every assignment and every student across the whole institute.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, CalendarCheck, Download, LayoutDashboard, RefreshCw, Users } from "lucide-react";
import { type TimeRange } from "@/lib/teacherAnalytics";
import { loadRoster } from "@/lib/teacherAnalyticsData";
import { loadInstituteAttendance, loadInstituteMarks } from "@/lib/instituteAnalyticsData";
import { ErrorBox } from "@/components/teacher/analytics/kit";
import { useIsDark } from "@/components/teacher/analytics/theme";
import { buildModel, type AnalyticsModel, type AnalyticsView, type Loaded, type ViewProps } from "@/components/teacher/analytics/model";
import OverviewView from "@/components/teacher/analytics/OverviewView";
import MarksView from "@/components/teacher/analytics/MarksView";
import AttendanceView from "@/components/teacher/analytics/AttendanceView";
import StudentsView from "@/components/teacher/analytics/StudentsView";
import { StudentDrawer } from "@/components/teacher/analytics/StudentBits";

interface Props {
  instituteId: string;
  batches: { id: string; name: string }[];
  onNavigateTab?: (tab: string) => void;
}

const RANGE_LABEL: Record<TimeRange, string> = { "7": "last 7 days", "30": "last 30 days", "90": "last 90 days", all: "all time" };

const VIEWS: { key: AnalyticsView; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "marks", label: "Marks", icon: BarChart3 },
  { key: "attendance", label: "Attendance", icon: CalendarCheck },
  { key: "students", label: "Students", icon: Users },
];

const errText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

export default function InstituteAnalyticsTab({ instituteId, batches, onNavigateTab }: Props) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const dark = useIsDark(rootRef);

  const batchIds = useMemo(() => batches.map((b) => b.id), [batches]);
  const batchName = useMemo(() => new Map(batches.map((b) => [b.id, b.name])), [batches]);

  const [view, setView] = useState<AnalyticsView>("overview");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("30");
  const [target, setTarget] = useState<number>(75);
  const [pass, setPass] = useState<number>(33);

  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [studentKey, setStudentKey] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (selectedBatchId !== "all" && !batchIds.includes(selectedBatchId)) setSelectedBatchId("all");
  }, [batchIds, selectedBatchId]);

  const fetchData = useCallback(async () => {
    if (!instituteId || !batchIds.length) { setLoading(false); return; }
    const id = ++requestId.current;
    setLoading(true);

    const scopeIds = selectedBatchId === "all" ? batchIds : batchIds.filter((b) => b === selectedBatchId);

    const [rosterR, attR, marksR] = await Promise.allSettled([
      loadRoster(scopeIds, batchName),
      loadInstituteAttendance(instituteId, scopeIds, timeRange),
      loadInstituteMarks(instituteId, scopeIds, timeRange),
    ]);
    if (id !== requestId.current) return;

    if (rosterR.status === "rejected") console.error("institute analytics roster:", rosterR.reason);
    if (attR.status === "rejected") console.error("institute analytics attendance:", attR.reason);
    if (marksR.status === "rejected") console.error("institute analytics marks:", marksR.reason);

    setRosterError(rosterR.status === "rejected" ? errText(rosterR.reason) : null);
    setLoaded({
      roster: rosterR.status === "fulfilled" ? rosterR.value : [],
      attendance: attR.status === "fulfilled" ? { data: attR.value, error: null } : { data: null, error: errText(attR.reason) },
      marks: marksR.status === "fulfilled" ? { data: marksR.value, error: null } : { data: null, error: errText(marksR.reason) },
    });
    setLoading(false);
  }, [instituteId, batchIds, batchName, selectedBatchId, timeRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const m: AnalyticsModel | null = useMemo(
    () => (loaded ? buildModel(loaded, { range: timeRange, target, pass, batchName }) : null),
    [loaded, timeRange, target, pass, batchName]);

  const allClasses = selectedBatchId === "all";
  const selectedName = allClasses ? "all batches" : batchName.get(selectedBatchId) ?? "this batch";
  const periodText = `${selectedName} · ${RANGE_LABEL[timeRange]}`;
  const noBatches = batchIds.length === 0;
  const firstLoad = loading && !loaded;
  const student = m && studentKey ? m.rows.find((r) => r.key === studentKey) ?? null : null;
  const closeStudent = useCallback(() => setStudentKey(null), []);

  const handleExport = useCallback(async () => {
    if (!m) return;
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const add = (rows: object[], name: string) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: "Nothing in this period" }]), name);
      add([
        { Metric: "Scope", Value: selectedName },
        { Metric: "Period", Value: RANGE_LABEL[timeRange] },
        { Metric: "Students", Value: m.rows.length },
        { Metric: "Classes held", Value: m.att?.sessionsHeld ?? "—" },
        { Metric: "Attendance %", Value: m.att?.rate ?? "—" },
        { Metric: `Students below ${target}%`, Value: m.att?.defaulters.length ?? "—" },
        { Metric: "Results counted", Value: m.marks?.results ?? "—" },
        { Metric: "Institute average %", Value: m.marks?.avg ?? "—" },
        { Metric: "Highest %", Value: m.marks?.highest ?? "—" },
        { Metric: `Results at or above ${pass}%`, Value: m.marks?.passRate ?? "—" },
        { Metric: "Generated on", Value: new Date().toLocaleString("en-IN") },
      ], "Summary");
      add(m.rows.map((r) => ({
        Student: r.name, Roll_No: r.rollNo, Batch: r.batchName ?? "", Guest: r.guest ? "Yes" : "",
        Status: { high: "Needs attention", watch: "Keep an eye", ok: "On track", none: "No data yet" }[r.risk],
        Attendance_Percent: r.att?.pct ?? "", Attended: r.att?.attended ?? "", Marked: r.att?.total ?? "",
        [`Classes_Needed_For_${target}%`]: r.att && r.att.total > 0 ? r.att.needed : "",
        Absent_In_A_Row: r.att?.absentStreak ?? "",
        Average_Marks_Percent: r.marks?.avg ?? "", Results: r.marks?.count ?? "",
      })), "Students");
      add((m.att?.trend ?? []).map((t) => ({ Date: t.date, Marked: t.marked, Attendance_Percent: t.rate })), "Attendance by date");
      add((m.marks?.assessments ?? []).map((a) => ({
        Assessment: a.title, Type: a.kind === "copies" ? "Copy check" : "Assignment", Date: a.date.slice(0, 10),
        Results: a.n, Average_Percent: a.avg, Lowest_Percent: a.min, Highest_Percent: a.max, [`At_Or_Above_${pass}%`]: a.passed,
      })), "Assessments");
      XLSX.writeFile(wb, `a4ai_institute_analytics_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      console.error("Export error:", e);
      alert("Couldn't export the Excel report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [m, selectedName, timeRange, target, pass]);

  const canExport = !!m && ((m.att?.marked ?? 0) > 0 || (m.marks?.results ?? 0) > 0 || m.tracker.length > 0);

  const viewProps: ViewProps | null = m ? {
    m, dark, allClasses,
    go: setView,
    openStudent: setStudentKey,
    openAssignments: () => onNavigateTab?.("batches"),
    openCheckCopies: () => {},
    openMarkAttendance: () => onNavigateTab?.("attendance"),
  } : null;

  const errors = (() => {
    if (!loaded) return [];
    const out: string[] = [];
    if (rosterError && view !== "marks") out.push(`Student names couldn't be loaded (${rosterError}).`);
    if (loaded.attendance.error && view !== "marks") out.push(loaded.attendance.error);
    if (loaded.marks.error && view !== "attendance") out.push(loaded.marks.error);
    return out;
  })();

  const pillCls = "rounded-xl border border-orange-200 bg-white/80 px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-orange-400 dark:border-white/15 dark:bg-white/10 dark:text-white [&>option]:text-slate-900";

  return (
    <div ref={rootRef} className="space-y-5 sm:space-y-6 [--a4-spark-ring:#ffffff] dark:[--a4-spark-ring:#121212]">
      <div className="relative overflow-hidden rounded-[28px] border border-orange-100 bg-gradient-to-br from-orange-50 via-amber-50 to-rose-100 p-4 sm:p-6 text-slate-900 shadow-[0_18px_40px_-24px_rgba(234,88,12,0.45)] dark:border-orange-500/20 dark:from-orange-950/60 dark:via-amber-950/30 dark:to-rose-950/50 dark:text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-orange-200/40 dark:bg-orange-500/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-rose-200/40 dark:bg-rose-500/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-amber-200/50 dark:bg-amber-500/10" />

        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 xl:max-w-[54%]">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-700 dark:text-orange-300">Institute Analytics</p>
            <h2 className="mt-1 text-xl sm:text-3xl font-black leading-tight">How your institute is doing</h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              Showing <strong className="text-slate-900 dark:text-white">{periodText}</strong> — real numbers from every class and checked copy across your institute.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap xl:justify-end">
            {batches.length > 1 && (
              <select aria-label="Batch" value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} className={`${pillCls} max-w-[200px]`}>
                <option value="all">All batches</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            <select aria-label="Period" value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)} className={pillCls}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All time</option>
            </select>
            <button type="button" onClick={handleExport} disabled={isExporting || !canExport} aria-label="Export"
              title={canExport ? "Download an Excel report (every student)" : "Nothing to export yet"}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-rose-600 px-3.5 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:from-orange-700 hover:to-rose-700 disabled:opacity-60">
              <Download className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{isExporting ? "Exporting…" : "Export"}</span>
            </button>
            <button type="button" onClick={() => fetchData()} disabled={loading} aria-label="Refresh" title="Refresh"
              className="rounded-xl border border-orange-200 bg-white/80 p-2 text-orange-700 hover:bg-white disabled:opacity-60 dark:border-white/15 dark:bg-white/10 dark:text-orange-200 dark:hover:bg-white/15">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="relative mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div role="group" aria-label="Analytics view" className="grid grid-cols-4 gap-1.5 sm:flex">
            {VIEWS.map((v) => (
              <button key={v.key} type="button" onClick={() => setView(v.key)} aria-pressed={view === v.key}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[11px] font-extrabold touch-manipulation sm:flex-row sm:gap-2 sm:px-4 sm:text-sm ${view === v.key
                  ? "bg-white text-orange-700 shadow-md ring-1 ring-orange-200 dark:bg-orange-500 dark:text-white dark:ring-0"
                  : "bg-white/50 text-slate-700 hover:bg-white/80 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"}`}>
                <v.icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="max-w-full truncate">{v.label}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Thresholds label="Attendance target" short="Target" values={[75, 80, 85]} value={target} onChange={setTarget} />
            <Thresholds label="Pass mark" short="Pass" values={[33, 40, 50]} value={pass} onChange={setPass} />
          </div>
        </div>
      </div>

      {noBatches && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs sm:text-sm font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          No batches exist yet — create classes and batches first.
        </p>
      )}

      {errors.map((e) => <ErrorBox key={e} message={e} onRetry={fetchData} />)}

      {firstLoad && (
        <div className="space-y-5" aria-busy="true" aria-label="Loading analytics">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-36 rounded-3xl bg-slate-200/70 dark:bg-slate-800/60" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="h-72 rounded-3xl bg-slate-200/60 dark:bg-slate-800/50 lg:col-span-7" />
            <div className="h-72 rounded-3xl bg-slate-200/60 dark:bg-slate-800/50 lg:col-span-5" />
          </div>
        </div>
      )}

      {!firstLoad && viewProps && m && (
        <div className={loading ? "opacity-60" : ""}>
          {view === "overview" && <OverviewView {...viewProps} />}
          {view === "marks" && <MarksView {...viewProps} userId="" />}
          {view === "attendance" && <AttendanceView {...viewProps} />}
          {view === "students" && <StudentsView {...viewProps} />}
        </div>
      )}

      {!firstLoad && m && (
        <p className="px-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          <strong className="font-bold">How it's counted:</strong> attendance = present + late out of every marked student (leave stays in the
          total), across all teachers in the institute. Marks = approved copy checks + published assignment results, one attempt per student
          per assignment. "vs previous" compares the same number of days just before this period.
        </p>
      )}

      {m && <StudentDrawer row={student} m={m} onClose={closeStudent} />}
    </div>
  );
}

function Thresholds({ label, short, values, value, onChange }: {
  label: string; short: string; values: number[]; value: number; onChange: (v: number) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1 rounded-xl border border-orange-200 bg-white/60 px-2 py-1 text-xs font-bold dark:border-white/15 dark:bg-white/5">
      <span className="px-1 text-slate-500 dark:text-slate-400">{short}</span>
      {values.map((v) => (
        <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={value === v}
          className={`rounded-lg px-2 py-1 ${value === v ? "bg-orange-600 text-white" : "text-slate-700 hover:bg-orange-100 dark:text-slate-300 dark:hover:bg-white/10"}`}>
          {v}%
        </button>
      ))}
    </div>
  );
}
