// Overview: four rings, "what stands out", the class as a pictograph, both trends, who needs attention, stars.

import React from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import {
  AlertTriangle, ArrowRight, Award, BookOpen, CalendarCheck, CalendarDays, CheckCircle2, ClipboardCheck, Clock,
  Flame, Link2, Medal, Sparkles, Star, Target, TrendingDown, TrendingUp, Trophy, Users,
} from "lucide-react";
import { RISK_ORDER, type Insight, type InsightIcon, type RiskLevel } from "@/lib/teacherAnalytics";
import { Avatar, CountPill, Delta, EmptyArt, Panel, Pictograph, StatCard, StatusDots } from "./kit";
import { AXIS, GRID, RISK_COLORS, RISK_LABELS, TOOLTIP, btnDark, btnGhost, fmtPct, linkBtn, plural, scoreColor } from "./theme";
import type { ViewProps } from "./model";
import { FlagChips } from "./StudentBits";

const INSIGHT_ICON: Record<InsightIcon, React.ElementType> = {
  flame: Flame, "trend-up": TrendingUp, "trend-down": TrendingDown, calendar: CalendarDays, alert: AlertTriangle,
  trophy: Trophy, clock: Clock, link: Link2, star: Star, book: BookOpen,
};

const INSIGHT_TONE: Record<Insight["tone"], { card: string; chip: string; label: string }> = {
  bad: { card: "bg-rose-50/70 border-rose-100 dark:bg-rose-500/[0.07] dark:border-rose-500/20", chip: "bg-rose-500 text-white", label: "Act now" },
  warn: { card: "bg-amber-50/70 border-amber-100 dark:bg-amber-500/[0.07] dark:border-amber-500/20", chip: "bg-amber-400 text-amber-950", label: "Watch" },
  good: { card: "bg-emerald-50/70 border-emerald-100 dark:bg-emerald-500/[0.07] dark:border-emerald-500/20", chip: "bg-emerald-500 text-white", label: "Good news" },
  info: { card: "bg-sky-50/70 border-sky-100 dark:bg-sky-500/[0.07] dark:border-sky-500/20", chip: "bg-sky-500 text-white", label: "Note" },
};

const RISK_LEGEND: RiskLevel[] = ["high", "watch", "ok", "none"];

export default function OverviewView({ m, go, openStudent, openAssignments, openCheckCopies, openMarkAttendance }: ViewProps) {
  const { att, marks } = m;
  const withData = m.rows.filter((r) => r.risk !== "none");
  const onTrack = withData.filter((r) => r.risk === "ok").length;
  const attention = m.rows.filter((r) => r.risk === "high" || r.risk === "watch");
  const onTrackPct = withData.length ? Math.round((onTrack / withData.length) * 1000) / 10 : null;

  const doInsight = (i: Insight) => {
    if (i.action === "assignments") openAssignments();
    else if (i.action) go(i.action);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── rings ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Attendance" tone="emerald" icon={<CalendarCheck className="h-4 w-4" />}
          value={fmtPct(att?.rate)} ring={att?.rate ?? null} ringLabel={`Attendance ${fmtPct(att?.rate)}`}
          sub={att?.rate == null ? "Nothing marked yet" : att.rate >= m.target ? `Meets the ${m.target}% target` : `Under the ${m.target}% target`}
          delta={<Delta value={att?.rate != null && m.prevAttRate != null ? att.rate - m.prevAttRate : null} vs={m.prevLabel} />} />
        <StatCard label="Class average" tone="indigo" icon={<TrendingUp className="h-4 w-4" />}
          value={fmtPct(marks?.avg)} ring={marks?.avg ?? null} ringLabel={`Class average ${fmtPct(marks?.avg)}`}
          sub={marks?.results ? `from ${plural(marks.results, "result")}` : "No marks yet"}
          delta={<Delta value={marks?.avg != null && m.prevMarksAvg != null ? marks.avg - m.prevMarksAvg : null} vs={m.prevLabel} />} />
        <StatCard label="Passing rate" tone="violet" icon={<CheckCircle2 className="h-4 w-4" />}
          value={fmtPct(marks?.passRate)} ring={marks?.passRate ?? null} ringLabel={`Passing rate ${fmtPct(marks?.passRate)}`}
          sub={`Results at or above ${m.pass}%`}
          delta={<Delta value={marks?.passRate != null && m.prevPassRate != null ? marks.passRate - m.prevPassRate : null} vs={m.prevLabel} />} />
        <StatCard label="On track" tone="amber" icon={<Users className="h-4 w-4" />}
          value={withData.length ? <>{onTrack}<span className="text-lg sm:text-xl font-bold text-slate-400"> / {withData.length}</span></> : "—"}
          ring={onTrackPct} ringLabel={`${onTrack} of ${withData.length} students on track`}
          sub={attention.length ? `${plural(attention.length, "student")} to look at` : withData.length ? "Nobody flagged" : "Needs attendance or marks"} />
      </div>

      {/* ── what stands out + pictograph ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        <Panel className="lg:col-span-7" title="What stands out" sub="Picked from your classes' real numbers for this period"
          icon={<Sparkles className="h-4 w-4" />} tone="violet">
          {m.insights.length ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {m.insights.slice(0, 6).map((i) => {
                const Icon = INSIGHT_ICON[i.icon];
                const t = INSIGHT_TONE[i.tone];
                return (
                  <li key={i.id} className={`flex gap-3 rounded-2xl border p-3.5 ${t.card}`}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.chip}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.label}</div>
                      <div className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug">{i.title}</div>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 break-words">{i.detail}</p>
                      {i.action && (
                        <button type="button" onClick={() => doInsight(i)} className={`${linkBtn} mt-1.5`}>
                          {i.action === "assignments" ? "Open assignments" : "See details"} <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <GettingStarted
              attendanceDone={(att?.marked ?? 0) > 0} marksDone={(marks?.results ?? 0) > 0}
              openMarkAttendance={openMarkAttendance} openCheckCopies={openCheckCopies} openAssignments={() => openAssignments()} />
          )}
        </Panel>

        <Panel className="lg:col-span-5" title="Your class at a glance" icon={<Users className="h-4 w-4" />} tone="sky"
          sub={m.rows.length ? `${plural(m.rows.length, "student")} — each icon is one student; tap one to open` : undefined}>
          {m.rows.length ? (
            <Pictograph label="Students by status"
              items={[...m.rows].sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]).map((r) => ({
                key: r.key, group: r.risk, color: RISK_COLORS[r.risk], title: `${r.name} — ${RISK_LABELS[r.risk]}`,
              }))}
              legend={RISK_LEGEND.map((k) => ({ group: k, label: RISK_LABELS[k], color: RISK_COLORS[k] }))}
              onPick={openStudent} />
          ) : (
            <EmptyArt compact title="No students in your classes yet">Students appear once your admin adds them to your batches.</EmptyArt>
          )}
        </Panel>
      </div>

      {/* ── both trends ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        <Panel title="Attendance trend" sub={`Share of marked students who attended · target ${m.target}%`}
          icon={<CalendarDays className="h-4 w-4" />} tone="emerald"
          right={<button type="button" onClick={() => go("attendance")} className={linkBtn}>Open <ArrowRight className="h-3 w-3" /></button>}>
          {att && att.trend.length ? (
            <div className="h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={att.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ovAtt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis domain={[0, 100]} {...AXIS} unit="%" width={40} />
                  <ReferenceLine y={m.target} stroke="#f59e0b" strokeWidth={1.5} ifOverflow="extendDomain" />
                  <Tooltip {...TOOLTIP} formatter={(v: number, _n, p) => [`${v}% of ${p?.payload?.marked} marked`, "Attended"]} />
                  <Area type="monotone" dataKey="rate" stroke="#10B981" strokeWidth={2.5} fill="url(#ovAtt)" isAnimationActive={false}
                    dot={att.trend.length <= 20 ? { r: 3, fill: "#10B981", strokeWidth: 0 } : false} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyArt compact title="No attendance yet" actions={<button type="button" onClick={openMarkAttendance} className={btnDark}>Mark attendance</button>} />
          )}
        </Panel>

        <Panel title="Marks by assessment" sub={`Class average per assessment · pass mark ${m.pass}%`}
          icon={<BookOpen className="h-4 w-4" />} tone="indigo"
          right={<button type="button" onClick={() => go("marks")} className={linkBtn}>Open <ArrowRight className="h-3 w-3" /></button>}>
          {marks && marks.assessments.length ? (
            <div className="h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marks.assessments.slice(-10)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={10} />
                  <YAxis domain={[0, 100]} {...AXIS} unit="%" width={40} />
                  <ReferenceLine y={m.pass} stroke="#ef4444" strokeWidth={1.5} />
                  <Tooltip {...TOOLTIP} labelFormatter={(_l, p) => p?.[0]?.payload?.title ?? ""}
                    formatter={(v: number, _n, p) => [`${v}% · ${plural(p?.payload?.n ?? 0, "student")}`, "Average"]} />
                  <Bar dataKey="avg" maxBarSize={28} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                    {marks.assessments.slice(-10).map((x) => <Cell key={x.id} fill={scoreColor(x.avg, m.pass)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyArt compact title="No marks yet" actions={<button type="button" onClick={openCheckCopies} className={btnDark}>Check copies</button>} />
          )}
        </Panel>
      </div>

      {/* ── who needs attention + stars ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        <Panel className="lg:col-span-7" title="Needs attention" icon={<AlertTriangle className="h-4 w-4" />} tone="rose"
          sub="Low attendance, low marks or a run of absences"
          right={<CountPill tone={attention.length ? "red" : "green"}>{attention.length}</CountPill>}>
          {attention.length ? (
            <>
              <ul className="divide-y divide-slate-100 dark:divide-white/5">
                {[...attention].sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || a.name.localeCompare(b.name)).slice(0, 6).map((r) => (
                  <li key={r.key}>
                    <button type="button" onClick={() => openStudent(r.key)}
                      className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-white/[0.03] rounded-xl px-1.5">
                      <Avatar name={r.name} seed={r.key} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-slate-900 dark:text-white">{r.name}</div>
                        <div className="mt-1"><FlagChips row={r} target={m.target} pass={m.pass} /></div>
                      </div>
                      <div className="hidden sm:block"><StatusDots statuses={r.att?.recent ?? []} /></div>
                    </button>
                  </li>
                ))}
              </ul>
              {attention.length > 6 && (
                <button type="button" onClick={() => go("students")} className={`${linkBtn} mt-3`}>See all {attention.length} <ArrowRight className="h-3 w-3" /></button>
              )}
            </>
          ) : (
            <EmptyArt compact title={withData.length ? "Nobody is flagged right now" : "Nothing to flag yet"}>
              {withData.length ? `Everyone with marked classes is at or above ${m.target}% and averaging ${m.pass}%+.` : "Students show up here once attendance or marks come in."}
            </EmptyArt>
          )}
        </Panel>

        <Panel className="lg:col-span-5" title="Stars of the period" icon={<Trophy className="h-4 w-4" />} tone="amber">
          <Stars m={m} openStudent={openStudent} />
        </Panel>
      </div>
    </div>
  );
}

const MEDAL = ["bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950", "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800", "bg-gradient-to-br from-orange-300 to-amber-700 text-amber-950"];

function Stars({ m, openStudent }: Pick<ViewProps, "m" | "openStudent">) {
  const top = (m.marks?.students ?? []).slice(0, 3);
  const improved = (m.marks?.improvers ?? []).slice(0, 2);
  const perfect = m.att?.perfect ?? [];
  if (!top.length && !perfect.length) {
    return <EmptyArt compact title="Stars appear with the first results">Top scorers, most improved and perfect attendance show here.</EmptyArt>;
  }
  return (
    <div className="space-y-4">
      {top.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400"><Medal className="h-3.5 w-3.5" /> Top scorers</div>
          <ul className="space-y-2">
            {top.map((s, i) => (
              <li key={s.key}>
                <button type="button" onClick={() => openStudent(s.key)} className="flex w-full items-center gap-3 rounded-xl p-1.5 text-left hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black shadow-sm ${MEDAL[i]}`}>{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900 dark:text-white">{s.name}</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">{s.avg}%</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {improved.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400"><TrendingUp className="h-3.5 w-3.5" /> Most improved</div>
          <ul className="space-y-1.5">
            {improved.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-2 text-sm">
                <button type="button" onClick={() => openStudent(s.key)} className="min-w-0 truncate font-bold text-slate-800 hover:underline dark:text-slate-100">{s.name}</button>
                <CountPill tone="green">+{s.delta} pts</CountPill>
              </li>
            ))}
          </ul>
        </div>
      )}
      {perfect.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400"><Award className="h-3.5 w-3.5" /> Perfect attendance</div>
          <div className="flex flex-wrap gap-1.5">
            {perfect.slice(0, 8).map((s) => (
              <button key={s.id} type="button" onClick={() => openStudent(`s:${s.id}`)}
                className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-200">
                {s.name}
              </button>
            ))}
            {perfect.length > 8 && <span className="px-1 py-1 text-xs font-semibold text-slate-500">+{perfect.length - 8} more</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function GettingStarted({ attendanceDone, marksDone, openMarkAttendance, openCheckCopies, openAssignments }: {
  attendanceDone: boolean; marksDone: boolean;
  openMarkAttendance: () => void; openCheckCopies: () => void; openAssignments: () => void;
}) {
  const steps = [
    { n: 1, title: "Mark attendance", text: "Rates, the calendar and absence alerts fill in from your marked classes.", done: attendanceDone, icon: CalendarCheck, tone: "from-emerald-400 to-teal-500", action: openMarkAttendance, cta: "Mark attendance" },
    { n: 2, title: "Check copies", text: "Approved copy checks give class averages, ranks and question-wise weak spots.", done: marksDone, icon: ClipboardCheck, tone: "from-indigo-500 to-violet-500", action: openCheckCopies, cta: "Check copies" },
    { n: 3, title: "Share a submit link", text: "Assignment submissions show who submitted, who's late and who's missing.", done: false, icon: Target, tone: "from-amber-400 to-orange-500", action: openAssignments, cta: "Assignments" },
  ];
  return (
    <div>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">Insights appear as soon as there's something real to say. Three things fill this page:</p>
      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {steps.map((s) => (
          <li key={s.n} className="rounded-2xl border border-slate-200/70 bg-white p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center gap-2">
              <span className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${s.tone} text-white`}>
                {s.done ? <CheckCircle2 className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Step {s.n}{s.done ? " · done" : ""}</span>
            </div>
            <div className="mt-2 text-sm font-extrabold text-slate-900 dark:text-white">{s.title}</div>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{s.text}</p>
            {!s.done && <button type="button" onClick={s.action} className={`${btnGhost} mt-3 px-3 py-1.5 text-xs`}>{s.cta}</button>}
          </li>
        ))}
      </ol>
    </div>
  );
}

