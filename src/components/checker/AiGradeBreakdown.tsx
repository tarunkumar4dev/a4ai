/**
 * AiGradeBreakdown — question-wise AI marks with the marking points behind them.
 * Shared by the standalone Smart Assignment Checker and the teacher's Assignments tab (portal submissions).
 * Data shape = backend smart_assignment_service v2 (graded_questions[].points / subpart_grades[]).
 */

import React, { useState } from "react";

export type Verdict = "full" | "mostly" | "partial" | "none";

export interface PointGrade {
  id: string;
  text: string;
  expected: string;
  max_marks: number;
  marks_awarded: number;
  verdict: Verdict;
  evidence: string;
  reason: string;
}

export interface SubpartGrade {
  sub_id: string;
  max_marks: number;
  marks_awarded: number;
  student_answer_summary: string;
  key_concepts_found: string[];
  key_concepts_missed: string[];
  feedback: string;
  points?: PointGrade[];
  needs_review?: boolean;
  review_reasons?: string[];
}

export interface GradedQuestion {
  q_no: string;
  max_marks: number;
  marks_awarded: number;
  student_answer_summary: string;
  key_concepts_found: string[];
  key_concepts_missed: string[];
  feedback: string;
  confidence: "high" | "medium" | "low";
  legibility_issue: boolean;
  not_attempted: boolean;
  has_subparts: boolean;
  subpart_grades: SubpartGrade[];
  points?: PointGrade[];
  needs_review?: boolean;
  review_reasons?: string[];
  counted?: boolean;
  or_group?: string | null;
  scheme_source?: "key" | "estimated" | "adjusted";
  /** Set when the teacher changed this question's marks (marks_awarded stays the AI's). */
  teacher_marks?: number | null;
  teacher_note?: string | null;
}

export const VERDICT_STYLE: Record<Verdict, { label: string; cls: string }> = {
  full:    { label: "Full",    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  mostly:  { label: "Mostly",  cls: "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300" },
  partial: { label: "Partial", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  none:    { label: "None",    cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

export type AiResult = {
  graded_questions: GradedQuestion[];
  total_marks_awarded: number; max_marks: number; percentage: number;
  overall_remarks: string; needs_review_count?: number;
  /** Sheet total after the teacher's per-question changes (absent = no changes). */
  teacher_total?: number; overridden_questions?: number;
};

/** The marks that count for a question: the teacher's if changed, else the AI's. */
export const effectiveMarks = (q: GradedQuestion) => q.teacher_marks ?? q.marks_awarded;

/** Sheet total that counts: with the teacher's per-question changes, else the AI total. */
export const effectiveTotal = (r: AiResult) => r.teacher_total ?? r.total_marks_awarded;

export type OverrideFn = (qNo: string, marks: number, note: string) => Promise<void>;

/** Student-facing feedback from an AI result: overall remark + the questions that lost marks. */
export function feedbackFromAi(r: AiResult): string {
  const lines = [r.overall_remarks?.trim()].filter(Boolean) as string[];
  for (const q of r.graded_questions || []) {
    const got = effectiveMarks(q);
    if (q.counted === false || got >= q.max_marks) continue;
    const note = q.has_subparts
      ? (q.subpart_grades || []).filter(s => s.marks_awarded < s.max_marks).map(s => `${s.sub_id}: ${s.feedback}`).join("; ")
      : q.feedback;
    lines.push(`Q${q.q_no}: ${got}/${q.max_marks}${note ? ` — ${note}` : ""}`);
  }
  return lines.join("\n").slice(0, 1500);
}

/** onOverride: when given, each question gets a ✎ to change its marks (Check Copies only). */
export function AiQuestionList({ questions, onOverride }: { questions: GradedQuestion[]; onOverride?: OverrideFn }) {
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {questions.map((q, i) => <QuestionRow key={i} q={q} onOverride={onOverride} />)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// QUESTION ROW
// ═══════════════════════════════════════════════════════════════════════

export function QuestionRow({ q, onOverride }: { q: GradedQuestion; onOverride?: OverrideFn }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const got = effectiveMarks(q);
  const overridden = q.teacher_marks != null;
  const isFull = got >= q.max_marks;
  const isZero = got === 0;

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(String(got));
    setNote(q.teacher_note || "");
    setEditError(null);
    setEditing(true);
  };

  const save = async () => {
    const m = parseFloat(draft);
    if (Number.isNaN(m) || m < 0 || m > q.max_marks) return setEditError(`Enter 0 to ${q.max_marks}.`);
    setSaving(true);
    setEditError(null);
    try {
      await onOverride!(q.q_no, m, note);
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };
  const isNotAttempted = q.not_attempted;

  const marksBg = isNotAttempted ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
    : isFull ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
    : isZero ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
    : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";

  const confDot = q.confidence === "high" ? "bg-emerald-400" : q.confidence === "medium" ? "bg-amber-400" : "bg-red-400";

  return (
    <div className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="px-6 py-3.5 flex items-center gap-3 sm:gap-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 w-10 shrink-0">Q{q.q_no}</span>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${marksBg}`}>
          {got}/{q.max_marks}
        </span>
        {overridden && (
          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 dark:bg-blue-900/40 dark:text-blue-300 rounded px-1.5 py-0.5 shrink-0"
            title={q.teacher_note || "Changed by teacher"}>edited · AI {q.marks_awarded}</span>
        )}
        {onOverride && !editing && (
          <button onClick={startEdit} title="Change marks" aria-label={`Change marks for Q${q.q_no}`}
            className="h-7 w-7 shrink-0 rounded-full text-gray-400 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm">✎</button>
        )}
        {!isNotAttempted && <span className={`w-2 h-2 rounded-full shrink-0 ${confDot}`} title={`Confidence: ${q.confidence}`} />}
        <span className="text-sm text-gray-600 dark:text-gray-400 truncate flex-1">{q.feedback}</span>
        <div className="flex gap-1 shrink-0">
          {q.needs_review && q.counted !== false && <span className="text-xs bg-orange-100 dark:bg-orange-900/40 text-orange-700 px-2 py-0.5 rounded" title={(q.review_reasons || []).join(" · ")}>Review</span>}
          {q.counted === false && <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded">not counted (OR)</span>}
          {q.legibility_issue && <span className="text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 px-2 py-0.5 rounded">illegible</span>}
          {isNotAttempted && <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded">not attempted</span>}
          {q.has_subparts && <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-600 px-2 py-0.5 rounded">{q.subpart_grades.length} parts</span>}
        </div>
        <span className={`text-gray-400 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
      </div>

      {editing && (
        <div className="px-6 pb-3 flex flex-wrap items-center gap-2" onClick={e => e.stopPropagation()}>
          <input type="number" inputMode="decimal" step="0.5" min={0} max={q.max_marks} value={draft} autoFocus
            onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && save()}
            className="w-20 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm font-bold" />
          <span className="text-xs text-gray-500">/ {q.max_marks}</span>
          <input value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="Note (optional)"
            className="flex-1 min-w-[140px] rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs" />
          <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-bold disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} disabled={saving} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-600">Cancel</button>
          {editError && <p className="w-full text-xs text-red-600">{editError}</p>}
        </div>
      )}

      {expanded && (
        <div className="px-6 pb-4 space-y-3">
          {overridden && q.teacher_note && (
            <p className="ml-10 text-xs text-blue-700 dark:text-blue-300">Teacher's note: {q.teacher_note}</p>
          )}
          {q.needs_review && q.review_reasons && q.review_reasons.length > 0 && (
            <p className="ml-10 text-xs text-orange-600 dark:text-orange-300">Review: {q.review_reasons.join(" · ")}</p>
          )}
          {/* Sub-parts */}
          {q.has_subparts && q.subpart_grades.length > 0 && (
            <div className="ml-10 space-y-2">
              {q.subpart_grades.map((sp, i) => {
                const spFull = sp.marks_awarded >= sp.max_marks;
                const spZero = sp.marks_awarded === 0;
                const spBg = spFull ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : spZero ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";

                return (
                  <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs font-bold text-gray-500 uppercase">{sp.sub_id}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${spBg}`}>
                        {sp.marks_awarded}/{sp.max_marks}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{sp.feedback}</p>
                    {sp.points && sp.points.length > 0
                      ? <PointList points={sp.points} />
                      : sp.key_concepts_missed.length > 0 && (
                        <p className="text-xs text-red-500 mt-1">Missed: {sp.key_concepts_missed.join(", ")}</p>
                      )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Answer summary + concepts */}
          {!q.has_subparts && (
            <div className="ml-10 space-y-2 text-sm">
              {q.student_answer_summary && (
                <div>
                  <span className="text-gray-400 text-xs uppercase tracking-wide">Student wrote:</span>
                  <p className="text-gray-700 dark:text-gray-300 mt-0.5 bg-gray-50 dark:bg-gray-800 rounded px-3 py-2">{q.student_answer_summary}</p>
                </div>
              )}
              {q.points && q.points.length > 0 ? <PointList points={q.points} /> : (
                <>
                  {q.key_concepts_found.length > 0 && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      ✓ Found: {q.key_concepts_found.join(", ")}
                    </p>
                  )}
                  {q.key_concepts_missed.length > 0 && (
                    <p className="text-xs text-red-500 dark:text-red-400">
                      ✕ Missed: {q.key_concepts_missed.join(", ")}
                    </p>
                  )}
                </>
              )}
              {q.scheme_source === "estimated" && (
                <p className="text-xs text-gray-400">Marks split estimated by AI — the answer key had no per-point marks.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// MARKING POINTS — why each mark was (not) given
// ═══════════════════════════════════════════════════════════════════════

export function PointList({ points }: { points: PointGrade[] }) {
  return (
    <div className="mt-2 space-y-1.5">
      {points.map(p => {
        const v = VERDICT_STYLE[p.verdict] || VERDICT_STYLE.none;
        return (
          <div key={p.id} className="text-xs border border-gray-100 dark:border-gray-800 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-700 dark:text-gray-300">{p.text || p.id}</span>
              <span className={`px-1.5 py-0.5 rounded font-bold ${v.cls}`}>{v.label} · {p.marks_awarded}/{p.max_marks}</span>
            </div>
            {p.expected && <p className="text-gray-400 mt-1">Key: {p.expected}</p>}
            {p.evidence
              ? <p className="text-gray-600 dark:text-gray-400 mt-0.5">Student: “{p.evidence}”</p>
              : <p className="text-gray-400 mt-0.5 italic">Student: nothing written for this point</p>}
            {p.reason && <p className="text-gray-500 mt-0.5">{p.reason}</p>}
          </div>
        );
      })}
    </div>
  );
}
