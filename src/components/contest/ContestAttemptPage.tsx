// src/components/contest/ContestAttemptPage.tsx
// ──────────────────────────────────────────────────────────────────────
// Student-facing Quiz/Contest Page
//
// Features:
//   1. Camera proctoring (webcam feed in corner)
//   2. Tab switch detection + warning system
//   3. Full-screen enforcement
//   4. Timer with auto-submit
//   5. Multi-device responsive (mobile + laptop)
//   6. Question navigation sidebar
//   7. Anti-cheating: right-click disabled, copy-paste disabled
//   8. Auto-save progress (localStorage every change + PUT progress, see src/lib/contestProgress.ts)
//   9. Clean, exam-like UI
//  10. Resume after refresh: server deadline timer, merged local/server answers, no reload while active
// ──────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useIsPresent } from "framer-motion";
import {
  Camera, CameraOff, Clock, AlertTriangle, ChevronLeft, ChevronRight,
  Send, Shield, Eye, MonitorSmartphone, Maximize, Flag,
  CheckCircle2, Circle, Loader2, X, BookOpen, Lock
} from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { contestApi, ContestApiError, type SubmitResponse } from "@/lib/contestApi";
import { setContestActive } from "@/lib/contestGuard";
import { CONTEST_FONT_STACK, CONTEST_NAVY, useContestFont } from "@/lib/contestFont";
import { supabase } from "@/lib/supabaseClient";
import {
  answersFor, clearLocal, clientDeadline, createAwayTracker, createProgressSync, loadLocal, mergeProgress, saveLocal,
  secondsLeft, submitWithRetry, type AttemptProgress, type SyncState, type WarningEntry, type WarningType,
} from "@/lib/contestProgress";

// ==================== MATH TEXT (LaTeX renderer) ====================
const MathText = ({ text }: { text: string }) => {
  if (!text) return null;

  // Split on $...$ (inline) and $$...$$ (block) delimiters
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g);

  return (
    <span>
      {parts.map((part, i) => {
        // Block math: $$...$$
        if (part.startsWith("$$") && part.endsWith("$$")) {
          const tex = part.slice(2, -2).trim();
          try {
            const html = katex.renderToString(tex, { displayMode: true, throwOnError: false });
            return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch {
            return <span key={i}>{part}</span>;
          }
        }
        // Inline math: $...$
        if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
          const tex = part.slice(1, -1).trim();
          try {
            const html = katex.renderToString(tex, { displayMode: false, throwOnError: false });
            return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch {
            return <span key={i}>{part}</span>;
          }
        }
        // Regular text — also handle \( \) and \[ \] delimiters
        let processed = part;
        // \[...\] block math
        processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_, tex) => {
          try { return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false }); }
          catch { return _; }
        });
        // \(...\) inline math
        processed = processed.replace(/\\\(([\s\S]+?)\\\)/g, (_, tex) => {
          try { return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false }); }
          catch { return _; }
        });
        if (processed !== part) {
          return <span key={i} dangerouslySetInnerHTML={{ __html: processed }} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

// ==================== TYPES ====================
interface ContestQuestion {
  id: string;
  questionNumber: number;
  questionText: string;
  options: { label: string; text: string }[];   // A, B, C, D
  marks: number;
  difficulty: "Easy" | "Medium" | "Hard";
  type: "MCQ" | "Short" | "Long";
  explanation?: string;
}

interface ContestConfig {
  contestId: string;
  attemptId: string;
  title: string;
  subject: string;
  classGrade: string;
  totalMarks: number;
  totalQuestions: number;
  durationMinutes: number;
  teacherName: string;
  instituteName?: string;
  logoBase64?: string;
  showInstantAnswers: boolean;     // answers on each click
  showAnswersAfterTest: boolean;   // answers after completion
  showNoAnswers: boolean;          // no answers at all
  showExplanation: boolean;
  allowBackNavigation: boolean;
  enableCamera: boolean;
  enableTabDetection: boolean;
  maxWarnings: number;
  questions: ContestQuestion[];
  // ── from /start on the newer backend (all optional) ──
  startedAt?: string | null;
  deadlineAt?: string | null;
  serverNow?: string | null;
  /** Date.now() when the /start response arrived (pairs with serverNow for clock skew) */
  receivedAt?: number;
  progress?: Partial<AttemptProgress> | null;
  snapshotsEnabled?: boolean;
  /** camera stream already opened (and allowed) in the lobby */
  cameraStream?: MediaStream | null;
  /** this attempt replaces one that ended on a technical issue (backend: retry_of) */
  retryOf?: string | null;
  /** answer_mode teacher_release: no score / answers until the teacher publishes */
  resultsByTeacher?: boolean;
}

interface StudentAnswer {
  questionId: string;
  selectedOption: string | null;    // "A", "B", "C", "D" or null
  textAnswer?: string;              // for Short/Long type
  timeSpent: number;                // seconds on this question
  flagged: boolean;
}

// ==================== CONSTANTS ====================
const MAX_WARNINGS = 5;             // fallback only — the contest's own max_warnings wins
const AUTOSAVE_INTERVAL = 15000;    // PUT progress every 15 s (plus 2 s after a change)
const SNAPSHOT_INTERVAL = 60000;
const SNAPSHOT_BUCKET = "contest-snapshots";
const SNAPSHOTS_BUILD_FLAG = import.meta.env.VITE_CONTEST_SNAPSHOTS === "1";
const TEXT_SCALES = [0.9, 1, 1.15];
const TEXT_SCALE_KEY = "a4_contest_text_scale";
const NAVY = CONTEST_NAVY;
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1F3A68]";
const CAMERA_CONSTRAINTS: MediaStreamConstraints = { video: { width: 320, height: 240, facingMode: "user" }, audio: false };

// ==================== PROCTORING: CAMERA FEED ====================
const CameraFeed = React.memo(function CameraFeed({
  stream,
  recording,
}: {
  /** null = camera off / lost */
  stream: MediaStream | null;
  /** snapshots are really being taken → "REC", else "Camera on" */
  recording: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // display only: never getUserMedia / stop() here — the attempt page owns the one stream.
  // srcObject is set only when the stream object changes, so answering / navigating never restarts the video.
  useEffect(() => {
    const v = videoRef.current;
    if (v && v.srcObject !== stream) v.srcObject = stream;
  }, [stream]);

  const isActive = !!stream;
  return (
    <div className="relative shrink-0" data-testid="camera-feed">
      <div className={`w-[56px] h-[42px] md:w-[96px] md:h-[72px] rounded-lg overflow-hidden border-2 bg-gray-900 ${isActive ? "border-emerald-400" : "border-red-400"}`}>
        <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover ${isActive ? "" : "hidden"}`} style={{ transform: "scaleX(-1)" }} />
        {!isActive && <div className="w-full h-full flex items-center justify-center"><CameraOff size={16} className="text-red-300" /></div>}
      </div>
      {isActive && (
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] md:text-[9px] font-bold text-white bg-black/80 px-1 rounded">
          {recording ? "● REC" : "Camera on"}
        </span>
      )}
    </div>
  );
});

// ==================== LIVE COUNTERS ====================
const AttemptCounters = ({ attempted, flagged, left, dark = false }: { attempted: number; flagged: number; left: number; dark?: boolean }) => (
  <p className={`text-xs md:text-[13px] font-semibold tabular-nums ${dark ? "text-white" : "text-gray-800"}`} aria-live="polite" data-testid="attempt-counters">
    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden />Attempted {attempted}</span>
    <span className={dark ? "text-blue-200" : "text-gray-600"}> · </span>
    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden />Flagged {flagged}</span>
    <span className={dark ? "text-blue-200" : "text-gray-600"}> · </span>
    <span className="inline-flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${dark ? "bg-gray-300" : "bg-gray-400"}`} aria-hidden />Left {left}</span>
  </p>
);

const PaletteLegend = () => (
  <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-700">
    <span className="inline-flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-emerald-700" />Answered</span>
    <span className="inline-flex items-center gap-1.5"><span className="relative w-4 h-4 rounded bg-amber-100 border border-amber-500"><span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500" /></span>Flagged</span>
    <span className="inline-flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-gray-100 border border-gray-300" />Not answered</span>
    <span className="inline-flex items-center gap-1.5"><span className="w-4 h-4 rounded" style={{ background: NAVY }} />Current</span>
  </div>
);

const TextSizeControl = ({ step, onChange }: { step: number; onChange: (s: number) => void }) => (
  <div role="group" aria-label="Text size" className="inline-flex rounded-md overflow-hidden border border-white/40">
    {["A-", "A", "A+"].map((l, i) => (
      <button key={l} onClick={() => onChange(i)} aria-pressed={step === i} aria-label={["Smaller text", "Normal text", "Larger text"][i]}
        className={`px-2.5 min-h-[32px] text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${step === i ? "bg-white text-[#1F3A68]" : "text-white"}`}>
        {l}
      </button>
    ))}
  </div>
);

// ==================== WARNING MODAL ====================
const WarningModal = ({
  warningCount,
  maxWarnings,
  onAcknowledge,
  reason,
}: {
  warningCount: number;
  maxWarnings: number;
  onAcknowledge: () => void;
  reason: string;
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
  >
    <motion.div
      initial={{ scale: 0.8, y: 30 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.8, y: 30 }}
      className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center"
    >
      <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
        <AlertTriangle size={32} className="text-red-500" />
      </div>

      <h3 className="text-xl font-extrabold text-gray-900 mb-2">
        Warning {warningCount}/{maxWarnings}
      </h3>

      <p className="text-sm text-gray-500 mb-2">{reason}</p>

      <p className="text-sm text-gray-600 mb-6">
        {warningCount >= maxWarnings - 1
          ? "Next violation will auto-submit your test."
          : `You have ${maxWarnings - warningCount} warning(s) remaining.`}
      </p>

      {/* Warning dots */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {Array.from({ length: maxWarnings }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-all ${
              i < warningCount ? "bg-red-500 scale-110" : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      <button
        onClick={onAcknowledge}
        className="w-full py-3.5 bg-gray-900 text-white font-bold text-sm rounded-2xl hover:bg-gray-800 transition-colors"
      >
        I Understand, Continue Test
      </button>
    </motion.div>
  </motion.div>
);

// ==================== SUBMIT CONFIRMATION MODAL ====================
const SubmitModal = ({
  onConfirm,
  onCancel,
  answeredCount,
  totalCount,
  flaggedCount,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  answeredCount: number;
  totalCount: number;
  flaggedCount: number;
}) => {
  const left = totalCount - answeredCount;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="submit-title"
      style={{ fontFamily: CONTEST_FONT_STACK }}>
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="px-6 py-4 text-white" style={{ background: NAVY }}>
          <h3 id="submit-title" className="text-lg font-bold">Submit test?</h3>
        </div>
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 py-3"><p className="text-xl font-bold text-emerald-800 tabular-nums">{answeredCount}</p><p className="text-[11px] font-semibold text-emerald-900">Attempted</p></div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 py-3"><p className="text-xl font-bold text-amber-800 tabular-nums">{flaggedCount}</p><p className="text-[11px] font-semibold text-amber-900">Flagged</p></div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 py-3"><p className="text-xl font-bold text-gray-800 tabular-nums">{left}</p><p className="text-[11px] font-semibold text-gray-700">Left</p></div>
          </div>
          {left > 0 ? (
            <p className="text-sm font-semibold text-red-700 text-center">You have {left} unanswered question{left === 1 ? "" : "s"}.</p>
          ) : (
            <p className="text-sm text-gray-700 text-center">All {totalCount} questions attempted.</p>
          )}
          <p className="text-xs text-gray-600 text-center">You can't change answers after submitting.</p>
          <div className="flex gap-3 pt-2">
            <button onClick={onCancel} className={`flex-1 min-h-[48px] rounded-lg border-2 border-gray-300 text-gray-800 font-bold text-sm ${FOCUS}`}>Go back</button>
            <button onClick={onConfirm} className={`flex-1 min-h-[48px] rounded-lg text-white font-bold text-sm inline-flex items-center justify-center gap-2 ${FOCUS}`} style={{ background: NAVY }}>
              <Send size={16} /> Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== TIMER ====================
const ContestTimer = ({
  totalSeconds,
  deadline,
  onTimeUp,
}: {
  totalSeconds: number;
  /** ms epoch on this device's clock */
  deadline: number;
  onTimeUp: () => void;
}) => {
  const [remaining, setRemaining] = useState(() => secondsLeft(deadline));
  const firedRef = useRef(false);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    const tick = () => {
      const left = secondsLeft(deadline);
      setRemaining(left);
      if (left <= 0 && !firedRef.current) { firedRef.current = true; onTimeUpRef.current(); }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isLow = remaining < 300; // < 5 min
  void totalSeconds;

  return (
    <div
      data-testid="timer"
      role="timer"
      aria-label={`Time left ${minutes} minutes ${seconds} seconds`}
      className={`flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg font-bold tabular-nums ${isLow ? "bg-red-600 text-white" : "bg-white/10 text-white"}`}
    >
      <Clock size={16} aria-hidden />
      <span className="text-base md:text-lg tracking-wide">
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </span>
    </div>
  );
};

// ==================== QUESTION CARD (MCQ) ====================
const QuestionCard = ({
  question,
  answer,
  onSelectOption,
  onToggleFlag,
  onTextAnswer,
  showInstantAnswer,
  scale = 1,
}: {
  question: ContestQuestion;
  answer: StudentAnswer;
  onSelectOption: (optionLabel: string) => void;
  onToggleFlag: () => void;
  onTextAnswer?: (text: string) => void;
  showInstantAnswer: boolean;
  scale?: number;
}) => {
  void showInstantAnswer;
  // the previous card stays on screen while it animates out — a fast tap must not change ITS answer
  const present = useIsPresent();
  const typeLabel = question.type === "MCQ" ? "Single Choice" : question.type === "Short" ? "Short Answer" : "Long Answer";
  const optionLetters = ["A", "B", "C", "D"];

  return (
    <motion.div
      key={question.id}
      style={present ? undefined : { pointerEvents: "none" }}
      aria-hidden={!present}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      className="w-full"
    >
      {/* header strip: Q. 12 · Single Choice · 1 mark */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 pb-3 mb-4">
        <p className="text-sm md:text-[15px] text-gray-800">
          <span className="font-bold" style={{ color: NAVY }}>Q. {question.questionNumber}</span>
          <span className="text-gray-500"> · </span>{typeLabel}
          <span className="text-gray-500"> · </span>{question.marks} mark{question.marks > 1 ? "s" : ""}
        </p>
        <button
          onClick={onToggleFlag}
          aria-pressed={answer.flagged}
          className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border text-xs font-bold ${FOCUS} ${
            answer.flagged ? "bg-amber-100 border-amber-500 text-amber-900" : "bg-white border-gray-300 text-gray-700"
          }`}
        >
          <Flag size={14} fill={answer.flagged ? "currentColor" : "none"} /> {answer.flagged ? "Flagged" : "Flag for review"}
        </button>
      </div>

      {/* question text: 17px phone / 18px desktop × text size, 1.6, 500, #111 */}
      <div className="[--q-base:17px] md:[--q-base:18px]">
        <p style={{ fontSize: `calc(var(--q-base) * ${scale})`, lineHeight: 1.6, fontWeight: 500, color: "#111" }}>
          <MathText text={question.questionText} />
        </p>
      </div>

      {question.type === "MCQ" && (
        <div role="radiogroup" aria-label={`Options for question ${question.questionNumber}`} className="mt-5 space-y-3">
          {question.options.map((opt, idx) => {
            const isSelected = answer.selectedOption === opt.label;
            return (
              <button
                key={opt.label}
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelectOption(opt.label)}
                className={`w-full min-h-[48px] flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left ${FOCUS} ${
                  isSelected ? "border-[#1F3A68] bg-[#E8F0FE]" : "border-gray-300 bg-white hover:border-gray-500"
                }`}
              >
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? "border-[#1F3A68]" : "border-gray-500"}`} aria-hidden>
                  {isSelected && <span className="w-2.5 h-2.5 rounded-full" style={{ background: NAVY }} />}
                </span>
                <span className="font-bold text-gray-900 w-5 shrink-0">{optionLetters[idx]}</span>
                <span className="flex-1" style={{ fontSize: `${16 * scale}px`, lineHeight: 1.5, color: "#111" }}>
                  <MathText text={opt.text} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {(question.type === "Short" || question.type === "Long") && (
        <textarea
          value={answer.textAnswer || ""}
          onChange={(e) => onTextAnswer?.(e.target.value)}
          aria-label="Your answer"
          placeholder={question.type === "Short" ? "Write your answer in 2-3 sentences..." : "Write your detailed answer here..."}
          rows={question.type === "Short" ? 4 : 8}
          style={{ fontSize: `${16 * scale}px` }}
          className={`mt-5 w-full p-4 rounded-lg border-2 border-gray-300 focus:border-[#1F3A68] outline-none text-gray-900 placeholder:text-gray-500 resize-none ${FOCUS}`}
        />
      )}
    </motion.div>
  );
};

// ==================== QUESTION NAV GRID (SIDEBAR / BOTTOM) ====================
const QuestionNav = ({
  questions,
  answers,
  currentIndex,
  onNavigate,
}: {
  questions: ContestQuestion[];
  answers: StudentAnswer[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}) => (
  <div className="grid grid-cols-6 md:grid-cols-5 gap-2">
    {questions.map((q, idx) => {
      const ans = answers[idx];
      const isCurrent = idx === currentIndex;
      const isAnswered = !!ans?.selectedOption || !!ans?.textAnswer?.trim();
      const isFlagged = !!ans?.flagged;
      const state = isAnswered ? "answered" : isFlagged ? "flagged" : "not answered";
      return (
        <button
          key={q.id}
          onClick={() => onNavigate(idx)}
          aria-label={`Question ${idx + 1}, ${state}${isAnswered && isFlagged ? ", flagged" : ""}${isCurrent ? ", current" : ""}`}
          aria-current={isCurrent ? "step" : undefined}
          className={`relative h-10 rounded-md text-xs font-bold ${FOCUS} ${
            isCurrent
              ? "text-white ring-2 ring-offset-1 ring-[#1F3A68]"
              : isAnswered
              ? "bg-emerald-700 text-white"
              : isFlagged
              ? "bg-amber-100 text-amber-900 border border-amber-500"
              : "bg-gray-100 text-gray-700 border border-gray-300"
          }`}
          style={isCurrent ? { background: NAVY } : undefined}
        >
          {idx + 1}
          {isFlagged && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border border-white" aria-hidden />}
        </button>
      );
    })}
  </div>
);

// ==================== MAIN CONTEST PAGE ====================
export const ContestAttemptPage = ({
  config,
}: {
  config: ContestConfig;
}) => {
  const { questions } = config;

  const maxWarnings = config.maxWarnings > 0 ? config.maxWarnings : MAX_WARNINGS;
  const durationSec = config.durationMinutes * 60;

  // ── Restore once: this device's copy merged with the server's (resumed attempt); deadline from the server ──
  const [boot] = useState(() => {
    const local = loadLocal(config.attemptId);
    const merged = mergeProgress(local, config.progress ?? null);
    const localDeadline = local?.local_deadline ?? Date.now() + durationSec * 1000;
    const serverDeadline = clientDeadline(config.deadlineAt, config.serverNow, config.receivedAt ?? Date.now());
    return { merged, localDeadline, deadline: serverDeadline ?? localDeadline };
  });
  const deadline = boot.deadline;

  // ── State ──
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.min(Math.max(0, boot.merged?.current_index ?? 0), Math.max(0, questions.length - 1)));
  const [answers, setAnswers] = useState<StudentAnswer[]>(() =>
    answersFor(questions.map((q) => q.id), boot.merged?.answers).map((a) => ({
      questionId: a.questionId, selectedOption: a.selected, textAnswer: a.textAnswer, timeSpent: a.timeSpent, flagged: a.flagged,
    })));
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [camStream, setCamStream] = useState<MediaStream | null>(config.enableCamera ? config.cameraStream ?? null : null);
  const [cameraLost, setCameraLost] = useState(false);
  const [warningCount, setWarningCount] = useState(boot.merged?.warning_count ?? 0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningReason, setWarningReason] = useState("");
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<"idle" | "submitting" | "failed">("idle");
  const [submitTry, setSubmitTry] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState | "local">("saved");
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [showAnswersView, setShowAnswersView] = useState(false);
  const questionTimerRef = useRef<number>(0);
  const isSubmitting = submitPhase === "submitting";

  // Latest values for event handlers / timers (no stale closures)
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const warningCountRef = useRef(warningCount);
  const warningLogRef = useRef<WarningEntry[]>(boot.merged?.warning_log ?? []);
  const submittingRef = useRef(false);   // single flight: timer + warnings + button
  const submittedRef = useRef(false);
  const camStreamRef = useRef(camStream);
  camStreamRef.current = camStream;
  const syncRef = useRef<ReturnType<typeof createProgressSync> | null>(null);
  /** the page is being refreshed / closed: its "hidden" is not a tab switch (the attempt resumes from the lobby) */
  const unloadingRef = useRef(false);
  const markUnloading = () => {
    unloadingRef.current = true;
    setTimeout(() => { unloadingRef.current = false; }, 3000);   // the student cancelled "Leave page?"
  };
  const progressUnsupported = useRef(false);   // old backend: no PUT progress → local copy only

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentIndex];

  const snapshot = (): AttemptProgress => ({
    answers: answersRef.current.map((a) => ({
      questionId: a.questionId, selected: a.selectedOption, textAnswer: a.textAnswer, timeSpent: a.timeSpent, flagged: a.flagged,
    })),
    current_index: currentIndexRef.current,
    warning_count: warningCountRef.current,
    warning_log: warningLogRef.current,
  });
  const persistLocal = () =>
    saveLocal(config.attemptId, { ...snapshot(), updated_at: Date.now(), local_deadline: boot.localDeadline });

  // ── Done: only when the server confirmed (submit, repeat submit, or a finalized progress save) ──
  const finishSubmitted = (result: Partial<SubmitResponse> | null) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    syncRef.current?.stop();
    clearLocal(config.attemptId);
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    setSubmitResult(result && (result.score !== undefined || result.questions_with_answers) ? result : null);
    setShowWarning(false);
    setShowSubmitModal(false);
    setSubmitPhase("idle");
    setIsSubmitted(true);
  };

  // ── Save time spent on the current question (synchronous, so submit sends it) ──
  const saveQuestionTime = useCallback(() => {
    const add = questionTimerRef.current;
    questionTimerRef.current = 0;
    if (!add) return;
    const idx = currentIndexRef.current;
    const next = answersRef.current.map((a, i) => (i === idx ? { ...a, timeSpent: a.timeSpent + add } : a));
    answersRef.current = next;
    setAnswers(next);
  }, []);

  // ── Submit: retried with backoff; the attempt stays open until the server answers ──
  const isAlreadySubmitted = (e: unknown) =>
    e instanceof ContestApiError && (e.code === "ALREADY_SUBMITTED" || e.status === 409 || /already submitted/i.test(e.message));
  const handleSubmit = async () => {
    if (submittedRef.current || submittingRef.current) return;
    submittingRef.current = true;
    saveQuestionTime();
    setShowSubmitModal(false);
    setShowWarning(false);
    setSubmitError(null);
    setSubmitTry(0);
    setSubmitPhase("submitting");
    persistLocal();
    const p = snapshot();
    const payload = {
      answers: p.answers.map((a) => ({ questionId: a.questionId, selected: a.selected, textAnswer: a.textAnswer, timeSpent: a.timeSpent, flagged: a.flagged })),
      warning_count: p.warning_count,
      warning_log: p.warning_log,
      time_taken_seconds: Math.min(durationSec, Math.max(0, durationSec - secondsLeft(deadline))),
    };
    try {
      const result = await submitWithRetry(() => contestApi.submitAttempt(config.contestId, config.attemptId, payload), {
        // a retry can't fix these; 401 is retried (the session refreshes itself)
        isFinal: (e) => isAlreadySubmitted(e) || (e instanceof ContestApiError && [400, 403, 404, 410, 422].includes(e.status)),
        onRetry: (n) => setSubmitTry(n),
      });
      finishSubmitted(result);
    } catch (e: any) {
      if (isAlreadySubmitted(e)) finishSubmitted(e.body?.result ?? e.body ?? null);
      else {
        console.error("Submit failed:", e);
        setSubmitError(e instanceof ContestApiError && e.status !== 401 ? e.message : null);
        setSubmitPhase("failed");   // never "submitted" on failure — answers stay on this device
      }
    } finally {
      submittingRef.current = false;
    }
  };
  const submitRef = useRef(handleSubmit);
  submitRef.current = handleSubmit;

  // ── Warnings (one per away episode / camera loss) ──
  const addWarning = (type: WarningType, reason: string, detail?: string) => {
    if (submittedRef.current || submittingRef.current) return;
    const n = warningCountRef.current + 1;
    warningCountRef.current = n;
    warningLogRef.current = [...warningLogRef.current, { type, at: new Date().toISOString(), ...(detail ? { detail } : {}) }];
    setWarningCount(n);
    setWarningReason(reason);
    persistLocal();
    syncRef.current?.changed();
    if (n >= maxWarnings) submitRef.current();   // auto-submit with the LATEST answers
    else setShowWarning(true);
  };
  const addWarningRef = useRef(addWarning);
  addWarningRef.current = addWarning;
  const trackerRef = useRef(createAwayTracker((type) =>
    addWarningRef.current(type, type === "tab_hidden" ? "You left the test page (another app or tab)." : "The test window lost focus. Do not switch windows.")));

  // ── Local copy on every change + server sync ──
  useEffect(() => {
    if (submittedRef.current) return;
    persistLocal();
    syncRef.current?.changed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, currentIndex, warningCount]);

  useEffect(() => {
    const sync = createProgressSync({
      snapshot,
      intervalMs: AUTOSAVE_INTERVAL,
      send: async (p, keepalive) => {
        if (progressUnsupported.current) return null;
        try {
          return await contestApi.saveProgress(config.contestId, config.attemptId, p, keepalive);
        } catch (e) {
          if (e instanceof ContestApiError && (e.status === 404 || e.status === 405)) { progressUnsupported.current = true; return null; }
          if (isAlreadySubmitted(e)) return { finalized: true };
          throw e;
        }
      },
      onState: (st) => setSyncState(st === "saved" && progressUnsupported.current ? "local" : st),
      onResult: (res: any) => { if (res?.finalized) finishSubmitted(res); },
    });
    syncRef.current = sync;
    sync.changed();
    return () => sync.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Anti-cheat: tab / window switching → one warning per away episode ──
  useEffect(() => {
    const t = trackerRef.current;
    const onVisibility = () => {
      if (document.hidden) {
        persistLocal();
        syncRef.current?.flush();   // keepalive: the page may not come back
        if (config.enableTabDetection && !unloadingRef.current) t.hidden();
      } else {
        t.back();
      }
    };
    const onBlur = () => {
      if (!config.enableTabDetection) return;
      // focus moved into an iframe of our own page (or never really left): not a switch
      setTimeout(() => {
        if (unloadingRef.current || document.hasFocus() || document.activeElement?.tagName === "IFRAME") return;
        t.blur();
      }, 0);
    };
    const onFocus = () => t.back();
    const onFullscreen = () => t.suppress();
    const onPageHide = () => { markUnloading(); persistLocal(); syncRef.current?.flush(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFullscreen);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFullscreen);
      window.removeEventListener("pagehide", onPageHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.enableTabDetection]);

  // ── While attempting: no reloads, no pull-to-refresh, confirm before leaving ──
  useEffect(() => {
    if (isSubmitted) return;
    setContestActive(true);
    const html = document.documentElement, body = document.body;
    const prev = [html.style.overscrollBehaviorY, body.style.overscrollBehaviorY];
    html.style.overscrollBehaviorY = "contain";
    body.style.overscrollBehaviorY = "contain";
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      markUnloading();
      persistLocal();
      syncRef.current?.flush();
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      setContestActive(false);
      html.style.overscrollBehaviorY = prev[0];
      body.style.overscrollBehaviorY = prev[1];
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubmitted]);

  // a failed submit tries again as soon as the network is back
  useEffect(() => {
    if (submitPhase !== "failed") return;
    const onOnline = () => submitRef.current();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [submitPhase]);

  // ── Camera: one stream for every preview; a lost camera blocks the test and counts one warning ──
  const requestCamera = useCallback(async () => {
    trackerRef.current.suppress(120000);   // the permission prompt takes focus — not a switch
    try {
      const s = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      setCamStream(s);
      setCameraLost(false);
      setCameraError(null);
    } catch {
      setCameraLost(true);
      setCameraError("Camera access is blocked. Allow the camera for this site in your browser settings, then tap “Turn camera on”.");
    } finally {
      trackerRef.current.suppress(1500);
    }
  }, []);

  const askedCamera = useRef(false);
  useEffect(() => {
    if (config.enableCamera && !camStreamRef.current && !askedCamera.current) { askedCamera.current = true; requestCamera(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const track = camStream?.getVideoTracks()[0];
    if (!track) return;
    const onEnded = () => {
      if (submittedRef.current) return;
      setCamStream(null);
      setCameraLost(true);
      addWarningRef.current("camera_lost", "Your camera turned off. Keep it on for the whole test.");
    };
    if (track.readyState === "ended") { onEnded(); return; }
    track.addEventListener("ended", onEnded);
    return () => track.removeEventListener("ended", onEnded);
  }, [camStream]);

  // stop the camera only on a real unmount (StrictMode's test unmount/remount must not kill the lobby's stream)
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      setTimeout(() => { if (!mountedRef.current) camStreamRef.current?.getTracks().forEach((t) => t.stop()); }, 0);
    };
  }, []);

  // ── P1 snapshots: VITE_CONTEST_SNAPSHOTS=1 AND the backend allows it; 320×240 JPEG every 60 s ──
  const snapshotsOn = SNAPSHOTS_BUILD_FLAG && !!config.snapshotsEnabled && config.enableCamera;
  useEffect(() => {
    if (!snapshotsOn || !camStream || isSubmitted) return;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = camStream;
    video.play().catch(() => {});
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const shoot = async () => {
      try {
        canvas.getContext("2d")?.drawImage(video, 0, 0, 320, 240);
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.6));
        if (!blob) return;
        const path = `${config.contestId}/${config.attemptId}/${Date.now()}.jpg`;
        const { error } = await supabase.storage.from(SNAPSHOT_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
        if (!error) await contestApi.postSnapshot(config.contestId, config.attemptId, path);
      } catch { /* snapshots are best effort */ }
    };
    const t = setInterval(shoot, SNAPSHOT_INTERVAL);
    return () => { clearInterval(t); video.srcObject = null; };
  }, [snapshotsOn, camStream, isSubmitted, config.contestId, config.attemptId]);

  // ── Anti-cheat: Right-click + copy disabled ──
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+C, Ctrl+V, Ctrl+U, F12
      if (
        (e.ctrlKey && ["c", "v", "u"].includes(e.key.toLowerCase())) ||
        e.key === "F12"
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // ── Track time per question ──
  useEffect(() => {
    const interval = setInterval(() => {
      questionTimerRef.current += 1;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Navigation ──
  const goToQuestion = useCallback(
    (index: number) => {
      if (index < 0 || index >= questions.length) return;
      saveQuestionTime();
      setCurrentIndex(index);
    },
    [questions.length, saveQuestionTime]
  );

  const goNext = useCallback(() => goToQuestion(currentIndex + 1), [currentIndex, goToQuestion]);
  const goPrev = useCallback(() => goToQuestion(currentIndex - 1), [currentIndex, goToQuestion]);

  // ── Answer handlers ──
  const selectOption = useCallback(
    (optionLabel: string) => {
      setAnswers((prev) => {
        const updated = [...prev];
        updated[currentIndex] = {
          ...updated[currentIndex],
          selectedOption:
            updated[currentIndex].selectedOption === optionLabel ? null : optionLabel,
        };
        return updated;
      });
    },
    [currentIndex]
  );

  const toggleFlag = useCallback(() => {
    setAnswers((prev) => {
      const updated = [...prev];
      updated[currentIndex] = {
        ...updated[currentIndex],
        flagged: !updated[currentIndex].flagged,
      };
      return updated;
    });
  }, [currentIndex]);

  const setTextAnswer = useCallback(
    (text: string) => {
      setAnswers((prev) => {
        const updated = [...prev];
        updated[currentIndex] = { ...updated[currentIndex], textAnswer: text };
        return updated;
      });
    },
    [currentIndex]
  );

  const handleTimeUp = useCallback(() => {
    submitRef.current();
  }, []);

  // ── Exam look: font, text size (remembered), keyboard ──
  useContestFont();
  const [textStep, setTextStep] = useState(() => {
    try {
      const v = localStorage.getItem(TEXT_SCALE_KEY);
      return v === "0" || v === "1" || v === "2" ? Number(v) : 1;
    } catch { return 1; }
  });
  useEffect(() => {
    try { localStorage.setItem(TEXT_SCALE_KEY, String(textStep)); } catch { /* ignore */ }
  }, [textStep]);
  const textScale = TEXT_SCALES[textStep] ?? 1;

  // 1–4 picks an option, ←/→ moves (desktop); never while typing or a dialog is open
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandlerRef.current = (e: KeyboardEvent) => {
    if (isSubmitted || showSubmitModal || showWarning || submitPhase !== "idle" || cameraLost) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable)) return;
    if (/^[1-4]$/.test(e.key) && currentQuestion?.type === "MCQ") {
      const opt = currentQuestion.options[Number(e.key) - 1];
      if (opt) { e.preventDefault(); selectOption(opt.label); }
      return;
    }
    const desktop = typeof window.matchMedia === "function" && window.matchMedia("(min-width: 768px)").matches;
    if (!desktop) return;
    if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ── Stats ──
  const answeredCount = useMemo(
    () => answers.filter((a) => a.selectedOption || a.textAnswer).length,
    [answers]
  );
  const flaggedCount = useMemo(
    () => answers.filter((a) => a.flagged).length,
    [answers]
  );

  // ════════════════════════════════════════════════════════════════════
  // SUBMITTED STATE
  // ════════════════════════════════════════════════════════════════════
  if (isSubmitted) {
    const score = submitResult?.score ?? 0;
    const totalMarks = submitResult?.total_marks ?? config.totalMarks;
    const percentage = submitResult?.percentage ?? 0;
    const questionsWithAnswers = submitResult?.questions_with_answers || [];

    // ── ANSWERS VIEW ──
    if (showAnswersView && questionsWithAnswers.length > 0) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
          {/* Top bar */}
          <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-200 px-4 md:px-8 py-4">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div>
                <h1 className="text-sm font-extrabold text-gray-900">{config.title} — Answer Key</h1>
                <p className="text-[10px] text-gray-600">Score: {score}/{totalMarks} ({percentage}%)</p>
              </div>
              <button
                onClick={() => setShowAnswersView(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-200 transition-colors"
              >
                Back to Summary
              </button>
            </div>
          </div>

          {/* Questions list */}
          <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6 pb-20">
            {questionsWithAnswers.map((q: any, idx: number) => {
              const studentAnswer = answers[idx];
              const studentSelected = studentAnswer?.selectedOption || null;
              const isCorrect = studentSelected && studentSelected.toUpperCase() === (q.correct_answer || "").toUpperCase();
              const opts = q.options || [];

              return (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 md:p-8"
                >
                  {/* Question header */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs font-extrabold text-white bg-gray-900 px-3 py-1.5 rounded-xl">
                      Q{q.question_number || idx + 1}
                    </span>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase ${
                      isCorrect
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        : studentSelected
                        ? "bg-red-50 text-red-600 border border-red-200"
                        : "bg-gray-50 text-gray-600 border border-gray-200"
                    }`}>
                      {isCorrect ? "Correct" : studentSelected ? "Wrong" : "Skipped"}
                    </span>
                    <span className="text-[10px] font-bold text-gray-600 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200">
                      {q.marks} mark{q.marks > 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Question text */}
                  <p className="text-sm md:text-base font-semibold text-gray-900 mb-5 leading-relaxed">
                    <MathText text={q.question_text} />
                  </p>

                  {/* Options */}
                  {opts.length > 0 && (
                    <div className="space-y-2.5 mb-5">
                      {opts.map((opt: any, optIdx: number) => {
                        const optLabel = typeof opt === "string" ? ["A","B","C","D"][optIdx] : (opt.label || ["A","B","C","D"][optIdx]);
                        const optText = typeof opt === "string" ? opt.replace(/^[A-D]\)\s*/i, "") : (opt.text || opt);
                        const isThisCorrect = optLabel.toUpperCase() === (q.correct_answer || "").toUpperCase();
                        const isThisSelected = studentSelected && optLabel.toUpperCase() === studentSelected.toUpperCase();

                        return (
                          <div
                            key={optIdx}
                            className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all ${
                              isThisCorrect
                                ? "border-emerald-400 bg-emerald-50"
                                : isThisSelected && !isThisCorrect
                                ? "border-red-300 bg-red-50"
                                : "border-gray-100 bg-gray-50"
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                              isThisCorrect
                                ? "bg-emerald-500 text-white"
                                : isThisSelected && !isThisCorrect
                                ? "bg-red-400 text-white"
                                : "bg-gray-200 text-gray-500"
                            }`}>
                              {isThisCorrect ? "✓" : isThisSelected && !isThisCorrect ? "✗" : optLabel}
                            </div>
                            <span className={`text-sm font-medium ${
                              isThisCorrect ? "text-emerald-800" : isThisSelected && !isThisCorrect ? "text-red-700" : "text-gray-600"
                            }`}>
                              <MathText text={String(optText)} />
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Correct answer label */}
                  {q.correct_answer && (
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span className="text-xs font-bold text-emerald-600">
                        Correct Answer: {q.correct_answer}
                      </span>
                    </div>
                  )}

                  {/* Explanation */}
                  {q.explanation && (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen size={14} className="text-blue-600" />
                        <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Explanation</span>
                      </div>
                      <p className="text-sm text-blue-800 leading-relaxed"><MathText text={q.explanation} /></p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      );
    }

    // ── RESULT SUMMARY VIEW ──
    const leftCount = questions.length - answeredCount;
    const hideScore = !!config.resultsByTeacher;
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex items-start sm:items-center justify-center p-4" style={{ fontFamily: CONTEST_FONT_STACK }}>
        <div className="bg-white rounded-xl max-w-lg w-full shadow-lg overflow-hidden text-center">
          <div className="px-6 py-4 text-white text-left" style={{ background: NAVY }}>
            <p className="text-sm font-bold truncate">{config.title}</p>
            <p className="text-xs text-blue-100">{config.subject} · {config.classGrade}</p>
          </div>
          <div className="p-6 md:p-8">
            <CheckCircle2 size={44} className="text-emerald-600 mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Test submitted</h2>
            <p className="text-gray-700 text-sm mb-6">Your answers have been recorded.</p>

            {submitResult && !hideScore && (
              <div className="rounded-xl p-5 mb-6 text-white" style={{ background: NAVY }}>
                <p className="text-4xl font-bold tabular-nums">{score}<span className="text-lg text-blue-100">/{totalMarks}</span></p>
                <p className="text-sm text-blue-100 mt-1">Your score · {percentage}%</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 py-3"><p className="text-xl font-bold text-emerald-800 tabular-nums">{answeredCount}</p><p className="text-[11px] font-semibold text-emerald-900">Attempted</p></div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 py-3"><p className="text-xl font-bold text-amber-800 tabular-nums">{flaggedCount}</p><p className="text-[11px] font-semibold text-amber-900">Flagged</p></div>
              <div className="rounded-lg bg-gray-50 border border-gray-200 py-3"><p className="text-xl font-bold text-gray-800 tabular-nums">{leftCount}</p><p className="text-[11px] font-semibold text-gray-700">Left</p></div>
            </div>
            {config.enableTabDetection && (
              <p className="text-xs text-gray-700 mb-6">Tab switches: {warningCount}/{maxWarnings}</p>
            )}

            {hideScore ? (
              <p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">Your teacher will publish the results.</p>
            ) : (
              <>
                {config.showAnswersAfterTest && questionsWithAnswers.length > 0 && (
                  <button
                    onClick={() => setShowAnswersView(true)}
                    className={`w-full min-h-[48px] text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 ${FOCUS}`}
                    style={{ background: NAVY }}
                  >
                    <BookOpen size={16} />
                    View Answers & Explanations
                  </button>
                )}
                {config.showNoAnswers && (
                  <p className="text-xs text-gray-600 mt-4">Results will be shared by your teacher.</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // MAIN QUIZ UI
  // ════════════════════════════════════════════════════════════════════
  const leftCount = questions.length - answeredCount;
  const syncText = syncState === "saving" ? "Saving…" : syncState === "offline" ? "Offline – answers kept on this device" : syncState === "local" ? "Saved on this device ✓" : "Saved ✓";
  return (
    <div
      className="min-h-screen bg-[#F4F6FA] select-none"
      style={{ fontFamily: CONTEST_FONT_STACK }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* ── TOP BAR (navy): title · camera · timer · Submit ── */}
      <header className="sticky top-0 z-50 text-white shadow-md" style={{ background: NAVY }}>
        <div className="max-w-7xl mx-auto px-3 md:px-6 py-2 flex items-center gap-2 md:gap-4">
          {config.logoBase64 && <img src={config.logoBase64} alt="" className="w-8 h-8 rounded object-cover bg-white" />}
          <div className="min-w-0 flex-1">
            <h1 className="text-sm md:text-base font-bold leading-tight truncate">{config.title || "Test Paper"}</h1>
            <p className="text-[11px] text-blue-100 truncate">
              <span className="hidden sm:inline">{config.subject} · {config.classGrade} · {config.totalQuestions} Qs · {config.totalMarks} marks · </span>
              <span className={syncState === "offline" ? "text-amber-300 font-semibold" : ""} aria-live="polite">{syncText}</span>
            </p>
          </div>
          {config.enableCamera && <CameraFeed stream={camStream} recording={snapshotsOn} />}
          <ContestTimer totalSeconds={durationSec} deadline={deadline} onTimeUp={handleTimeUp} />
          <button
            onClick={() => setShowSubmitModal(true)}
            className="min-h-[40px] px-3 md:px-4 rounded-lg bg-white text-[#1F3A68] font-bold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F3A68]"
          >
            Submit
          </button>
        </div>
        <div className="border-t border-white/15">
          <div className="max-w-7xl mx-auto px-3 md:px-6 py-1.5 flex items-center gap-3 flex-wrap">
            <div className="md:hidden"><AttemptCounters attempted={answeredCount} flagged={flaggedCount} left={leftCount} dark /></div>
            {config.enableTabDetection && (
              <span className={`text-xs font-semibold tabular-nums ${warningCount > 0 ? "text-amber-300" : "text-blue-100"}`} data-testid="tab-switches">
                Tab switches: {warningCount}/{maxWarnings}
              </span>
            )}
            <div className="ml-auto"><TextSizeControl step={textStep} onChange={setTextStep} /></div>
          </div>
        </div>
      </header>

      {config.retryOf && (
        <div className="bg-amber-50 border-b border-amber-300 px-4 py-2.5 text-sm font-semibold text-amber-900 text-center" role="status">
          Your previous attempt ended because of a technical issue. This is your second and last attempt.
        </div>
      )}

      {cameraError && !cameraLost && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 flex items-center justify-between gap-3 text-sm text-red-800">
          <span className="inline-flex items-center gap-2"><CameraOff size={16} /> {cameraError}</span>
          <button onClick={() => setCameraError(null)} aria-label="Dismiss" className={`text-red-700 ${FOCUS}`}><X size={16} /></button>
        </div>
      )}

      {/* ── MAIN ── */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 md:gap-6 p-3 md:p-6">
        <main className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-8">
            <AnimatePresence mode="wait">
              <QuestionCard
                key={currentQuestion.id}
                question={currentQuestion}
                answer={currentAnswer}
                onSelectOption={selectOption}
                onToggleFlag={toggleFlag}
                onTextAnswer={setTextAnswer}
                showInstantAnswer={config.showInstantAnswers}
                scale={textScale}
              />
            </AnimatePresence>

            <div className="flex items-center justify-between gap-2 mt-8 pt-4 border-t border-gray-200">
              <button
                onClick={goPrev}
                disabled={currentIndex === 0}
                className={`inline-flex items-center gap-1.5 min-h-[48px] px-4 rounded-lg text-sm font-bold text-gray-800 border-2 border-gray-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS}`}
              >
                <ChevronLeft size={18} /> Previous
              </button>
              <button
                onClick={() => setShowMobileNav(true)}
                className={`md:hidden min-h-[48px] px-3 rounded-lg text-xs font-bold text-gray-800 bg-gray-100 border border-gray-300 ${FOCUS}`}
                aria-label="Open question palette"
              >
                Q {currentIndex + 1}/{questions.length} ▦
              </button>
              {currentIndex < questions.length - 1 ? (
                <button onClick={goNext} className={`inline-flex items-center gap-1.5 min-h-[48px] px-5 rounded-lg text-sm font-bold text-white ${FOCUS}`} style={{ background: NAVY }}>
                  Next <ChevronRight size={18} />
                </button>
              ) : (
                <button onClick={() => setShowSubmitModal(true)} className={`inline-flex items-center gap-1.5 min-h-[48px] px-5 rounded-lg text-sm font-bold text-white bg-emerald-700 ${FOCUS}`}>
                  <Send size={16} /> Submit test
                </button>
              )}
            </div>
            <p className="hidden md:block text-[11px] text-gray-600 mt-3">Keyboard: 1–4 choose an option · ← → previous / next</p>
          </div>
        </main>

        {/* ── Palette (desktop) ── */}
        <aside className="hidden md:block w-72 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-28 space-y-4">
            <AttemptCounters attempted={answeredCount} flagged={flaggedCount} left={leftCount} />
            <div>
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Question palette</h3>
              <QuestionNav questions={questions} answers={answers} currentIndex={currentIndex} onNavigate={goToQuestion} />
            </div>
            <PaletteLegend />
            <button
              onClick={() => setShowSubmitModal(true)}
              className={`w-full min-h-[44px] text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 ${FOCUS}`}
              style={{ background: NAVY }}
            >
              <Send size={14} /> Submit test
            </button>
          </div>
        </aside>
      </div>

      {/* ── MOBILE: palette sheet ── */}
      {showMobileNav && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Question palette">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMobileNav(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl shadow-2xl p-4 space-y-4 max-h-[80vh] overflow-y-auto" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Question palette</h3>
              <button onClick={() => setShowMobileNav(false)} aria-label="Close" className={`p-2 rounded-lg bg-gray-100 ${FOCUS}`}><X size={16} /></button>
            </div>
            <AttemptCounters attempted={answeredCount} flagged={flaggedCount} left={leftCount} />
            <QuestionNav
              questions={questions}
              answers={answers}
              currentIndex={currentIndex}
              onNavigate={(idx) => { goToQuestion(idx); setShowMobileNav(false); }}
            />
            <PaletteLegend />
          </div>
        </div>
      )}

      {/* ── Camera lost: blocking until it is back on ── */}
      {config.enableCamera && cameraLost && !isSubmitted && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4" role="alertdialog" aria-modal="true">
          <div className="bg-white rounded-xl p-7 max-w-sm w-full text-center space-y-4">
            <CameraOff size={36} className="mx-auto text-red-600" />
            <h3 className="text-lg font-bold text-gray-900">Turn your camera back on</h3>
            <p className="text-sm text-gray-700">The camera must stay on during this test. The timer is still running.</p>
            {cameraError && <p className="text-xs text-red-800 bg-red-50 rounded-lg px-3 py-2">{cameraError}</p>}
            <button onClick={requestCamera} className={`w-full min-h-[48px] text-white font-bold text-sm rounded-lg ${FOCUS}`} style={{ background: NAVY }}>Turn camera on</button>
          </div>
        </div>
      )}

      {/* ── MODALS ── */}
      <AnimatePresence>
        {showWarning && (
          <WarningModal
            warningCount={warningCount}
            maxWarnings={maxWarnings}
            onAcknowledge={() => setShowWarning(false)}
            reason={warningReason}
          />
        )}
      </AnimatePresence>

      {showSubmitModal && (
        <SubmitModal
          onConfirm={() => submitRef.current()}
          onCancel={() => setShowSubmitModal(false)}
          answeredCount={answeredCount}
          totalCount={questions.length}
          flaggedCount={flaggedCount}
        />
      )}

      {isSubmitting && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white/95" role="status">
          <div className="text-center px-6">
            <Loader2 size={40} className="animate-spin text-gray-500 mx-auto mb-4" />
            <p className="text-sm font-bold text-gray-800">Submitting… don't close this page</p>
            {submitTry > 0 && <p className="text-xs text-amber-800 mt-1">Weak connection — trying again ({submitTry})…</p>}
          </div>
        </div>
      )}

      {/* Submit failed: answers are kept on this device; retry (also automatic when back online) */}
      {submitPhase === "failed" && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white/95 p-6" role="alertdialog" aria-modal="true">
          <div className="text-center max-w-sm space-y-3">
            <AlertTriangle size={40} className="mx-auto text-amber-600" />
            <p className="text-base font-bold text-gray-900">Not submitted yet</p>
            <p className="text-sm text-gray-700">Your answers are saved on this device. Check your internet and tap Retry — don't close this page.</p>
            {submitError && <p className="text-xs text-red-800 bg-red-50 rounded-lg px-3 py-2">{submitError}</p>}
            <button onClick={() => submitRef.current()} className={`w-full min-h-[48px] text-white font-bold text-sm rounded-lg ${FOCUS}`} style={{ background: NAVY }}>Retry submit</button>
            {secondsLeft(deadline) > 0 && (
              <button onClick={() => setSubmitPhase("idle")} className={`w-full min-h-[44px] text-sm font-bold text-gray-700 ${FOCUS}`}>Back to the test</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContestAttemptPage;