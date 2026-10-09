/**
 * SmartAssignmentChecker.tsx — v1.0
 *
 * Teacher uploads:
 *   1. Question paper
 *   2. Answer key
 *   3. Student's handwritten sheet
 *
 * System:
 *   - Validates student name, class, roll no (invalid if any missing)
 *   - Grades per question and sub-part
 *   - Marks strictly capped at paper's maximum
 */

import React, { useState, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────

interface StudentInfo {
  name: string;
  class: string;
  roll_no: string;
  missing_fields: string[];
}

interface SubpartGrade {
  sub_id: string;
  max_marks: number;
  marks_awarded: number;
  student_answer_summary: string;
  key_concepts_found: string[];
  key_concepts_missed: string[];
  feedback: string;
}

interface GradedQuestion {
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
}

interface AssignmentResult {
  is_valid: boolean;
  student_info: StudentInfo;
  invalid_reason?: string;
  missing_fields?: string[];
  graded_questions: GradedQuestion[];
  total_marks_awarded: number;
  max_marks: number;
  percentage: number;
  overall_remarks: string;
  readability_score: string;
  paper_info?: { total_questions: number; total_marks: number };
  _meta?: {
    model: string;
    strictness: string;
    parse_paper_time_s: number;
    parse_key_time_s: number;
    grade_time_s: number;
    total_time_s: number;
  };
}

interface CheckResponse {
  ok: boolean;
  check_id: string;
  grading_time_seconds: number;
  result: AssignmentResult;
}

type Strictness = "easy" | "medium" | "hard" | "extreme";
type Step = "upload" | "grading" | "results";
type GradingPhase = "paper" | "key" | "grading";

// ── Constants ─────────────────────────────────────────────────────

const API_BASE = `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8000/api"}/v1`;

const STRICTNESS_OPTIONS: { value: Strictness; label: string; desc: string }[] = [
  { value: "easy",    label: "Lenient",       desc: "40% concept coverage = full marks" },
  { value: "medium",  label: "Standard",      desc: "60% coverage = full marks, fair partial marks" },
  { value: "hard",    label: "Strict",        desc: "80% coverage, key terms required" },
  { value: "extreme", label: "Very Strict",   desc: "90%+ exact coverage required" },
];

const PHASE_LABELS: Record<GradingPhase, { title: string; desc: string }> = {
  paper:   { title: "Step 1: Reading question paper…",   desc: "Extracting questions, sub-parts and marks structure." },
  key:     { title: "Step 2: Reading answer key…",       desc: "Mapping correct answers and key concepts to each question." },
  grading: { title: "Step 3: Grading student sheet…",    desc: "Validating student identity and grading each answer." },
};

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp";
const MAX_MB = 20;

// ── File upload zone ──────────────────────────────────────────────

interface FileZoneProps {
  label: string;
  file: File | null;
  onPick: (f: File) => void;
  onRemove: () => void;
  accent: string;
}

function FileZone({ label, file, onPick, onRemove, accent }: FileZoneProps) {
  const ref = useRef<HTMLInputElement>(null);
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); if (e.dataTransfer.files[0]) onPick(e.dataTransfer.files[0]); };

  return (
    <div
      onDragOver={e => e.preventDefault()} onDrop={handleDrop}
      onClick={() => ref.current?.click()}
      className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
        file
          ? `border-${accent}-300 bg-${accent}-50 dark:border-${accent}-700 dark:bg-${accent}-900/20`
          : "border-gray-300 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10"
      }`}
    >
      <input ref={ref} type="file" accept={ACCEPTED} className="hidden"
        onChange={e => e.target.files?.[0] && onPick(e.target.files[0])} />
      {file ? (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{file.name}</p>
          <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          <button onClick={e => { e.stopPropagation(); onRemove(); }} className="text-xs text-red-500 hover:underline">Remove</button>
        </div>
      ) : (
        <div>
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Drop here or click to browse</p>
          <p className="text-xs text-gray-400 mt-0.5">PDF, PNG, JPG — up to {MAX_MB} MB</p>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────

export default function SmartAssignmentChecker() {
  const [qpFile, setQpFile] = useState<File | null>(null);
  const [akFile, setAkFile] = useState<File | null>(null);
  const [ssFile, setSsFile] = useState<File | null>(null);

  const [strictness, setStrictness] = useState<Strictness>("medium");
  const [subject, setSubject] = useState("");
  const [classGrade, setClassGrade] = useState("");

  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<GradingPhase>("paper");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const validateFile = (f: File): boolean => {
    if (f.size > MAX_MB * 1024 * 1024) { setError(`File too large. Max ${MAX_MB} MB.`); return false; }
    return true;
  };

  const pickFile = (setter: (f: File) => void) => (f: File) => {
    if (validateFile(f)) { setter(f); setError(""); }
  };

  const canGrade = () => !!qpFile && !!akFile && !!ssFile;

  const startGrading = async () => {
    if (!canGrade()) { setError("Upload all three files before grading."); return; }

    setLoading(true); setError(""); setStep("grading");
    setElapsed(0); setPhase("paper");

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const s = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(s);
      if (s < 30) setPhase("paper");
      else if (s < 70) setPhase("key");
      else setPhase("grading");
    }, 1000);

    try {
      const fd = new FormData();
      fd.append("question_paper", qpFile!);
      fd.append("answer_key", akFile!);
      fd.append("student_sheet", ssFile!);
      fd.append("strictness", strictness);
      fd.append("subject", subject);
      fd.append("class_grade", classGrade);
      fd.append("teacher_id", "");

      const res = await fetch(`${API_BASE}/smart-assignment-checker/check`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error (${res.status})`);
      }
      setResult(await res.json());
      setStep("results");
    } catch (e: any) {
      setError(e.message || "Grading failed. Try again.");
      setStep("upload");
    } finally {
      setLoading(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resetAll = () => {
    setQpFile(null); setAkFile(null); setSsFile(null);
    setResult(null); setStep("upload"); setError(""); setElapsed(0);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Assignment Checker</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Upload question paper + answer key + student sheet — AI grades with strict per-question marks.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
            <span className="shrink-0">⚠</span>
            <span>{error}</span>
            <button onClick={() => setError("")} className="ml-auto">✕</button>
          </div>
        )}

        {/* ─── UPLOAD ─── */}
        {step === "upload" && (
          <div className="space-y-6">

            {/* 3 file uploads */}
            <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
                Upload Files
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FileZone label="Question Paper" file={qpFile} onPick={pickFile(setQpFile)} onRemove={() => setQpFile(null)} accent="blue" />
                <FileZone label="Answer Key" file={akFile} onPick={pickFile(setAkFile)} onRemove={() => setAkFile(null)} accent="emerald" />
                <FileZone label="Student Sheet" file={ssFile} onPick={pickFile(setSsFile)} onRemove={() => setSsFile(null)} accent="purple" />
              </div>

              {/* Requirements note */}
              <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">⚠ Student sheet must contain:</p>
                <div className="flex gap-4 text-xs text-amber-700 dark:text-amber-300">
                  <span>✓ Student Name</span>
                  <span>✓ Class / Section</span>
                  <span>✓ Roll Number</span>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Missing any of these → sheet will be marked invalid and not graded.</p>
              </div>
            </section>

            {/* Settings */}
            <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">Settings</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">Subject</label>
                  <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Science"
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">Class / Grade</label>
                  <input value={classGrade} onChange={e => setClassGrade(e.target.value)} placeholder="e.g. Class 10"
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">Strictness</label>
                  <select value={strictness} onChange={e => setStrictness(e.target.value as Strictness)}
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    {STRICTNESS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} — {o.desc}</option>)}
                  </select>
                </div>
              </div>
            </section>

            <button onClick={startGrading} disabled={!canGrade()}
              className="w-full py-3.5 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition-all disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed">
              Grade Assignment
            </button>
          </div>
        )}

        {/* ─── GRADING ─── */}
        {step === "grading" && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
            <div className="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-6" />
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">{PHASE_LABELS[phase].title}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{PHASE_LABELS[phase].desc}</p>
            <div className="w-72 mx-auto mt-5 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                style={{ width: phase === "paper" ? "25%" : phase === "key" ? "60%" : "88%" }} />
            </div>
            <p className="text-2xl font-mono text-blue-600 mt-4">{elapsed}s</p>
            <p className="text-xs text-gray-400 mt-1">3 AI passes — usually 90–150 seconds</p>
          </div>
        )}

        {/* ─── RESULTS ─── */}
        {step === "results" && result && (
          <ResultsView data={result} onReset={resetAll} />
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// RESULTS VIEW
// ═══════════════════════════════════════════════════════════════════════

function ResultsView({ data, onReset }: { data: CheckResponse; onReset: () => void }) {
  const r = data.result;

  if (!r.is_valid) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <p className="text-3xl mb-3">❌</p>
          <h2 className="text-xl font-bold text-red-700 dark:text-red-300 mb-2">Assignment Invalid</h2>
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">{r.invalid_reason}</p>
          {r.missing_fields && r.missing_fields.length > 0 && (
            <div className="flex justify-center gap-2">
              {r.missing_fields.map((f, i) => (
                <span key={i} className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-3 py-1 rounded-full font-medium">
                  Missing: {f}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-red-500 mt-3">Student must write Name, Class, and Roll Number on the sheet.</p>
        </div>
        <button onClick={onReset} className="w-full py-3 rounded-xl font-medium text-blue-600 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
          Try Again
        </button>
      </div>
    );
  }

  const pct = r.percentage;
  const pctColor = pct >= 75 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : pct >= 33 ? "text-orange-600" : "text-red-600";
  const pctBg = pct >= 75 ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800"
    : pct >= 50 ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800"
    : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800";

  const si = r.student_info;
  const meta = r._meta;

  return (
    <div className="space-y-5">

      {/* Student Identity Card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Student Details</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-400">Name</p>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{si.name || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Class</p>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{si.class || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Roll No.</p>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{si.roll_no || "—"}</p>
          </div>
        </div>
      </div>

      {/* Score card */}
      <div className={`rounded-xl border p-6 ${pctBg}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-3">
              <span className={`text-4xl font-bold ${pctColor}`}>{r.total_marks_awarded}</span>
              <span className="text-xl text-gray-500">/ {r.max_marks}</span>
              <span className={`text-2xl font-semibold ${pctColor}`}>({pct}%)</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{r.overall_remarks}</p>
          </div>
          <div className="text-xs text-gray-500 space-y-1 shrink-0">
            {r.readability_score && (
              <p>{r.readability_score === "good" ? "🟢" : r.readability_score === "average" ? "🟡" : "🔴"} Legibility: {r.readability_score}</p>
            )}
            {meta && <p>⏱ {meta.total_time_s}s total</p>}
            {meta && <p>📄 Parse: {meta.parse_paper_time_s}s · Key: {meta.parse_key_time_s}s · Grade: {meta.grade_time_s}s</p>}
            {r.paper_info && <p>📝 {r.paper_info.total_questions} questions · {r.paper_info.total_marks} max marks</p>}
          </div>
        </div>
      </div>

      {/* Per-question breakdown */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Question-wise Marks</h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {r.graded_questions.map((q, i) => <QuestionRow key={i} q={q} />)}
        </div>
        {/* Total row */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Total</span>
          <span className={`text-lg font-black ${pctColor}`}>{r.total_marks_awarded} / {r.max_marks}</span>
        </div>
      </section>

      <button onClick={onReset}
        className="w-full py-3 rounded-xl font-medium text-blue-600 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
        Check Another Sheet
      </button>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// QUESTION ROW
// ═══════════════════════════════════════════════════════════════════════

function QuestionRow({ q }: { q: GradedQuestion }) {
  const [expanded, setExpanded] = useState(false);
  const isFull = q.marks_awarded >= q.max_marks;
  const isZero = q.marks_awarded === 0;
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
          {q.marks_awarded}/{q.max_marks}
        </span>
        {!isNotAttempted && <span className={`w-2 h-2 rounded-full shrink-0 ${confDot}`} title={`Confidence: ${q.confidence}`} />}
        <span className="text-sm text-gray-600 dark:text-gray-400 truncate flex-1">{q.feedback}</span>
        <div className="flex gap-1 shrink-0">
          {q.legibility_issue && <span className="text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 px-2 py-0.5 rounded">illegible</span>}
          {isNotAttempted && <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded">not attempted</span>}
          {q.has_subparts && <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-600 px-2 py-0.5 rounded">{q.subpart_grades.length} parts</span>}
        </div>
        <span className={`text-gray-400 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
      </div>

      {expanded && (
        <div className="px-6 pb-4 space-y-3">
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
                    {sp.key_concepts_missed.length > 0 && (
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
