// Question-wise analysis of one assessment: marks scored per question + the concepts students missed.
// Loaded only when the teacher picks the assessment (ai_result.graded_questions is ~20 KB a copy).

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { Lightbulb, ListChecks, ThumbsUp } from "lucide-react";
import { shortDate, summarizeQuestions, type QuestionSummary } from "@/lib/teacherAnalytics";
import { loadQuestionSheets } from "@/lib/teacherAnalyticsData";
import { CountPill, EmptyArt, ErrorBox, Panel } from "./kit";
import { AXIS, GRID, TOOLTIP, plural, scoreColor } from "./theme";
import type { AnalyticsModel } from "./model";

type Entry = { state: "loading" } | { state: "error"; error: string } | { state: "done"; data: QuestionSummary };

const qLabel = (q: string) => (/^\d/.test(q) ? `Q${q}` : q);

export default function QuestionAnalysis({ userId, m }: { userId: string; m: AnalyticsModel }) {
  const list = useMemo(() => [...(m.marks?.assessments ?? [])].reverse(), [m.marks]);
  const [selected, setSelected] = useState<string | null>(list[0]?.id ?? null);
  const [cache, setCache] = useState<Map<string, Entry>>(() => new Map());

  useEffect(() => {
    if (!list.length) { setSelected(null); return; }
    if (!selected || !list.some((a) => a.id === selected)) setSelected(list[0].id);
  }, [list, selected]);

  const load = useCallback((id: string) => {
    const a = list.find((x) => x.id === id);
    if (!a) return;
    setCache((c) => new Map(c).set(id, { state: "loading" }));
    loadQuestionSheets(userId, { kind: a.kind, id }, m.countedSubmissionIds)
      .then((sheets) => setCache((c) => new Map(c).set(id, { state: "done", data: summarizeQuestions(sheets) })))
      .catch((e: unknown) => setCache((c) => new Map(c).set(id, { state: "error", error: e instanceof Error ? e.message : "Couldn't load question-wise marks." })));
  }, [list, userId, m.countedSubmissionIds]);

  useEffect(() => {
    if (selected && !cache.has(selected)) load(selected);
  }, [selected, cache, load]);

  if (!list.length) return null;
  const entry = selected ? cache.get(selected) : undefined;
  const current = list.find((a) => a.id === selected);

  return (
    <Panel title="Question-wise analysis" icon={<ListChecks className="h-4 w-4" />} tone="fuchsia"
      sub="Which questions cost your class the most marks — from AI-checked copies, after your review">
      <div role="tablist" aria-label="Assessment" className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {list.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={a.id === selected} onClick={() => setSelected(a.id)}
            className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs font-bold ${a.id === selected
              ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-900 dark:border-fuchsia-500/40 dark:bg-fuchsia-500/15 dark:text-fuchsia-100"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"}`}>
            <span className="block max-w-[180px] truncate">{a.title}</span>
            <span className="block text-[10px] font-semibold opacity-70">{shortDate(a.date)} · avg {a.avg}%</span>
          </button>
        ))}
      </div>

      {!entry || entry.state === "loading" ? (
        <div className="flex h-[220px] items-end gap-2 px-2" aria-busy="true" aria-label="Loading question-wise marks">
          {[60, 35, 80, 50, 70, 40, 90, 55].map((h, i) => <div key={i} className="flex-1 rounded-t-lg bg-slate-200/70 dark:bg-slate-800" style={{ height: `${h}%` }} />)}
        </div>
      ) : entry.state === "error" ? (
        <ErrorBox message={entry.error} onRetry={() => selected && load(selected)} />
      ) : entry.data.sheets === 0 || entry.data.questions.length === 0 ? (
        <EmptyArt compact title="No question-wise marks for this one">
          They come from copies checked with AI in Check Copies or a submit link. Hand-entered or older results don't have them.
        </EmptyArt>
      ) : (
        <Breakdown data={entry.data} pass={m.pass} title={current?.title ?? ""} />
      )}
    </Panel>
  );
}

function Breakdown({ data, pass, title }: { data: QuestionSummary; pass: number; title: string }) {
  const scored = data.questions.filter((q) => q.pct != null);
  const weakest = [...scored].sort((a, b) => a.pct! - b.pct!).slice(0, 3);
  const skipped = [...data.questions].filter((q) => q.skipped > 0).sort((a, b) => b.skipped - a.skipped)[0];
  const chart = data.questions.map((q) => ({ ...q, label: qLabel(q.q), value: q.pct ?? 0 }));
  const wide = chart.length > 14;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 text-xs">
        <CountPill>Based on {plural(data.sheets, "copy", "copies")}</CountPill>
        {weakest.length > 0 && <CountPill tone="red">Weakest: {weakest.map((q) => `${qLabel(q.q)} (${q.pct}%)`).join(", ")}</CountPill>}
        {skipped && <CountPill tone="amber">Most skipped: {qLabel(skipped.q)} ({plural(skipped.skipped, "student")})</CountPill>}
      </div>

      <div className="overflow-x-auto">
        <div className="h-[240px]" style={{ minWidth: wide ? chart.length * 38 : undefined }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" {...AXIS} interval={0} />
              <YAxis domain={[0, 100]} {...AXIS} unit="%" width={40} />
              <ReferenceLine y={pass} stroke="#ef4444" strokeWidth={1.5} />
              <Tooltip {...TOOLTIP} labelFormatter={(l) => `${l} · ${title}`}
                formatter={(_v: number, _n, p) => {
                  const q = p?.payload;
                  return [q?.pct == null ? "no marks" : `${q.pct}% of marks (${q.scored} / ${q.available})`,
                    `${q?.attempted ?? 0} attempted${q?.skipped ? ` · ${q.skipped} skipped` : ""}`];
                }} />
              <Bar dataKey="value" maxBarSize={28} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {chart.map((q) => <Cell key={q.q} fill={q.pct == null ? "#cbd5e1" : scoreColor(q.pct, pass)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {(data.missed.length > 0 || data.strong.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 dark:border-rose-500/20 dark:bg-rose-500/[0.06]">
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-slate-900 dark:text-white"><Lightbulb className="h-4 w-4 text-rose-600" aria-hidden="true" /> Concepts to revisit</h4>
            {data.missed.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {data.missed.slice(0, 10).map((c) => {
                  const share = c.students / data.sheets;
                  return (
                    <li key={c.concept} title={`Missed in ${c.questions.map(qLabel).join(", ")}`}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${share >= 0.5
                        ? "bg-rose-600 text-white" : share >= 0.25 ? "bg-rose-200 text-rose-900 dark:bg-rose-500/30 dark:text-rose-100" : "bg-white text-slate-700 dark:bg-white/10 dark:text-slate-200"}`}>
                      {c.concept}<span className="rounded-full bg-black/10 px-1.5 text-[10px]">{c.students}</span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-xs text-slate-600 dark:text-slate-400">No missed concepts recorded.</p>}
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Number = students who missed it.</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]">
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-slate-900 dark:text-white"><ThumbsUp className="h-4 w-4 text-emerald-600" aria-hidden="true" /> Well understood</h4>
            {data.strong.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {data.strong.slice(0, 8).map((c) => (
                  <li key={c.concept} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-white/10 dark:text-emerald-200">
                    {c.concept}<span className="rounded-full bg-emerald-100 px-1.5 text-[10px] dark:bg-emerald-500/20">{c.students}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-slate-600 dark:text-slate-400">Nothing recorded yet.</p>}
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Number = students who showed it.</p>
          </div>
        </div>
      )}
    </div>
  );
}
