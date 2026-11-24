// Marks: averages per assessment (with the spread), score bands, top / improving / slipping students,
// who needs support, the assignment tracker and the question-wise analysis.

import React, { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, Cell, ErrorBar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import {
  Award, BookOpen, CheckCircle2, ChevronDown, ClipboardList, Crown, LifeBuoy, MessageCircle, TrendingDown, TrendingUp,
  Trophy, ArrowRight,
} from "lucide-react";
import { shortDate, type AssignmentTrack, type StudentMarks } from "@/lib/teacherAnalytics";
import { openWhatsApp } from "@/lib/whatsapp";
import { Avatar, CountPill, Delta, EmptyArt, Panel, Pictograph, Sparkline, StatCard } from "./kit";
import { AXIS, GRID, TOOLTIP, btnDark, btnGhost, fmtPct, linkBtn, plural, scoreColor } from "./theme";
import type { ViewProps } from "./model";
import QuestionAnalysis from "./QuestionAnalysis";

const shorten = (s: string, n = 14) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export default function MarksView(props: ViewProps & { userId: string }) {
  const { m, openStudent, openAssignments, openCheckCopies, userId } = props;
  const marks = m.marks;
  if (!marks) return null;

  const best = m.results.reduce<(typeof m.results)[number] | null>((b, r) => (!b || r.pct > b.pct ? r : b), null);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Class Average" tone="indigo" icon={<TrendingUp className="h-4 w-4" />} value={fmtPct(marks.avg)}
          ring={marks.avg} ringLabel={`Class average ${fmtPct(marks.avg)}`}
          sub={marks.results ? `from ${plural(marks.results, "result")}` : "No marks yet"}
          delta={<Delta value={marks.avg != null && m.prevMarksAvg != null ? marks.avg - m.prevMarksAvg : null} vs={m.prevLabel} />} />
        <StatCard label="Highest Score" tone="amber" icon={<Award className="h-4 w-4" />} value={fmtPct(marks.highest)}
          sub={best ? <span className="block truncate">{best.name} · {best.title}</span> : "Best single result"} />
        <StatCard label="Passing Rate" tone="emerald" icon={<CheckCircle2 className="h-4 w-4" />} value={fmtPct(marks.passRate)}
          ring={marks.passRate} ringLabel={`Passing rate ${fmtPct(marks.passRate)}`} sub={`Results at or above ${m.pass}%`}
          delta={<Delta value={marks.passRate != null && m.prevPassRate != null ? marks.passRate - m.prevPassRate : null} vs={m.prevLabel} />} />
        <StatCard label="Assessments" tone="violet" icon={<BookOpen className="h-4 w-4" />} value={m.assignmentsGiven + m.copyChecks}
          sub={<>
            {plural(m.assignmentsGiven, "assignment")} · {plural(m.copyChecks, "copy check")}
            {m.pending > 0 && <span className="mt-1 block font-bold text-amber-800 dark:text-amber-300">{m.pending} awaiting marks</span>}
          </>} />
      </div>

      {marks.results === 0 ? (
        <Panel title="No marks in this period yet" icon={<BookOpen className="h-4 w-4" />} tone="indigo">
          <EmptyArt title="Marks show up here on their own"
            actions={<>
              <button type="button" onClick={openCheckCopies} className={btnDark}>Check copies</button>
              <button type="button" onClick={() => openAssignments()} className={btnGhost}>Assignments</button>
            </>}>
            Approve checked copies in <strong>Check Copies</strong>, or publish the results of an assignment's submit link.
            {m.pending > 0 && ` ${plural(m.pending, "submission")} ${m.pending === 1 ? "is" : "are"} waiting to be checked or published.`}
          </EmptyArt>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            <Panel className="lg:col-span-8" title="Average by assessment" icon={<BookOpen className="h-4 w-4" />} tone="indigo"
              sub={`Bar = class average · whisker = lowest to highest score · red line = pass mark ${m.pass}%`}>
              <div className="h-[260px] sm:h-[290px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={marks.assessments.slice(-12).map((a) => ({ ...a, short: shorten(a.title), range: [a.avg - a.min, a.max - a.avg] }))}
                    margin={{ top: 10, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey="short" {...AXIS} interval={marks.assessments.length > 8 ? "preserveStartEnd" : 0} />
                    <YAxis domain={[0, 100]} {...AXIS} unit="%" width={40} />
                    <ReferenceLine y={m.pass} stroke="#ef4444" strokeWidth={1.5} />
                    <Tooltip {...TOOLTIP} labelFormatter={(_l, p) => { const a = p?.[0]?.payload; return a ? `${a.title} · ${a.label}` : ""; }}
                      formatter={(v: number, name, p) => (name === "avg"
                        ? [`${v}% average · ${p?.payload?.min}–${p?.payload?.max}% · ${p?.payload?.passed}/${p?.payload?.n} passed`, p?.payload?.kind === "copies" ? "Copy check" : "Assignment"]
                        : [null, null]) as [string, string]} />
                    <Bar dataKey="avg" name="avg" maxBarSize={30} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                      {marks.assessments.slice(-12).map((a) => <Cell key={a.id} fill={scoreColor(a.avg, m.pass)} />)}
                      <ErrorBar dataKey="range" width={8} strokeWidth={1.5} stroke="#64748b" direction="y" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {marks.distribution.map((b) => (
                  <li key={b.label} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: b.color }} aria-hidden="true" />{b.label}
                  </li>
                ))}
              </ul>
              {marks.assessments.length > 12 && <p className="mt-2 text-xs text-slate-500">Latest 12 of {marks.assessments.length} — all in the export.</p>}
            </Panel>

            <Panel className="lg:col-span-4" title="Score bands" icon={<Trophy className="h-4 w-4" />} tone="amber"
              sub={`${plural(marks.students.length, "student")} by average — one icon each`}>
              <Pictograph label="Students by score band"
                items={marks.students.map((s) => {
                  const b = marks.distribution.find((d) => s.avg >= d.min && s.avg < d.max)!;
                  return { key: s.key, group: b.label, color: b.color, title: `${s.name} — ${s.avg}%` };
                })}
                legend={marks.distribution.map((b) => ({ group: b.label, label: b.label, color: b.color }))}
                onPick={openStudent} />
              <SegmentBar parts={marks.distribution.map((b) => ({ label: b.label, value: b.count, color: b.color }))} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
            <Panel title="Top performers" sub="Highest average score" icon={<Crown className="h-4 w-4" />} tone="amber">
              <Podium students={marks.students} openStudent={openStudent} />
            </Panel>
            <Panel title="Momentum" icon={<TrendingUp className="h-4 w-4" />} tone="teal"
              sub={`First vs latest result, ${plural(5, "point")} or more`}>
              <Momentum improvers={marks.improvers} slipping={marks.slipping} openStudent={openStudent} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            <Panel className="lg:col-span-5" title="Students needing support" sub={`Average below ${m.pass}%`}
              icon={<LifeBuoy className="h-4 w-4" />} tone="rose"
              right={<CountPill tone={marks.needsSupport.length ? "red" : "green"}>{marks.needsSupport.length}</CountPill>}>
              {marks.needsSupport.length === 0 ? (
                <EmptyArt compact title={`Nobody is below ${m.pass}%`}>Every student's average is at or above the pass mark.</EmptyArt>
              ) : (
                <>
                  <ul className="space-y-2">
                    {marks.needsSupport.slice(0, 8).map((s) => (
                      <li key={s.key}>
                        <button type="button" onClick={() => openStudent(s.key)}
                          className="flex w-full items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 p-2.5 text-left hover:bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/[0.06]">
                          <Avatar name={s.name} seed={s.key} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold text-slate-900 dark:text-white">
                              {s.name}{s.guest && <GuestTag />}
                            </div>
                            <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{s.rollNo ? `Roll ${s.rollNo} · ` : ""}{plural(s.count, "result")}</div>
                          </div>
                          <Sparkline values={s.trend} color="#ef4444" label={`${s.name}: ${s.trend.join("%, ")}%`} />
                          <span className="shrink-0 rounded-lg bg-red-600 px-2 py-1 text-xs font-black text-white">{s.avg}%</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {marks.needsSupport.length > 8 && <p className="mt-3 text-xs text-slate-500">+{marks.needsSupport.length - 8} more in the export.</p>}
                </>
              )}
              <CloseToPass students={marks.students} pass={m.pass} openStudent={openStudent} />
            </Panel>
            <Panel className="lg:col-span-7" title="Assignment tracker" icon={<ClipboardList className="h-4 w-4" />} tone="sky"
              sub="Who submitted, what's checked, who's missing">
              <Tracker items={m.tracker} batchName={m.batchName} openAssignments={openAssignments} />
            </Panel>
          </div>

          <QuestionAnalysis userId={userId} m={m} />
        </>
      )}

      {marks.results === 0 && m.tracker.length > 0 && (
        <Panel title="Assignment tracker" icon={<ClipboardList className="h-4 w-4" />} tone="sky" sub="Who submitted, what's checked, who's missing">
          <Tracker items={m.tracker} batchName={m.batchName} openAssignments={openAssignments} />
        </Panel>
      )}
    </div>
  );
}

/** Averaging at or just above the pass mark (within 10 points) — one bad test away from failing. */
function CloseToPass({ students, pass, openStudent }: { students: StudentMarks[]; pass: number; openStudent: (k: string) => void }) {
  const close = students.filter((s) => s.avg >= pass && s.avg < pass + 10).sort((a, b) => a.avg - b.avg);
  if (!close.length) return null;
  return (
    <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/10">
      <div className="mb-2 text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">Close to the line · {pass}–{pass + 9}%</div>
      <div className="flex flex-wrap gap-1.5">
        {close.slice(0, 10).map((s) => (
          <button key={s.key} type="button" onClick={() => openStudent(s.key)}
            className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-200">
            {s.name} · {s.avg}%
          </button>
        ))}
        {close.length > 10 && <span className="px-1 py-1 text-xs text-slate-500">+{close.length - 10} more</span>}
      </div>
    </div>
  );
}

function GuestTag() {
  return <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">Guest</span>;
}

/** Tall segmented bar: one whole split into parts; share printed inside when it fits. */
export function SegmentBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return null;
  const aria = parts.filter((p) => p.value).map((p) => `${p.label}: ${p.value} (${Math.round((p.value / total) * 100)}%)`).join(", ");
  return (
    <div role="img" aria-label={aria} title={aria} className="mt-4 flex h-7 w-full gap-[2px] overflow-hidden rounded-lg">
      {parts.filter((p) => p.value > 0).map((p) => {
        const share = (p.value / total) * 100;
        return (
          <div key={p.label} className="flex items-center rounded-[4px] px-1.5" style={{ width: `${share}%`, backgroundColor: p.color }}>
            {share >= 14 && <span className="text-[11px] font-black text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.25)]">{Math.round(share)}%</span>}
          </div>
        );
      })}
    </div>
  );
}

const PODIUM = [
  { place: 2, h: "h-20", cls: "from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700", medal: "bg-slate-300 text-slate-800" },
  { place: 1, h: "h-28", cls: "from-amber-200 to-amber-400 dark:from-amber-500/60 dark:to-amber-600/60", medal: "bg-amber-400 text-amber-950" },
  { place: 3, h: "h-14", cls: "from-orange-200 to-orange-300 dark:from-orange-500/40 dark:to-orange-600/40", medal: "bg-orange-300 text-orange-950" },
];

function Podium({ students, openStudent }: { students: StudentMarks[]; openStudent: (k: string) => void }) {
  if (!students.length) return <EmptyArt compact title="No results yet" />;
  const rest = students.slice(3, 8);
  return (
    <div>
      <div className="grid grid-cols-3 items-end gap-2 sm:gap-3">
        {PODIUM.map((p) => {
          const s = students[p.place - 1];
          if (!s) return <div key={p.place} />;
          return (
            <button key={p.place} type="button" onClick={() => openStudent(s.key)} className="flex min-w-0 flex-col items-center text-center">
              <Avatar name={s.name} seed={s.key} size={p.place === 1 ? "h-12 w-12 text-sm" : "h-10 w-10 text-xs"} />
              <span className="mt-1.5 w-full truncate text-xs font-extrabold text-slate-900 dark:text-white">{s.name}</span>
              <span className="text-[11px] font-black text-slate-600 dark:text-slate-300">{s.avg}%</span>
              <div className={`mt-2 flex w-full items-start justify-center rounded-t-xl bg-gradient-to-b pt-2 ${p.h} ${p.cls}`}>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black shadow ${p.medal}`}>{p.place}</span>
              </div>
            </button>
          );
        })}
      </div>
      {rest.length > 0 && (
        <ol start={4} className="mt-4 space-y-1.5">
          {rest.map((s, i) => (
            <li key={s.key}>
              <button type="button" onClick={() => openStudent(s.key)} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                <span className="w-5 text-xs font-black text-slate-500">{i + 4}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800 dark:text-slate-100">{s.name}{s.guest && <GuestTag />}</span>
                <Sparkline values={s.trend} label={`${s.name}: ${s.trend.join("%, ")}%`} />
                <span className="w-12 text-right text-sm font-black text-slate-900 dark:text-white">{s.avg}%</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Momentum({ improvers, slipping, openStudent }: {
  improvers: StudentMarks[]; slipping: StudentMarks[]; openStudent: (k: string) => void;
}) {
  if (!improvers.length && !slipping.length) {
    return <EmptyArt compact title="No trend yet">A trend needs at least two results per student with a change of 5 points or more.</EmptyArt>;
  }
  const Row = ({ s, up }: { s: StudentMarks; up: boolean }) => (
    <li>
      <button type="button" onClick={() => openStudent(s.key)} className="flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-white/[0.03]">
        <Avatar name={s.name} seed={s.key} size="h-8 w-8 text-[11px]" />
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800 dark:text-slate-100">{s.name}</span>
        <Sparkline values={s.trend} color={up ? "#10b981" : "#ef4444"} label={`${s.name}: ${s.trend.join("%, ")}%`} />
        <CountPill tone={up ? "green" : "red"}>{up ? "+" : "−"}{Math.abs(s.delta!)}</CountPill>
      </button>
    </li>
  );
  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300"><TrendingUp className="h-3.5 w-3.5" /> Improving</div>
        {improvers.length ? <ul>{improvers.slice(0, 5).map((s) => <Row key={s.key} s={s} up />)}</ul> : <p className="text-xs text-slate-500">Nobody yet.</p>}
      </div>
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-300"><TrendingDown className="h-3.5 w-3.5" /> Slipping</div>
        {slipping.length ? <ul>{slipping.slice(0, 5).map((s) => <Row key={s.key} s={s} up={false} />)}</ul> : <p className="text-xs text-slate-500">Nobody — good.</p>}
      </div>
    </div>
  );
}

const STAGES = [
  { key: "marked", label: "Marked", color: "#0ca30c" },
  { key: "review", label: "To review", color: "#2a78d6" },
  { key: "checking", label: "Being checked", color: "#fab219" },
  { key: "failed", label: "Check failed", color: "#d03b3b" },
] as const;

function Tracker({ items, batchName, openAssignments }: {
  items: AssignmentTrack[]; batchName: Map<string, string>; openAssignments: (id?: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  if (!items.length) {
    return <EmptyArt compact title="No assignments in this period" actions={<button type="button" onClick={() => openAssignments()} className={btnGhost}>Assignments</button>} />;
  }
  const shown = showAll ? items : items.slice(0, 3);
  return (
    <div className="space-y-3">
      {shown.map((a) => {
        const missing = a.notSubmitted.length;
        const total = STAGES.reduce((s, st) => s + a.stages[st.key], 0) + missing;
        const due = a.deadline ? new Date(a.deadline) : null;
        const soon = due && !a.closed && due.getTime() - Date.now() < 2 * 86400000;
        return (
          <div key={a.id} className="rounded-2xl border border-slate-200/80 p-3.5 dark:border-white/10">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold text-slate-900 dark:text-white">{a.title}</div>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {[a.batchId && batchName.get(a.batchId), `set ${shortDate(a.createdAt)}`].filter(Boolean).join(" · ")}
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${a.closed
                ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                : soon ? "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200" : "bg-sky-50 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200"}`}>
                {!due ? "No deadline" : a.closed ? `Closed ${shortDate(a.deadline)}` : `Due ${shortDate(a.deadline)}`}
              </span>
            </div>

            {total > 0 && (
              <div className="mt-3 flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                role="img" aria-label={`${a.submitted} of ${a.expected} submitted, ${a.stages.marked} marked, ${missing} not submitted`}>
                {STAGES.filter((st) => a.stages[st.key] > 0).map((st) => (
                  <div key={st.key} style={{ width: `${(a.stages[st.key] / total) * 100}%`, backgroundColor: st.color }} />
                ))}
                {missing > 0 && <div style={{ width: `${(missing / total) * 100}%` }} className="bg-slate-300 dark:bg-slate-600" />}
              </div>
            )}
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              <li className="font-black text-slate-900 dark:text-white">{a.submitted}/{a.expected} submitted</li>
              {STAGES.filter((st) => a.stages[st.key] > 0).map((st) => (
                <li key={st.key} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: st.color }} />{st.label} {a.stages[st.key]}</li>
              ))}
              {missing > 0 && <li className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />Not submitted {missing}</li>}
              {a.late > 0 && <li className="text-amber-800 dark:text-amber-300">{a.late} late</li>}
              {a.guests > 0 && <li>{plural(a.guests, "guest")}</li>}
            </ul>

            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              {missing > 0 && (
                <button type="button" onClick={() => setOpenId(openId === a.id ? null : a.id)} aria-expanded={openId === a.id} className={linkBtn}>
                  Not submitted ({missing}) <ChevronDown className={`h-3 w-3 ${openId === a.id ? "rotate-180" : ""}`} />
                </button>
              )}
              <button type="button" onClick={() => openAssignments(a.id)} className={linkBtn}>Open submissions <ArrowRight className="h-3 w-3" /></button>
            </div>
            {openId === a.id && missing > 0 && (
              <div className="mt-2.5 rounded-xl bg-slate-50 p-3 dark:bg-white/[0.03]">
                <ul className="flex flex-wrap gap-1.5">
                  {a.notSubmitted.slice(0, 40).map((s) => (
                    <li key={s.id} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">
                      {s.name}{s.rollNo ? ` (${s.rollNo})` : ""}
                    </li>
                  ))}
                  {missing > 40 && <li className="px-1 text-[11px] text-slate-500">+{missing - 40} more</li>}
                </ul>
                <button type="button" className={`${btnGhost} mt-3 px-3 py-1.5 text-xs`}
                  onClick={() => openWhatsApp(`Reminder: "${a.title}" ${a.deadline ? (a.closed ? `was due on ${shortDate(a.deadline)}` : `is due on ${shortDate(a.deadline)}`) : "is pending"}. Not submitted yet: ${a.notSubmitted.map((s) => s.name).join(", ")}.`)}>
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Share reminder on WhatsApp
                </button>
              </div>
            )}
          </div>
        );
      })}
      {items.length > 3 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className={linkBtn}>
          {showAll ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
}
