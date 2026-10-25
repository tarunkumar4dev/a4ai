// src/components/contest/contestPayload.ts — pure helpers behind CreateContestModal (unit-tested).
import type { AnswerMode, CreateContestPayload } from "@/lib/contestApi";

/** Minutes the backend accepts (5–180); anything missing / invalid → 30. */
export const clampDuration = (m?: number | null): number =>
  typeof m === "number" && isFinite(m) && m > 0 ? Math.min(180, Math.max(5, Math.round(m))) : 30;

/** datetime-local value ("2026-10-25T11:36", the teacher's local time) → UTC ISO; empty / invalid → null. */
export const localToIso = (local: string | null | undefined): string | null => {
  if (!local) return null;
  const d = new Date(local);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

export interface ContestFormSettings {
  title: string;
  duration: number;
  answerMode: AnswerMode;
  showExplanation: boolean;
  enableCamera: boolean;
  enableTabDetection: boolean;
  allowBackNavigation: boolean;
  maxWarnings: number;
  scheduledAt: string | null;
  expiresAt: string | null;
  maxAttempts: number;
}

/** The POST /contests body: duration_minutes is exactly the selected duration. */
export function buildContestPayload(input: {
  settings: ContestFormSettings;
  subject: string;
  classGrade: string;
  board?: string | null;
  logoBase64?: string | null;
  questions: any[];
}): CreateContestPayload {
  const { settings: s } = input;
  return {
    title: s.title,
    subject: input.subject,
    class_grade: input.classGrade,
    board: input.board?.trim() || "CBSE",
    logo_base64: input.logoBase64 || undefined,
    duration_minutes: s.duration,
    answer_mode: s.answerMode,
    show_explanation: s.showExplanation,
    enable_camera: s.enableCamera,
    enable_tab_detection: s.enableTabDetection,
    allow_back_navigation: s.allowBackNavigation,
    max_warnings: s.maxWarnings,
    max_attempts: s.maxAttempts,
    scheduled_at: localToIso(s.scheduledAt),
    expires_at: localToIso(s.expiresAt),
    questions: input.questions.map((q: any) => {
      // Fix question_type: "mcq" → "MCQ", "short" → "Short", "long" → "Long"
      const rawType = q.type || q.format || q.question_type || "MCQ";
      const typeMap: Record<string, string> = { mcq: "MCQ", short: "Short", long: "Long", essay: "Long" };
      const questionType = typeMap[String(rawType).toLowerCase()] || rawType;

      // Fix options: convert strings to {label, text} dicts
      const options = (q.options || []).map((opt: any, idx: number) => {
        if (typeof opt === "string") {
          const labels = ["A", "B", "C", "D"];
          return { label: labels[idx] || String(idx + 1), text: opt.replace(/^[A-D]\)\s*/i, "") };   // drop "A) "
        }
        return opt; // already a dict
      });

      // correct_answer is passed through as-is: the grader matches "B" and "B) text" alike
      return {
        question_text: q.question_text || q.text || "",
        question_type: questionType,
        options,
        correct_answer: q.correct_answer || q.correctAnswer || "",
        explanation: q.explanation || "",
        marks: q.marks || 1,
        difficulty: q.difficulty || "Medium",
        chapter: q.chapter || "",
      };
    }),
  };
}

/**
 * Phones: closing the native date/time picker can deliver a "ghost" tap to whatever sits under the finger once
 * the picker is gone — the duration grid. block() after the picker closes; taps within windowMs are ignored.
 */
export function createTapGuard(windowMs = 400, now: () => number = Date.now) {
  let blockedUntil = 0;
  return {
    block() { blockedUntil = now() + windowMs; },
    allowed() { return now() >= blockedUntil; },
  };
}
