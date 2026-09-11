/**
 * TestChecker.tsx — v2.0 (Production Grade)
 *
 * Changes from v1.1:
 *  - Subject selector added (triggers subject-specific rubrics in backend)
 *  - Results show concept coverage %, deductions list, grade summary
 *  - Better loading UX with 2-step progress (extracting → grading)
 *  - Question rows show key_concepts_found / key_concepts_total
 */

import React, { useState, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────

interface Deduction {
  reason: string;
  marks_deducted: number;
}

interface StudentAnswer {
  q_no: number | string;
  matched_on_sheet: boolean;
  extracted_answer: string;
  marks_awarded: number;
  max_marks: number;
  confidence: "high" | "medium" | "low";
  feedback: string;
  legibility_issue: boolean;
  key_concepts_total?: number;
  key_concepts_found?: number;
  concept_coverage_pct?: number;
  deductions?: Deduction[];
  format_type?: string;
}

interface GradeSummary {
  full_marks_count?: number;
  partial_marks_count?: number;
  zero_marks_count?: number;
  not_attempted_count?: number;
}

interface GradingResult {
  student_answers: StudentAnswer[];
  total_marks_obtained: number;
  total_marks_possible: number;
  percentage: number;
  overall_remarks: string;
  readability_score: "good" | "average" | "poor" | "unknown";
  questions_not_found: (number | string)[];
  needs_review_count: number;
  grade_summary?: GradeSummary;
  _meta?: {
    pipeline: string;
    model: string;
    strictness: string;
    subject: string;
    extraction_time_s: number;
    grading_time_s: number;
    total_answers_extracted: number;
    sheet_legibility: string;
    pages_scanned: number;
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
}

type KeySource = "pdf" | "test" | "json";
type Strictness = "easy" | "medium" | "hard" | "extreme";
type Step = "upload" | "grading" | "results";

// ── Constants ─────────────────────────────────────────────────────

const API_BASE = `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8000/api"}/v1`;

const STRICTNESS_OPTIONS: { value: Strictness; label: string; desc: string }[] = [
  { value: "easy", label: "Lenient", desc: "40% concept coverage = full marks" },
  { value: "medium", label: "Standard (CBSE)", desc: "60% coverage needed, fair partial marks" },
  { value: "hard", label: "Strict", desc: "80% coverage, exact terms required" },
  { value: "extreme", label: "Very Strict", desc: "90%+ coverage, zero tolerance" },
];

const SUBJECT_OPTIONS = [
  { value: "", label: "Auto-detect" },
  { value: "science", label: "Science" },
  { value: "mathematics", label: "Mathematics" },
  { value: "english", label: "English" },
  { value: "social_science", label: "Social Science" },
  { value: "accountancy", label: "Accountancy" },
];

const ACCEPTED_TYPES = ".pdf,.png,.jpg,.jpeg,.webp";
const MAX_FILE_MB = 20;

// ── Component ─────────────────────────────────────────────────────

export default function TestChecker() {
  const [sheetFile, setSheetFile] = useState<File | null>(null);
  const [sheetPreview, setSheetPreview] = useState<string | null>(null);
  const sheetRef = useRef<HTMLInputElement>(null);

  const [keySource, setKeySource] = useState<KeySource>("pdf");
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [testId, setTestId] = useState("");
  const [answerKeyJson, setAnswerKeyJson] = useState("");

  const [strictness, setStrictness] = useState<Strictness>("medium");
  const [subject, setSubject] = useState("");
  const [studentName, setStudentName] = useState("");

  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [elapsedDisplay, setElapsedDisplay] = useState(0);
  const [gradingPhase, setGradingPhase] = useState<"extracting" | "grading">("extracting");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pickSheetFile = (f: File) => {
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File too large. Max ${MAX_FILE_MB} MB.`);
      return;
    }
    setSheetFile(f);
    setError("");
    setSheetPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  };

  const handleSheetDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) pickSheetFile(e.dataTransfer.files[0]);
  }, []);

  const pickKeyFile = (f: File) => {
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Answer key too large. Max ${MAX_FILE_MB} MB.`);
      return;
    }
    setKeyFile(f);
    setError("");
  };

  const canGrade = () => {
    if (!sheetFile) return false;
    if (keySource === "pdf" && !keyFile) return false;
    if (keySource === "test" && !testId.trim()) return false;
    if (keySource === "json" && !answerKeyJson.trim()) return false;
    return true;
  };

  const startGrading = async () => {
    if (!canGrade()) { setError("Please fill all required fields."); return; }

    setLoading(true);
    setError("");
    setStep("grading");
    setElapsedDisplay(0);
    setGradingPhase("extracting");

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedDisplay(elapsed);
      if (elapsed > 20) setGradingPhase("grading");
    }, 1000);

    try {
      const formData = new FormData();
      formData.append("file", sheetFile!);
      formData.append("strictness", strictness);
      formData.append("student_name", studentName);
      formData.append("teacher_id", "");
      if (subject) formData.append("subject", subject);

      let endpoint: string;
      if (keySource === "test") {
        endpoint = `${API_BASE}/test-checker/check-with-test`;
        formData.append("test_id", testId.trim());
      } else if (keySource === "pdf") {
        endpoint = `${API_BASE}/test-checker/check`;
        formData.append("answer_key_file", keyFile!);
      } else {
        endpoint = `${API_BASE}/test-checker/check`;
        formData.append("answer_key_json", answerKeyJson);
      }

      const res = await fetch(endpoint, { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error (${res.status})`);
      }

      setResult(await res.json());
      setStep("results");
    } catch (e: any) {
      setError(e.message || "Grading failed.");
      setStep("upload");
    } finally {
      setLoading(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resetAll = () => {
    setSheetFile(null); setSheetPreview(null); setKeyFile(null);
    setTestId(""); setAnswerKeyJson(""); setResult(null);
    setStep("upload"); setError(""); setElapsedDisplay(0);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Answer Sheet Checker</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            2-pass AI grading: extracts answers first, then grades with subject-specific rubrics.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
            <span className="shrink-0 mt-0.5">⚠</span>
            <span>{error}</span>
            <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {step === "upload" && (
          <div className="space-y-6">
            {/* 1. Answer Sheet */}
            <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">1 · Student Answer Sheet</h2>
              <div
                onDragOver={e => e.preventDefault()} onDrop={handleSheetDrop}
                onClick={() => sheetRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${sheetFile ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20" : "border-gray-300 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10"}`}
              >
                <input ref={sheetRef} type="file" accept={ACCEPTED_TYPES} className="hidden" onChange={e => e.target.files?.[0] && pickSheetFile(e.target.files[0])} />
                {sheetFile ? (
                  <div className="space-y-2">
                    {sheetPreview && <img src={sheetPreview} alt="Preview" className="mx-auto max-h-40 rounded shadow-sm" />}
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{sheetFile.name}</p>
                    <p className="text-xs text-gray-500">{(sheetFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    <button onClick={e => { e.stopPropagation(); setSheetFile(null); setSheetPreview(null); }} className="text-xs text-red-500 hover:underline">Remove</button>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 font-medium">Drop answer sheet here or click to browse</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, PNG, JPG, WEBP — up to {MAX_FILE_MB} MB</p>
                  </div>
                )}
              </div>
            </section>

            {/* 2. Answer Key */}
            <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">2 · Answer Key</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {([{ v: "pdf" as KeySource, l: "Upload PDF / Image" }, { v: "test" as KeySource, l: "From Saved Test" }, { v: "json" as KeySource, l: "Paste JSON" }]).map(o => (
                  <button key={o.v} onClick={() => setKeySource(o.v)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${keySource === o.v ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>{o.l}</button>
                ))}
              </div>

              {keySource === "pdf" && (
                <div>
                  <label className="block">
                    <input type="file" accept={ACCEPTED_TYPES} className="hidden" onChange={e => e.target.files?.[0] && pickKeyFile(e.target.files[0])} />
                    <div className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${keyFile ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20" : "border-gray-300 dark:border-gray-700 hover:border-blue-400"}`}>
                      {keyFile ? (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{keyFile.name}</p>
                          <button onClick={e => { e.preventDefault(); e.stopPropagation(); setKeyFile(null); }} className="text-xs text-red-500 hover:underline">Remove</button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 font-medium">Drop answer key here or click to browse</p>
                          <p className="text-xs text-gray-400 mt-1">AI extracts questions, answers & marks automatically</p>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              )}

              {keySource === "test" && (
                <div>
                  <input type="text" value={testId} onChange={e => setTestId(e.target.value)} placeholder="Test ID (UUID)" className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              )}

              {keySource === "json" && (
                <textarea value={answerKeyJson} onChange={e => setAnswerKeyJson(e.target.value)} placeholder='{"questions": [{"q_no": 1, "correct_answer": "...", "marks": 3}]}' rows={5} className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y" />
              )}
            </section>

            {/* 3. Settings */}
            <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">3 · Settings</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">Strictness</label>
                  <div className="space-y-1.5">
                    {STRICTNESS_OPTIONS.map(o => (
                      <label key={o.value} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${strictness === o.value ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700" : "hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent"}`}>
                        <input type="radio" name="strictness" value={o.value} checked={strictness === o.value} onChange={() => setStrictness(o.value)} className="accent-blue-600" />
                        <div>
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{o.label}</span>
                          <span className="text-xs text-gray-400 ml-2">{o.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">Subject (for grading rubric)</label>
                    <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                      {SUBJECT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Different subjects have different marking rules</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">Student Name (optional)</label>
                    <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="For your records" className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                </div>
              </div>
            </section>

            <button onClick={startGrading} disabled={!canGrade()} className="w-full py-3.5 rounded-xl font-semibold text-white transition-all bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed">
              Grade Answer Sheet
            </button>
          </div>
        )}

        {step === "grading" && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
            <div className="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-6" />
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
              {gradingPhase === "extracting" ? "Step 1: Reading answer sheet…" : "Step 2: Grading against answer key…"}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {gradingPhase === "extracting" ? "AI is extracting what the student wrote on each question." : "Comparing answers against key using subject-specific rubrics."}
            </p>
            {/* Progress bar */}
            <div className="w-64 mx-auto mt-4 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-1000 ${gradingPhase === "extracting" ? "w-1/3 bg-amber-500" : "w-2/3 bg-blue-500"}`} />
            </div>
            <p className="text-2xl font-mono text-blue-600 mt-4">{elapsedDisplay}s</p>
            <p className="text-xs text-gray-400 mt-1">Usually 60-120 seconds (two AI passes)</p>
          </div>
        )}

        {step === "results" && result && <ResultsView data={result} onReset={resetAll} studentName={studentName} />}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// RESULTS VIEW
// ═══════════════════════════════════════════════════════════════════════

function ResultsView({ data, onReset, studentName }: { data: CheckResponse; onReset: () => void; studentName: string }) {
  const r = data.result;
  const pct = r.percentage;
  const meta = r._meta;
  const gs = r.grade_summary;

  const pctColor = pct >= 75 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : pct >= 33 ? "text-orange-600" : "text-red-600";
  const pctBg = pct >= 75 ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800" : pct >= 50 ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800" : pct >= 33 ? "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800" : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800";

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className={`rounded-xl border p-6 ${pctBg}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {studentName && <p className="text-sm text-gray-500 mb-1">{studentName}</p>}
            <div className="flex items-baseline gap-3">
              <span className={`text-4xl font-bold ${pctColor}`}>{r.total_marks_obtained}/{r.total_marks_possible}</span>
              <span className={`text-2xl font-semibold ${pctColor}`}>({pct}%)</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{r.overall_remarks}</p>
          </div>
          <div className="flex flex-col gap-1.5 text-xs text-gray-500">
            {meta && <span>🤖 {meta.model} · {meta.pipeline}</span>}
            <span>⏱ Total: {data.grading_time_seconds}s</span>
            {meta && <span>📖 Extract: {meta.extraction_time_s}s · Grade: {meta.grading_time_s}s</span>}
            {meta?.subject && <span>📚 Rubric: {meta.subject}</span>}
          </div>
        </div>
      </div>

      {/* Grade Summary Stats */}
      {gs && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBadge label="Full Marks" value={gs.full_marks_count ?? 0} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" />
          <StatBadge label="Partial" value={gs.partial_marks_count ?? 0} color="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" />
          <StatBadge label="Zero" value={gs.zero_marks_count ?? 0} color="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" />
          <StatBadge label="Not Attempted" value={gs.not_attempted_count ?? 0} color="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" />
        </div>
      )}

      {/* Flags */}
      <div className="flex flex-wrap gap-2">
        {r.needs_review_count > 0 && (
          <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-3 py-1.5 rounded-lg font-medium">⚠ {r.needs_review_count} need manual review</span>
        )}
        {r.questions_not_found.length > 0 && (
          <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 px-3 py-1.5 rounded-lg font-medium">✕ Q{r.questions_not_found.join(", Q")} not attempted</span>
        )}
        {r.readability_score && (
          <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 px-3 py-1.5 rounded-lg font-medium">
            {r.readability_score === "good" ? "🟢" : r.readability_score === "average" ? "🟡" : "🔴"} Legibility: {r.readability_score}
          </span>
        )}
      </div>

      {/* Per-question breakdown */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Question-wise Breakdown</h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {r.student_answers.map((sa, i) => <QuestionRow key={`${sa.q_no}-${i}`} answer={sa} />)}
        </div>
      </section>

      <button onClick={onReset} className="w-full py-3 rounded-xl font-medium text-blue-600 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
        Check Another Sheet
      </button>
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg p-3 text-center ${color}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-0.5">{label}</div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// QUESTION ROW (with concept coverage + deductions)
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

  const confDot = sa.confidence === "high" ? "bg-emerald-400" : sa.confidence === "medium" ? "bg-amber-400" : "bg-red-400";

  return (
    <div className="px-6 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors" onClick={() => setExpanded(!expanded)}>
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 w-10 shrink-0">Q{sa.q_no}</span>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${marksBg} shrink-0`}>{sa.marks_awarded}/{sa.max_marks}</span>
        <span className={`w-2 h-2 rounded-full shrink-0 ${confDot}`} title={`Confidence: ${sa.confidence}`} />

        {/* Concept coverage mini-bar */}
        {sa.concept_coverage_pct != null && (
          <div className="hidden sm:flex items-center gap-1.5 shrink-0" title={`${sa.key_concepts_found}/${sa.key_concepts_total} concepts`}>
            <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(sa.concept_coverage_pct, 100)}%` }} />
            </div>
            <span className="text-[10px] text-gray-400">{sa.concept_coverage_pct}%</span>
          </div>
        )}

        <span className="text-sm text-gray-600 dark:text-gray-400 truncate flex-1">{sa.feedback}</span>

        <div className="flex gap-1.5 shrink-0">
          {sa.legibility_issue && <span className="text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded">illegible</span>}
          {!sa.matched_on_sheet && <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 px-2 py-0.5 rounded">not found</span>}
          {sa.format_type && <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded hidden sm:inline">{sa.format_type}</span>}
        </div>

        <span className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
      </div>

      {expanded && (
        <div className="mt-3 ml-10 space-y-3 text-sm">
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

          {sa.key_concepts_total != null && (
            <div>
              <span className="text-gray-400 text-xs uppercase tracking-wide">Concept Coverage:</span>
              <p className="text-gray-600 dark:text-gray-400 mt-0.5">
                {sa.key_concepts_found}/{sa.key_concepts_total} key concepts found ({sa.concept_coverage_pct}%)
              </p>
            </div>
          )}

          {sa.deductions && sa.deductions.length > 0 && (
            <div>
              <span className="text-gray-400 text-xs uppercase tracking-wide">Deductions:</span>
              <div className="mt-1 space-y-1">
                {sa.deductions.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                    <span className="font-mono">-{d.marks_deducted}</span>
                    <span>{d.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}