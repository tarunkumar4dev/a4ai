// Attendance: rings, a month-style calendar, the trend vs target, status mix, weekdays, absence streaks
// (with a WhatsApp-the-parent button), attendance bands, students below target and a per-class comparison.

import React from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import {
  AlertTriangle, BarChart3, CalendarCheck, CalendarDays, CalendarRange, Flame, MessageCircle, PieChart as PieIcon,
  School, Users,
} from "lucide-react";
import { MIN_MARKED_FOR_ALERT, STREAK_ALERT, parseDay, shortDate, type AttendanceSummary } from "@/lib/teacherAnalytics";
import { isoDate } from "@/lib/localDate";
import { openWhatsApp } from "@/lib/whatsapp";
import { Avatar, CountPill, Delta, EmptyArt, Panel, Pictograph, StatCard, StatusDots } from "./kit";
import { ATT_COLORS, ATT_LABELS, AXIS, GRID, TOOLTIP, STATUS, attColor, btnDark, fmtPct, plural } from "./theme";
import type { ViewProps } from "./model";

export default function AttendanceView({ m, allClasses, openStudent, openMarkAttendance }: ViewProps) {
  const att = m.att;
  if (!att) return null;
  const heldDelta = m.prevHeld != null ? att.sessionsHeld - m.prevHeld : null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Attendance Rate" tone="emerald" icon={<CalendarCheck className="h-4 w-4" />} value={fmtPct(att.rate)}
          ring={att.rate} ringLabel={`Attendance ${fmtPct(att.rate)}`}
          sub={att.rate == null ? "Nothing marked yet" : att.rate >= m.target ? `Meets the ${m.target}% target` : `Under the ${m.target}% target`}
          delta={<Delta value={att.rate != null && m.prevAttRate != null ? att.rate - m.prevAttRate : null} vs={m.prevLabel} />} />
        <StatCard label="Classes Held" tone="sky" icon={<CalendarDays className="h-4 w-4" />} value={att.sessionsHeld}
          sub="Conducted classes you marked"
          delta={<Delta value={att.sessionsHeld || m.prevHeld ? heldDelta : null} unit="" vs={m.prevLabel} />} />
        <StatCard label="Avg Present" tone="indigo" icon={<Users className="h-4 w-4" />} value={att.avgAttended ?? "—"} sub="Students attending per class" />
        <StatCard label={`Below ${m.target}%`} tone="rose" icon={<AlertTriangle className="h-4 w-4" />} value={att.defaulters.length}
          sub={`Students with ${MIN_MARKED_FOR_ALERT}+ classes marked`} />
      </div>

      {att.marked === 0 ? (
        <Panel title="No attendance in this period yet" icon={<CalendarCheck className="h-4 w-4" />} tone="emerald">
          <EmptyArt title="Your attendance analytics start with the first marked class"
            actions={<button type="button" onClick={openMarkAttendance} className={btnDark}>Mark attendance</button>}>
            Mark attendance and the calendar, trends, absence alerts and the students below {m.target}% appear here.
          </EmptyArt>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            <Panel className="lg:col-span-7" title="Attendance calendar" icon={<CalendarRange className="h-4 w-4" />} tone="emerald"
              sub="Each day coloured by the share of students who attended">
              <AttendanceCalendar att={att} target={m.target} periodStart={m.periodStart} />
            </Panel>
            <Panel className="lg:col-span-5" title="Marking breakdown" icon={<PieIcon className="h-4 w-4" />} tone="violet" sub={`${att.marked} marks in total`}>
              <Breakdown att={att} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            <Panel className="lg:col-span-8" title="Attendance by date" icon={<CalendarDays className="h-4 w-4" />} tone="emerald"
              sub={`Share of marked students who attended · amber line = ${m.target}% target`}>
              <div className="h-[240px] sm:h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={att.trend} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
                    <defs>
                      <linearGradient id="attArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis domain={[0, 100]} {...AXIS} unit="%" width={40} />
                    <ReferenceLine y={m.target} stroke="#f59e0b" strokeWidth={1.5} />
                    <Tooltip {...TOOLTIP} formatter={(v: number, _n, p) => [`${v}% of ${p?.payload?.marked} marked`, "Attended"]} />
                    <Area type="monotone" dataKey="rate" stroke="#10B981" strokeWidth={2.5} fill="url(#attArea)" isAnimationActive={false}
                      dot={att.trend.length <= 31 ? { r: 3.5, fill: "#10B981", strokeWidth: 0 } : false} activeDot={{ r: 5.5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel className="lg:col-span-4" title="By weekday" icon={<BarChart3 className="h-4 w-4" />} tone="sky"
              sub="Attendance % per weekday (gap = no class that day)">
              <div className="h-[240px] sm:h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={att.weekday} margin={{ top: 18, right: 4, left: 0, bottom: 0 }} accessibilityLayer>
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey="day" {...AXIS} />
                    <YAxis domain={[0, 100]} {...AXIS} unit="%" width={40} />
                    <ReferenceLine y={m.target} stroke="#f59e0b" strokeWidth={1.5} />
                    <Tooltip {...TOOLTIP} labelFormatter={(_l, p) => p?.[0]?.payload?.dayLong ?? ""}
                      formatter={(v: number, _n, p) => [`${v}% of ${p?.payload?.marked} marked`, "Attended"]} />
                    <Bar dataKey="rate" maxBarSize={28} radius={[6, 6, 0, 0]} isAnimationActive={false}
                      label={{ position: "top", fontSize: 10, fill: "#64748b", formatter: (v: number | null) => (v == null ? "" : `${Math.round(v)}`) }}>
                      {att.weekday.map((d) => <Cell key={d.day} fill={d.rate == null ? "#cbd5e1" : attColor(d.rate, m.target)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
            <Panel title={`Absent ${STREAK_ALERT}+ classes in a row`} icon={<Flame className="h-4 w-4" />} tone="rose"
              sub="Up to their latest marked class — leave, late or present ends a run"
              right={<CountPill tone={att.streaks.length ? "red" : "green"}>{att.streaks.length}</CountPill>}>
              {att.streaks.length ? (
                <ul className="space-y-2">
                  {att.streaks.slice(0, 8).map((s) => (
                    <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 p-2.5 dark:border-rose-500/20 dark:bg-rose-500/[0.06]">
                      <button type="button" onClick={() => openStudent(`s:${s.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <Avatar name={s.name} seed={`s:${s.id}`} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-slate-900 dark:text-white">{s.name}</div>
                          <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                            Absent last {s.absentStreak} · {s.pct}% overall{allClasses && s.batchName ? ` · ${s.batchName}` : ""}
                          </div>
                          <div className="mt-1"><StatusDots statuses={s.recent} /></div>
                        </div>
                      </button>
                      {s.parentPhone ? (
                        <button type="button" title="Message the parent on WhatsApp" aria-label={`WhatsApp ${s.name}'s parent`}
                          onClick={() => openWhatsApp(`Hello, ${s.name} has been absent in the last ${s.absentStreak} classes${s.batchName ? ` of ${s.batchName}` : ""}. Is everything okay? Please get in touch.`, s.parentPhone)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white hover:bg-emerald-600">
                          <MessageCircle className="h-4 w-4" />
                        </button>
                      ) : <span className="shrink-0 text-[10px] font-semibold text-slate-500">No phone</span>}
                    </li>
                  ))}
                  {att.streaks.length > 8 && <li className="text-xs text-slate-500">+{att.streaks.length - 8} more in the export.</li>}
                </ul>
              ) : (
                <EmptyArt compact title="No absence streaks">Nobody has missed {STREAK_ALERT} classes in a row.</EmptyArt>
              )}
            </Panel>

            <Panel title="Attendance bands" icon={<Users className="h-4 w-4" />} tone="teal" sub="Every student in your classes — one icon each">
              <Pictograph label="Students by attendance band"
                items={att.students.map((s) => {
                  const b = att.bands.find((x) => (s.pct == null ? x.key === "none" : s.pct >= x.min && s.pct < x.max))!;
                  return { key: `s:${s.id}`, group: b.key, color: b.color, title: `${s.name} — ${s.pct == null ? "not marked" : `${s.pct}%`}` };
                })}
                legend={att.bands.map((b) => ({ group: b.key, label: b.label, color: b.color }))}
                onPick={openStudent} />
              {att.perfect.length > 0 && (
                <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
                  ⭐ Perfect attendance: {att.perfect.slice(0, 6).map((s) => s.name).join(", ")}{att.perfect.length > 6 ? ` +${att.perfect.length - 6} more` : ""}
                </p>
              )}
            </Panel>
          </div>

          <Panel title={`Below ${m.target}%`} icon={<AlertTriangle className="h-4 w-4" />} tone="rose"
            sub={`Students with at least ${MIN_MARKED_FOR_ALERT} classes marked`}
            right={<CountPill tone={att.defaulters.length ? "red" : "green"}>{att.defaulters.length} at risk</CountPill>}>
            {att.defaulters.length === 0 ? (
              <EmptyArt compact title={`No student is below ${m.target}%`}>Everyone with {MIN_MARKED_FOR_ALERT}+ marked classes meets the target.</EmptyArt>
            ) : (
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[560px] text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200/70 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/10">
                      <th className="pb-3">Student</th>
                      <th className="pb-3">Recent classes</th>
                      <th className="pb-3 text-center">Attended</th>
                      <th className="pb-3 text-center">%</th>
                      <th className="pb-3 text-right">To reach {m.target}%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 tabular-nums">
                    {att.defaulters.slice(0, 15).map((s) => (
                      <tr key={s.id}>
                        <td className="py-2.5">
                          <button type="button" onClick={() => openStudent(`s:${s.id}`)} className="flex items-center gap-2.5 text-left">
                            <Avatar name={s.name} seed={`s:${s.id}`} size="h-8 w-8 text-[11px]" />
                            <span>
                              <span className="block font-bold text-slate-900 hover:underline dark:text-white">{s.name}</span>
                              {(s.rollNo || (allClasses && s.batchName)) && (
                                <span className="block text-[10px] font-mono text-slate-500">{[s.rollNo && `Roll ${s.rollNo}`, allClasses && s.batchName].filter(Boolean).join(" · ")}</span>
                              )}
                            </span>
                          </button>
                        </td>
                        <td className="py-2.5"><StatusDots statuses={s.recent} /></td>
                        <td className="py-2.5 text-center font-medium text-slate-700 dark:text-slate-300">{s.attended} / {s.total}</td>
                        <td className="py-2.5 text-center"><span className="rounded-lg bg-red-50 px-2 py-0.5 font-black text-red-700 dark:bg-red-500/15 dark:text-red-300">{s.pct}%</span></td>
                        <td className="py-2.5 text-right">
                          <span className="inline-block rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
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

          {allClasses && att.byBatch.length >= 2 && (() => {
            const byClass = [...att.byBatch].sort((a, b) => b.rate - a.rate).map((b) => ({ ...b, name: m.batchName.get(b.batchId) ?? "Class" }));
            return (
            <Panel title="By class" icon={<School className="h-4 w-4" />} tone="indigo" sub="Attendance % of each of your classes in this period">
              <div className="w-full" style={{ height: Math.max(160, att.byBatch.length * 44) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }} accessibilityLayer data={byClass}>
                    <CartesianGrid horizontal={false} stroke={GRID} />
                    <XAxis type="number" domain={[0, 100]} {...AXIS} unit="%" />
                    <YAxis type="category" dataKey="name" {...AXIS} width={110} />
                    <ReferenceLine x={m.target} stroke="#f59e0b" strokeWidth={1.5} />
                    <Tooltip {...TOOLTIP} formatter={(v: number, _n, p) => [`${v}% · ${plural(p?.payload?.held ?? 0, "class", "classes")} held`, "Attendance"]} />
                    <Bar dataKey="rate" maxBarSize={22} radius={[0, 6, 6, 0]} isAnimationActive={false}
                      label={{ position: "right", fontSize: 11, fill: "#64748b", formatter: (v: number) => `${v}%` }}>
                      {byClass.map((b) => <Cell key={b.batchId} fill={attColor(b.rate, m.target)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            );
          })()}

          {att.offRoster > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {plural(att.offRoster, "marked student")} {att.offRoster === 1 ? "is" : "are"} no longer in {allClasses ? "your classes" : "this class"} — counted in the totals, not in the lists.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Breakdown({ att }: { att: AttendanceSummary }) {
  const slices = (["present", "late", "leave", "absent"] as const)
    .map((k) => ({ key: k, name: ATT_LABELS[k], value: att.counts[k], color: ATT_COLORS[k] }))
    .filter((s) => s.value > 0);
  return (
    <>
      <div className="relative h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} cx="50%" cy="50%" innerRadius={58} outerRadius={84} paddingAngle={slices.length > 1 ? 2 : 0}
              dataKey="value" stroke="none" isAnimationActive={false}>
              {slices.map((s) => <Cell key={s.key} fill={s.color} />)}
            </Pie>
            <Tooltip {...TOOLTIP} formatter={(v: number, n) => [`${v} (${Math.round((v / att.marked) * 100)}%)`, n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-slate-900 dark:text-white">{fmtPct(att.rate)}</span>
          <span className="text-[11px] font-semibold text-slate-500">attended</span>
        </div>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-200/60 pt-3 dark:border-white/5">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
            {s.name} <span className="ml-auto tabular-nums text-slate-900 dark:text-white">{s.value}</span>
            <span className="w-9 text-right tabular-nums font-semibold text-slate-500">{Math.round((s.value / att.marked) * 100)}%</span>
          </li>
        ))}
      </ul>
    </>
  );
}

const DAY_HEAD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** at most this many weeks (≈ 90 days) — older days are in the trend chart and the export */
const MAX_WEEKS = 13;

function AttendanceCalendar({ att, target, periodStart }: { att: AttendanceSummary; target: number; periodStart: string | null }) {
  const byDay = new Map(att.trend.map((t) => [t.date, t]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const first = parseDay(periodStart ?? att.trend[0]?.date) ?? today;
  // Monday on or before the first day, but never more than MAX_WEEKS back
  const start = new Date(first);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const earliest = new Date(today);
  earliest.setDate(earliest.getDate() - ((earliest.getDay() + 6) % 7) - (MAX_WEEKS - 1) * 7);
  if (start < earliest) start.setTime(earliest.getTime());
  const weeks: Date[][] = [];
  for (const d = new Date(start); d <= today; ) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) { week.push(new Date(d)); d.setDate(d.getDate() + 1); }
    weeks.push(week);
  }
  const firstDay = first > start ? first : start;
  const clipped = first < start;

  return (
    <div>
      <div className="grid grid-cols-[2.25rem_repeat(7,minmax(0,1fr))] gap-1 sm:gap-1.5">
        <span />
        {DAY_HEAD.map((d) => <span key={d} className="text-center text-[10px] font-bold uppercase text-slate-500">{d}</span>)}
        {weeks.map((week) => {
          const monthStart = week.find((d) => d.getDate() === 1);
          const label = week === weeks[0] ? MONTHS[week[0].getMonth()] : monthStart ? MONTHS[monthStart.getMonth()] : "";
          return (
            <React.Fragment key={isoDate(week[0])}>
              <span className="self-center text-[10px] font-bold text-slate-500">{label}</span>
              {week.map((d) => {
                const key = isoDate(d);
                if (d > today) return <span key={key} />;
                if (d < firstDay) return <span key={key} className="aspect-square rounded-md" />;
                const t = byDay.get(key);
                const title = t ? `${shortDate(key)}: ${t.rate}% attended (${t.marked} marked)` : `${shortDate(key)}: no class marked`;
                return (
                  <span key={key} title={title} aria-label={title}
                    className={`flex aspect-square items-center justify-center rounded-md text-[10px] sm:text-[11px] font-bold ${t ? "" : "bg-slate-100 text-slate-400 dark:bg-white/[0.05] dark:text-slate-500"}`}
                    style={t ? { backgroundColor: attColor(t.rate, target), color: attColor(t.rate, target) === STATUS.warning ? "#0b0b0b" : "#fff" } : undefined}>
                    {d.getDate()}
                  </span>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
        {[
          { c: attColor(95, target), l: "90%+" },
          ...(target < 90 ? [{ c: attColor(target, target), l: `${target}–89%` }] : []),
          { c: attColor(target - 5, target), l: `${target - 10}–${target - 1}%` },
          { c: attColor(0, target), l: `Below ${target - 10}%` },
        ].map((x) => (
          <li key={x.l} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ backgroundColor: x.c }} aria-hidden="true" />{x.l}</li>
        ))}
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-100 dark:bg-white/[0.08]" aria-hidden="true" />No class</li>
      </ul>
      {clipped && <p className="mt-2 text-[11px] text-slate-500">Showing the last {MAX_WEEKS} weeks — older days are in the trend chart and the export.</p>}
    </div>
  );
}
