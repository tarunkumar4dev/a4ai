// Students: every student in one list (attendance, marks, trend, flags) + attendance-vs-marks scatter.

import React, { useMemo, useState } from "react";
import { ResponsiveContainer, ScatterChart, Scatter, Cell, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { ChevronRight, Search, ScatterChart as ScatterIcon, Users } from "lucide-react";
import { RISK_ORDER, type StudentRow } from "@/lib/teacherAnalytics";
import { Avatar, EmptyArt, Panel, Sparkline, StatusDots } from "./kit";
import { AXIS, GRID, RISK_COLORS, RISK_LABELS, attColor, plural, scoreColor } from "./theme";
import type { ViewProps } from "./model";
import { FlagChips } from "./StudentBits";

type Filter = "all" | "high" | "watch" | "low-attendance" | "low-marks" | "absent-streak" | "none";
type Sort = "status" | "name" | "att" | "marks" | "improved";

const FILTERS: { key: Filter; label: string; test: (r: StudentRow) => boolean }[] = [
  { key: "all", label: "All", test: () => true },
  { key: "high", label: "Needs attention", test: (r) => r.risk === "high" },
  { key: "watch", label: "Keep an eye", test: (r) => r.risk === "watch" },
  { key: "low-attendance", label: "Low attendance", test: (r) => r.flags.includes("low-attendance") },
  { key: "low-marks", label: "Low marks", test: (r) => r.flags.includes("low-marks") },
  { key: "absent-streak", label: "Absence streak", test: (r) => r.flags.includes("absent-streak") },
  { key: "none", label: "No data yet", test: (r) => r.risk === "none" },
];

const PAGE = 50;

export default function StudentsView({ m, allClasses, openStudent, dark }: ViewProps) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("status");
  const [limit, setLimit] = useState(PAGE);

  const counts = useMemo(() => new Map(FILTERS.map((f) => [f.key, m.rows.filter(f.test).length])), [m.rows]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const test = FILTERS.find((f) => f.key === filter)!.test;
    const out = m.rows.filter((r) => test(r) && (!needle || r.name.toLowerCase().includes(needle) || r.rollNo.toLowerCase().includes(needle)));
    const val = (v: number | null | undefined, dflt: number) => (v == null ? dflt : v);
    out.sort((a, b) => {
      switch (sort) {
        case "name": return a.name.localeCompare(b.name);
        case "att": return val(a.att?.pct, Infinity) - val(b.att?.pct, Infinity) || a.name.localeCompare(b.name);
        case "marks": return val(a.marks?.avg, Infinity) - val(b.marks?.avg, Infinity) || a.name.localeCompare(b.name);
        case "improved": return val(b.marks?.delta, -Infinity) - val(a.marks?.delta, -Infinity) || a.name.localeCompare(b.name);
        default: return RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || a.name.localeCompare(b.name);
      }
    });
    return out;
  }, [m.rows, q, filter, sort]);

  const points = m.rows.filter((r) => r.att?.pct != null && r.marks).map((r) => ({
    key: r.key, name: r.name, x: r.att!.pct!, y: r.marks!.avg, risk: r.risk,
  }));

  if (!m.rows.length) {
    return (
      <Panel title="Students" icon={<Users className="h-4 w-4" />} tone="sky">
        <EmptyArt title="No students in your classes yet">Students appear here once your admin adds them to your batches.</EmptyArt>
      </Panel>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {points.length >= 3 && <ScatterPanel points={points} target={m.target} pass={m.pass} openStudent={openStudent} dark={dark} />}

      <Panel title="Every student" icon={<Users className="h-4 w-4" />} tone="sky"
        sub={`${plural(m.rows.length, "student")} · attendance, marks and trend in one place — tap a row for details`}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-xs">
            <span className="sr-only">Search students</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Search by name or roll no."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100">
              <option value="status">Needs attention first</option>
              <option value="name">Name</option>
              <option value="att">Lowest attendance</option>
              <option value="marks">Lowest marks</option>
              <option value="improved">Most improved</option>
            </select>
          </label>
        </div>
        <div role="group" aria-label="Filter students" className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {FILTERS.filter((f) => f.key === "all" || (counts.get(f.key) ?? 0) > 0).map((f) => (
            <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => { setFilter(f.key); setLimit(PAGE); }}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${filter === f.key
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"}`}>
              {f.label} <span className="opacity-70">{counts.get(f.key)}</span>
            </button>
          ))}
        </div>

        <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1.9fr)_minmax(0,1.5fr)_minmax(0,1.7fr)_1.25rem] gap-4 border-b border-slate-200/70 px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/10">
          <span>Student</span><span>Attendance</span><span>Marks</span><span>Status</span><span />
        </div>
        {list.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">No student matches.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {list.slice(0, limit).map((r) => (
              <li key={r.key}>
                <button type="button" onClick={() => openStudent(r.key)}
                  className="grid w-full grid-cols-1 gap-2 rounded-xl px-3 py-3 text-left hover:bg-slate-50 md:grid-cols-[minmax(0,2fr)_minmax(0,1.9fr)_minmax(0,1.5fr)_minmax(0,1.7fr)_1.25rem] md:items-center md:gap-4 dark:hover:bg-white/[0.03]">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="relative">
                      <Avatar name={r.name} seed={r.key} />
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-[#121212]" style={{ backgroundColor: RISK_COLORS[r.risk] }} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                        {r.name}{r.guest && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">Guest</span>}
                      </span>
                      <span className="block truncate text-[11px] font-medium text-slate-500">
                        {[r.rollNo && `Roll ${r.rollNo}`, allClasses && r.batchName].filter(Boolean).join(" · ") || " "}
                      </span>
                    </span>
                  </span>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="w-24 shrink-0">
                      <span className="flex items-baseline justify-between text-xs">
                        <span className="font-black text-slate-900 dark:text-white">{r.att?.pct == null ? "—" : `${r.att.pct}%`}</span>
                        {r.att && <span className="text-[10px] font-semibold text-slate-500 tabular-nums">{r.att.attended}/{r.att.total}</span>}
                      </span>
                      <span className="mt-1 block h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                        {r.att?.pct != null && <span className="block h-1.5 rounded-full" style={{ width: `${Math.max(3, r.att.pct)}%`, backgroundColor: attColor(r.att.pct, m.target) }} />}
                      </span>
                    </span>
                    <span className="hidden xl:inline-flex"><StatusDots statuses={r.att?.recent ?? []} max={6} /></span>
                  </span>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="w-12 shrink-0 text-xs font-black text-slate-900 dark:text-white">{r.marks ? `${r.marks.avg}%` : "—"}</span>
                    {r.marks && <Sparkline values={r.marks.trend} color={scoreColor(r.marks.avg, m.pass)} label={`${r.name}: ${r.marks.trend.join("%, ")}%`} />}
                    {r.marks?.delta != null && Math.abs(r.marks.delta) >= 1 && (
                      <span className={`text-[11px] font-bold ${r.marks.delta > 0 ? "text-[#006300] dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                        {r.marks.delta > 0 ? "▲" : "▼"}{Math.abs(r.marks.delta)}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0"><FlagChips row={r} target={m.target} pass={m.pass} /></span>
                  <ChevronRight className="hidden h-4 w-4 text-slate-400 md:block" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {list.length > limit && (
          <div className="mt-3 text-center">
            <button type="button" onClick={() => setLimit((n) => n + PAGE)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
              Show {Math.min(PAGE, list.length - limit)} more of {list.length - limit}
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}

type Point = { key: string; name: string; x: number; y: number; risk: StudentRow["risk"] };

function ScatterPanel({ points, target, pass, openStudent, dark }: {
  points: Point[]; target: number; pass: number; openStudent: (k: string) => void; dark: boolean;
}) {
  const quads = [
    { label: "Attending & scoring", arrow: "↗", n: points.filter((p) => p.x >= target && p.y >= pass).length },
    { label: "Attending, low marks", arrow: "↘", n: points.filter((p) => p.x >= target && p.y < pass).length },
    { label: "Scoring, missing classes", arrow: "↖", n: points.filter((p) => p.x < target && p.y >= pass).length },
    { label: "Missing classes & low marks", arrow: "↙", n: points.filter((p) => p.x < target && p.y < pass).length },
  ];
  return (
    <Panel title="Attendance vs marks" icon={<ScatterIcon className="h-4 w-4" />} tone="violet"
      sub={`One dot per student · across = attendance, up = average marks · lines at ${target}% and ${pass}% — tap a dot`}>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 12, left: 0, bottom: 8 }} accessibilityLayer>
            <CartesianGrid stroke={GRID} />
            <XAxis type="number" dataKey="x" name="Attendance" domain={[0, 100]} {...AXIS} unit="%" />
            <YAxis type="number" dataKey="y" name="Marks" domain={[0, 100]} {...AXIS} unit="%" width={44} />
            <ZAxis range={[90, 90]} />
            <ReferenceLine x={target} stroke="#f59e0b" strokeWidth={1.5} />
            <ReferenceLine y={pass} stroke="#ef4444" strokeWidth={1.5} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
              const p = payload?.[0]?.payload as Point | undefined;
              if (!p) return null;
              return (
                <div className="rounded-xl bg-slate-900/95 px-3 py-2 text-xs text-white shadow-lg">
                  <div className="font-bold">{p.name}</div>
                  <div className="text-slate-300">Attendance {p.x}% · Marks {p.y}%</div>
                </div>
              );
            }} />
            <Scatter data={points} isAnimationActive={false} onClick={(p: { key?: string; payload?: Point }) => { const k = p?.payload?.key ?? p?.key; if (k) openStudent(k); }}
              className="cursor-pointer">
              {points.map((p) => <Cell key={p.key} fill={RISK_COLORS[p.risk]} stroke={dark ? "#121212" : "#ffffff"} strokeWidth={2} />)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1" aria-label="Dot colours">
        {(["high", "watch", "ok"] as const).map((k) => (
          <li key={k} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RISK_COLORS[k] }} aria-hidden="true" />{RISK_LABELS[k]}
          </li>
        ))}
      </ul>
      <ul className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Students per quadrant">
        {quads.map((qd) => (
          <li key={qd.label} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/[0.03]">
            <span className="w-4 shrink-0 text-center text-sm font-black text-slate-500" aria-hidden="true">{qd.arrow}</span>
            <span className="min-w-0 text-[11px] font-semibold leading-tight text-slate-600 dark:text-slate-400">{qd.label}</span>
            <span className="ml-auto text-sm font-black text-slate-900 dark:text-white">{qd.n}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
