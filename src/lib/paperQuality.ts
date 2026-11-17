// Generated-paper quality helpers (fix/p0-quality): answer-key verdicts, honest validation status,
// requested-vs-delivered shortfall, staged progress text. Pure functions, unit-tested in paperQuality.test.ts.

import type { VerifyAnswersResponse } from "@/lib/api";

/** Result of the background answer-key check for one question. */
export interface QuestionVerification {
  verdict: "ok" | "fix" | "reject";
  issue?: string;
  /** fix: the key the checker proposes. Applied only when the teacher accepts it. */
  suggestedAnswer?: string;
  suggestedExplanation?: string;
  /** fix, after Accept: the key that was replaced. */
  previousAnswer?: string;
  accepted?: boolean;
  /** false when the checker was the same model family that wrote the paper. */
  independent?: boolean;
}

interface Verifiable {
  id: string;
  correctAnswer: string;
  explanation: string;
  validationStatus: string;
  editData?: unknown;
  verification?: QuestionVerification;
}

/**
 * Puts the checker's verdicts on the questions.
 *  - ok     -> validationStatus "verified" (the ONLY way a question becomes verified)
 *  - fix    -> suggestion stored; the key is unchanged until the teacher accepts it; stays "needs_review"
 *  - reject -> flagged for review; stays "needs_review"
 * A question that already carries a verdict, or whose key the teacher changed since generation, is left alone.
 */
export function applyVerdicts<Q extends Verifiable>(
  questions: Q[],
  res: Pick<VerifyAnswersResponse, "results" | "checker_independent">,
  originalAnswers: Map<string, string>,
): Q[] {
  const byId = new Map((res.results || []).map((r) => [r.id, r]));
  const independent = res.checker_independent !== false;
  return questions.map((q) => {
    const v = byId.get(q.id);
    if (!v || q.verification) return q;
    const untouched = !q.editData && q.correctAnswer === originalAnswers.get(q.id);
    if (v.verdict === "ok") {
      return untouched ? { ...q, validationStatus: "verified", verification: { verdict: "ok", independent } } : q;
    }
    const suggested = v.correctAnswer ?? v.correct_answer;
    if (v.verdict === "fix" && suggested && untouched) {
      return {
        ...q,
        verification: { verdict: "fix", issue: v.issue, suggestedAnswer: suggested, suggestedExplanation: v.explanation, independent },
      };
    }
    return { ...q, verification: { verdict: "reject", issue: v.issue, independent } };
  });
}

/** Teacher accepts the checker's corrected key. The question is NOT marked verified: nobody checked the new key. */
export function acceptFix<Q extends Verifiable>(q: Q): Q {
  const v = q.verification;
  if (!v || v.verdict !== "fix" || v.accepted || !v.suggestedAnswer) return q;
  return {
    ...q,
    correctAnswer: v.suggestedAnswer,
    explanation: v.suggestedExplanation || q.explanation,
    verification: { ...v, accepted: true, previousAnswer: q.correctAnswer },
  };
}

/** A verified question that the teacher edits is no longer the question that was checked. */
export function afterTeacherEdit<Q extends Verifiable>(q: Q, changed: boolean): Q {
  if (!changed || q.validationStatus !== "verified") return q;
  return { ...q, validationStatus: "needs_review", verification: undefined };
}

export interface VerifySummary {
  verified: number;
  suggested: number;
  flagged: number;
}

export function summarizeVerification(questions: Verifiable[]): VerifySummary {
  const out = { verified: 0, suggested: 0, flagged: 0 };
  for (const q of questions) {
    if (q.verification?.verdict === "ok") out.verified += 1;
    else if (q.verification?.verdict === "fix") out.suggested += 1;
    else if (q.verification?.verdict === "reject") out.flagged += 1;
  }
  return out;
}

/** { requested, delivered } when the paper came back with fewer questions than asked for, else null. */
export function paperShortfall(meta: Record<string, unknown> | null | undefined): { requested: number; delivered: number } | null {
  const requested = Number(meta?.requestedQuestions);
  const delivered = Number(meta?.deliveredQuestions);
  if (!Number.isFinite(requested) || !Number.isFinite(delivered) || delivered >= requested) return null;
  return { requested, delivered };
}

/**
 * Stage text while a paper is being generated. Driven by elapsed time only: the generate call returns one
 * response when the paper is finished, so there is no real progress feed.
 */
export function generationStage(seconds: number): string {
  if (seconds < 5) return "Preparing…";
  if (seconds < 25) return "Writing questions…";
  return "Almost done…";
}

/**
 * PostgREST .or() filter for tests rows that are real papers: everything except a paper that is still generating
 * or whose generation failed (those are kept out of history lists and usage counts). NULL status = old row, kept.
 */
export const DELIVERED_TESTS_FILTER = "status.is.null,status.not.in.(generating,failed)";
