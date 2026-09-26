/**
 * TestChecker.tsx — v3.1 (a4ai Native Design)
 *
 * Matches the actual a4ai product design language:
 *   - Clean white cards with subtle shadows
 *   - [#111827] dark text, [#1E5BD6] blue accent
 *   - Uppercase tracking-wider labels
 *   - Minimal, premium feel — no gradient hero banners
 *   - Dark CTA buttons matching TabBar active state
 */

import React, { useState, useRef, useCallback } from "react";
import {
  Upload, FileText, ChevronDown, ChevronUp, Eye,
  Loader2, AlertCircle, XCircle, CheckCircle,
  RotateCcw, Sparkles, Clock, BookOpen, User,
  FileKey, Hash, Code2, Shield, Target, Minus
} from "lucide-react";

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
  { value: "medium", label: "Standard (CBSE)", desc: "60% coverage, fair partial" },
  { value: "hard", label: "Strict", desc: "80% coverage, exact terms" },
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

// ── Shared styles ─────────────────────────────────────────────────

const cardClass = "bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.04)]";
const labelClass = "text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider";
const inputClass = "w-full bg-white text-[#111827] text-sm font-semibold placeholder:text-gray-300 placeholder:font-medium rounded-xl border border-[#E5E7EB] px-4 py-3 outline-none transition-all duration-200 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] focus:shadow-[0_0_0_3px_rgba(107,114,128,0.1)] focus:border-gray-400 hover:border-gray-300";

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
    if (f.size > MAX_FILE_MB * 1024 * 1024) { setError(`File too large. Max ${MAX_FILE_MB} MB.`); return; }
    setSheetFile(f); setError("");
    setSheetPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  };

  const handleSheetDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) pickSheetFile(e.dataTransfer.files[0]);
  }, []);

  const pickKeyFile = (f: File) => {
    if (f.size > MAX_FILE_MB * 1024 * 1024) { setError(`Answer key too large. Max ${MAX_FILE_MB} MB.`); return; }
    setKeyFile(f); setError("");
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
    setLoading(true); setError(""); setStep("grading"); setElapsedDisplay(0); setGradingPhase("extracting");

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
      setError(e.message || "Grading failed."); setStep("upload");
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

  // ── Key source tabs ──
  const keyTabs: { v: KeySource; label: string; icon: React.ReactNode }[] = [
    { v: "pdf", label: "Upload PDF", icon: <Upload size={13} /> },
    { v: "test", label: "From Test", icon: <Hash size={13} /> },
    { v: "json", label: "Paste JSON", icon: <Code2 size={13} /> },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">

        {/* ── Page header ── */}
        <div className="mb-8">
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#111827] tracking-tight">
            Answer Sheet Checker
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-400 mt-1 font-medium">
            Upload a student's sheet + answer key — AI grades it in two passes.
          </p>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className={`${cardClass} mb-6 px-4 py-3 flex items-start gap-3 border-red-200 bg-red-50`}>
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={() => setError("")} className="text-red-400 hover:text-red-600"><XCircle className="w-4 h-4" /></button>
          </div>
        )}

        {/* ════════════════════ UPLOAD ════════════════════ */}
        {step === "upload" && (
          <div className="space-y-5">

            {/* ── 1. Answer Sheet ── */}
            <div className={`${cardClass} p-5 sm:p-6`}>
              <p className={`${labelClass} mb-3 flex items-center gap-1.5`}>
                <FileText size={11} /> Student Answer Sheet
              </p>
              <div
                onDragOver={e => e.preventDefault()} onDrop={handleSheetDrop}
                onClick={() => sheetRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 ${
                  sheetFile
                    ? "border-emerald-300 bg-emerald-50/60"
                    : "border-[#D1D5DB] hover:border-gray-400 hover:bg-gray-50/50"
                }`}
              >
                <input ref={sheetRef} type="file" accept={ACCEPTED_TYPES} className="hidden" onChange={e => e.target.files?.[0] && pickSheetFile(e.target.files[0])} />
                {sheetFile ? (
                  <div className="space-y-2">
                    {sheetPreview && <img src={sheetPreview} alt="Preview" className="mx-auto max-h-36 rounded-lg" />}
                    <p className="text-sm font-bold text-emerald-700 flex items-center justify-center gap-1.5">
                      <CheckCircle size={14} />{sheetFile.name}
                    </p>
                    <p className="text-[11px] text-gray-400">{(sheetFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    <button onClick={e => { e.stopPropagation(); setSheetFile(null); setSheetPreview(null); }}
                      className="text-[11px] text-red-500 hover:text-red-700 font-semibold">Remove</button>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-[#111827]">Drop answer sheet here or click to browse</p>
                    <p className="text-[11px] text-gray-400 mt-1">PDF, PNG, JPG, WEBP — up to {MAX_FILE_MB} MB</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── 2. Answer Key ── */}
            <div className={`${cardClass} p-5 sm:p-6`}>
              <p className={`${labelClass} mb-3 flex items-center gap-1.5`}>
                <FileKey size={11} /> Answer Key
              </p>

              {/* Tab bar — dark active pill (matches a4ai TabBar) */}
              <div className="bg-[#F3F4F6] p-1 rounded-xl inline-flex gap-0.5 mb-4">
                {keyTabs.map(t => (
                  <button key={t.v} onClick={() => setKeySource(t.v)}
                    className={`px-3.5 py-2 rounded-[10px] text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                      keySource === t.v
                        ? "bg-gradient-to-br from-[#111827] to-[#374151] text-white shadow-md shadow-gray-900/15"
                        : "text-gray-500 hover:text-gray-800"
                    }`}>
                    {t.icon}{t.label}
                  </button>
                ))}
              </div>

              {keySource === "pdf" && (
                <label className="block">
                  <input type="file" accept={ACCEPTED_TYPES} className="hidden" onChange={e => e.target.files?.[0] && pickKeyFile(e.target.files[0])} />
                  <div className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                    keyFile ? "border-emerald-300 bg-emerald-50/60" : "border-[#D1D5DB] hover:border-gray-400"
                  }`}>
                    {keyFile ? (
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-emerald-700 flex items-center justify-center gap-1.5">
                          <CheckCircle size={14} />{keyFile.name}
                        </p>
                        <button onClick={e => { e.preventDefault(); e.stopPropagation(); setKeyFile(null); }}
                          className="text-[11px] text-red-500 hover:text-red-700 font-semibold">Remove</button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-7 h-7 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-[#111827]">Drop answer key or click to browse</p>
                        <p className="text-[11px] text-gray-400 mt-1">AI extracts questions, answers & marks</p>
                      </div>
                    )}
                  </div>
                </label>
              )}

              {keySource === "test" && (
                <input type="text" value={testId} onChange={e => setTestId(e.target.value)}
                  placeholder="Test ID (UUID)" className={inputClass} />
              )}

              {keySource === "json" && (
                <textarea value={answerKeyJson} onChange={e => setAnswerKeyJson(e.target.value)}
                  placeholder='{"questions": [{"q_no": 1, "correct_answer": "...", "marks": 3}]}'
                  rows={4} className={`${inputClass} font-mono text-xs resize-y`} />
              )}
            </div>

            {/* ── 3. Settings ── */}
            <div className={`${cardClass} p-5 sm:p-6`}>
              <p className={`${labelClass} mb-4 flex items-center gap-1.5`}>
                <Shield size={11} /> Grading Settings
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Strictness */}
                <div>
                  <p className={`${labelClass} mb-2`}>Strictness</p>
                  <div className="space-y-1.5">
                    {STRICTNESS_OPTIONS.map(o => (
                      <label key={o.value}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all border ${
                          strictness === o.value
                            ? "border-[#111827] bg-gray-50"
                            : "border-transparent hover:bg-gray-50"
                        }`}>
                        <input type="radio" name="strictness" value={o.value}
                          checked={strictness === o.value} onChange={() => setStrictness(o.value)}
                          className="accent-[#111827]" />
                        <div className="min-w-0">
                          <span className="text-[13px] font-bold text-[#111827]">{o.label}</span>
                          <span className="block text-[10px] text-gray-400 mt-0.5 leading-tight">{o.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Subject */}
                  <div className="group">
                    <p className={`${labelClass} mb-1.5 ml-1 flex items-center gap-1.5 group-focus-within:text-gray-800 transition-colors`}>
                      <BookOpen size={11} /> Subject
                    </p>
                    <div className="relative">
                      <select value={subject} onChange={e => setSubject(e.target.value)}
                        className={`${inputClass} appearance-none cursor-pointer pr-10`}>
                        {SUBJECT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                    </div>
                  </div>
                  {/* Student name */}
                  <div className="group">
                    <p className={`${labelClass} mb-1.5 ml-1 flex items-center gap-1.5 group-focus-within:text-gray-800 transition-colors`}>
                      <User size={11} /> Student Name
                    </p>
                    <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)}
                      placeholder="For your records (optional)" className={inputClass} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Grade CTA ── */}
            <button onClick={startGrading} disabled={!canGrade()}
              className="w-full py-3.5 sm:py-4 rounded-2xl font-extrabold text-sm sm:text-base text-white transition-all duration-200
                bg-gradient-to-br from-[#111827] to-[#374151]
                hover:shadow-lg hover:shadow-gray-900/20 active:scale-[0.98]
                disabled:from-gray-200 disabled:to-gray-300 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed
                flex items-center justify-center gap-2">
              <Sparkles size={16} />
              Grade Answer Sheet
            </button>
          </div>
        )}

        {/* ════════════════════ GRADING ════════════════════ */}
        {step === "grading" && (
          <div className={`${cardClass} p-6 sm:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.10)]`}>
            <div className="max-w-sm mx-auto text-center">
              <div className="flex items-end justify-between gap-3 mb-4">
                <div className="text-left min-w-0">
                  <p className={labelClass}>
                    {gradingPhase === "extracting" ? "Extracting" : "Grading"}
                  </p>
                  <p className="text-[13px] sm:text-sm font-bold text-[#111827] mt-1">
                    {gradingPhase === "extracting" ? "Reading student answers…" : "Comparing against answer key…"}
                  </p>
                </div>
                <p className="text-3xl sm:text-4xl font-black tabular-nums leading-none text-[#1E5BD6] shrink-0">
                  {elapsedDisplay}<span className="text-lg font-bold">s</span>
                </p>
              </div>

              {/* Progress bar — same style as TestGeneratorForm */}
              <div className="relative h-3.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="relative h-full rounded-full bg-gradient-to-r from-[#1E5BD6] to-[#4F86F7] transition-[width] duration-1000 ease-out"
                  style={{ width: gradingPhase === "extracting" ? "35%" : "70%" }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                    style={{ animation: "a4aiSheen 1.6s linear infinite" }} />
                </div>
              </div>

              <p className="mt-4 text-[11px] text-gray-400">
                Keep this tab open — usually takes 60–120 seconds.
              </p>
            </div>

            {/* Sheen keyframe */}
            <style>{`@keyframes a4aiSheen { 0% { transform: translateX(-100%) } 100% { transform: translateX(100%) } }`}</style>
          </div>
        )}

        {/* ════════════════════ RESULTS ════════════════════ */}
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

  const scoreColor = pct >= 75 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : pct >= 33 ? "text-orange-600" : "text-red-600";

  return (
    <div className="space-y-4">

      {/* ── Score card ── */}
      <div className={`${cardClass} p-5 sm:p-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {studentName && (
              <p className="text-[11px] font-semibold text-gray-400 mb-1 flex items-center gap-1">
                <User size={11} />{studentName}
              </p>
            )}
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl sm:text-5xl font-black tabular-nums ${scoreColor}`}>
                {r.total_marks_obtained}/{r.total_marks_possible}
              </span>
              <span className={`text-xl sm:text-2xl font-bold ${scoreColor} opacity-70`}>
                ({pct}%)
              </span>
            </div>
            <p className="text-[13px] text-gray-500 mt-2 leading-relaxed max-w-md">{r.overall_remarks}</p>
          </div>

          {/* Meta info */}
          <div className="text-[11px] text-gray-400 space-y-1.5 sm:text-right shrink-0">
            {meta && <p className="flex items-center gap-1 sm:justify-end"><Sparkles size={10} className="text-gray-300" />{meta.model} · {meta.pipeline}</p>}
            <p className="flex items-center gap-1 sm:justify-end"><Clock size={10} className="text-gray-300" />{data.grading_time_seconds}s total</p>
            {meta && <p className="flex items-center gap-1 sm:justify-end"><Eye size={10} className="text-gray-300" />Extract {meta.extraction_time_s}s · Grade {meta.grading_time_s}s</p>}
            {meta?.subject && <p className="flex items-center gap-1 sm:justify-end"><BookOpen size={10} className="text-gray-300" />Rubric: {meta.subject}</p>}
          </div>
        </div>
      </div>

      {/* ── Grade summary stats ── */}
      {gs && (
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          <StatBadge label="Full" value={gs.full_marks_count ?? 0} color="text-emerald-600 bg-emerald-50 border-emerald-200" />
          <StatBadge label="Partial" value={gs.partial_marks_count ?? 0} color="text-amber-600 bg-amber-50 border-amber-200" />
          <StatBadge label="Zero" value={gs.zero_marks_count ?? 0} color="text-red-600 bg-red-50 border-red-200" />
          <StatBadge label="Skipped" value={gs.not_attempted_count ?? 0} color="text-gray-500 bg-gray-50 border-gray-200" />
        </div>
      )}

      {/* ── Flags ── */}
      {(r.needs_review_count > 0 || r.questions_not_found.length > 0 || r.readability_score) && (
        <div className="flex flex-wrap gap-2">
          {r.needs_review_count > 0 && (
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
              <AlertCircle size={11} /> {r.needs_review_count} need review
            </span>
          )}
          {r.questions_not_found.length > 0 && (
            <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
              <XCircle size={11} /> Q{r.questions_not_found.join(", Q")} not attempted
            </span>
          )}
          {r.readability_score && (
            <span className="text-[11px] font-bold text-gray-600 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
              <Eye size={11} /> Legibility: {r.readability_score}
            </span>
          )}
        </div>
      )}

      {/* ── Question breakdown ── */}
      <div className={`${cardClass} overflow-hidden`}>
        <div className="px-5 py-3.5 border-b border-[#E5E7EB]">
          <p className={`${labelClass} flex items-center gap-1.5`}>
            <Target size={11} /> Question-wise Breakdown
          </p>
        </div>
        <div className="divide-y divide-[#F3F4F6]">
          {r.student_answers.map((sa, i) => <QuestionRow key={`${sa.q_no}-${i}`} answer={sa} />)}
        </div>
      </div>

      {/* ── Reset ── */}
      <button onClick={onReset}
        className="w-full py-3 rounded-2xl text-sm font-bold text-[#111827] border-2 border-[#E5E7EB] hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
        <RotateCcw size={14} />
        Check Another Sheet
      </button>
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${color}`}>
      <div className="text-2xl font-black tabular-nums">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5 opacity-70">{label}</div>
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
    ? "bg-emerald-100 text-emerald-700"
    : isZero
    ? "bg-red-100 text-red-700"
    : "bg-amber-100 text-amber-700";

  const confDot = sa.confidence === "high" ? "bg-emerald-400" : sa.confidence === "medium" ? "bg-amber-400" : "bg-red-400";

  return (
    <div className="px-5 py-3.5 hover:bg-[#FAFBFC] cursor-pointer transition-colors" onClick={() => setExpanded(!expanded)}>
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-extrabold text-[#111827] w-10 shrink-0">Q{sa.q_no}</span>
        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${marksBg}`}>{sa.marks_awarded}/{sa.max_marks}</span>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${confDot}`} title={`Confidence: ${sa.confidence}`} />

        {sa.concept_coverage_pct != null && (
          <div className="hidden sm:flex items-center gap-1.5 shrink-0" title={`${sa.key_concepts_found}/${sa.key_concepts_total} concepts`}>
            <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#1E5BD6] rounded-full" style={{ width: `${Math.min(sa.concept_coverage_pct, 100)}%` }} />
            </div>
            <span className="text-[10px] text-gray-400 font-semibold tabular-nums">{sa.concept_coverage_pct}%</span>
          </div>
        )}

        <span className="text-[12px] text-gray-400 truncate flex-1">{sa.feedback}</span>

        <div className="flex gap-1.5 shrink-0">
          {sa.legibility_issue && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-md font-bold">illegible</span>}
          {!sa.matched_on_sheet && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-md font-bold">not found</span>}
          {sa.format_type && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md hidden sm:inline">{sa.format_type}</span>}
        </div>

        {expanded
          ? <ChevronUp size={14} className="text-gray-400 shrink-0" />
          : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
      </div>

      {expanded && (
        <div className="mt-3 ml-10 space-y-3 text-[13px]" onClick={e => e.stopPropagation()}>
          <div>
            <p className={`${labelClass} mb-1`}>Student wrote</p>
            <div className="bg-[#F8F9FB] rounded-xl border border-[#E5E7EB] px-4 py-3 text-gray-700 whitespace-pre-wrap text-sm">
              {sa.extracted_answer || "(nothing found)"}
            </div>
          </div>
          <div>
            <p className={`${labelClass} mb-1`}>Feedback</p>
            <p className="text-gray-600">{sa.feedback}</p>
          </div>

          {sa.key_concepts_total != null && (
            <div>
              <p className={`${labelClass} mb-1`}>Concept Coverage</p>
              <p className="text-gray-600 text-sm">
                {sa.key_concepts_found}/{sa.key_concepts_total} key concepts ({sa.concept_coverage_pct}%)
              </p>
            </div>
          )}

          {sa.deductions && sa.deductions.length > 0 && (
            <div>
              <p className={`${labelClass} mb-1`}>Deductions</p>
              <div className="space-y-1">
                {sa.deductions.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px] text-red-600">
                    <Minus size={12} className="shrink-0" />
                    <span className="font-mono font-bold">{d.marks_deducted}</span>
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