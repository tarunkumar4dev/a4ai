// Constants + small helpers of the teacher Analytics tab (kept out of kit.tsx so it only exports components).

import { useEffect, useState, type RefObject } from "react";
import type { RiskLevel } from "@/lib/teacherAnalytics";

/* ───── colours ───── */
export const STATUS = { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b", info: "#2a78d6" } as const;

export const ATT_COLORS: Record<string, string> = {
  present: STATUS.good, late: STATUS.warning, leave: STATUS.info, absent: STATUS.critical,
};
export const ATT_LABELS: Record<string, string> = { present: "Present", late: "Late", leave: "Leave", absent: "Absent" };

export const RISK_COLORS: Record<RiskLevel, string> = {
  high: STATUS.critical, watch: STATUS.warning, ok: STATUS.good, none: "#94a3b8",
};
export const RISK_LABELS: Record<RiskLevel, string> = {
  high: "Needs attention", watch: "Keep an eye", ok: "On track", none: "No data yet",
};

/** Bar colour for a % score: same bands as the grade bands (85 / 70 / 50 / pass). */
export function scoreColor(pct: number, pass: number): string {
  if (pct >= 85) return "#10B981";
  if (pct >= 70) return "#3B82F6";
  if (pct >= 50) return "#F59E0B";
  if (pct >= pass) return "#FB923C";
  return "#EF4444";
}

/** Attendance % colour against the target. */
export function attColor(pct: number, target: number): string {
  if (pct >= 90) return STATUS.good;
  if (pct >= target) return STATUS.info;
  if (pct >= target - 10) return STATUS.warning;
  return STATUS.critical;
}

/* ───── chart chrome ───── */
export const TOOLTIP = {
  contentStyle: {
    backgroundColor: "rgba(15, 23, 42, 0.94)", borderColor: "rgba(255,255,255,0.08)", borderRadius: "12px",
    color: "#fff", fontSize: "12px", padding: "8px 12px",
  },
  itemStyle: { color: "#fff" },
  labelStyle: { color: "#cbd5e1", fontWeight: 700, marginBottom: 2 },
  cursor: { fill: "rgba(148,163,184,0.12)" },
};
export const AXIS = { stroke: "#94A3B8", fontSize: 11, tickLine: false as const, axisLine: false as const };
export const GRID = "rgba(148,163,184,0.18)";

/** The dashboard puts `.dark` on its root; charts (SVG fills) need to know. */
export function useIsDark(ref: RefObject<HTMLElement>): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setDark(!!el.closest(".dark"));
    read();
    const mo = new MutationObserver(read);
    for (let n = el.parentElement; n; n = n.parentElement) mo.observe(n, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, [ref]);
  return dark;
}

export const fmtPct = (v: number | null | undefined) => (v == null ? "—" : `${v}%`);
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* ───── tones (decorative accents) ───── */
export type Tone = "emerald" | "indigo" | "violet" | "amber" | "rose" | "sky" | "teal" | "fuchsia";

export const TONES: Record<Tone, { chip: string; bar: string; ring: string }> = {
  emerald: { chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", bar: "from-emerald-400 to-teal-500", ring: "#10b981" },
  indigo: { chip: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300", bar: "from-indigo-500 to-blue-500", ring: "#6366f1" },
  violet: { chip: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", bar: "from-violet-500 to-fuchsia-500", ring: "#8b5cf6" },
  amber: { chip: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", bar: "from-amber-400 to-orange-500", ring: "#f59e0b" },
  rose: { chip: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", bar: "from-rose-500 to-pink-500", ring: "#f43f5e" },
  sky: { chip: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", bar: "from-sky-400 to-cyan-500", ring: "#0ea5e9" },
  teal: { chip: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300", bar: "from-teal-400 to-emerald-500", ring: "#14b8a6" },
  fuchsia: { chip: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300", bar: "from-fuchsia-500 to-pink-500", ring: "#d946ef" },
};


export const btnDark = "inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-bold text-white hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100";
export const btnGhost = "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10";
export const linkBtn = "inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:underline dark:text-indigo-300";
