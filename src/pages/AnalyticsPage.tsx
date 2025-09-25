// src/pages/AnalyticsPage.tsx
import React from "react";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell,
  ScatterChart, Scatter, ReferenceLine, Legend
} from "recharts";

// shadcn/ui
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// icons (avoid lucide BarChart to prevent clash with Recharts)
import {
  BarChart3, Users2, Clock, Target, Trophy, Upload, Download, FileSpreadsheet,
  Building2, LayoutGrid, UserSquare2, Wand2, RefreshCw, Save, UploadCloud, Search,
  FileDown, Activity, Play, Pause, Info, SmilePlus, ThumbsUp, Gauge
} from "lucide-react";

/* =========================================================
   Error Boundary (prevents blank page on runtime errors)
   ========================================================= */
class Boundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: any }> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: undefined }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, info: any) { console.error("UI crashed:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-2xl mx-auto">
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-4">Open the console for details.</p>
          <pre className="text-xs bg-slate-50 p-3 rounded border overflow-auto">{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ================= Types & Theme ================= */
type Row = Record<string, any>;
type Role = "student" | "teacher" | "corporate";
type DailyUsage = { date: string; logins: number; tests: number };
type TopicBreakdown = { name: string; correct: number; total: number };
type LeaderboardRow = { id?: string; name: string; tests: number; avgScore: number; streak?: number };
type ColumnMapping = { dateCol?: string; categoryCol?: string; numericCols: string[] };

type TaskType = "regression" | "classification";

type RegressionModel = {
  kind: "regression";
  features: string[];
  target: string;
  weights: number[]; // includes intercept at index 0
  mu: number[];      // feature means (before standardization)
  sigma: number[];   // feature std (0 -> 1)
  metrics: { r2: number; rmse: number; mae: number; cvR2?: number; cvRMSE?: number; cvMAE?: number };
};

type ClassificationModel = {
  kind: "classification";
  features: string[];
  target: string;     // binary 0/1 target name
  weights: number[];  // includes intercept at index 0
  mu: number[];
  sigma: number[];
  threshold: number;  // 0.5 default
  metrics: { accuracy: number; precision: number; recall: number; f1: number };
};

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16", "#e11d48", "#0ea5e9"];
const hx = { fontFamily: "'Halenoir Expanded DemiBold','Inter',system-ui,sans-serif", fontWeight: 600 } as const;

/* ================= Mock (fallbacks) ================= */
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
const MOCK_LEADERS: LeaderboardRow[] = [
  { id: "S01", name: "Ananya Gupta", tests: 7, avgScore: 92, streak: 6 },
  { id: "S02", name: "Ravi Sharma", tests: 6, avgScore: 88, streak: 4 },
  { id: "S03", name: "Meera Iyer", tests: 5, avgScore: 86, streak: 8 },
  { id: "S04", name: "Aditya Kumar", tests: 8, avgScore: 80, streak: 2 },
];

/* ================= Utils (robust) ================= */
const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const normalizeKey = (k: string) => k.trim().toLowerCase().replace(/\s+/g, "_");

const isDateLikeStrict = (v: any) => {
  if (v instanceof Date && !isNaN(v.getTime())) return true;
  if (typeof v === "number" && v > 25569 && v < 60000) return true; // Excel serial (rough range)
  const s = String(v).trim();
  if (!s) return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
};

const excelSerialToDate = (n: number) => {
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const ms = n * 24 * 60 * 60 * 1000;
  return new Date(epoch.getTime() + ms);
};

// HH:MM:SS or MM:SS to seconds; Excel time fraction to seconds
const durationToSeconds = (val: any): number | null => {
  if (val == null || val === "") return null;
  if (typeof val === "number") return val;
  const s = String(val).trim();
  if (!s) return null;
  if (/^\d+:\d{2}(:\d{2})?$/.test(s)) {
    const parts = s.split(":").map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  const asNum = Number(s);
  if (!isNaN(asNum) && asNum > 0 && asNum < 2) return Math.round(asNum * 24 * 3600);
  return null;
};

// numeric-ish (%, currency, commas, sentiment words)
const numberish = (v: any): number | null => {
  if (v === "" || v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;

  const low = String(v).trim().toLowerCase();
  if (["positive", "pos"].includes(low)) return 1;
  if (["negative", "neg"].includes(low)) return -1;
  if (["neutral", "neu"].includes(low)) return 0;

  const dur = durationToSeconds(v);
  if (dur !== null) return dur;

  if (/^-?\d+(\.\d+)?\s*%$/.test(low)) {
    const n = Number(low.replace("%", ""));
    return Number.isFinite(n) ? n : null;
  }

  const n = Number(low.replace(/[^\d.\-eE]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const coerceNumber = (v: any): number => numberish(v) ?? 0;

// NOTE: keep options valid here (no cellDates; that belongs to read())
const sheetJSON = (ws: XLSX.WorkSheet) =>
  XLSX.utils.sheet_to_json<Row>(ws, { defval: "", raw: true, dateNF: "yyyy-mm-dd" });

/* ============ Detectors (works with call-center style too) ============ */
function detectDaily(rows: Row[]): DailyUsage[] | null {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0]).map(normalizeKey);
  const di = keys.findIndex((k) => ["date", "day", "calldate", "timestamp", "created_at"].includes(k));
  const li = keys.findIndex((k) => ["logins", "login", "login_count", "agents_active"].includes(k));
  const ti = keys.findIndex((k) => ["tests", "attempts", "tickets", "calls", "handled"].includes(k));
  if (di === -1 || li === -1 || ti === -1) return null;
  return rows.map((r) => {
    const v = Object.values(r);
    const rawDate = v[di];
    let dateStr = "";
    if (rawDate instanceof Date) dateStr = rawDate.toISOString().slice(0, 10);
    else if (typeof rawDate === "number") dateStr = excelSerialToDate(rawDate).toISOString().slice(0, 10);
    else dateStr = String(rawDate);
    return { date: dateStr, logins: coerceNumber(v[li]), tests: coerceNumber(v[ti]) };
  });
}
function detectTopics(rows: Row[]): TopicBreakdown[] | null {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0]).map(normalizeKey);
  const ni = keys.findIndex((k) => ["name", "topic", "skill", "queue"].includes(k));
  const ci = keys.findIndex((k) => ["correct", "right", "positive", "resolved"].includes(k));
  const ti = keys.findIndex((k) => ["total", "attempted", "questions", "calls", "tickets"].includes(k));
  if (ni === -1 || ci === -1 || ti === -1) return null;
  return rows.map((r) => {
    const v = Object.values(r);
    return { name: String(v[ni] ?? ""), correct: coerceNumber(v[ci]), total: coerceNumber(v[ti]) };
  });
}
function detectLeaders(rows: Row[]): LeaderboardRow[] | null {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0]).map(normalizeKey);
  const ni = keys.findIndex((k) => ["name", "student", "employee", "agent"].includes(k));
  const ti = keys.findIndex((k) => ["tests", "attempts", "tasks", "completed", "calls"].includes(k));
  const ai = keys.findIndex((k) => ["avgscore", "avg_score", "average", "avg", "csat", "nps", "performance"].includes(k));
  const si = keys.findIndex((k) => ["streak", "days", "sprint_streak"].includes(k));
  const id = keys.findIndex((k) => ["id", "roll", "emp_id", "agent_id"].includes(k));
  if (ni === -1 || ti === -1 || ai === -1) return null;
  return rows.map((r) => {
    const v = Object.values(r);
    return {
      id: id !== -1 ? String(v[id] ?? "") : undefined,
      name: String(v[ni] ?? ""),
      tests: coerceNumber(v[ti]),
      avgScore: coerceNumber(v[ai]),
      streak: si !== -1 ? coerceNumber(v[si]) : undefined,
    };
  });
}

/* =========== Workbook parsing with full sheet map =========== */
function parseWorkbook(wb: XLSX.WorkBook) {
  const daily: DailyUsage[] = [];
  const topics: TopicBreakdown[] = [];
  const leaders: LeaderboardRow[] = [];
  const firstSheetRows: Row[] = [];
  const sheetRowsMap: Record<string, Row[]> = {};

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]; if (!ws) continue;
    const rows = sheetJSON(ws).map(postProcessRow);
    sheetRowsMap[name] = rows;

    detectDaily(rows)?.forEach((d) => daily.push(d));
    detectTopics(rows)?.forEach((t) => topics.push(t));
    detectLeaders(rows)?.forEach((l) => leaders.push(l));

    if (!firstSheetRows.length) firstSheetRows.push(...rows);
  }
  return {
    daily: daily.length ? daily : null,
    topics: topics.length ? topics : null,
    leaders: leaders.length ? leaders : null,
    firstSheetRows,
    sheetRowsMap,
  };
}

/* ======== Post-process rows (call-center aware) ======== */
function postProcessRow(r: Row): Row {
  const out: Row = { ...r };
  for (const k of Object.keys(out)) {
    const key = k.toLowerCase();
    const v = out[k];

    if (typeof v === "number" && isDateLikeStrict(v)) out[k] = excelSerialToDate(v);

    if (/(duration|talk_time|handle_time|aht|call_duration)/i.test(key)) {
      const sec = durationToSeconds(v);
      if (sec !== null) {
        out[k] = sec;
        if (!("Duration_s" in out)) out["Duration_s"] = sec;
      }
    }

    if (/(csat|nps|satisfaction|sla|service_level|completion_rate|accuracy)/i.test(key) || (typeof v === "string" && v.includes("%"))) {
      const n = numberish(v);
      if (n !== null) {
        out[k] = n;
        if (/csat/i.test(key) && !("CSAT_pct" in out)) out["CSAT_pct"] = n;
        if (/nps/i.test(key) && !("NPS" in out)) out["NPS"] = n;
      }
    }

    if (/(sentiment|mood|polarity)/i.test(key)) {
      const n = numberish(v);
      if (n !== null) {
        out[k] = n;
        if (!("Sentiment_num" in out)) out["Sentiment_num"] = n;
      }
    }
  }
  return out;
}

/* ================= Generic inference (improved) ================= */
function inferGenericMeta(rows: Row[]) {
  if (!rows.length) return { dateCol: undefined as string | undefined, categoryCol: undefined as string | undefined, numericCols: [] as string[] };
  const headers = Object.keys(rows[0]);

  const preferredDateNames = ["date", "day", "calldate", "timestamp", "created_at", "call_date", "time", "datetime"];
  const preferredDate =
    headers.find((h) => preferredDateNames.includes(h.toLowerCase())) ||
    headers.find((h) => rows.slice(0, 200).filter((r) => isDateLikeStrict(r[h])).length >= Math.max(5, Math.ceil(rows.length * 0.2)));
  const dateCol = preferredDate;

  const numericCols = headers.filter((h) => {
    let nums = 0, seen = 0;
    for (const r of rows.slice(0, 400)) {
      const v = r[h]; if (v === "" || v == null) continue;
      seen++; if (numberish(v) !== null) nums++;
    }
    return seen > 0 && nums / seen > 0.6;
  });

  const metricOrderPriority = (h: string) => {
    const l = h.toLowerCase();
    if (/(duration_s|duration|aht|handle_time|talk_time|call_duration)/.test(l)) return 0;
    if (/(csat_pct|csat|nps|sentiment_num|sentiment|sla|accuracy)/.test(l)) return 1;
    if (/(calls|tickets|handled|resolved|completed|tests|attempts)/.test(l)) return 2;
    return 3;
  };
  const sortedNumeric = [...numericCols].sort((a, b) => metricOrderPriority(a) - metricOrderPriority(b)).slice(0, 12);

  const catPriority = (h: string) => {
    const l = h.toLowerCase();
    if (/(agent|employee|user|student)/.test(l)) return 0;
    if (/(queue|team|dept|class|section|channel)/.test(l)) return 1;
    if (/(region|country|city)/.test(l)) return 2;
    if (/(topic|skill|subject)/.test(l)) return 3;
    return 4;
  };
  const candidateCats = headers
    .filter((h) => !sortedNumeric.includes(h))
    .map((h) => {
      const vals = new Set(rows.map((r) => String(r[h]).trim()).filter(Boolean).slice(0, 5000));
      return { h, card: vals.size };
    })
    .filter(({ card }) => card >= 2 && card <= 200)
    .sort((a, b) => catPriority(a.h) - catPriority(b.h));
  const categoryCol = candidateCats[0]?.h;

  return { dateCol, categoryCol, numericCols: sortedNumeric };
}

function groupBy<T extends Row>(rows: T[], key: string) {
  const m = new Map<string, T[]>();
  for (const r of rows) { const k = String(r[key] ?? ""); if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); }
  return m;
}
const sumCol = (rows: Row[], col: string) => rows.reduce((s, r) => s + (numberish(r[col]) ?? 0), 0);

/* ================= CSV Export & Template ================= */
function exportAllAsCSV(daily: DailyUsage[], topics: TopicBreakdown[], leaders: LeaderboardRow[]) {
  const secs: string[] = [];
  if (daily.length) { secs.push("# DailyUsage\ndate,logins,tests"); daily.forEach((d) => secs.push(`${d.date},${d.logins},${d.tests}`)); secs.push(""); }
  if (topics.length) { secs.push("# TopicBreakdown\nname,correct,total,accuracy_%"); topics.forEach((t) => secs.push(`${t.name},${t.correct},${t.total},${pct(t.correct, t.total)}`)); secs.push(""); }
  if (leaders.length) { secs.push("# Leaderboard\nid,name,tests,avgScore,streak"); leaders.forEach((l) => secs.push(`${l.id ?? ""},${l.name},${l.tests},${l.avgScore},${l.streak ?? ""}`)); }
  const blob = new Blob([secs.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = `analytics_export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function downloadTemplateXLSX() {
  const wsDaily = XLSX.utils.aoa_to_sheet([["date", "logins", "tests"], ["2025-08-01", 42, 6], ["2025-08-02", 55, 9]]);
  const wsTopic = XLSX.utils.aoa_to_sheet([["name", "correct", "total"], ["Electricity", 312, 520], ["Optics", 271, 480]]);
  const wsLead = XLSX.utils.aoa_to_sheet([["id", "name", "tests", "avgScore", "streak"], ["EMP01", "Alex", 12, 88, 5]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsDaily, "DailyUsage");
  XLSX.utils.book_append_sheet(wb, wsTopic, "TopicBreakdown");
  XLSX.utils.book_append_sheet(wb, wsLead, "Leaderboard");
  XLSX.writeFile(wb, "analytics_template.xlsx");
}

/* ================= Column Mapper Dialog ================= */
function ColumnMapperDialog({
  open, onOpenChange, headers, initial, onApply
}: { open: boolean; onOpenChange: (v: boolean) => void; headers: string[]; initial: ColumnMapping; onApply: (m: ColumnMapping) => void; }) {
  const safeHeaders = Array.isArray(headers) ? headers : [];
  const [dateCol, setDateCol] = React.useState<string | undefined>(initial?.dateCol);
  const [categoryCol, setCategoryCol] = React.useState<string | undefined>(initial?.categoryCol);
  const [nums, setNums] = React.useState<string[]>(initial?.numericCols ?? []);
  React.useEffect(() => { setDateCol(initial?.dateCol); setCategoryCol(initial?.categoryCol); setNums(initial?.numericCols ?? []); }, [initial]);

  const toggle = (h: string) => setNums((prev) => (prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]).slice(0, 12));
  const apply = () => { onApply({ dateCol: dateCol || undefined, categoryCol: categoryCol || undefined, numericCols: nums }); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl z-[999]">
        <DialogHeader><DialogTitle>Map columns</DialogTitle></DialogHeader>
        {safeHeaders.length === 0 ? (
          <div className="text-sm text-muted-foreground">No columns detected yet. Upload a CSV/XLSX first.</div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Date column (optional)</Label>
              <Select value={dateCol ?? ""} onValueChange={(v) => setDateCol(v || undefined)}>
                <SelectTrigger><SelectValue placeholder="Pick a date column" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="">(none)</SelectItem>
                  {safeHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Category column (optional)</Label>
              <Select value={categoryCol ?? ""} onValueChange={(v) => setCategoryCol(v || undefined)}>
                <SelectTrigger><SelectValue placeholder="Pick a category column" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="">(none)</SelectItem>
                  {safeHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Numeric columns (toggle up to 12)</Label>
              <div className="flex flex-wrap gap-2">
                {safeHeaders.map(h => (
                  <button
                    key={h}
                    onClick={() => toggle(h)}
                    className={`px-3 py-1 rounded-lg text-xs border ${nums.includes(h) ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-slate-50"}`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={apply} className="bg-blue-600 text-white" disabled={safeHeaders.length === 0}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Data Profiler (quick quality check) ================= */
type ColStat = { column: string; type: "numeric" | "date" | "text"; missing: number; unique: number; min?: number; max?: number; mean?: number; p25?: number; p50?: number; p75?: number; outliers?: number; };
const quantile = (arr: number[], p: number) => {
  if (!arr.length) return undefined as any;
  const i = (arr.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); const h = i - lo;
  return arr[lo] + (arr[hi] - arr[lo]) * h;
};
function profileColumns(rows: Row[], headers: string[], dateCol?: string): ColStat[] {
  const N = rows.length || 1;
  const res: ColStat[] = [];
  for (const h of headers) {
    const vals = rows.map(r => r[h]).filter(v => v !== "" && v != null);
    const missing = clamp(Math.round(((N - vals.length) / N) * 100), 0, 100);
    const uniques = new Set(vals.map(v => String(v))).size;
    const isNum = vals.filter(v => numberish(v) !== null).length >= Math.max(3, Math.round(vals.length * 0.6));
    const isDate = !isNum && vals.filter(v => isDateLikeStrict(v)).length >= Math.max(3, Math.round(vals.length * 0.6));

    if (isNum) {
      const nums = vals.map(v => numberish(v) as number).filter((v) => v != null).sort((a, b) => a - b);
      const mean = nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
      const sd = Math.sqrt(nums.reduce((s, v) => s + (v - mean) * (v - mean), 0) / (nums.length || 1));
      const out = nums.filter(v => Math.abs((v - mean) / (sd || 1)) > 3).length;
      res.push({
        column: h, type: "numeric", missing, unique: uniques,
        min: nums[0], max: nums[nums.length - 1], mean: Math.round(mean * 100) / 100,
        p25: Math.round((quantile(nums, 0.25) ?? 0) * 100) / 100,
        p50: Math.round((quantile(nums, 0.5) ?? 0) * 100) / 100,
        p75: Math.round((quantile(nums, 0.75) ?? 0) * 100) / 100,
        outliers: out
      });
    } else if (isDate || h === dateCol) {
      res.push({ column: h, type: "date", missing, unique: uniques });
    } else {
      res.push({ column: h, type: "text", missing: uniques ? missing : 100, unique: uniques });
    }
  }
  return res;
}
function ProfilerDialog({ open, onOpenChange, rows, headers, dateCol }: { open: boolean; onOpenChange: (v: boolean) => void; rows: Row[]; headers: string[]; dateCol?: string }) {
  const stats = React.useMemo(() => profileColumns(rows, headers, dateCol), [rows, headers, dateCol]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Data quality & column stats</DialogTitle></DialogHeader>
        {headers.length === 0 ? (
          <div className="text-sm text-muted-foreground">Upload a file to see profiling.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Column</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Missing %</TableHead>
                  <TableHead>Unique</TableHead>
                  <TableHead>Min</TableHead>
                  <TableHead>p25</TableHead>
                  <TableHead>Median</TableHead>
                  <TableHead>p75</TableHead>
                  <TableHead>Max</TableHead>
                  <TableHead>Outliers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((s) => (
                  <TableRow key={s.column}>
                    <TableCell className="font-medium">{s.column}</TableCell>
                    <TableCell>{s.type}</TableCell>
                    <TableCell>{s.missing}%</TableCell>
                    <TableCell>{s.unique}</TableCell>
                    <TableCell>{s.min ?? "-"}</TableCell>
                    <TableCell>{s.p25 ?? "-"}</TableCell>
                    <TableCell>{s.p50 ?? "-"}</TableCell>
                    <TableCell>{s.p75 ?? "-"}</TableCell>
                    <TableCell>{s.max ?? "-"}</TableCell>
                    <TableCell>{s.outliers ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <DialogFooter><Button onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Metric Card ================= */
const MetricCard = ({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string | number; hint?: string }) => (
  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
    <Card className="rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow-[0_16px_40px_-16px_rgba(2,6,23,0.15)] hover:shadow-[0_24px_50px_-18px_rgba(2,6,23,0.20)] transition-all hover:-translate-y-[2px]">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-[13px] text-slate-500" style={hx}>{label}</CardTitle>
        <div className="rounded-xl p-2 bg-slate-100"><Icon className="h-4 w-4" /></div>
      </CardHeader>
      <CardContent>
        <div className="text-[22px] text-slate-900" style={hx}>{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  </motion.div>
);

/* ================= Insights ================= */
function makeInsights(daily: DailyUsage[], topics: TopicBreakdown[]) {
  const insights: string[] = [];
  if (daily.length >= 3) {
    const last = daily.slice(-3).map(d => d.tests);
    if (last[2] > last[1] && last[1] > last[0]) insights.push("Tests are trending up over the last 3 days.");
    if (last[2] < last[1] && last[1] < last[0]) insights.push("Tests are trending down over the last 3 days.");
  }
  if (topics.length) {
    const worst = [...topics].sort((a, b) => pct(a.correct, a.total) - pct(b.correct, b.total))[0];
    const best = [...topics].sort((a, b) => pct(b.correct, b.total) - pct(a.correct, a.total))[0];
    if (worst) insights.push(`Weakest topic: ${worst.name} (${pct(worst.correct, worst.total)}%).`);
    if (best) insights.push(`Strongest topic: ${best.name} (${pct(best.correct, best.total)}%).`);
  }
  if (!insights.length) insights.push("Upload data to generate insights.");
  return insights;
}

/* ======================= ML: helpers ======================= */
function standardize(X: number[][]) {
  const n = X.length, p = X[0]?.length ?? 0;
  const mu = Array(p).fill(0);
  const sigma = Array(p).fill(0);

  for (let j = 0; j < p; j++) {
    let sum = 0, cnt = 0;
    for (let i = 0; i < n; i++) { const v = X[i][j]; if (Number.isFinite(v)) { sum += v; cnt++; } }
    mu[j] = cnt ? sum / cnt : 0;
    let ss = 0;
    for (let i = 0; i < n; i++) { const v = X[i][j]; const d = (Number.isFinite(v) ? v : mu[j]) - mu[j]; ss += d * d; }
    sigma[j] = Math.sqrt(ss / (cnt || 1)) || 1;
  }

  const Z = X.map(row => row.map((v, j) => ((Number.isFinite(v) ? v : mu[j]) - mu[j]) / (sigma[j] || 1)));
  return { Z, mu, sigma };
}
function addIntercept(Z: number[][]) {
  return Z.map(r => [1, ...r]);
}
function matMul(A: number[][], B: number[][]): number[][] {
  const n = A.length, m = A[0].length, p = B[0].length;
  const out: number[][] = Array.from({ length: n }, () => Array(p).fill(0));
  for (let i = 0; i < n; i++) for (let k = 0; k < m; k++) { const aik = A[i][k]; if (aik === 0) continue; for (let j = 0; j < p; j++) out[i][j] += aik * B[k][j]; }
  return out;
}
function matT(A: number[][]): number[][] {
  const n = A.length, m = A[0].length; const T: number[][] = Array.from({ length: m }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) T[j][i] = A[i][j];
  return T;
}
function eye(n: number, v = 1): number[][] { return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => i === j ? v : 0)); }
function gaussJordanInverse(M: number[][]): number[][] {
  const n = M.length;
  const A = M.map(r => r.slice());
  const I = eye(n);
  for (let i = 0; i < n; i++) {
    // pivot
    let pivot = A[i][i]; let r = i;
    for (let k = i + 1; k < n; k++) { if (Math.abs(A[k][i]) > Math.abs(pivot)) { pivot = A[k][i]; r = k; } }
    if (Math.abs(pivot) < 1e-12) pivot = 1e-12;
    if (r !== i) { [A[i], A[r]] = [A[r], A[i]];[I[i], I[r]] = [I[r], I[i]]; }
    // normalize
    const d = A[i][i] || 1e-12;
    for (let j = 0; j < n; j++) { A[i][j] /= d; I[i][j] /= d; }
    // eliminate
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const f = A[k][i];
      for (let j = 0; j < n; j++) { A[k][j] -= f * A[i][j]; I[k][j] -= f * I[i][j]; }
    }
  }
  return I;
}

/* ============ Linear Regression (ridge) ============ */
function trainRidgeRegression(Xraw: number[][], y: number[], lambda = 1e-6) {
  const { Z, mu, sigma } = standardize(Xraw);
  const X = addIntercept(Z);
  const Xt = matT(X);
  // (X^T X + λI)^-1 X^T y
  const XtX = matMul(Xt, X);
  for (let i = 0; i < XtX.length; i++) XtX[i][i] += lambda; // ridge
  const Inv = gaussJordanInverse(XtX);
  const Xty = matMul(Xt, y.map(v => [v]));
  const W = matMul(Inv, Xty).map(r => r[0]); // [w0, w1..wp]

  const yhat = X.map(r => r.reduce((s, v, j) => s + v * W[j], 0));
  const n = y.length;
  const ybar = y.reduce((a, b) => a + b, 0) / n;
  const ssRes = y.reduce((s, yi, i) => s + (yi - yhat[i]) ** 2, 0);
  const ssTot = y.reduce((s, yi) => s + (yi - ybar) ** 2, 0) || 1;
  const r2 = 1 - ssRes / ssTot;
  const rmse = Math.sqrt(ssRes / n);
  const mae = y.reduce((s, yi, i) => s + Math.abs(yi - yhat[i]), 0) / n;

  return { weights: W, mu, sigma, metrics: { r2, rmse, mae } };
}
function predictRegression(model: RegressionModel, Xraw: number[][]) {
  const Z = Xraw.map(row => row.map((v, j) => ((Number.isFinite(v) ? v : model.mu[j]) - model.mu[j]) / (model.sigma[j] || 1)));
  return Z.map(r => [1, ...r].reduce((s, v, j) => s + v * model.weights[j], 0));
}
function kfoldRegression(X: number[][], y: number[], k = 5, lambda = 1e-6) {
  const idx = Array.from({ length: y.length }, (_, i) => i);
  // simple split (no shuffle to keep determinism)
  const foldSize = Math.max(1, Math.floor(y.length / k));
  let r2 = 0, rmse = 0, mae = 0, folds = 0;
  for (let f = 0; f < k; f++) {
    const start = f * foldSize, end = Math.min(y.length, start + foldSize);
    if (start >= end) break;
    const test = new Set(idx.slice(start, end));
    const Xtr: number[][] = [], ytr: number[] = [], Xte: number[][] = [], yte: number[] = [];
    for (let i = 0; i < y.length; i++) {
      if (test.has(i)) { Xte.push(X[i]); yte.push(y[i]); } else { Xtr.push(X[i]); ytr.push(y[i]); }
    }
    const m = trainRidgeRegression(Xtr, ytr, lambda);
    const yhat = predictRegression({ kind: "regression", features: [], target: "", weights: m.weights, mu: m.mu, sigma: m.sigma, metrics: { r2: 0, rmse: 0, mae: 0 } }, Xte);
    const n = yte.length || 1;
    const ybar = yte.reduce((a, b) => a + b, 0) / n;
    const ssRes = yte.reduce((s, yi, i) => s + (yi - yhat[i]) ** 2, 0);
    const ssTot = yte.reduce((s, yi) => s + (yi - ybar) ** 2, 0) || 1;
    r2 += 1 - ssRes / ssTot;
    rmse += Math.sqrt(ssRes / n);
    mae += yte.reduce((s, yi, i) => s + Math.abs(yi - yhat[i]), 0) / n;
    folds++;
  }
  return { r2: r2 / (folds || 1), rmse: rmse / (folds || 1), mae: mae / (folds || 1) };
}

/* ============ Logistic Regression (binary) ============ */
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
function trainLogisticGD(Xraw: number[][], ybin: number[], lr = 0.1, epochs = 800, l2 = 1e-4) {
  const { Z, mu, sigma } = standardize(Xraw);
  const X = addIntercept(Z);
  const n = X.length, p = X[0].length;
  const w = Array(p).fill(0);

  for (let t = 0; t < epochs; t++) {
    const grad = Array(p).fill(0);
    for (let i = 0; i < n; i++) {
      const z = X[i].reduce((s, v, j) => s + v * w[j], 0);
      const p1 = sigmoid(z);
      const err = p1 - ybin[i];
      for (let j = 0; j < p; j++) grad[j] += X[i][j] * err;
    }
    for (let j = 0; j < p; j++) {
      const reg = j === 0 ? 0 : l2 * w[j];
      w[j] -= lr * ((grad[j] / n) + reg);
    }
  }
  return { weights: w, mu, sigma };
}
function predictLogistic(model: ClassificationModel, Xraw: number[][]) {
  const Z = Xraw.map(row => row.map((v, j) => ((Number.isFinite(v) ? v : model.mu[j]) - model.mu[j]) / (model.sigma[j] || 1)));
  const p = Z.map(r => [1, ...r].reduce((s, v, j) => s + v * model.weights[j], 0)).map(sigmoid);
  const yhat = p.map(v => (v >= model.threshold ? 1 : 0));
  return { p, yhat };
}
function classMetrics(y: number[], yhat: number[]) {
  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (let i = 0; i < y.length; i++) {
    if (y[i] === 1 && yhat[i] === 1) tp++;
    else if (y[i] === 0 && yhat[i] === 0) tn++;
    else if (y[i] === 0 && yhat[i] === 1) fp++;
    else if (y[i] === 1 && yhat[i] === 0) fn++;
  }
  const acc = (tp + tn) / Math.max(1, y.length);
  const prec = tp / Math.max(1, (tp + fp));
  const rec = tp / Math.max(1, (tp + fn));
  const f1 = (prec + rec) ? (2 * prec * rec) / (prec + rec) : 0;
  return { accuracy: round4(acc), precision: round4(prec), recall: round4(rec), f1: round4(f1), tp, tn, fp, fn };
}
function round4(x: number) { return Math.round(x * 10000) / 10000; }

/* ============== Pivot Builder (unchanged) ============== */
type Agg = "sum" | "avg" | "count" | "median";
function aggregate(values: number[], fn: Agg): number {
  if (fn === "count") return values.length;
  if (!values.length) return 0;
  if (fn === "sum") return values.reduce((a, b) => a + b, 0);
  if (fn === "avg") return values.reduce((a, b) => a + b, 0) / values.length;
  if (fn === "median") {
    const s = [...values].sort((a, b) => a - b);
    const i = Math.floor(s.length / 2);
    return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
  }
  return 0;
}
function computePivot(rows: Row[], dims: string[], metrics: string[], fn: Agg): Row[] {
  if (!rows.length || !metrics.length) return [];
  const keyOf = (r: Row) => dims.map((d) => String(r[d] ?? "")).join(" | ");
  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    const k = keyOf(r);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  const result: Row[] = [];
  for (const [k, grp] of buckets.entries()) {
    const row: Row = {};
    dims.forEach((d, i) => (row[d] = String(k.split(" | ")[i] ?? "")));
    for (const m of metrics) {
      const vals = grp.map((g) => numberish(g[m]) ?? 0);
      row[`${fn.toUpperCase()}(${m})`] = Math.round(aggregate(vals, fn) * 100) / 100;
    }
    result.push(row);
  }
  return result;
}

/* ======================= Page ======================= */
const STORAGE_KEY = "a4ai_analytics_session_v4";

export default function AnalyticsPage() {
  const [role, setRole] = React.useState<Role>("teacher");

  // shared filters
  const [subject, setSubject] = React.useState("Science");
  const [klass, setKlass] = React.useState("Class 10");
  const [team, setTeam] = React.useState("Team Alpha");
  const [from, setFrom] = React.useState("2025-08-01");
  const [to, setTo] = React.useState("2025-08-07");

  // structured data (recognized sheets)
  const [daily, setDaily] = React.useState<DailyUsage[]>(MOCK_DAILY);
  const [topics, setTopics] = React.useState<TopicBreakdown[]>(MOCK_TOPICS);
  const [leaders, setLeaders] = React.useState<LeaderboardRow[]>(MOCK_LEADERS);

  // workbook / sheets
  const [sheetRowsMap, setSheetRowsMap] = React.useState<Record<string, Row[]>>({});
  const sheetNames = React.useMemo(() => Object.keys(sheetRowsMap), [sheetRowsMap]);
  const [activeSheet, setActiveSheet] = React.useState<string | null>(null);

  // generic (fallback) data
  const [rows, setRows] = React.useState<Row[]>([]);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [meta, setMeta] = React.useState<ColumnMapping>({ numericCols: [] });
  const [selectedNumeric, setSelectedNumeric] = React.useState<string | undefined>(undefined);
  const [selectedNumerics, setSelectedNumerics] = React.useState<string[]>([]);
  const [metricForCategory, setMetricForCategory] = React.useState<string | undefined>(undefined);

  // upload state & messages
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState("Upload .xlsx/.csv — we auto-detect known sheets or infer columns for generic reports.");
  const [banner, setBanner] = React.useState<string | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  // dialogs
  const [mapOpen, setMapOpen] = React.useState(false);
  const [profOpen, setProfOpen] = React.useState(false);

  // search & filter
  const [query, setQuery] = React.useState("");
  const [topN, setTopN] = React.useState(15);

  // pivot state
  const [pivotDims, setPivotDims] = React.useState<string[]>([]);
  const [pivotMetrics, setPivotMetrics] = React.useState<string[]>([]);
  const [pivotAgg, setPivotAgg] = React.useState<Agg>("sum");
  const pivotRows = React.useMemo(() => computePivot(rows, pivotDims, pivotMetrics, pivotAgg), [rows, pivotDims, pivotMetrics, pivotAgg]);

  // live mode
  const [live, setLive] = React.useState(false);
  const liveRef = React.useRef<number | null>(null);

  // computed totals
  const totals = React.useMemo(() => {
    const totalLogins = daily.reduce((s, d) => s + d.logins, 0);
    const totalTests = daily.reduce((s, d) => s + d.tests, 0);
    const correct = topics.reduce((s, t) => s + t.correct, 0);
    const total = topics.reduce((s, t) => s + t.total, 0);
    return { totalLogins, totalTests, accuracy: pct(correct, total) };
  }, [daily, topics]);

  const topicPie = topics.map((t) => ({ name: t.name, value: pct(t.correct, t.total) }));
  const insights = React.useMemo(() => makeInsights(daily, topics), [daily, topics]);

  // derived (generic) rows with filters
  const filteredRows = React.useMemo(() => {
    if (!rows.length) return rows;
    let r = rows;
    if (meta.dateCol && from) r = r.filter(x => !x[meta.dateCol!] || new Date(x[meta.dateCol!]) >= new Date(from));
    if (meta.dateCol && to) r = r.filter(x => !x[meta.dateCol!] || new Date(x[meta.dateCol!]) <= new Date(to));
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter(row => headers.some(h => String(row[h]).toLowerCase().includes(q)));
    }
    return r;
  }, [rows, meta, from, to, query, headers]);

  const tsData = React.useMemo(() => {
    if (!filteredRows.length || !meta.dateCol) return [] as any[];
    const byDate = groupBy(filteredRows, meta.dateCol);
    const arr: any[] = [];
    for (const [k, grp] of byDate.entries()) {
      const t = Date.parse(k);
      const dateStr = isNaN(t) ? String(k) : new Date(t).toISOString().slice(0, 10);
      const o: any = { date: dateStr };
      for (const m of (selectedNumerics.length ? selectedNumerics : (selectedNumeric ? [selectedNumeric] : []))) {
        o[m] = sumCol(grp, m);
      }
      arr.push(o);
    }
    return arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredRows, meta, selectedNumerics, selectedNumeric]);

  const catAgg = React.useMemo(() => {
    const metric = metricForCategory || selectedNumeric || selectedNumerics[0];
    if (!filteredRows.length || !meta.categoryCol || !metric) return [] as any[];
    const by = groupBy(filteredRows, meta.categoryCol);
    const arr: any[] = [];
    for (const [k, grp] of by.entries()) arr.push({ name: k || "(blank)", value: sumCol(grp, metric) });
    arr.sort((a, b) => b.value - a.value);
    return arr.slice(0, topN);
  }, [filteredRows, meta, selectedNumeric, selectedNumerics, metricForCategory, topN]);

  const summary = React.useMemo(() => {
    const rowCount = filteredRows.length;
    const dateSpan = (() => {
      if (!filteredRows.length || !meta.dateCol) return null;
      const dates = filteredRows.map(r => new Date(r[meta.dateCol!])).filter(d => !isNaN(d.getTime()));
      if (!dates.length) return null;
      const min = new Date(Math.min(...dates.map(d => d.getTime())));
      const max = new Date(Math.max(...dates.map(d => d.getTime())));
      return { min, max };
    })();
    const numericCount = meta.numericCols.length;
    return { rowCount, dateSpan, numericCount };
  }, [filteredRows, meta]);

  // ==== ML state ====
  const [task, setTask] = React.useState<TaskType>("regression");
  const [mlTarget, setMlTarget] = React.useState<string>("");
  const [mlFeatures, setMlFeatures] = React.useState<string[]>([]);
  const [ridge, setRidge] = React.useState(1e-6);
  const [kfold, setKfold] = React.useState(5);

  const [learnRate, setLearnRate] = React.useState(0.1);
  const [epochs, setEpochs] = React.useState(800);
  const [threshold, setThreshold] = React.useState(0.5);

  const [regModel, setRegModel] = React.useState<RegressionModel | null>(null);
  const [clfModel, setClfModel] = React.useState<ClassificationModel | null>(null);
  const [regEval, setRegEval] = React.useState<{ actual: number; predicted: number }[]>([]);
  const [clfEval, setClfEval] = React.useState<{ actual: number; predicted: number; p: number }[]>([]);

  // Single-prediction form
  const [predictForm, setPredictForm] = React.useState<Record<string, string>>({});

  // ==== File handling ====
  async function handleFile(file: File) {
    try {
      setParsing(true); setFileName(file.name); setBanner("Parsing file…");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });

      const parsed = parseWorkbook(wb);

      let matched = 0;
      if (parsed.daily) { setDaily(parsed.daily); matched++; }
      if (parsed.topics) { setTopics(parsed.topics); matched++; }
      if (parsed.leaders) { setLeaders(parsed.leaders); matched++; }

      setSheetRowsMap(parsed.sheetRowsMap);
      const first = parsed.firstSheetRows;
      const firstSheetName = Object.keys(parsed.sheetRowsMap)[0] || null;
      setActiveSheet(firstSheetName);
      setRows(first);
      setHeaders(first.length ? Object.keys(first[0]) : []);
      if (first.length) {
        const m = inferGenericMeta(first); setMeta(m);
        const ok = (m.dateCol || m.categoryCol) && m.numericCols.length;
        setSelectedNumeric(m.numericCols[0]);
        setSelectedNumerics(m.numericCols.slice(0, 3));
        setMetricForCategory(m.numericCols[0]);

        // ML defaults
        const targetGuess = m.numericCols.find(h => /csat|score|nps|target|label/i.test(h)) || m.numericCols[0];
        const featureGuess = m.numericCols.filter(h => h !== targetGuess).slice(0, 5);
        setMlTarget(targetGuess || "");
        setMlFeatures(featureGuess);
        setPredictForm(Object.fromEntries(featureGuess.map(f => [f, "0"])));

        setInfo(ok
          ? `Auto-charts from ${file.name}. ${m.dateCol ? `Date=${m.dateCol}; ` : ""}${m.categoryCol ? `Category=${m.categoryCol}; ` : ""}Numeric=${m.numericCols.join(", ")}`
          : `Could not infer columns. Use "Map Columns" to select date/category/numeric.`);
        setBanner(ok ? "Parsed ✓ — Auto-charts ready" : "We couldn't infer your columns. Click “Map Columns”.");
      } else {
        setMeta({ numericCols: [] });
        setSelectedNumeric(undefined);
        setSelectedNumerics([]);
        setMetricForCategory(undefined);
        setInfo(`Loaded ${matched} dataset(s) from ${file.name}.`);
        setBanner("No tabular rows found on first sheet.");
      }
    } catch (e: any) {
      console.error(e);
      setInfo(`Failed to parse file: ${e?.message ?? e}`);
      setBanner("File parse failed. Ensure the file is a valid CSV/XLSX.");
    } finally {
      setParsing(false);
      setTimeout(() => setBanner(null), 4500);
    }
  }

  // ==== Apply mappings ====
  function applyMapping(m: ColumnMapping) {
    setMeta({ dateCol: m.dateCol, categoryCol: m.categoryCol, numericCols: m.numericCols });
    setSelectedNumeric(m.numericCols[0]);
    setSelectedNumerics(m.numericCols.slice(0, 3));
    setMetricForCategory(m.numericCols[0]);
    // refresh pivot defaults
    setPivotDims([m.categoryCol!].filter(Boolean).slice(0, 1) as string[]);
    setPivotMetrics(m.numericCols.slice(0, 2));
    // ML defaults refresh
    const targetGuess = m.numericCols.find(h => /csat|score|nps|target|label/i.test(h)) || m.numericCols[0] || "";
    const featureGuess = m.numericCols.filter(h => h !== targetGuess).slice(0, 5);
    setMlTarget(targetGuess);
    setMlFeatures(featureGuess);
    setPredictForm(Object.fromEntries(featureGuess.map(f => [f, "0"])));
    setBanner("Mapping applied.");
    setTimeout(() => setBanner(null), 3000);
  }

  // ==== Save / Load session (localStorage) ====
  function saveSession() {
    const sess = {
      role, subject, klass, team, from, to,
      daily, topics, leaders,
      rows: rows.slice(0, 500),
      headers,
      meta,
      selectedNumeric, selectedNumerics, metricForCategory,
      sheetRowsMap: Object.fromEntries(Object.entries(sheetRowsMap).map(([k, v]) => [k, v.slice(0, 200)])),
      activeSheet,
      fileName,
      pivotDims, pivotMetrics, pivotAgg,
      task, mlTarget, mlFeatures, ridge, kfold, learnRate, epochs, threshold
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sess));
    setBanner("Session saved locally.");
    setTimeout(() => setBanner(null), 3000);
  }
  function loadSession() {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) { setBanner("No saved session found."); setTimeout(() => setBanner(null), 3000); return; }
    try {
      const sess = JSON.parse(s);
      setRole(sess.role ?? role); setSubject(sess.subject ?? subject); setKlass(sess.klass ?? klass); setTeam(sess.team ?? team);
      setFrom(sess.from ?? from); setTo(sess.to ?? to);
      setDaily(sess.daily ?? daily); setTopics(sess.topics ?? topics); setLeaders(sess.leaders ?? leaders);
      setRows(sess.rows ?? []); setHeaders(sess.headers ?? []);
      setMeta(sess.meta ?? { numericCols: [] });
      setSelectedNumeric(sess.selectedNumeric ?? undefined);
      setSelectedNumerics(sess.selectedNumerics ?? []);
      setMetricForCategory(sess.metricForCategory ?? undefined);
      setSheetRowsMap(sess.sheetRowsMap ?? {});
      setActiveSheet(sess.activeSheet ?? null);
      setFileName(sess.fileName ?? null);
      setPivotDims(sess.pivotDims ?? []);
      setPivotMetrics(sess.pivotMetrics ?? []);
      setPivotAgg(sess.pivotAgg ?? "sum");
      setTask(sess.task ?? "regression");
      setMlTarget(sess.mlTarget ?? "");
      setMlFeatures(sess.mlFeatures ?? []);
      setRidge(sess.ridge ?? 1e-6);
      setKfold(sess.kfold ?? 5);
      setLearnRate(sess.learnRate ?? 0.1);
      setEpochs(sess.epochs ?? 800);
      setThreshold(sess.threshold ?? 0.5);
      setBanner("Session loaded.");
      setTimeout(() => setBanner(null), 3000);
    } catch {
      setBanner("Failed to load saved session.");
      setTimeout(() => setBanner(null), 3000);
    }
  }

  // ==== Reset ====
  function resetAll() {
    setDaily(MOCK_DAILY); setTopics(MOCK_TOPICS); setLeaders(MOCK_LEADERS);
    setRows([]); setHeaders([]);
    setMeta({ numericCols: [] }); setSelectedNumeric(undefined); setSelectedNumerics([]); setMetricForCategory(undefined);
    setSheetRowsMap({}); setActiveSheet(null);
    setFileName(null); setInfo("Upload .xlsx/.csv — we auto-detect known sheets or infer columns for generic reports.");
    setPivotDims([]); setPivotMetrics([]); setPivotAgg("sum");
    setRegModel(null); setClfModel(null); setRegEval([]); setClfEval([]);
    setMlTarget(""); setMlFeatures([]); setPredictForm({});
    setBanner("Reset done.");
    setTimeout(() => setBanner(null), 2000);
  }

  // ==== Live mode (demo) ====
  React.useEffect(() => {
    if (!live || !meta.dateCol) return;
    if (liveRef.current) window.clearInterval(liveRef.current);
    liveRef.current = window.setInterval(() => {
      if (!rows.length || !meta.dateCol) return;
      const dates = rows.map(r => new Date(r[meta.dateCol!])).filter(d => !isNaN(d.getTime())).sort((a, b) => a.getTime() - b.getTime());
      const last = dates[dates.length - 1] || new Date();
      const next = new Date(last.getTime() + 24 * 3600 * 1000);
      const patch: Row = { ...rows[rows.length - 1] };
      patch[meta.dateCol] = next.toISOString().slice(0, 10);
      for (const m of (selectedNumerics.length ? selectedNumerics : (selectedNumeric ? [selectedNumeric] : []))) {
        const base = numberish(patch[m]) ?? 10;
        patch[m] = Math.max(0, Math.round(base * (0.9 + Math.random() * 0.3)));
      }
      setRows(prev => [...prev, patch]);
    }, 3000);
    return () => { if (liveRef.current) window.clearInterval(liveRef.current); };
  }, [live, rows, meta, selectedNumeric, selectedNumerics]);

  // ==== Keyboard shortcuts ====
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key.toLowerCase() === "u") fileRef.current?.click();
      if (e.key.toLowerCase() === "m") setMapOpen(true);
      if (e.key.toLowerCase() === "s") saveSession();
      if (e.key === "?") setBanner("Shortcuts — U: Upload • M: Map Columns • S: Save Session • L: Load Session • P: Print");
      if (e.key.toLowerCase() === "l") loadSession();
      if (e.key.toLowerCase() === "p") window.print();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Call-center KPI detection
  const hasSentiment = headers.some(h => /sentiment|sentiment_num/i.test(h));
  const hasCSAT = headers.some(h => /csat/i.test(h));
  const hasDuration = headers.some(h => /(duration_s|duration|aht|handle_time|talk_time|call_duration)/i.test(h));

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
  const filteredNums = (name: string) => filteredRows.map(r => numberish(r[name]) ?? 0);
  const sentimentAvg = hasSentiment ? Math.round(avg(filteredNums("Sentiment_num")) * 100) / 100 : null;
  const aht = hasDuration ? Math.round(avg(filteredNums("Duration_s"))) : null;
  const csatAvg = hasCSAT ? Math.round(avg(filteredNums("CSAT_pct")) * 100) / 100 : null;

  // ==== Train models ====
  function trainRegression() {
    if (!mlTarget || mlFeatures.length === 0) { setBanner("Pick a target and at least one feature."); setTimeout(() => setBanner(null), 2500); return; }
    const X = filteredRows.map(r => mlFeatures.map(f => numberish(r[f]) ?? 0));
    const y = filteredRows.map(r => numberish(r[mlTarget]) ?? 0);
    if (!X.length) { setBanner("No rows to train on."); setTimeout(() => setBanner(null), 2000); return; }
    const t = trainRidgeRegression(X, y, ridge);
    const cv = kfoldRegression(X, y, kfold, ridge);
    const model: RegressionModel = {
      kind: "regression",
      features: mlFeatures,
      target: mlTarget,
      weights: t.weights,
      mu: t.mu,
      sigma: t.sigma,
      metrics: { ...t.metrics, cvR2: cv.r2, cvRMSE: cv.rmse, cvMAE: cv.mae }
    };
    setRegModel(model);
    const yhat = predictRegression(model, X);
    setRegEval(y.map((v, i) => ({ actual: v, predicted: yhat[i] })));
    setBanner("Regression trained ✓");
    setTimeout(() => setBanner(null), 2000);
  }

  function binarizeTarget(vals: number[]): number[] {
    // If already 0/1, return; else threshold by median
    const uniq = Array.from(new Set(vals.map(v => v))).sort((a, b) => a - b);
    if (uniq.length === 2 && ((uniq[0] === 0 && uniq[1] === 1) || (uniq[0] === -1 && uniq[1] === 1))) {
      return vals.map(v => v === -1 ? 0 : v); // map -1/1 -> 0/1
    }
    const med = quantile([...vals].sort((a, b) => a - b), 0.5) ?? 0;
    return vals.map(v => (v >= med ? 1 : 0));
  }

  function trainClassification() {
    if (!mlTarget || mlFeatures.length === 0) { setBanner("Pick a target and at least one feature."); setTimeout(() => setBanner(null), 2500); return; }
    const X = filteredRows.map(r => mlFeatures.map(f => numberish(r[f]) ?? 0));
    const yRaw = filteredRows.map(r => numberish(r[mlTarget]) ?? 0);
    if (!X.length) { setBanner("No rows to train on."); setTimeout(() => setBanner(null), 2000); return; }

    const ybin = binarizeTarget(yRaw);
    const { weights, mu, sigma } = trainLogisticGD(X, ybin, learnRate, epochs, 1e-4);
    const tempModel: ClassificationModel = {
      kind: "classification",
      features: mlFeatures,
      target: mlTarget,
      weights,
      mu,
      sigma,
      threshold,
      metrics: { accuracy: 0, precision: 0, recall: 0, f1: 0 }
    };
    const { p, yhat } = predictLogistic(tempModel, X);
    const m = classMetrics(ybin, yhat);
    const model: ClassificationModel = { ...tempModel, metrics: { accuracy: m.accuracy, precision: m.precision, recall: m.recall, f1: m.f1 } };
    setClfModel(model);
    setClfEval(ybin.map((v, i) => ({ actual: v, predicted: yhat[i], p: p[i] })));
    setBanner("Classifier trained ✓");
    setTimeout(() => setBanner(null), 2000);
  }

  function predictSingle() {
    const feats = mlFeatures;
    if (!feats.length) return;
    const vals = feats.map(f => numberish(predictForm[f]) ?? 0);
    if (task === "regression" && regModel) {
      const [pred] = predictRegression(regModel, [vals]);
      setBanner(`Prediction: ${regModel.target} ≈ ${Math.round(pred * 100) / 100}`);
      setTimeout(() => setBanner(null), 3000);
    } else if (task === "classification" && clfModel) {
      const { p, yhat } = predictLogistic(clfModel, [vals]);
      setBanner(`Prediction: P(1)=${Math.round(p[0] * 100) / 100} → class ${yhat[0]}`);
      setTimeout(() => setBanner(null), 3000);
    }
  }

  const brandBtn =
    "bg-[linear-gradient(180deg,#93c5fd,#3b82f6_85%)] text-white border border-blue-300 shadow-[0_10px_24px_rgba(59,130,246,0.25)] hover:brightness-[1.06] active:brightness-[1.03] transition";

  return (
    <Boundary>
      <div className="relative min-h-screen w-full bg-[radial-gradient(1000px_600px_at_12%_-10%,#EDF1F7_0%,transparent_60%),radial-gradient(1000px_600px_at_88%_110%,#F7FAFF_0%,transparent_60%)]">
        {/* faint grid */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] [background-size:48px_48px]" />

        <div className="relative mx-auto max-w-7xl p-4 md:p-6 lg:p-8 space-y-6">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            {/* Neutral shell with gradient bg */}
            <div
              className={[
                "relative overflow-hidden rounded-2xl",
                "ring-1 ring-[#C9D2DE]",
                "bg-[linear-gradient(120deg,#DFE4EF_0%,#D6DEE7_100%)]",
                "p-5 shadow-[0_16px_36px_-18px_rgba(17,24,39,0.18)]",
              ].join(" ")}
            >
              {/* faint grid */}
              <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] [background-size:48px_48px]" />

              <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                {/* Title + sub */}
                <div>
                  <h1
                    className="text-2xl md:text-3xl tracking-tight flex items-center gap-3"
                    style={{ color: "#353A47", ...hx }}
                  >
                    <BarChart3 className="h-7 w-7 text-[#5B6878]" />
                    Analytics
                    {/* blue gradient badge */}
                    <span className="ml-1 inline-flex items-center rounded-md px-2 py-1 text-sm font-medium text-white shadow-sm bg-[linear-gradient(180deg,#93c5fd,#3b82f6_85%)] border border-blue-300">
                      Performance Insights
                    </span>
                  </h1>
                  <p className="text-sm mt-1 text-[#5B6878]">
                    Upload CSV/XLSX • Auto Charts • Pivot • Profiler • <b>Advanced ML Insights</b>.
                  </p>
                </div>

                {/* Controls */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportAllAsCSV(daily, topics, leaders)}
                    className="rounded-xl bg-white/70 hover:bg-white border border-[#C9D2DE] text-[#353A47]"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export CSV
                  </Button>

                  {/* blue gradient button for Load Template */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={downloadTemplateXLSX}
                    className="rounded-xl text-white border border-blue-300 shadow-[0_10px_24px_rgba(59,130,246,0.25)] bg-[linear-gradient(180deg,#93c5fd,#3b82f6_85%)] hover:brightness-[1.06] active:brightness-[1.03] transition"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-1" />
                    Load Template
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={saveSession}
                    className="rounded-xl bg-white/70 hover:bg-white border border-[#C9D2DE] text-[#353A47]"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadSession}
                    className="rounded-xl bg-white/70 hover:bg-white border border-[#C9D2DE] text-[#353A47]"
                  >
                    <UploadCloud className="h-4 w-4 mr-1" />
                    Load
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.print()}
                    className="rounded-xl bg-white/70 hover:bg-white border border-[#C9D2DE] text-[#353A47]"
                  >
                    <FileDown className="h-4 w-4 mr-1" />
                    Print
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setProfOpen(true)}
                    className="rounded-xl bg-white/70 hover:bg-white border border-[#C9D2DE] text-[#353A47]"
                  >
                    <Activity className="h-4 w-4 mr-1" />
                    Profiler
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLive((v) => !v)}
                    className={[
                      "rounded-xl border",
                      live ? "border-green-500 bg-white text-[#353A47]" : "border-[#C9D2DE] bg-white/70 hover:bg-white text-[#353A47]",
                    ].join(" ")}
                  >
                    {live ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                    Live
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetAll}
                    className="rounded-xl bg-white/70 hover:bg-white border border-[#C9D2DE] text-[#353A47]"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>


          {/* Inline banner */}
          {banner && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-2 text-sm flex items-center gap-2">
              <Info className="h-4 w-4" /> {banner}
            </div>
          )}

          {/* Role Switch + Filters + Upload */}
          <Card className="rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow-[0_16px_40px_-16px_rgba(2,6,23,0.15)]">
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Role */}
              <div className="md:col-span-3">
                <label className="text-xs text-muted-foreground">View by Role</label>
                <Tabs value={role} onValueChange={(v) => setRole(v as Role)} className="mt-2">
                  <TabsList className="grid grid-cols-3 rounded-xl">
                    <TabsTrigger value="student" className="text-sm flex items-center gap-1" style={hx}><UserSquare2 className="h-3.5 w-3.5" />Student</TabsTrigger>
                    <TabsTrigger value="teacher" className="text-sm flex items-center gap-1" style={hx}><LayoutGrid className="h-3.5 w-3.5" />Teacher</TabsTrigger>
                    <TabsTrigger value="corporate" className="text-sm flex items-center gap-1" style={hx}><Building2 className="h-3.5 w-3.5" />Corporate</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Class / Subject */}
              {(role !== "corporate") && (
                <>
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Class</label>
                    <Select value={klass} onValueChange={setKlass}>
                      <SelectTrigger className="mt-2 rounded-xl"><SelectValue placeholder="Class" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Class 9">Class 9</SelectItem>
                        <SelectItem value="Class 10">Class 10</SelectItem>
                        <SelectItem value="Class 11">Class 11</SelectItem>
                        <SelectItem value="Class 12">Class 12</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Subject</label>
                    <Select value={subject} onValueChange={setSubject}>
                      <SelectTrigger className="mt-2 rounded-xl"><SelectValue placeholder="Subject" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Science">Science</SelectItem>
                        <SelectItem value="Maths">Maths</SelectItem>
                        <SelectItem value="English">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Team */}
              {role === "corporate" && (
                <div className="md:col-span-4">
                  <label className="text-xs text-muted-foreground">Team/Dept</label>
                  <Select value={team} onValueChange={setTeam}>
                    <SelectTrigger className="mt-2 rounded-xl"><SelectValue placeholder="Team" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Team Alpha">Team Alpha</SelectItem>
                      <SelectItem value="Team Beta">Team Beta</SelectItem>
                      <SelectItem value="Support">Support</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Dates */}
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">From</label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-2 rounded-xl" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">To</label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-2 rounded-xl" />
              </div>

              {/* Search */}
              <div className="md:col-span-3">
                <label className="text-xs text-muted-foreground">Search</label>
                <div className="mt-2 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find in rows/columns..." className="pl-8 rounded-xl" />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setQuery("")}>Clear</Button>
                </div>
              </div>
            </CardContent>

            {/* Upload row + Sheet picker + Map */}
            <div className="px-6 pb-6">
              <div className="rounded-2xl ring-1 ring-dashed ring-black/[0.08] p-4 flex flex-col md:flex-row items-center gap-3 justify-between bg-white/70">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 grid place-items-center rounded-xl bg-background ring-1 ring-black/[0.06]">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div className="text-sm">
                    <div className="font-medium text-slate-900" style={hx}>{fileName ?? "Upload .xlsx or .csv"}</div>
                    <div className="text-muted-foreground">{info}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  />
                  {sheetNames.length > 0 && (
                    <>
                      <Label className="mr-1 text-xs text-muted-foreground">Sheet</Label>
                      <Select value={activeSheet ?? ""} onValueChange={(name) => {
                        setActiveSheet(name);
                        const r = sheetRowsMap[name] ?? [];
                        setRows(r); setHeaders(r.length ? Object.keys(r[0]) : []);
                        const m = inferGenericMeta(r); setMeta(m);
                        setSelectedNumeric(m.numericCols[0]); setSelectedNumerics(m.numericCols.slice(0, 3));
                        setMetricForCategory(m.numericCols[0]);
                        setPivotDims([m.categoryCol!].filter(Boolean).slice(0, 1) as string[]);
                        setPivotMetrics(m.numericCols.slice(0, 2));
                        // ML defaults
                        const targetGuess = m.numericCols.find(h => /csat|score|nps|target|label/i.test(h)) || m.numericCols[0] || "";
                        const featureGuess = m.numericCols.filter(h => h !== targetGuess).slice(0, 5);
                        setMlTarget(targetGuess);
                        setMlFeatures(featureGuess);
                        setPredictForm(Object.fromEntries(featureGuess.map(f => [f, "0"])));
                      }}>
                        <SelectTrigger className="w-[180px] rounded-xl"><SelectValue placeholder="Pick sheet" /></SelectTrigger>
                        <SelectContent>
                          {sheetNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  <Button size="sm" onClick={() => fileRef.current?.click()} disabled={parsing} className={`rounded-xl ${brandBtn}`} style={hx}>
                    {parsing ? "Parsing..." : "Choose File"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setMapOpen(true)} className="rounded-xl">
                    <Wand2 className="h-4 w-4 mr-1" /> Map Columns
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* KPIs + Call-center quick KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard icon={Users2} label={role === "corporate" ? "Total Active Users" : "Total Logins"} value={totals.totalLogins} hint="Selected range" />
            <MetricCard icon={Trophy} label={role === "corporate" ? "Tasks/Calls Completed" : "Tests Attempted"} value={totals.totalTests} hint="Across selection" />
            <MetricCard icon={Target} label={role === "corporate" ? "Avg Performance" : "Average Accuracy"} value={`${totals.accuracy}%`} hint="Correct/Total" />
            <MetricCard icon={Clock} label="Avg Time/Item" value="14m" hint="Median duration" />
          </div>
          {(hasSentiment || hasCSAT || hasDuration) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {hasSentiment && <MetricCard icon={SmilePlus} label="Avg Sentiment" value={String(sentimentAvg)} hint="-1..0..+1 map" />}
              {hasDuration && <MetricCard icon={Gauge} label="AHT (sec)" value={String(aht)} hint="Avg handle time" />}
              {hasCSAT && <MetricCard icon={ThumbsUp} label="CSAT (%)" value={String(csatAvg)} hint="Mean of CSAT" />}
            </div>
          )}

          {/* ===== Role-specific sections ===== */}
          {role !== "corporate" ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2 rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow">
                <CardHeader><CardTitle className="text-base text-slate-900" style={hx}>{role === "student" ? "Your Progress (Logins vs Tests)" : "Daily Activity: Logins vs Tests"}</CardTitle></CardHeader>
                <CardContent className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={daily}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="date" /><YAxis /><Tooltip />
                      <Line type="monotone" dataKey="logins" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="tests" strokeWidth={2} dot={false} /></LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow">
                <CardHeader><CardTitle className="text-base text-slate-900" style={hx}>{role === "student" ? `${klass} • Topic Mastery` : "Topic Mastery (Correct %)"}</CardTitle></CardHeader>
                <CardContent className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={topicPie} dataKey="value" nameKey="name" outerRadius={100}>
                        {topicPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie><Tooltip formatter={(v: any) => `${v}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {role === "teacher" && (
                <>
                  <Card className="lg:col-span-2 rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow">
                    <CardHeader><CardTitle className="text-base text-slate-900" style={hx}>Class-wise Performance</CardTitle></CardHeader>
                    <CardContent className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[{ name: "X-A", avg: 78 }, { name: "X-B", avg: 81 }, { name: "X-C", avg: 74 }]}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" /><YAxis /><Tooltip />
                          <Bar dataKey="avg" radius={[8, 8, 0, 0]} /></BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow">
                    <CardHeader className="pb-3 flex-row items-center justify-between">
                      <CardTitle className="text-base text-slate-900" style={hx}>Top Students (by Avg. Score)</CardTitle>
                      <Badge variant="secondary">Live</Badge>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-left text-muted-foreground">
                          <tr>
                            <th className="py-2 font-medium" style={hx}>Student</th>
                            <th className="py-2 font-medium" style={hx}>Tests</th>
                            <th className="py-2 font-medium" style={hx}>Avg Score</th>
                            <th className="py-2 font-medium" style={hx}>Streak</th>
                          </tr>
                        </thead>
                        <tbody>
                          {MOCK_LEADERS.map((s, i) => (
                            <tr key={s.id ?? s.name} className="border-t">
                              <td className="py-2 flex items-center gap-2">
                                <span className="text-xs w-5 h-5 grid place-items-center rounded-full bg-primary/10 text-primary" style={hx}>{i + 1}</span>
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
                </>
              )}
            </div>
          ) : (
            // CORPORATE
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2 rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow">
                <CardHeader><CardTitle className="text-base text-slate-900" style={hx}>{team}: Activity Over Time</CardTitle></CardHeader>
                <CardContent className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={daily}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="date" /><YAxis /><Tooltip />
                      <Line type="monotone" dataKey="logins" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="tests" strokeWidth={2} dot={false} /></LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow">
                <CardHeader><CardTitle className="text-base text-slate-900" style={hx}>KPI Snapshot</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span>Avg Sentiment</span><span style={hx}>{sentimentAvg ?? "-"}</span></div>
                  <div className="flex justify-between"><span>AHT (sec)</span><span style={hx}>{aht ?? "-"}</span></div>
                  <div className="flex justify-between"><span>CSAT (%)</span><span style={hx}>{csatAvg ?? "-"}</span></div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ===== Insights + Summary ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow">
              <CardHeader><CardTitle className="text-base text-slate-900" style={hx}>Quick Insights</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {insights.map((i, idx) => (
                  <div key={idx} className="text-sm flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                    <span>{i}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow lg:col-span-2">
              <CardHeader><CardTitle className="text-base text-slate-900" style={hx}>Data Summary</CardTitle></CardHeader>
              <CardContent className="text-sm">
                {filteredRows.length ? (
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div><span className="text-slate-500">Rows:</span> <span style={hx}>{summary.rowCount}</span></div>
                    <div><span className="text-slate-500">Numeric columns:</span> <span style={hx}>{summary.numericCount}</span></div>
                    <div>
                      <span className="text-slate-500">Date range:</span>{" "}
                      {summary.dateSpan ? (
                        <span style={hx}>
                          {summary.dateSpan.min.toISOString().slice(0, 10)} → {summary.dateSpan.max.toISOString().slice(0, 10)}
                        </span>
                      ) : <span>-</span>}
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-500">Upload data to see dataset summary here.</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ===== Auto-charts for any dataset ===== */}
          {headers.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-3 rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow">
                <CardHeader>
                  <CardTitle className="text-base text-slate-900" style={hx}>Auto Charts {fileName ? `— ${fileName}` : ""}</CardTitle>
                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                    <span>Detected {filteredRows.length} rows.</span>
                    {meta.dateCol && <span>Date: <b>{meta.dateCol}</b>.</span>}
                    {meta.categoryCol && <span>Category: <b>{meta.categoryCol}</b>.</span>}
                    <span>Numeric: {meta.numericCols.join(", ") || "-"}</span>
                  </div>

                  {meta.numericCols.length > 0 && (
                    <div className="mt-3 grid md:grid-cols-3 gap-3">
                      {/* Metric badges (multi) */}
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Line metrics (toggle)</Label>
                        <div className="flex flex-wrap gap-2">
                          {meta.numericCols.map((h) => {
                            const on = selectedNumerics.includes(h);
                            return (
                              <button
                                key={h}
                                onClick={() =>
                                  setSelectedNumerics((prev) =>
                                    on ? prev.filter((x) => x !== h) : [...new Set([...prev, h])].slice(0, 5)
                                  )
                                }
                                className={`px-2.5 py-1 rounded-lg text-xs border ${on ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-slate-50"}`}
                              >
                                {h}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Category metric */}
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Category metric</Label>
                        <Select value={metricForCategory ?? ""} onValueChange={(v) => setMetricForCategory(v)}>
                          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Pick numeric" /></SelectTrigger>
                          <SelectContent>
                            {(meta.numericCols.length ? meta.numericCols : (selectedNumerics.length ? selectedNumerics : [])).map((h) => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Top N */}
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Top N categories</Label>
                        <Input type="number" min={3} max={50} value={topN} onChange={(e) => setTopN(clamp(Number(e.target.value || 15), 3, 50))} className="rounded-xl" />
                      </div>
                    </div>
                  )}
                </CardHeader>
              </Card>

              {/* Time series */}
              {meta.dateCol && (selectedNumerics.length || selectedNumeric) ? (
                <Card className="lg:col-span-2 rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow">
                  <CardHeader><CardTitle className="text-base text-slate-900" style={hx}>Time Series by {meta.dateCol}</CardTitle></CardHeader>
                  <CardContent className="h-[340px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={tsData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend />
                        {(selectedNumerics.length ? selectedNumerics : (selectedNumeric ? [selectedNumeric] : [])).map((m) => (
                          <Line key={m} type="monotone" dataKey={m} strokeWidth={2} dot={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              ) : (
                <Card className="lg:col-span-2 rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow">
                  <CardHeader><CardTitle className="text-base text-slate-900" style={hx}>Time Series</CardTitle></CardHeader>
                  <CardContent className="h-[340px] grid place-items-center text-sm text-muted-foreground">
                    Select a date column and at least one numeric column to draw a time series.
                  </CardContent>
                </Card>
              )}

              {/* Category bar & pie */}
              {meta.categoryCol && (metricForCategory || selectedNumeric || selectedNumerics[0]) ? (
                <>
                  <Card className="rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow">
                    <CardHeader><CardTitle className="text-base text-slate-900" style={hx}>By {meta.categoryCol}</CardTitle></CardHeader>
                    <CardContent className="h-[340px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={catAgg}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" hide={catAgg.length > 12} /><YAxis /><Tooltip />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]} /></BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow">
                    <CardHeader><CardTitle className="text-base text-slate-900" style={hx}>Share by {meta.categoryCol}</CardTitle></CardHeader>
                    <CardContent className="h-[340px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={catAgg} dataKey="value" nameKey="name" outerRadius={100}>
                            {catAgg.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie><Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow">
                  <CardHeader><CardTitle className="text-base text-slate-900" style={hx}>Category Breakdown</CardTitle></CardHeader>
                  <CardContent className="h-[340px] grid place-items-center text-sm text-muted-foreground">
                    Select a category column and numeric metric to view category charts.
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ===== Pivot Builder ===== */}
          {headers.length > 0 && (
            <Card className="rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow">
              <CardHeader>
                <CardTitle className="text-base text-slate-900" style={hx}>Pivot Builder</CardTitle>
                <div className="text-xs text-muted-foreground">Choose Dimensions (e.g., Agent, Queue) and Metrics (e.g., Calls, Duration_s, CSAT_pct). Aggregations: SUM/AVG/COUNT/MEDIAN.</div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Dimensions</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {headers.map((h) => (
                        <button
                          key={h}
                          onClick={() =>
                            setPivotDims((prev) => prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h].slice(0, 2))
                          }
                          className={`px-2.5 py-1 rounded-lg text-xs border ${pivotDims.includes(h) ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50"}`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs text-muted-foreground">Metrics</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {meta.numericCols.map((h) => (
                        <button
                          key={h}
                          onClick={() =>
                            setPivotMetrics((prev) => prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h].slice(0, 5))
                          }
                          className={`px-2.5 py-1 rounded-lg text-xs border ${pivotMetrics.includes(h) ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-slate-50"}`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Aggregation</Label>
                    <Select value={pivotAgg} onValueChange={(v) => setPivotAgg(v as Agg)}>
                      <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Aggregation" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sum">SUM</SelectItem>
                        <SelectItem value="avg">AVG</SelectItem>
                        <SelectItem value="count">COUNT</SelectItem>
                        <SelectItem value="median">MEDIAN</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {pivotRows.length > 0 ? (
                  <div className="overflow-x-auto border rounded-xl">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {[...pivotDims, ...pivotMetrics.map(m => `${pivotAgg.toUpperCase()}(${m})`)].map((h) => (
                            <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pivotRows.slice(0, 200).map((r, i) => (
                          <TableRow key={i}>
                            {[...pivotDims, ...pivotMetrics.map(m => `${pivotAgg.toUpperCase()}(${m})`)].map((h) => (
                              <TableCell key={h} className="whitespace-nowrap">{String(r[h] ?? "")}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Pick at least one metric to build a pivot.</div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ======================== ML STUDIO ======================== */}
          {meta.numericCols.length > 1 && (
            <Card className="rounded-2xl ring-1 ring-black/[0.06] bg-white/95 backdrop-blur shadow">
              <CardHeader>
                <CardTitle className="text-base text-slate-900" style={hx}>ML Studio</CardTitle>
                <div className="text-xs text-muted-foreground">
                  Choose a target and features from numeric columns. Train a <b>Linear Regression</b> (with Ridge & k-fold CV) or a <b>Logistic Regression</b> for binary outcomes.
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Controls */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                  <div className="lg:col-span-2">
                    <Label className="text-xs text-muted-foreground">Task</Label>
                    <Tabs value={task} onValueChange={(v) => setTask(v as TaskType)} className="mt-2">
                      <TabsList className="w-full">
                        <TabsTrigger value="regression" className="flex-1">Regression</TabsTrigger>
                        <TabsTrigger value="classification" className="flex-1">Classification</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  <div className="lg:col-span-3">
                    <Label className="text-xs text-muted-foreground">Target</Label>
                    <Select value={mlTarget} onValueChange={(v) => setMlTarget(v)}>
                      <SelectTrigger className="mt-2 rounded-xl"><SelectValue placeholder="Pick target" /></SelectTrigger>
                      <SelectContent>
                        {meta.numericCols.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="lg:col-span-7">
                    <Label className="text-xs text-muted-foreground">Features (toggle 1–8)</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {meta.numericCols.filter(h => h !== mlTarget).map(h => {
                        const on = mlFeatures.includes(h);
                        return (
                          <button
                            key={h}
                            onClick={() =>
                              setMlFeatures(prev => on ? prev.filter(x => x !== h) : [...prev, h].slice(0, 8))
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs border ${on ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-slate-50"}`}
                          >
                            {h}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Hyperparams */}
                {task === "regression" ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Ridge λ</Label>
                      <Input type="number" step="0.000001" value={ridge} onChange={(e) => setRidge(Number(e.target.value) || 0)} className="mt-1 rounded-xl" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">k-folds</Label>
                      <Input type="number" min={2} max={10} value={kfold} onChange={(e) => setKfold(clamp(Number(e.target.value || 5), 2, 10))} className="mt-1 rounded-xl" />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={trainRegression} className={`w-full rounded-xl ${brandBtn}`}>Train Regression</Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Learning rate</Label>
                      <Input type="number" step="0.01" value={learnRate} onChange={(e) => setLearnRate(Number(e.target.value) || 0.1)} className="mt-1 rounded-xl" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Epochs</Label>
                      <Input type="number" min={100} max={5000} value={epochs} onChange={(e) => setEpochs(clamp(Number(e.target.value || 800), 100, 5000))} className="mt-1 rounded-xl" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Decision threshold</Label>
                      <Input type="number" step="0.01" min={0.05} max={0.95} value={threshold} onChange={(e) => setThreshold(clamp(Number(e.target.value || 0.5), 0.05, 0.95))} className="mt-1 rounded-xl" />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={trainClassification} className={`w-full rounded-xl ${brandBtn}`}>Train Classifier</Button>
                    </div>
                  </div>
                )}

                {/* Results */}
                {task === "regression" && regModel && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Card className="rounded-2xl ring-1 ring-black/[0.06]">
                      <CardHeader><CardTitle className="text-sm" style={hx}>Metrics</CardTitle></CardHeader>
                      <CardContent className="text-sm space-y-1">
                        <div className="flex justify-between"><span>R²</span><span style={hx}>{regModel.metrics.r2.toFixed(4)}</span></div>
                        <div className="flex justify-between"><span>RMSE</span><span style={hx}>{regModel.metrics.rmse.toFixed(4)}</span></div>
                        <div className="flex justify-between"><span>MAE</span><span style={hx}>{regModel.metrics.mae.toFixed(4)}</span></div>
                        {"cvR2" in regModel.metrics && regModel.metrics.cvR2 !== undefined && (
                          <>
                            <div className="h-px bg-slate-100 my-2" />
                            <div className="flex justify-between"><span>CV R²</span><span style={hx}>{regModel.metrics.cvR2?.toFixed(4)}</span></div>
                            <div className="flex justify-between"><span>CV RMSE</span><span style={hx}>{regModel.metrics.cvRMSE?.toFixed(4)}</span></div>
                            <div className="flex justify-between"><span>CV MAE</span><span style={hx}>{regModel.metrics.cvMAE?.toFixed(4)}</span></div>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl ring-1 ring-black/[0.06] lg:col-span-2">
                      <CardHeader><CardTitle className="text-sm" style={hx}>Actual vs Predicted — {regModel.target}</CardTitle></CardHeader>
                      <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis type="number" dataKey="actual" name="Actual" />
                            <YAxis type="number" dataKey="predicted" name="Predicted" />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                            <Legend />
                            <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} ifOverflow="extendDomain" />
                            <Scatter name="Points" data={regEval} />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl ring-1 ring-black/[0.06] lg:col-span-3">
                      <CardHeader><CardTitle className="text-sm" style={hx}>Coefficients</CardTitle></CardHeader>
                      <CardContent className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Feature</TableHead>
                              <TableHead>Weight</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow><TableCell className="font-medium">(Intercept)</TableCell><TableCell>{regModel.weights[0].toFixed(6)}</TableCell></TableRow>
                            {regModel.features.map((f, i) => (
                              <TableRow key={f}><TableCell className="font-medium">{f}</TableCell><TableCell>{regModel.weights[i + 1].toFixed(6)}</TableCell></TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {task === "classification" && clfModel && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Card className="rounded-2xl ring-1 ring-black/[0.06]">
                      <CardHeader><CardTitle className="text-sm" style={hx}>Metrics</CardTitle></CardHeader>
                      <CardContent className="text-sm space-y-1">
                        <div className="flex justify-between"><span>Accuracy</span><span style={hx}>{clfModel.metrics.accuracy}</span></div>
                        <div className="flex justify-between"><span>Precision</span><span style={hx}>{clfModel.metrics.precision}</span></div>
                        <div className="flex justify-between"><span>Recall</span><span style={hx}>{clfModel.metrics.recall}</span></div>
                        <div className="flex justify-between"><span>F1</span><span style={hx}>{clfModel.metrics.f1}</span></div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl ring-1 ring-black/[0.06] lg:col-span-2">
                      <CardHeader><CardTitle className="text-sm" style={hx}>Predicted Probability (first 200)</CardTitle></CardHeader>
                      <CardContent className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead>
                              <TableHead>p(1)</TableHead>
                              <TableHead>pred</TableHead>
                              <TableHead>actual</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {clfEval.slice(0, 200).map((r, i) => (
                              <TableRow key={i}>
                                <TableCell>{i + 1}</TableCell>
                                <TableCell>{r.p.toFixed(4)}</TableCell>
                                <TableCell>{r.predicted}</TableCell>
                                <TableCell>{r.actual}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl ring-1 ring-black/[0.06] lg:col-span-3">
                      <CardHeader><CardTitle className="text-sm" style={hx}>Coefficients</CardTitle></CardHeader>
                      <CardContent className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Feature</TableHead>
                              <TableHead>Weight</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow><TableCell className="font-medium">(Intercept)</TableCell><TableCell>{clfModel.weights[0].toFixed(6)}</TableCell></TableRow>
                            {clfModel.features.map((f, i) => (
                              <TableRow key={f}><TableCell className="font-medium">{f}</TableCell><TableCell>{clfModel.weights[i + 1].toFixed(6)}</TableCell></TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Single prediction */}
                {(task === "regression" && regModel) || (task === "classification" && clfModel) ? (
                  <div className="rounded-xl border p-3">
                    <div className="text-sm font-medium mb-2" style={hx}>Try a single prediction</div>
                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {mlFeatures.map(f => (
                        <div key={f}>
                          <Label className="text-xs text-muted-foreground">{f}</Label>
                          <Input value={predictForm[f] ?? ""} onChange={(e) => setPredictForm(prev => ({ ...prev, [f]: e.target.value }))} placeholder="0" className="rounded-xl mt-1" />
                        </div>
                      ))}
                      <div className="flex items-end">
                        <Button onClick={predictSingle} className={`rounded-xl ${brandBtn}`}>Predict</Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* ===== Row Preview ===== */}
          {headers.length > 0 && (
            <Card className="rounded-2xl ring-1 ring-black/[0.06] bg-white/90 backdrop-blur shadow">
              <CardHeader>
                <CardTitle className="text-base text-slate-900" style={hx}>Rows (showing {Math.min(20, filteredRows.length)} of {filteredRows.length})</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h) => <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.slice(0, 20).map((r, ri) => (
                      <TableRow key={ri}>
                        {headers.map((h) => {
                          const val = r[h];
                          const show = val instanceof Date ? val.toISOString().slice(0, 10) : String(val);
                          return <TableCell key={h} className="whitespace-nowrap">{show}</TableCell>;
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Dialogs */}
        <ColumnMapperDialog open={mapOpen} onOpenChange={setMapOpen} headers={headers} initial={meta} onApply={applyMapping} />
        <ProfilerDialog open={profOpen} onOpenChange={setProfOpen} rows={filteredRows} headers={headers} dateCol={meta.dateCol} />
      </div>
    </Boundary>
  );
}
