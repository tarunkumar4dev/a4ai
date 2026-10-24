// src/lib/contestImportMock.ts
// Canned "Upload PDF → Contest" job for ?mockImport=1 — lets the UI be checked without the backend.
// Shaped like Class12_Economics_ForeignExchangeRate_50MCQs: 50 MCQs, Easy 1-10 / Medium 11-40 / Hard 41-50.
// Q12 KEY_MISMATCH_SUSPECT, Q20 OPTION_LABELS_RENUMBERED, Q33 usable=false (one option only — must be fixed),
// Q47 AI_ANSWER, Q49 ANSWER_MISSING (no answer — blocks Create until fixed), paper-level KEY_CHECK_SKIPPED.
// Job ids: mock-ok-<ms> / mock-fail-<ms> (fails, retryable) / mock-fatal-<ms> (fails, not retryable).

import type { ImportJob, ImportedQuestion, ImportResult } from "./contestImportApi";

const MOCK_SECONDS = 8;

const TOPICS = [
  ["Foreign exchange rate is the price of", "one currency in terms of another", "gold in the world market", "exports in rupees", "imports in dollars", "A"],
  ["Under a flexible exchange rate system, the rate is determined by", "the central bank", "demand and supply of foreign exchange", "the government budget", "the IMF", "B"],
  ["A rise in the price of foreign currency is called", "appreciation of domestic currency", "revaluation", "depreciation of domestic currency", "devaluation by the government", "C"],
  ["Demand for foreign exchange rises when", "foreign tourists visit India", "Indians import more goods", "exports increase", "FDI flows into India", "B"],
  ["Managed floating is also called", "dirty floating", "fixed peg", "gold standard", "crawling peg", "A"],
] as const;

function makeQuestion(n: number): ImportedQuestion {
  const [stem, a, b, c, d, key] = TOPICS[(n - 1) % TOPICS.length];
  const q: ImportedQuestion = {
    question_text: `${stem} (${n})`,
    question_type: "MCQ",
    options: [{ label: "A", text: a }, { label: "B", text: b }, { label: "C", text: c }, { label: "D", text: d }],
    correct_answer: key,
    explanation: "",
    marks: 1,
    difficulty: n <= 10 ? "Easy" : n <= 40 ? "Medium" : "Hard",
    chapter: "Foreign Exchange Rate",
    source_number: n,
    answer_source: "key",
    usable: true,
  };
  if (n === 33) { q.options = [{ label: "A", text: a }]; q.usable = false; }
  if (n === 47) q.answer_source = "ai";
  if (n === 49) { q.answer_source = "missing"; q.correct_answer = ""; }
  return q;
}

const RESULT: ImportResult = {
  title: "Foreign Exchange Rate – 50 MCQs",
  subject: "Economics",
  class_grade: "XII",
  institute: "EducationBeast",
  board: "CBSE",
  duration_minutes: 60,
  total_marks: 50,
  answer_key_found: true,
  answer_key_count: 48,
  questions: Array.from({ length: 50 }, (_, i) => makeQuestion(i + 1)),
  warnings: [
    { question: 12, code: "KEY_MISMATCH_SUSPECT", message: "Key says D; the question text points to B." },
    { question: 20, code: "OPTION_LABELS_RENUMBERED", message: "Options were labelled (i)–(iv)." },
    { question: 33, code: "NUMBER_UNREADABLE", message: "Only one option could be read." },
    { question: 47, code: "AI_ANSWER", message: "No key entry for Q47." },
    { question: 49, code: "ANSWER_MISSING", message: "No key entry for Q49 and AI was not sure." },
    { question: null, code: "KEY_CHECK_SKIPPED", message: "The AI double-check timed out for this paper." },
  ],
};

export function mockImportJob(jobId: string): ImportJob {
  const [, mode, ts] = jobId.split("-");
  const startedAt = Number(ts) || Date.now();
  const elapsed = (Date.now() - startedAt) / 1000;
  if (elapsed < 1) return { status: "queued", progress: 0 };
  if (mode !== "ok" && elapsed >= 3) {
    return mode === "fail"
      ? { status: "failed", progress: 30, retryable: true, error: "The reader timed out. Please try again." }
      : { status: "failed", progress: 10, retryable: false, error: "This PDF has no readable text (it looks like a scanned image)." };
  }
  if (elapsed < MOCK_SECONDS) return { status: "processing", progress: Math.round((elapsed / MOCK_SECONDS) * 100) };
  return { status: "done", progress: 100, retryable: false, result: structuredClone(RESULT) };
}
