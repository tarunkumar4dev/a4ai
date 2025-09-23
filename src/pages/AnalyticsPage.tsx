// ==========================================
// FILE: src/pages/AnalyticsPage.tsx
// Cluely-themed analytics (Halenoir Expanded Demi Bold)
// - Excel/CSV upload + auto-charts (generic inference)
// - Soft neumorphic cards, subtle grid, micro-interactions
// ==========================================
import React, { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Download, BarChart3, Users2, Clock, Target, Trophy, Upload, FileSpreadsheet } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";

// ------------------------------
// Font helper (Halenoir Expanded Demi Bold)
// ------------------------------
const hx = {
  fontFamily:
    "'Halenoir Expanded DemiBold','Halenoir Expanded','Halenoir','Inter',system-ui,sans-serif",
  fontWeight: 600,
} as const;

// ------------------------------
// Types
// ------------------------------
export type DailyUsage = { date: string; logins: number; tests: number };
export type TopicBreakdown = { name: string; correct: number; total: number };
export type LeaderboardRow = { id?: string; name: string; tests: number; avgScore: number; streak?: number };

// ------------------------------
// Mock data (fallbacks until upload)
// ------------------------------
const MOCK_DAILY: DailyUsage[] = [
  { date: "Aug 01", logins: 42, tests: 6 },
  { date: "Aug 02", logins: 55, tests: 9 },
  { date: "Aug 03", logins: 61, tests: 14 },
  { date: "Aug 04", logins: 47, tests: 7 },
  { date: "Aug 05", logins: 78, tests: 19 },
  { date: "Aug 06", logins: 90, tests: 25 },
  { date: "Aug 07", logins: 84, tests: 21 },
];

const MOCK_TOPICS: TopicBreakdown[] = [
  { name: "Electricity", correct: 312, total: 520 },
  { name: "Optics", correct: 271, total: 480 },
  { name: "Metals", correct: 198, total: 350 },
  { name: "Acids & Bases", correct: 325, total: 510 },
];

const MOCK_LEADERBOARD: LeaderboardRow[] = [
  { id: "S01", name: "Ananya Gupta", tests: 7, avgScore: 92, streak: 6 },
  { id: "S02", name: "Ravi Sharma", tests: 6, avgScore: 88, streak: 4 },
  { id: "S03", name: "Meera Iyer", tests: 5, avgScore: 86, streak: 8 },
  { id: "S04", name: "Aditya Kumar", tests: 8, avgScore: 80, streak: 2 },
];

// Utility for %
const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));

// Pies only (keep neutral yet distinct)
const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

// ---------------------------------
// File helpers (XLSX/CSV parsing)
// ---------------------------------
const normalizeKey = (k: string) => k.trim().toLowerCase().replace(/\s+/g, "_");

function sheetToJSON(ws: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, any>[];
}

function coerceNumber(v: any): number {
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function detectDailyUsage(rows: Record<string, any>[]): DailyUsage[] | null {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0] || {}).map(normalizeKey);
  const idxDate = keys.findIndex((k) => ["date", "day"].includes(k));
  const idxLogins = keys.findIndex((k) => ["logins", "login", "login_count"].includes(k));
  const idxTests = keys.findIndex((k) => ["tests", "attempts", "test", "tests_count"].includes(k));
  if (idxDate === -1 || idxLogins === -1 || idxTests === -1) return null;

  return rows.map((r) => {
    const arr = Object.values(r);
    return {
      date: String(arr[idxDate] ?? ""),
      logins: coerceNumber(arr[idxLogins]),
      tests: coerceNumber(arr[idxTests]),
    };
  });
}

function detectTopics(rows: Record<string, any>[]): TopicBreakdown[] | null {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0] || {}).map(normalizeKey);
  const idxName = keys.findIndex((k) => ["name", "topic"].includes(k));
  const idxCorrect = keys.findIndex((k) => ["correct", "right"].includes(k));
  const idxTotal = keys.findIndex((k) => ["total", "attempted", "questions"].includes(k));
  if (idxName === -1 || idxCorrect === -1 || idxTotal === -1) return null;

  return rows.map((r) => {
    const arr = Object.values(r);
    return {
      name: String(arr[idxName] ?? ""),
      correct: coerceNumber(arr[idxCorrect]),
      total: coerceNumber(arr[idxTotal]),
    };
  });
}

function detectLeaderboard(rows: Record<string, any>[]): LeaderboardRow[] | null {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0] || {}).map(normalizeKey);
  const idxName = keys.findIndex((k) => ["name", "student", "student_name"].includes(k));
  const idxTests = keys.findIndex((k) => ["tests", "attempts"].includes(k));
  const idxAvg = keys.findIndex((k) => ["avgscore", "avg_score", "average", "avg"].includes(k));
  const idxStreak = keys.findIndex((k) => ["streak", "days"].includes(k));
  const idxId = keys.findIndex((k) => ["id", "roll", "roll_no"].includes(k));
  if (idxName === -1 || idxTests === -1 || idxAvg === -1) return null;

  return rows.map((r) => {
    const arr = Object.values(r);
    return {
      id: idxId !== -1 ? String(arr[idxId] ?? "") : undefined,
      name: String(arr[idxName] ?? ""),
      tests: coerceNumber(arr[idxTests]),
      avgScore: coerceNumber(arr[idxAvg]),
      streak: idxStreak !== -1 ? coerceNumber(arr[idxStreak]) : undefined,
    };
  });
}

function parseWorkbook(wb: XLSX.WorkBook) {
  const daily: DailyUsage[] = [];
  const topics: TopicBreakdown[] = [];
  const leaders: LeaderboardRow[] = [];

  const targetSheets = wb.SheetNames.slice(0, 5);
  const firstSheetRows: Record<string, any>[] = [];

  for (const name of targetSheets) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = sheetToJSON(ws);

    const d = detectDailyUsage(rows);
    if (d) daily.push(...d);

    const t = detectTopics(rows);
    if (t) topics.push(...t);

    const l = detectLeaderboard(rows);
    if (l) leaders.push(...l);

    if (!firstSheetRows.length) firstSheetRows.push(...rows);
  }

  return { daily: daily.length ? daily : null, topics: topics.length ? topics : null, leaders: leaders.length ? leaders : null, firstSheetRows };
}

// CSV export
function downloadAllAsCSV(daily: DailyUsage[], topics: TopicBreakdown[], leaders: LeaderboardRow[]) {
  const secs: string[] = [];
  if (daily.length) {
    secs.push("# DailyUsage\ndate,logins,tests");
    daily.forEach((d) => secs.push(`${d.date},${d.logins},${d.tests}`));
    secs.push("");
  }
  if (topics.length) {
    secs.push("# TopicBreakdown\nname,correct,total,accuracy_%");
    topics.forEach((t) => secs.push(`${t.name},${t.correct},${t.total},${pct(t.correct, t.total)}`));
    secs.push("");
  }
  if (leaders.length) {
    secs.push("# Leaderboard\nid,name,tests,avgScore,streak");
    leaders.forEach((l) => secs.push(`${l.id ?? ""},${l.name},${l.tests},${l.avgScore},${l.streak ?? ""}`));
  }

  const blob = new Blob([secs.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analytics_export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Template download (3 tabs)
function downloadTemplateXLSX() {
  const wsDaily = XLSX.utils.aoa_to_sheet([["date", "logins", "tests"], ["2025-08-01", 42, 6], ["2025-08-02", 55, 9]]);
  const wsTopic = XLSX.utils.aoa_to_sheet([["name", "correct", "total"], ["Electricity", 312, 520], ["Optics", 271, 480]]);
  const wsLead = XLSX.utils.aoa_to_sheet([["id", "name", "tests", "avgScore", "streak"], ["S01", "Ananya Gupta", 7, 92, 6], ["S02", "Ravi Sharma", 6, 88, 4]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsDaily, "DailyUsage");
  XLSX.utils.book_append_sheet(wb, wsTopic, "TopicBreakdown");
  XLSX.utils.book_append_sheet(wb, wsLead, "Leaderboard");
  XLSX.writeFile(wb, "a4ai_analytics_template.xlsx");
}

// ------------------------------
// Auto-Chart (generic Excel) helpers
// ------------------------------
function isDateLike(v: any) {
  if (v instanceof Date) return true;
  const s = String(v).trim();
  if (!s) return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}

function inferGenericMeta(rows: Record<string, any>[]) {
  if (!rows.length) return { dateCol: undefined as string | undefined, categoryCol: undefined as string | undefined, numericCols: [] as string[] };
  const headers = Object.keys(rows[0]);

  // find date column
  const dateCol = headers.find((h) => rows.slice(0, 30).filter((r) => isDateLike(r[h])).length >= Math.max(5, Math.ceil(rows.length * 0.2)));

  // find numeric columns
  const numericCols = headers
    .filter((h) => {
      let nums = 0,
        seen = 0;
      for (const r of rows.slice(0, 50)) {
        const v = r[h];
        if (v === "" || v === null || v === undefined) continue;
        seen++;
        if (!Number.isNaN(Number(String(v).replace(/[^0-9.\-]/g, "")))) nums++;
      }
      return seen > 0 && nums / seen > 0.7; // mostly numeric
    })
    .slice(0, 3);

  // category = non-numeric with small cardinality
  const nonNum = headers.filter((h) => !numericCols.includes(h));
  let categoryCol: string | undefined = undefined;
  for (const h of nonNum) {
    const vals = new Set(rows.map((r) => String(r[h]).trim()).filter(Boolean));
    if (vals.size >= 2 && vals.size <= 20) {
      categoryCol = h;
      break;
    }
  }

  return { dateCol, categoryCol, numericCols };
}

function groupBy<T extends Record<string, any>>(rows: T[], key: string) {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = String(r[key] ?? "");
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  return m;
}

function sumColumn(rows: Record<string, any>[], col: string) {
  return rows.reduce((s, r) => s + coerceNumber(r[col]), 0);
}

// ------------------------------
// UI: Metric Card (Cluely style)
// ------------------------------
const MetricCard = ({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: any;
  label: string;
  value: string | number;
  hint?: string;
}) => (
  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
    <Card
      className="
        rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur
        shadow-[0_16px_40px_-16px_rgba(2,6,23,0.15)]
        hover:shadow-[0_24px_50px_-18px_rgba(2,6,23,0.20)]
        transition-all will-change-transform hover:-translate-y-[2px]
      "
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-[13px] text-slate-500" style={hx}>
          {label}
        </CardTitle>
        <div className="rounded-xl p-2 bg-slate-100">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-[22px] text-slate-900" style={hx}>
          {value}
        </div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  </motion.div>
);

export default function AnalyticsPage() {
  const [roleTab, setRoleTab] = useState<"teacher" | "student">("teacher");
  const [subject, setSubject] = useState("Science");
  const [klass, setKlass] = useState("Class 10");
  const [from, setFrom] = useState("2025-08-01");
  const [to, setTo] = useState("2025-08-07");

  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>(MOCK_DAILY);
  const [topicBreakdown, setTopicBreakdown] = useState<TopicBreakdown[]>(MOCK_TOPICS);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>(MOCK_LEADERBOARD);

  // Generic auto-charts state
  const [genericRows, setGenericRows] = useState<Record<string, any>[]>([]);
  const [genericMeta, setGenericMeta] = useState<{ dateCol?: string; categoryCol?: string; numericCols: string[] }>({
    numericCols: [],
  });

  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadInfo, setUploadInfo] = useState<string>(
    "Upload .xlsx/.csv with sheets: DailyUsage, TopicBreakdown, Leaderboard (or headers auto-detected)."
  );
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const totals = useMemo(() => {
    const totalLogins = dailyUsage.reduce((s, d) => s + d.logins, 0);
    const totalTests = dailyUsage.reduce((s, d) => s + d.tests, 0);
    const correct = topicBreakdown.reduce((s, t) => s + t.correct, 0);
    const total = topicBreakdown.reduce((s, t) => s + t.total, 0);
    return { totalLogins, totalTests, accuracy: pct(correct, total) };
  }, [dailyUsage, topicBreakdown]);

  // Pie-friendly data for topic mastery
  const topicPie = topicBreakdown.map((t) => ({ name: t.name, value: pct(t.correct, t.total) }));

  // Derived generic datasets
  const genericTimeSeries = useMemo(() => {
    if (!genericRows.length || !genericMeta.dateCol || !genericMeta.numericCols.length) return [] as any[];
    const dateCol = genericMeta.dateCol;
    const num = genericMeta.numericCols[0];
    const byDate = groupBy(genericRows, dateCol);
    const points: any[] = [];
    for (const [k, rows] of byDate.entries()) {
      const d = new Date(k);
      if (isNaN(d.getTime())) continue;
      points.push({ date: k, [num]: sumColumn(rows, num) });
    }
    points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return points;
  }, [genericRows, genericMeta]);

  const genericCategoryAgg = useMemo(() => {
    if (!genericRows.length || !genericMeta.categoryCol || !genericMeta.numericCols.length) return [] as any[];
    const c = genericMeta.categoryCol!;
    const num = genericMeta.numericCols[0];
    const byCat = groupBy(genericRows, c);
    const arr: any[] = [];
    for (const [k, rows] of byCat.entries()) {
      arr.push({ name: k || "(blank)", value: sumColumn(rows, num) });
    }
    return arr;
  }, [genericRows, genericMeta]);

  async function handleFile(file: File) {
    try {
      setParsing(true);
      setFileName(file.name);
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const { daily, topics, leaders, firstSheetRows } = parseWorkbook(wb);

      let changed = 0;
      if (daily && daily.length) {
        setDailyUsage(daily);
        changed++;
      }
      if (topics && topics.length) {
        setTopicBreakdown(topics);
        changed++;
      }
      if (leaders && leaders.length) {
        setLeaderboard(leaders);
        changed++;
      }

      if (!changed) {
        // Generic auto-chart path
        setGenericRows(firstSheetRows);
        const meta = inferGenericMeta(firstSheetRows);
        setGenericMeta(meta);
        const foundAny = (meta.dateCol || meta.categoryCol) && meta.numericCols.length;
        setUploadInfo(
          foundAny
            ? `Auto-charts from ${file.name}. Using ${meta.dateCol ? `date: ${meta.dateCol}` : "no date"}, ${
                meta.categoryCol ? `category: ${meta.categoryCol}` : "no category"
              }, numeric: ${meta.numericCols.join(", ")}`
            : `No recognized analytics sheets and couldn't infer columns. Try the Template or include at least one numeric column + (date or category).`
        );
      } else {
        // Clear generic if structured datasets found
        setGenericRows([]);
        setGenericMeta({ numericCols: [] });
        setUploadInfo(`Loaded ${changed} dataset(s) from ${file.name}.`);
      }
    } catch (e: any) {
      console.error(e);
      setUploadInfo(`Failed to parse file: ${e?.message ?? e}`);
    } finally {
      setParsing(false);
    }
  }

  // Button styles (brand blue/indigo gradient)
  const brandBtn =
    "bg-[linear-gradient(180deg,#93c5fd,#3b82f6_85%)] text-white border border-blue-300 shadow-[0_10px_24px_rgba(59,130,246,0.25)] hover:brightness-[1.06] active:brightness-[1.03] transition";

  return (
    <div
      className="
        relative min-h-screen w-full
        bg-[radial-gradient(1000px_600px_at_12%_-10%,#EDF1F7_0%,transparent_60%),radial-gradient(1000px_600px_at_88%_110%,#F7FAFF_0%,transparent_60%)]
      "
    >
      {/* faint grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative mx-auto max-w-7xl p-4 md:p-6 lg:p-8 space-y-6">
        {/* Gradient header */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <div
            className="
              relative overflow-hidden rounded-2xl ring-1 ring-black/[0.06]
              bg-[linear-gradient(120deg,rgba(99,102,241,0.10),rgba(236,72,153,0.10),rgba(16,185,129,0.10))]
              p-5 shadow-[0_16px_40px_-16px_rgba(2,6,23,0.15)]
            "
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl tracking-tight flex items-center gap-3 text-slate-900" style={hx}>
                  <BarChart3 className="h-7 w-7" /> Analytics
                  <Badge variant="secondary" className="ml-1">
                    Beta
                  </Badge>
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Upload Excel/CSV and get instant charts. Filter by class, subject and time range.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadAllAsCSV(dailyUsage, topicBreakdown, leaderboard)}
                  className="rounded-xl"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export CSV
                </Button>
                <Button variant="secondary" size="sm" onClick={downloadTemplateXLSX} className={`rounded-xl ${brandBtn}`}>
                  <FileSpreadsheet className="h-4 w-4 mr-1" />
                  Template
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filters + Upload */}
        <Card className="rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow-[0_16px_40px_-16px_rgba(2,6,23,0.15)]">
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-5 gap-3">
            {/* Role Tabs */}
            <div className="md:col-span-1">
              <label className="text-xs text-muted-foreground">Role View</label>
              <Tabs value={roleTab} onValueChange={(v) => setRoleTab(v as any)} className="mt-2">
                <TabsList className="grid grid-cols-2 rounded-xl">
                  <TabsTrigger value="teacher" className="text-sm" style={hx}>
                    Teacher
                  </TabsTrigger>
                  <TabsTrigger value="student" className="text-sm" style={hx}>
                    Student
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Class */}
            <div>
              <label className="text-xs text-muted-foreground">Class</label>
              <Select value={klass} onValueChange={setKlass}>
                <SelectTrigger className="mt-2 rounded-xl">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Class 9">Class 9</SelectItem>
                  <SelectItem value="Class 10">Class 10</SelectItem>
                  <SelectItem value="Class 11">Class 11</SelectItem>
                  <SelectItem value="Class 12">Class 12</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div>
              <label className="text-xs text-muted-foreground">Subject</label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="mt-2 rounded-xl">
                  <SelectValue placeholder="Subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Science">Science</SelectItem>
                  <SelectItem value="Maths">Maths</SelectItem>
                  <SelectItem value="English">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div>
              <label className="text-xs text-muted-foreground">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-2 rounded-xl" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-2 rounded-xl" />
            </div>
          </CardContent>

          {/* File input row */}
          <div className="px-6 pb-6">
            <div
              className="
                rounded-2xl ring-1 ring-dashed ring-black/[0.08] p-4
                flex flex-col md:flex-row items-center gap-3 justify-between
                bg-white/70
              "
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 grid place-items-center rounded-xl bg-background ring-1 ring-black/[0.06]">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="text-sm">
                  <div className="font-medium text-slate-900" style={hx}>
                    {fileName ?? "Upload .xlsx or .csv"}
                  </div>
                  <div className="text-muted-foreground">{uploadInfo}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                <Button size="sm" onClick={() => fileRef.current?.click()} disabled={parsing} className={`rounded-xl ${brandBtn}`} style={hx}>
                  {parsing ? "Parsing..." : "Choose File"}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* KPI row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard icon={Users2} label="Total Logins" value={totals.totalLogins} hint="Selected range" />
          <MetricCard icon={Trophy} label="Tests Attempted" value={totals.totalTests} hint="Across selected class" />
          <MetricCard icon={Target} label="Average Accuracy" value={`${totals.accuracy}%`} hint="Correct / total" />
          <MetricCard icon={Clock} label="Avg Time/Test" value={`14m`} hint="Median duration" />
        </div>

        {/* Charts (structured) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow-[0_16px_40px_-16px_rgba(2,6,23,0.15)]">
            <CardHeader>
              <CardTitle className="text-base text-slate-900" style={hx}>
                Daily Activity: Logins vs Tests
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyUsage} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tickMargin={8} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="logins" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="tests" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow-[0_16px_40px_-16px_rgba(2,6,23,0.15)]">
            <CardHeader>
              <CardTitle className="text-base text-slate-900" style={hx}>
                Topic Mastery (Correct %)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={topicPie} dataKey="value" nameKey="name" outerRadius={100}>
                    {topicPie.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Auto-Charts (generic) */}
        {genericRows.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-3 rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow-[0_16px_40px_-16px_rgba(2,6,23,0.15)]">
              <CardHeader>
                <CardTitle className="text-base text-slate-900" style={hx}>
                  Auto Charts from {fileName}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Detected {genericRows.length} rows. {genericMeta.dateCol ? `Date: ${genericMeta.dateCol}. ` : ""}
                  {genericMeta.categoryCol ? `Category: ${genericMeta.categoryCol}. ` : ""}Numeric:{" "}
                  {genericMeta.numericCols.join(", ") || "-"}.
                </p>
              </CardHeader>
            </Card>

            {/* Line (time series) */}
            {genericMeta.dateCol && genericMeta.numericCols.length > 0 && (
              <Card className="lg:col-span-2 rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow-[0_16px_40px_-16px_rgba(2,6,23,0.15)]">
                <CardHeader>
                  <CardTitle className="text-base text-slate-900" style={hx}>
                    Time Series ({genericMeta.numericCols[0]} by {genericMeta.dateCol})
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={genericTimeSeries}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="date" tickMargin={8} />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey={genericMeta.numericCols[0]} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Bar + Pie (category aggregates) */}
            {genericMeta.categoryCol && genericMeta.numericCols.length > 0 && (
              <>
                <Card className="rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow-[0_16px_40px_-16px_rgba(2,6,23,0.15)]">
                  <CardHeader>
                    <CardTitle className="text-base text-slate-900" style={hx}>
                      By {genericMeta.categoryCol}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={genericCategoryAgg}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="name" hide={genericCategoryAgg.length > 12} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow-[0_16px_40px_-16px_rgba(2,6,23,0.15)]">
                  <CardHeader>
                    <CardTitle className="text-base text-slate-900" style={hx}>
                      Share by {genericMeta.categoryCol}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={genericCategoryAgg} dataKey="value" nameKey="name" outerRadius={100}>
                          {genericCategoryAgg.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* Teacher vs Student Views */}
        <Tabs value={roleTab} onValueChange={(v) => setRoleTab(v as any)}>
          <TabsContent value="teacher" className="space-y-4">
            <Card className="rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow-[0_16px_40px_-16px_rgba(2,6,23,0.15)]">
              <CardHeader>
                <CardTitle className="text-base text-slate-900" style={hx}>
                  Class-wise Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "X-A", avg: 78, tests: 120 },
                      { name: "X-B", avg: 81, tests: 140 },
                      { name: "X-C", avg: 74, tests: 96 },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avg" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow-[0_16px_40px_-16px_rgba(2,6,23,0.15)]">
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-base text-slate-900" style={hx}>
                  Top Students (by Avg. Score)
                </CardTitle>
                <Badge variant="secondary">Live</Badge>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-2 font-medium" style={hx}>
                        Student
                      </th>
                      <th className="py-2 font-medium" style={hx}>
                        Tests
                      </th>
                      <th className="py-2 font-medium" style={hx}>
                        Avg Score
                      </th>
                      <th className="py-2 font-medium" style={hx}>
                        Streak
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_LEADERBOARD.map((s, i) => (
                      <tr key={s.id ?? s.name} className="border-t">
                        <td className="py-2 flex items-center gap-2">
                          <span className="text-xs w-5 h-5 grid place-items-center rounded-full bg-primary/10 text-primary" style={hx}>
                            {i + 1}
                          </span>
                          {s.name}
                        </td>
                        <td className="py-2">{s.tests}</td>
                        <td className="py-2 font-semibold">{s.avgScore}%</td>
                        <td className="py-2">🔥 {s.streak ?? 0} days</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="student" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard icon={Trophy} label="Your Best Score" value={`96%`} />
              <MetricCard icon={Target} label="Weakest Topic" value={`Optics`} hint="Suggested practice ready" />
              <MetricCard icon={Clock} label="Avg Time/Test" value={`11m`} />
            </div>

            <Card className="rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow-[0_16px_40px_-16px_rgba(2,6,23,0.15)]">
              <CardHeader>
                <CardTitle className="text-base text-slate-900" style={hx}>
                  Your Recent Tests
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-2 font-medium" style={hx}>
                        Date
                      </th>
                      <th className="py-2 font-medium" style={hx}>
                        Subject
                      </th>
                      <th className="py-2 font-medium" style={hx}>
                        Score
                      </th>
                      <th className="py-2 font-medium" style={hx}>
                        Time
                      </th>
                      <th className="py-2 font-medium" style={hx}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { date: "Aug 06", subject: "Science", score: 92, time: "12m" },
                      { date: "Aug 05", subject: "Maths", score: 84, time: "18m" },
                      { date: "Aug 03", subject: "Science", score: 77, time: "16m" },
                    ].map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="py-2">{r.date}</td>
                        <td className="py-2">{r.subject}</td>
                        <td className="py-2 font-semibold">{r.score}%</td>
                        <td className="py-2">{r.time}</td>
                        <td className="py-2">
                          <Button variant="outline" size="sm" className="rounded-xl" style={hx}>
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
