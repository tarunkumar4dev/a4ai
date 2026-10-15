// src/components/checker/CheckSessionAnalytics.tsx
// Class-level analytics for a Check Copies session — computed in the browser from check_sheets.
// Uses APPROVED copies only (final marks). Plain CSS bars: no chart library, no animation (lite mode).

import React, { useMemo } from "react";
import { effectiveMarks } from "./AiGradeBreakdown";
import { questionNumbers, sheetTotal } from "./checkerExport";
import type { CheckSession, CheckSheet } from "./copyCheckerApi";

const round1 = (n: number) => Math.round(n * 10) / 10;

const BUCKETS = [
  { label: "90% +", min: 90, max: Infinity, cls: "bg-emerald-500" },
  { label: "75–90%", min: 75, max: 90, cls: "bg-lime-500" },
  { label: "60–75%", min: 60, max: 75, cls: "bg-amber-500" },
  { label: "Below 60%", min: -Infinity, max: 60, cls: "bg-red-500" },
];

export function percentOf(s: CheckSheet): number | null {
  const total = sheetTotal(s);
  const max = Number(s.max_marks ?? s.ai_result?.max_marks ?? 0);
  return total != null && max > 0 ? (total / max) * 100 : null;
}

export default function CheckSessionAnalytics({ session, sheets, nameOf, onOpen }: {
  session: CheckSession;
  sheets: CheckSheet[];
  /** how to show a student (blind mode masks names) */
  nameOf: (s: CheckSheet) => string;
  onOpen: (sheetId: string) => void;
}) {
  const stats = useMemo(() => {
    const approved = sheets.filter(s => s.status === "approved" && s.ai_result);
    const pcts = approved.map(percentOf).filter((p): p is number => p != null);
    const avg = pcts.length ? round1(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;

    const maxOf = new Map((session.rubric?.questions ?? []).map(q => [q.q_no, q.marks]));
    const perQuestion = questionNumbers(session, approved).map(q => {
      // an OR-alternative only averages over the students for whom it counted
      const got = approved
        .map(s => s.ai_result!.graded_questions.find(g => g.q_no === q))
        .filter(g => g && g.counted !== false)
        .map(g => effectiveMarks(g!));
      const max = maxOf.get(q) ?? approved.flatMap(s => s.ai_result!.graded_questions).find(g => g.q_no === q)?.max_marks ?? 0;
      return { q, max, n: got.length, avg: got.length ? round1(got.reduce((a, b) => a + b, 0) / got.length) : null };
    });

    const buckets = BUCKETS.map(b => ({ ...b, count: pcts.filter(p => p >= b.min && p < b.max).length }));
    const review = sheets.filter(s => (s.status === "checked" || s.status === "approved") && (s.ai_result?.needs_review_count || 0) > 0);
    return { approved: approved.length, avg, perQuestion, buckets, review };
  }, [session, sheets]);

  const maxBucket = Math.max(1, ...stats.buckets.map(b => b.count));

  return (
    <div className="mt-3 space-y-5">
      {/* 1. Class average */}
      <div className="flex items-end gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Class average</p>
          <p className="text-3xl font-black text-gray-900">{stats.avg ?? "—"}<span className="text-lg text-gray-400">%</span></p>
        </div>
        <div className="flex-1 pb-2">
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-violet-600" style={{ width: `${Math.min(100, stats.avg ?? 0)}%` }} />
          </div>
          <p className="text-[11px] text-gray-400 mt-1">from {stats.approved} approved {stats.approved === 1 ? "copy" : "copies"}</p>
        </div>
      </div>

      {/* 4. Score distribution */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2">Score distribution</p>
        <div className="space-y-1.5">
          {stats.buckets.map(b => (
            <div key={b.label} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 font-bold text-gray-600">{b.label}</span>
              <div className="flex-1 h-4 rounded bg-gray-100 overflow-hidden">
                <div className={`h-full ${b.cls}`} style={{ width: `${(b.count / maxBucket) * 100}%` }} />
              </div>
              <span className="w-8 text-right font-black text-gray-800">{b.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Per-question average */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2">Average marks per question</p>
        <div className="space-y-1.5">
          {stats.perQuestion.map(r => {
            const pct = r.avg != null && r.max ? (r.avg / r.max) * 100 : 0;
            const cls = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
            return (
              <div key={r.q} className="flex items-center gap-2 text-xs">
                <span className="w-14 shrink-0 font-black text-gray-800">Q{r.q}</span>
                <div className="flex-1 h-4 rounded bg-gray-100 overflow-hidden">
                  <div className={`h-full ${cls}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-24 text-right font-bold text-gray-700">
                  {r.avg ?? "—"}/{r.max}{r.n < stats.approved && <span className="text-gray-400 font-medium"> · {r.n}</span>}
                </span>
              </div>
            );
          })}
        </div>
        {stats.perQuestion.some(r => r.n < stats.approved) && (
          <p className="text-[11px] text-gray-400 mt-1">· n = students for whom that OR-choice counted (the other choice is left out).</p>
        )}
      </div>

      {/* 3. Needs review */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2">
          Answers flagged for review · {stats.review.length} {stats.review.length === 1 ? "student" : "students"}
        </p>
        {stats.review.length === 0 ? (
          <p className="text-xs text-gray-500">No copies with review flags.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {stats.review.map(s => (
              <button key={s.id} onClick={() => onOpen(s.id)}
                className="px-2.5 py-1.5 rounded-lg bg-orange-50 border border-orange-200 text-xs font-bold text-orange-700">
                {nameOf(s)} · {s.ai_result!.needs_review_count}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
