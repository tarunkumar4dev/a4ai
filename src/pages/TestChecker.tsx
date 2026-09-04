/**
 * TestChecker.tsx — Answer Sheet Grading UI (v1.1)
 *
 * v1.1: Answer key accepts PDF/image upload (primary path).
 *       Backend extracts the key via Gemini automatically.
 *       JSON paste kept as fallback for edge cases.
 *
 * Flow:
 *   1. Upload student answer sheet (PDF/image)
 *   2. Upload answer key (PDF/image) — OR pick from saved test / paste JSON
 *   3. Pick strictness
 *   4. Grade → results with per-question breakdown
 */

import React, { useState, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────

interface StudentAnswer {
  q_no: number;
  matched_on_sheet: boolean;
  extracted_answer: string;
  marks_awarded: number;
  max_marks: number;
  confidence: "high" | "medium" | "low";
  feedback: string;
  legibility_issue: boolean;
}

interface GradingResult {
  student_answers: StudentAnswer[];
  total_marks_obtained: number;
  total_marks_possible: number;
  percentage: number;
  overall_remarks: string;
  readability_score: "good" | "average" | "poor";
  questions_not_found: number[];
  needs_review_count: number;
  _meta?: {
    upload_time_s: number;
    generation_time_s: number;
    model: string;
    strictness: string;
    attempt: number;
  };
}

interface CheckResponse {
  ok: boolean;
  check_id: string;
  grading_time_seconds: number;
  result: GradingResult;
  answer_key_summary?: {
    total_questions: number;
    total_marks: number;
    extraction_notes: string;
  };
  exam_title?: string;
  test_id?: string;
}

type KeySource = "pdf" | "test" | "json";
type Strictness = "easy" | "medium" | "hard" | "extreme";
type Step = "upload" | "grading" | "results";

// ── Constants ─────────────────────────────────────────────────────

const API_BASE = `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8000/api"}/v1`;

const STRICTNESS_OPTIONS: { value: Strictness; label: string; desc: string }[] = [
  { value: "easy", label: "Lenient", desc: "Partial marks given generously" },
  { value: "medium", label: "Standard", desc: "CBSE marking scheme" },
  { value: "hard", label: "Strict", desc: "Key terms must be present" },
  { value: "extreme", label: "Very Strict", desc: "Near-perfect answers expected" },
];

const ACCEPTED_TYPES = ".pdf,.png,.jpg,.jpeg,.webp";
const MAX_FILE_MB = 20;

// ── Component ─────────────────────────────────────────────────────

export default function TestChecker() {
  // Answer sheet
  const [sheetFile, setSheetFile] = useState<File | null>(null);
  const [sheetPreview, setSheetPreview] = useState<string | null>(null);
  const sheetRef = useRef<HTMLInputElement>(null);

  // Answer key
  const [keySource, setKeySource] = useState<KeySource>("pdf");
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [testId, setTestId] = useState("");
  const [answerKeyJson, setAnswerKeyJson] = useState("");

  // Config
  const [strictness, setStrictness] = useState<Strictness>("medium");
  const [studentName, setStudentName] = useState("");

  // UI state
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [elapsedDisplay, setElapsedDisplay] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── File helpers ────────────────────────────────────────────────

  const pickSheetFile = (f: File) => {
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_FILE_MB} MB.`);
      return;
    }
    setSheetFile(f);
    setError("");
    setSheetPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  };

  const handleSheetDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) pickSheetFile(f);
  }, []);

  const pickKeyFile = (f: File) => {
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Answer key file too large. Max ${MAX_FILE_MB} MB.`);
      return;
    }
    setKeyFile(f);
    setError("");
  };

  // ── Grading ─────────────────────────────────────────────────────

  const canGrade = () => {
    if (!sheetFile) return false;
    if (keySource === "pdf" && !keyFile) return false;
    if (keySource === "test" && !testId.trim()) return false;
    if (keySource === "json" && !answerKeyJson.trim()) return false;
    return true;
  };

  const startGrading = async () => {
    if (!sheetFile) { setError("Upload an answer sheet."); return; }

    if (keySource === "pdf" && !keyFile) {
      setError("Upload the answer key PDF/image."); return;
    }
    if (keySource === "test" && !testId.trim()) {
      setError("Enter a Test ID."); return;
    }
    if (keySource === "json" && !answerKeyJson.trim()) {
      setError("Paste the answer key JSON."); return;
    }

    setLoading(true);
    setError("");
    setStep("grading");
    setElapsedDisplay(0);

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedDisplay(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      const formData = new FormData();
      formData.append("file", sheetFile);
      formData.append("strictness", strictness);
      formData.append("student_name", studentName);
      formData.append("teacher_id", ""); // TODO: from auth context

      let endpoint: string;

      if (keySource === "test") {
        // Use saved test as answer key
        endpoint = `${API_BASE}/test-checker/check-with-test`;
        formData.append("test_id", testId.trim());

      } else if (keySource === "pdf") {
        // Upload answer key PDF — backend extracts via Gemini
        endpoint = `${API_BASE}/test-checker/check`;
        formData.append("answer_key_file", keyFile!);

      } else {
        // JSON fallback
        endpoint = `${API_BASE}/test-checker/check`;
        formData.append("answer_key_json", answerKeyJson);
      }

      const res = await fetch(endpoint, { method: "POST", body: formData });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error (${res.status})`);
      }

      const data: CheckResponse = await res.json();
      setResult(data);
      setStep("results");
    } catch (e: any) {
      setError(e.message || "Grading failed. Please try again.");
      setStep("upload");
    } finally {
      setLoading(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resetAll = () => {
    setSheetFile(null);
    setSheetPreview(null);
    setKeyFile(null);
    setTestId("");
    setAnswerKeyJson("");
    setResult(null);
    setStep("upload");
    setError("");
    setElapsedDisplay(0);
  };

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Answer Sheet Checker
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Upload a student's answer sheet and the answer key — AI grades it instantly.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
            <span className="shrink-0 mt-0.5">⚠</span>
            <span>{error}</span>
            <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* ─── UPLOAD STEP ─── */}
        {step === "upload" && (
          <div className="space-y-6">

            {/* 1. Answer Sheet */}
            <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
                1 · Student Answer Sheet
              </h2>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleSheetDrop}
                onClick={() => sheetRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                  ${sheetFile
                    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                    : "border-gray-300 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10"
                  }
                `}
              >
                <input
                  ref={sheetRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && pickSheetFile(e.target.files[0])}
                />

                {sheetFile ? (
                  <div className="space-y-2">
                    {sheetPreview && (
                      <img src={sheetPreview} alt="Preview" className="mx-auto max-h-40 rounded shadow-sm" />
                    )}
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      {sheetFile.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(sheetFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSheetFile(null); setSheetPreview(null); }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 font-medium">
                      Drop answer sheet here or click to browse
                    </p>
                    <p className="text-xs text-gray-400 mt-1">PDF, PNG, JPG, WEBP — up to {MAX_FILE_MB} MB</p>
                  </div>
                )}
              </div>
            </section>

            {/* 2. Answer Key */}
            <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
                2 · Answer Key
              </h2>

              {/* Source toggle */}
              <div className="flex flex-wrap gap-2 mb-4">
                {([
                  { v: "pdf" as KeySource, label: "Upload PDF / Image" },
                  { v: "test" as KeySource, label: "From Saved Test" },
                  { v: "json" as KeySource, label: "Paste JSON" },
                ]).map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => setKeySource(opt.v)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      keySource === opt.v
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* PDF upload (primary) */}
              {keySource === "pdf" && (
                <div>
                  <label className="block">
                    <input
                      type="file"
                      accept={ACCEPTED_TYPES}
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && pickKeyFile(e.target.files[0])}
                    />
                    <div className={`
                      border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                      ${keyFile
                        ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                        : "border-gray-300 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10"
                      }
                    `}>
                      {keyFile ? (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                            {keyFile.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(keyFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setKeyFile(null); }}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 font-medium">
                            Drop answer key here or click to browse
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            PDF or image of the marking scheme / answer key
                          </p>
                        </div>
                      )}
                    </div>
                  </label>
                  <p className="text-xs text-gray-400 mt-2">
                    AI will read the answer key and extract questions, answers & marks automatically.
                  </p>
                </div>
              )}

              {/* From saved test */}
              {keySource === "test" && (
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">Test ID</label>
                  <input
                    type="text"
                    value={testId}
                    onChange={(e) => setTestId(e.target.value)}
                    placeholder="e.g. 3f2a8b1c-..."
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg px-3 py-2.5 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Answer key will be pulled from the saved test's questions.
                  </p>
                </div>
              )}

              {/* JSON fallback */}
              {keySource === "json" && (
                <div>
                  <textarea
                    value={answerKeyJson}
                    onChange={(e) => setAnswerKeyJson(e.target.value)}
                    placeholder={`{\n  "questions": [\n    {"q_no": 1, "correct_answer": "Photosynthesis is...", "marks": 3},\n    {"q_no": 2, "correct_answer": "B", "marks": 1}\n  ]\n}`}
                    rows={6}
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 text-sm font-mono
                               focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y"
                  />
                  {answerKeyJson && (() => {
                    try {
                      const count = JSON.parse(answerKeyJson)?.questions?.length || 0;
                      return <p className="text-xs text-emerald-600 mt-1">✓ {count} questions loaded</p>;
                    } catch {
                      return <p className="text-xs text-red-500 mt-1">Invalid JSON</p>;
                    }
                  })()}
                </div>
              )}
            </section>

            {/* 3. Settings */}
            <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
                3 · Settings
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">Checking Strictness</label>
                  <div className="space-y-1.5">
                    {STRICTNESS_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                          strictness === opt.value
                            ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent"
                        }`}
                      >
                        <input
                          type="radio"
                          name="strictness"
                          value={opt.value}
                          checked={strictness === opt.value}
                          onChange={() => setStrictness(opt.value)}
                          className="accent-blue-600"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{opt.label}</span>
                          <span className="text-xs text-gray-400 ml-2">{opt.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">Student Name (optional)</label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="For your records"
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg px-3 py-2.5 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>
            </section>

            {/* Grade button */}
            <button
              onClick={startGrading}
              disabled={!canGrade()}
              className="w-full py-3.5 rounded-xl font-semibold text-white transition-all
                         bg-blue-600 hover:bg-blue-700 active:scale-[0.99]
                         disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
            >
              Grade Answer Sheet
            </button>
          </div>
        )}

        {/* ─── GRADING (loading) ─── */}
        {step === "grading" && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
            <div className="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-6" />
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Grading in progress…
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {keySource === "pdf"
                ? "Reading answer key → then grading the answer sheet…"
                : "Reading the answer sheet and comparing with the answer key…"
              }
            </p>
            <p className="text-2xl font-mono text-blue-600 mt-4">{elapsedDisplay}s</p>
            <p className="text-xs text-gray-400 mt-1">
              {keySource === "pdf" ? "Usually takes 45-90 seconds (two AI steps)" : "Usually takes 30-60 seconds"}
            </p>
          </div>
        )}

        {/* ─── RESULTS ─── */}
        {step === "results" && result && (
          <ResultsView data={result} onReset={resetAll} studentName={studentName} />
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// RESULTS VIEW
// ═══════════════════════════════════════════════════════════════════════

function ResultsView({
  data,
  onReset,
  studentName,
}: {
  data: CheckResponse;
  onReset: () => void;
  studentName: string;
}) {
  const r = data.result;
  const pct = r.percentage;

  const pctColor =
    pct >= 75 ? "text-emerald-600" :
    pct >= 50 ? "text-amber-600" :
    pct >= 33 ? "text-orange-600" :
    "text-red-600";

  const pctBg =
    pct >= 75 ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800" :
    pct >= 50 ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800" :
    pct >= 33 ? "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800" :
    "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800";

  const readabilityEmoji =
    r.readability_score === "good" ? "🟢" :
    r.readability_score === "average" ? "🟡" : "🔴";

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className={`rounded-xl border p-6 ${pctBg}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {studentName && (
              <p className="text-sm text-gray-500 mb-1">{studentName}</p>
            )}
            <div className="flex items-baseline gap-3">
              <span className={`text-4xl font-bold ${pctColor}`}>
                {r.total_marks_obtained}/{r.total_marks_possible}
              </span>
              <span className={`text-2xl font-semibold ${pctColor}`}>
                ({pct}%)
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{r.overall_remarks}</p>
          </div>

          <div className="flex flex-col gap-1.5 text-xs text-gray-500">
            <span>{readabilityEmoji} Readability: {r.readability_score}</span>
            <span>⏱ Grading time: {data.grading_time_seconds}s</span>
            {data.answer_key_summary && (
              <span>📋 {data.answer_key_summary.total_questions} questions, {data.answer_key_summary.total_marks} marks</span>
            )}
            {r.needs_review_count > 0 && (
              <span className="text-amber-600 font-medium">
                ⚠ {r.needs_review_count} answer(s) need manual review
              </span>
            )}
            {r.questions_not_found.length > 0 && (
              <span className="text-red-500 font-medium">
                ✕ Q{r.questions_not_found.join(", Q")} not found on sheet
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Per-question breakdown */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Question-wise Breakdown
          </h3>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {r.student_answers.map((sa) => (
            <QuestionRow key={sa.q_no} answer={sa} />
          ))}
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onReset}
          className="flex-1 py-3 rounded-xl font-medium text-blue-600 border border-blue-200 dark:border-blue-800
                     hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
          Check Another Sheet
        </button>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// QUESTION ROW
// ═══════════════════════════════════════════════════════════════════════

function QuestionRow({ answer: sa }: { answer: StudentAnswer }) {
  const [expanded, setExpanded] = useState(false);
  const isFullMarks = sa.marks_awarded === sa.max_marks;
  const isZero = sa.marks_awarded === 0;

  const marksBg = isFullMarks
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
    : isZero
    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
    : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";

  const confDot =
    sa.confidence === "high" ? "bg-emerald-400" :
    sa.confidence === "medium" ? "bg-amber-400" : "bg-red-400";

  return (
    <div
      className="px-6 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 w-10 shrink-0">
          Q{sa.q_no}
        </span>

        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${marksBg} shrink-0`}>
          {sa.marks_awarded}/{sa.max_marks}
        </span>

        <span className={`w-2 h-2 rounded-full shrink-0 ${confDot}`} title={`Confidence: ${sa.confidence}`} />

        <span className="text-sm text-gray-600 dark:text-gray-400 truncate flex-1">{sa.feedback}</span>

        <div className="flex gap-1.5 shrink-0">
          {sa.legibility_issue && (
            <span className="text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded">
              illegible
            </span>
          )}
          {!sa.matched_on_sheet && (
            <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 px-2 py-0.5 rounded">
              not found
            </span>
          )}
        </div>

        <span className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
      </div>

      {expanded && (
        <div className="mt-3 ml-10 space-y-2 text-sm">
          <div>
            <span className="text-gray-400 text-xs uppercase tracking-wide">Student wrote:</span>
            <p className="text-gray-700 dark:text-gray-300 mt-0.5 bg-gray-50 dark:bg-gray-800 rounded px-3 py-2 whitespace-pre-wrap">
              {sa.extracted_answer || "(nothing found)"}
            </p>
          </div>
          <div>
            <span className="text-gray-400 text-xs uppercase tracking-wide">Feedback:</span>
            <p className="text-gray-700 dark:text-gray-300 mt-0.5">{sa.feedback}</p>
          </div>
        </div>
      )}
    </div>
  );
}
