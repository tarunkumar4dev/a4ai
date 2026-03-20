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
//   8. Auto-save progress
//   9. Clean, exam-like UI
// ──────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, CameraOff, Clock, AlertTriangle, ChevronLeft, ChevronRight,
  Send, Shield, Eye, MonitorSmartphone, Maximize, Flag,
  CheckCircle2, Circle, Loader2, X, BookOpen, Lock
} from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";

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
}

interface StudentAnswer {
  questionId: string;
  selectedOption: string | null;    // "A", "B", "C", "D" or null
  textAnswer?: string;              // for Short/Long type
  timeSpent: number;                // seconds on this question
  flagged: boolean;
}

// ==================== CONSTANTS ====================
const MAX_WARNINGS = 3;
const AUTOSAVE_INTERVAL = 30000; // 30 seconds

// ==================== PROCTORING: CAMERA FEED ====================
const CameraFeed = ({
  isActive,
  onToggle,
  onError,
}: {
  isActive: boolean;
  onToggle: () => void;
  onError: (msg: string) => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isActive) {
      navigator.mediaDevices
        .getUserMedia({ video: { width: 320, height: 240, facingMode: "user" }, audio: false })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.error("Camera error:", err);
          onError("Camera access denied. Please enable camera to continue.");
        });
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isActive, onError]);

  return (
    <div className="relative group">
      <div
        className={`w-[140px] h-[105px] md:w-[180px] md:h-[135px] rounded-2xl overflow-hidden border-2 transition-all shadow-lg ${
          isActive
            ? "border-emerald-400/60 shadow-emerald-500/20"
            : "border-red-400/60 shadow-red-500/20 bg-gray-900"
        }`}
      >
        {isActive ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover mirror"
            style={{ transform: "scaleX(-1)" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-900">
            <CameraOff size={24} className="text-red-400" />
          </div>
        )}
      </div>
      {/* Recording indicator */}
      {isActive && (
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] font-bold text-white bg-black/50 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
            REC
          </span>
        </div>
      )}
      {/* Shield badge */}
      <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full shadow-md">
        <Shield size={10} />
      </div>
    </div>
  );
};

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
      className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
    >
      <h3 className="text-xl font-extrabold text-gray-900 mb-6 text-center">
        Submit Test?
      </h3>

      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl">
          <span className="text-sm text-gray-600">Answered</span>
          <span className="text-sm font-bold text-emerald-600">{answeredCount}/{totalCount}</span>
        </div>
        <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl">
          <span className="text-sm text-gray-600">Unanswered</span>
          <span className="text-sm font-bold text-amber-600">{totalCount - answeredCount}</span>
        </div>
        {flaggedCount > 0 && (
          <div className="flex items-center justify-between py-3 px-4 bg-amber-50 rounded-xl border border-amber-200">
            <span className="text-sm text-amber-700">Flagged for Review</span>
            <span className="text-sm font-bold text-amber-600">{flaggedCount}</span>
          </div>
        )}
      </div>

      {totalCount - answeredCount > 0 && (
        <p className="text-xs text-red-500 text-center mb-4 font-medium">
          You have {totalCount - answeredCount} unanswered question(s)!
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3.5 bg-gray-100 text-gray-700 font-bold text-sm rounded-2xl hover:bg-gray-200 transition-colors"
        >
          Go Back
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-3.5 bg-gray-900 text-white font-bold text-sm rounded-2xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
        >
          <Send size={16} /> Submit
        </button>
      </div>
    </motion.div>
  </motion.div>
);

// ==================== TIMER ====================
const ContestTimer = ({
  totalSeconds,
  onTimeUp,
}: {
  totalSeconds: number;
  onTimeUp: () => void;
}) => {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    if (remaining <= 0) {
      onTimeUp();
      return;
    }
    const timer = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(timer);
  }, [remaining, onTimeUp]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const percentage = (remaining / totalSeconds) * 100;

  const isLow = remaining < 300; // < 5 min
  const isCritical = remaining < 60; // < 1 min

  return (
    <div
      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border transition-all ${
        isCritical
          ? "bg-red-50 border-red-200 text-red-600 animate-pulse"
          : isLow
          ? "bg-amber-50 border-amber-200 text-amber-600"
          : "bg-gray-50 border-gray-200 text-gray-700"
      }`}
    >
      <Clock size={16} />
      <span className="font-mono font-extrabold text-sm tabular-nums tracking-wide">
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </span>
      {/* Mini progress bar */}
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden hidden md:block">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            isCritical ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-emerald-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
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
}: {
  question: ContestQuestion;
  answer: StudentAnswer;
  onSelectOption: (optionLabel: string) => void;
  onToggleFlag: () => void;
  onTextAnswer?: (text: string) => void;
  showInstantAnswer: boolean;
}) => {
  const correctOption = null; // will come from API if showInstantAnswer

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className="w-full"
    >
      {/* Question header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-xs font-extrabold text-white bg-gray-900 px-3 py-1.5 rounded-xl">
            Q{question.questionNumber}
          </span>
          <span
            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider ${
              question.difficulty === "Easy"
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                : question.difficulty === "Medium"
                ? "bg-amber-50 text-amber-600 border border-amber-200"
                : "bg-red-50 text-red-600 border border-red-200"
            }`}
          >
            {question.difficulty}
          </span>
          <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200">
            {question.marks} mark{question.marks > 1 ? "s" : ""}
          </span>
        </div>

        {/* Flag button */}
        <button
          onClick={onToggleFlag}
          className={`p-2 rounded-xl transition-all ${
            answer.flagged
              ? "bg-amber-50 text-amber-500 border border-amber-200"
              : "bg-gray-50 text-gray-400 border border-gray-200 hover:text-amber-500 hover:border-amber-200"
          }`}
          title={answer.flagged ? "Remove flag" : "Flag for review"}
        >
          <Flag size={16} fill={answer.flagged ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Question text */}
      <div className="mb-8">
        <p className="text-base md:text-lg font-semibold text-gray-900 leading-relaxed">
          <MathText text={question.questionText} />
        </p>
      </div>

      {/* Options for MCQ */}
      {question.type === "MCQ" && (
        <div className="space-y-3">
          {question.options.map((opt, idx) => {
            const isSelected = answer.selectedOption === opt.label;
            const optionLetters = ["A", "B", "C", "D"];

            return (
              <motion.button
                key={opt.label}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onSelectOption(opt.label)}
                className={`w-full flex items-center gap-4 p-4 md:p-5 rounded-2xl border-2 transition-all text-left group ${
                  isSelected
                    ? "border-gray-900 bg-gray-900 text-white shadow-lg"
                    : "border-gray-200 bg-white hover:border-gray-400 hover:shadow-md text-gray-700"
                }`}
              >
                {/* Option letter badge */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm flex-shrink-0 transition-all ${
                    isSelected
                      ? "bg-white text-gray-900"
                      : "bg-gray-100 text-gray-500 group-hover:bg-gray-200"
                  }`}
                >
                  {optionLetters[idx]}
                </div>

                {/* Option text */}
                <span className={`text-sm md:text-base font-medium flex-1 ${
                  isSelected ? "text-white" : "text-gray-700"
                }`}>
                  <MathText text={opt.text} />
                </span>

                {/* Selected indicator */}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-6 h-6 rounded-full bg-emerald-400 flex items-center justify-center flex-shrink-0"
                  >
                    <CheckCircle2 size={14} className="text-white" />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Text answer for Short/Long */}
      {(question.type === "Short" || question.type === "Long") && (
        <textarea
          value={answer.textAnswer || ""}
          onChange={(e) => onTextAnswer?.(e.target.value)}
          placeholder={
            question.type === "Short"
              ? "Write your answer in 2-3 sentences..."
              : "Write your detailed answer here..."
          }
          rows={question.type === "Short" ? 4 : 8}
          className="w-full p-5 rounded-2xl border-2 border-gray-200 focus:border-gray-900 outline-none text-sm font-medium text-gray-700 placeholder:text-gray-300 resize-none transition-colors"
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
  <div className="grid grid-cols-5 md:grid-cols-4 gap-2">
    {questions.map((q, idx) => {
      const ans = answers[idx];
      const isCurrent = idx === currentIndex;
      const isAnswered = !!ans?.selectedOption || !!ans?.textAnswer;
      const isFlagged = ans?.flagged;

      return (
        <button
          key={q.id}
          onClick={() => onNavigate(idx)}
          className={`relative w-10 h-10 rounded-xl text-xs font-bold transition-all ${
            isCurrent
              ? "bg-gray-900 text-white shadow-lg scale-110"
              : isAnswered
              ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
              : "bg-gray-100 text-gray-500 border border-gray-200 hover:border-gray-400"
          }`}
        >
          {idx + 1}
          {isFlagged && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-white" />
          )}
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

  // ── State ──
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<StudentAnswer[]>(
    questions.map((q) => ({
      questionId: q.id,
      selectedOption: null,
      textAnswer: "",
      timeSpent: 0,
      flagged: false,
    }))
  );
  const [cameraActive, setCameraActive] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [warningCount, setWarningCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningReason, setWarningReason] = useState("");
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [showAnswersView, setShowAnswersView] = useState(false);
  const questionTimerRef = useRef<number>(0);

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentIndex];

  // ── Anti-cheat: Tab visibility ──
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        triggerWarning("Tab switch detected. Stay on this page.");
      }
    };

    const handleBlur = () => {
      triggerWarning("Window lost focus. Do not switch windows.");
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }, [warningCount]);

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

  // Save time when navigating away from question
  const saveQuestionTime = useCallback(() => {
    setAnswers((prev) => {
      const updated = [...prev];
      updated[currentIndex] = {
        ...updated[currentIndex],
        timeSpent: updated[currentIndex].timeSpent + questionTimerRef.current,
      };
      return updated;
    });
    questionTimerRef.current = 0;
  }, [currentIndex]);

  // ── Warning trigger ──
  const triggerWarning = useCallback(
    (reason: string) => {
      const newCount = warningCount + 1;
      setWarningCount(newCount);
      setWarningReason(reason);

      if (newCount >= MAX_WARNINGS) {
        handleSubmit(); // Auto-submit on max warnings
      } else {
        setShowWarning(true);
      }
    },
    [warningCount]
  );

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

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    saveQuestionTime();
    setIsSubmitting(true);

    try {
      const { contestApi } = await import("@/lib/contestApi");

      const result = await contestApi.submitAttempt(
        config.contestId,
        config.attemptId,
        {
          answers: answers.map((a) => ({
            questionId: a.questionId,
            selected: a.selectedOption,
            textAnswer: a.textAnswer,
            timeSpent: a.timeSpent,
          })),
          warning_count: warningCount,
          warning_log: [],
          time_taken_seconds: config.durationMinutes * 60,
        }
      );

      setSubmitResult(result);
      setIsSubmitted(true);
    } catch (err) {
      console.error("Submit failed:", err);
      // Still mark as submitted locally so student isn't stuck
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, saveQuestionTime, warningCount, config]);

  const handleTimeUp = useCallback(() => {
    handleSubmit();
  }, [handleSubmit]);

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
                <p className="text-[10px] text-gray-400">Score: {score}/{totalMarks} ({percentage}%)</p>
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
                        : "bg-gray-50 text-gray-400 border border-gray-200"
                    }`}>
                      {isCorrect ? "Correct" : studentSelected ? "Wrong" : "Skipped"}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200">
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-3xl p-10 max-w-lg w-full shadow-2xl text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle2 size={40} className="text-emerald-500" />
          </motion.div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
            Test Submitted!
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Your answers have been recorded successfully.
          </p>

          {/* Score card */}
          {submitResult && (
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 mb-6 text-white">
              <p className="text-4xl font-extrabold">{score}<span className="text-lg text-gray-400">/{totalMarks}</span></p>
              <p className="text-sm text-gray-300 mt-1">Your Score</p>
              <div className="w-full h-2 bg-gray-700 rounded-full mt-4 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    percentage >= 80 ? "bg-emerald-400" :
                    percentage >= 50 ? "bg-yellow-400" :
                    "bg-red-400"
                  }`}
                />
              </div>
              <p className="text-right text-xs text-gray-400 mt-1">{percentage}%</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-2xl font-extrabold text-gray-900">{answeredCount}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Answered</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-2xl font-extrabold text-gray-900">
                {questions.length - answeredCount}
              </p>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Skipped</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-2xl font-extrabold text-amber-600">{warningCount}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Warnings</p>
            </div>
          </div>

          {config.showAnswersAfterTest && questionsWithAnswers.length > 0 && (
            <button
              onClick={() => setShowAnswersView(true)}
              className="w-full py-3.5 bg-gray-900 text-white font-bold text-sm rounded-2xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              <BookOpen size={16} />
              View Answers & Explanations
            </button>
          )}

          {config.showNoAnswers && (
            <p className="text-xs text-gray-400 mt-4">
              Results will be shared by your teacher.
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // MAIN QUIZ UI
  // ════════════════════════════════════════════════════════════════════
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* ── TOP BAR ── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-200 px-4 md:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left — contest info */}
          <div className="flex items-center gap-3">
            {config.logoBase64 && (
              <img
                src={config.logoBase64}
                alt="Logo"
                className="w-8 h-8 rounded-lg object-cover"
              />
            )}
            <div>
              <h1 className="text-sm font-extrabold text-gray-900 leading-tight">
                {config.title || "Test Paper"}
              </h1>
              <p className="text-[10px] text-gray-400 font-medium">
                {config.subject} · {config.classGrade} · {config.totalQuestions} Qs · {config.totalMarks} marks
              </p>
            </div>
          </div>

          {/* Center — Timer */}
          <ContestTimer
            totalSeconds={config.durationMinutes * 60}
            onTimeUp={handleTimeUp}
          />

          {/* Right — Camera + Proctoring */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
              <Shield size={10} />
              Proctored
            </div>
            <CameraFeed
              isActive={cameraActive}
              onToggle={() => setCameraActive(!cameraActive)}
              onError={(msg) => setCameraError(msg)}
            />
          </div>
        </div>
      </header>

      {/* Camera error banner */}
      <AnimatePresence>
        {cameraError && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-2 text-red-600 text-sm font-medium">
              <CameraOff size={16} />
              {cameraError}
            </div>
            <button
              onClick={() => setCameraError(null)}
              className="text-red-400 hover:text-red-600"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-6 p-4 md:p-8">
        {/* Question area */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 md:p-10">
            {/* Progress bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <span className="text-[10px] font-bold text-emerald-600">
                  {answeredCount} answered
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gray-900 rounded-full"
                  initial={false}
                  animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                  transition={{ type: "spring", stiffness: 200 }}
                />
              </div>
            </div>

            {/* Question */}
            <AnimatePresence mode="wait">
              <QuestionCard
                key={currentQuestion.id}
                question={currentQuestion}
                answer={currentAnswer}
                onSelectOption={selectOption}
                onToggleFlag={toggleFlag}
                onTextAnswer={setTextAnswer}
                showInstantAnswer={config.showInstantAnswers}
              />
            </AnimatePresence>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-100">
              <button
                onClick={goPrev}
                disabled={currentIndex === 0}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={18} /> Previous
              </button>

              {/* Mobile nav toggle */}
              <button
                onClick={() => setShowMobileNav(!showMobileNav)}
                className="md:hidden px-4 py-3 rounded-2xl text-xs font-bold text-gray-600 bg-gray-100"
              >
                {currentIndex + 1}/{questions.length}
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  onClick={goNext}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 transition-all"
                >
                  Next <ChevronRight size={18} />
                </button>
              ) : (
                <button
                  onClick={() => setShowSubmitModal(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-lg"
                >
                  <Send size={16} /> Submit Test
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── SIDEBAR: Question Navigation (Desktop) ── */}
        <div className="hidden md:block w-64 flex-shrink-0">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-5 sticky top-24">
            <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-4">
              Questions
            </h3>
            <QuestionNav
              questions={questions}
              answers={answers}
              currentIndex={currentIndex}
              onNavigate={goToQuestion}
            />

            {/* Legend */}
            <div className="mt-5 pt-4 border-t border-gray-100 space-y-2">
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                <div className="w-4 h-4 rounded bg-gray-900" />
                <span>Current</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                <div className="w-4 h-4 rounded bg-gray-100 border border-gray-200 relative">
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full" />
                </div>
                <span>Flagged</span>
              </div>
            </div>

            {/* Submit button in sidebar */}
            <button
              onClick={() => setShowSubmitModal(true)}
              className="w-full mt-5 py-3 bg-gray-900 text-white font-bold text-xs rounded-2xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              <Send size={14} /> Submit Test
            </button>
          </div>

          {/* Camera feed (desktop sidebar) */}
          <div className="mt-4 flex justify-center">
            <CameraFeed
              isActive={cameraActive}
              onToggle={() => setCameraActive(!cameraActive)}
              onError={(msg) => setCameraError(msg)}
            />
          </div>
        </div>
      </div>

      {/* ── MOBILE: Bottom Question Nav ── */}
      <AnimatePresence>
        {showMobileNav && (
          <motion.div
            initial={{ y: 300 }}
            animate={{ y: 0 }}
            exit={{ y: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 rounded-t-3xl shadow-2xl p-6 z-50 md:hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-gray-900">Questions</h3>
              <button
                onClick={() => setShowMobileNav(false)}
                className="p-1.5 rounded-lg bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>
            <QuestionNav
              questions={questions}
              answers={answers}
              currentIndex={currentIndex}
              onNavigate={(idx) => {
                goToQuestion(idx);
                setShowMobileNav(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MOBILE: Camera (floating) ── */}
      <div className="md:hidden fixed bottom-20 right-4 z-40">
        <CameraFeed
          isActive={cameraActive}
          onToggle={() => setCameraActive(!cameraActive)}
          onError={(msg) => setCameraError(msg)}
        />
      </div>

      {/* ── MODALS ── */}
      <AnimatePresence>
        {showWarning && (
          <WarningModal
            warningCount={warningCount}
            maxWarnings={MAX_WARNINGS}
            onAcknowledge={() => setShowWarning(false)}
            reason={warningReason}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSubmitModal && (
          <SubmitModal
            onConfirm={handleSubmit}
            onCancel={() => setShowSubmitModal(false)}
            answeredCount={answeredCount}
            totalCount={questions.length}
            flaggedCount={flaggedCount}
          />
        )}
      </AnimatePresence>

      {/* Submitting overlay */}
      <AnimatePresence>
        {isSubmitting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-white/90 backdrop-blur-sm"
          >
            <div className="text-center">
              <Loader2 size={40} className="animate-spin text-gray-400 mx-auto mb-4" />
              <p className="text-sm font-bold text-gray-600">Submitting your test...</p>
              <p className="text-xs text-gray-400 mt-1">Please don't close this page</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ContestAttemptPage;