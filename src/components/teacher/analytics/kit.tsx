// Shared pieces of the teacher Analytics tab (rings, stat cards, pictograph, sparkline, status dots, panels).
// No animation (lite mode). Colours: status palette for good / warning / critical meaning, decoration elsewhere.

import React from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { ATT_COLORS, ATT_LABELS, TONES, plural, type Tone } from "./theme";

/* ───── ring gauge ───── */
export function Ring({ value, max = 100, size = 68, stroke = 8, color, label, children }: {
  value: number | null; max?: number; size?: number; stroke?: number; color: string; label: string; children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = value == null || max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.16} strokeWidth={stroke} />
        {frac > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${c * frac} ${c}`} strokeLinecap="round" />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center">{children}</div>
    </div>
  );
}

/* ───── delta vs the previous period ───── */
export function Delta({ value, unit = " pts", vs, goodWhenUp = true }: {
  value: number | null; unit?: string; vs: string | null; goodWhenUp?: boolean;
}) {
  if (value == null || !vs) return null;
  const v = Math.round(value * 10) / 10;
  const same = Math.abs(v) < 0.5;
  const up = v > 0;
  const good = up === goodWhenUp;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {same ? (
        <span className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Minus className="h-3 w-3" aria-hidden="true" /> same
        </span>
      ) : (
        <span className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${
          good ? "bg-emerald-50 text-[#006300] dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
        }`}>
          {up ? <ArrowUpRight className="h-3 w-3" aria-hidden="true" /> : <ArrowDownRight className="h-3 w-3" aria-hidden="true" />}
          {up ? "+" : "−"}{Math.abs(v)}{unit}
        </span>
      )}
      <span className="whitespace-nowrap text-[11px] font-medium text-slate-500 dark:text-slate-400">vs {vs}</span>
    </span>
  );
}

/* ───── stat card ───── */
export function StatCard({ label, value, sub, icon, tone, ring, ringLabel, delta }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; icon: React.ReactNode; tone: Tone;
  /** 0–100, draws a ring on the right */
  ring?: number | null; ringLabel?: string; delta?: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div className="glass-panel relative overflow-hidden rounded-3xl p-4 sm:p-5 min-w-0">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${t.bar}`} aria-hidden="true" />
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${t.chip}`}>{icon}</span>
        <span className="truncate text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">{label}</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="min-w-0 text-[26px] sm:text-[34px] font-black leading-none tracking-tight text-slate-900 dark:text-white">{value}</div>
        {ring !== undefined && (
          <div className="hidden min-[420px]:block">
            <Ring value={ring} color={t.ring} size={54} stroke={6} label={ringLabel ?? label}>
              <span className="text-[10px] font-black text-slate-700 dark:text-slate-200">{ring == null ? "—" : `${Math.round(ring)}%`}</span>
            </Ring>
          </div>
        )}
      </div>
      {sub && <div className="mt-2 text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">{sub}</div>}
      {delta && <div className="mt-2">{delta}</div>}
    </div>
  );
}

/* ───── panel ───── */
export function Panel({ title, sub, icon, tone = "indigo", right, className = "", children, id }: {
  title: string; sub?: React.ReactNode; icon?: React.ReactNode; tone?: Tone; right?: React.ReactNode;
  className?: string; children: React.ReactNode; id?: string;
}) {
  return (
    <section id={id} aria-label={title} className={`glass-panel rounded-3xl p-4 sm:p-6 min-w-0 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {icon && <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${TONES[tone].chip}`}>{icon}</span>}
          <div className="min-w-0">
            <h3 className="text-[15px] sm:text-base font-extrabold text-slate-900 dark:text-white leading-snug">{title}</h3>
            {sub && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
          </div>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {children}
    </section>
  );
}

export function CountPill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "red" | "amber" | "green" }) {
  const cls = {
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    red: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    amber: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${cls}`}>{children}</span>;
}

/* ───── pictograph: one person icon per student ───── */
const MAX_ICONS = 120;

function Person({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 20 24" className="h-full w-full" aria-hidden="true">
      <circle cx="10" cy="6" r="4.6" fill={color} />
      <path d="M1.6 22.5c0-5.2 3.8-9 8.4-9s8.4 3.8 8.4 9z" fill={color} />
    </svg>
  );
}

export interface PictoItem { key: string; color: string; title: string; group: string }

/** Icons grouped by `group` (legend order). Up to MAX_ICONS one icon = one student (clickable), else scaled. */
export function Pictograph({ items, legend, onPick, label }: {
  items: PictoItem[]; legend: { group: string; label: string; color: string }[];
  onPick?: (key: string) => void; label: string;
}) {
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it.group, (counts.get(it.group) ?? 0) + 1);
  const ordered = legend.flatMap((l) => items.filter((it) => it.group === l.group));
  const scale = items.length > MAX_ICONS ? Math.ceil(items.length / MAX_ICONS) : 1;
  const size = items.length <= 30 ? "h-7 w-6" : items.length <= 60 ? "h-6 w-5" : "h-5 w-4";

  return (
    <div>
      <ul aria-label={label} className="flex flex-wrap gap-x-1.5 gap-y-2">
        {scale === 1
          ? ordered.map((it) => (
              <li key={it.key} className={size}>
                {onPick ? (
                  <button type="button" onClick={() => onPick(it.key)} title={it.title} aria-label={it.title}
                    className="block h-full w-full rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 hover:opacity-80">
                    <Person color={it.color} />
                  </button>
                ) : (
                  <span role="img" title={it.title} aria-label={it.title} className="block h-full w-full"><Person color={it.color} /></span>
                )}
              </li>
            ))
          : legend.flatMap((l) =>
              Array.from({ length: Math.ceil((counts.get(l.group) ?? 0) / scale) }, (_, i) => (
                <li key={`${l.group}-${i}`} className={size}>
                  <span role="img" aria-label={l.label} title={l.label} className="block h-full w-full"><Person color={l.color} /></span>
                </li>
              )))}
      </ul>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {legend.map((l) => (
          <li key={l.group} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} aria-hidden="true" />
            {l.label} <span className="font-black text-slate-900 dark:text-white">{counts.get(l.group) ?? 0}</span>
          </li>
        ))}
      </ul>
      {scale > 1 && <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Each icon ≈ {scale} students.</p>}
    </div>
  );
}

/* ───── sparkline (0–100) ───── */
export function Sparkline({ values, width = 72, height = 24, color = "#6366f1", label }: {
  values: number[]; width?: number; height?: number; color?: string; label: string;
}) {
  if (values.length === 0) return <span className="text-xs text-slate-400">—</span>;
  const pad = 3;
  const x = (i: number) => (values.length === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (values.length - 1));
  const y = (v: number) => pad + (1 - Math.max(0, Math.min(100, v)) / 100) * (height - 2 * pad);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values[values.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="shrink-0 overflow-visible">
      {values.length > 1 && <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
      <circle cx={x(values.length - 1)} cy={y(last)} r={3} fill={color} stroke="var(--a4-spark-ring, #fff)" strokeWidth={1.5} />
    </svg>
  );
}

/* ───── recent classes as coloured dots ───── */
export function StatusDots({ statuses, max = 10 }: { statuses: string[]; max?: number }) {
  const shown = statuses.slice(-max);
  if (!shown.length) return <span className="text-xs text-slate-400">—</span>;
  const tally = shown.reduce<Record<string, number>>((m, s) => ((m[s] = (m[s] ?? 0) + 1), m), {});
  const aria = `Last ${plural(shown.length, "class", "classes")}: ` +
    Object.entries(tally).map(([k, n]) => `${n} ${ATT_LABELS[k]?.toLowerCase() ?? k}`).join(", ");
  return (
    <span role="img" aria-label={aria} title={aria} className="inline-flex items-center gap-[3px]">
      {shown.map((s, i) => (
        <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ATT_COLORS[s] ?? "#94a3b8" }} />
      ))}
    </span>
  );
}

/* ───── avatar ───── */
const AVATAR_TINTS = [
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200",
  "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200",
  "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-200",
];

export function Avatar({ name, seed, size = "h-9 w-9 text-xs" }: { name: string; seed: string; size?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full font-black ${size} ${AVATAR_TINTS[h % AVATAR_TINTS.length]}`}>
      {initials}
    </span>
  );
}

/* ───── states ───── */
export function EmptyArt({ title, children, actions, compact = false }: {
  title: string; children?: React.ReactNode; actions?: React.ReactNode; compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02] px-6 ${compact ? "py-6" : "py-10"}`}>
      <svg width="88" height="56" viewBox="0 0 88 56" aria-hidden="true" className="mb-3">
        <rect x="4" y="30" width="12" height="22" rx="3" fill="#c7d2fe" />
        <rect x="22" y="18" width="12" height="34" rx="3" fill="#a5b4fc" />
        <rect x="40" y="8" width="12" height="44" rx="3" fill="#818cf8" />
        <rect x="58" y="22" width="12" height="30" rx="3" fill="#6ee7b7" />
        <rect x="76" y="34" width="8" height="18" rx="3" fill="#fcd34d" />
      </svg>
      <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">{title}</h4>
      {children && <div className="mt-1 max-w-md text-xs sm:text-sm text-slate-600 dark:text-slate-400">{children}</div>}
      {actions && <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="break-words">{message}</span>
      </div>
      <button type="button" onClick={onRetry} className="shrink-0 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700">Retry</button>
    </div>
  );
}

