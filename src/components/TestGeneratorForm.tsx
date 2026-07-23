// src/components/TestGeneratorForm.tsx — V10 (milestone progress bar)
import React, { useState, useEffect, useRef } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Library, GraduationCap, Book, ChevronDown, Clock, Zap,
  Loader2, AlertCircle, FileText,
} from "lucide-react";

import { formSchema, FormSchema } from "@/lib/schema";
import { TestRowEditor, FORMAT_MAP } from "./TestRowEditor";
import { LogoUpload } from "./LogoUpload";
import { DifficultyMix } from "./DifficultyMix";
import { TabBar } from "./TabBar";
import { PreviewModal } from "./PreviewModal";
import { SummaryStats } from "./SummaryStats";
import GeneratedTestView from "./GeneratedTestView";
import { useTestGenerator } from "@/hooks/useTestGenerator";
import { useAuth } from "@/providers/AuthProvider";

// ═══════════════════════════════════════════════════════════════════════
// SUBJECT CONFIG
// ═══════════════════════════════════════════════════════════════════════

const SUBJECTS_BY_CLASS: Record<string, string[]> = {
  "Class 9":  ["Science", "Maths", "English", "Political Science", "Economics", "History", "Geography"],
  "Class 10": ["Science", "Maths", "English", "Political Science", "Economics", "History", "Geography"],
  "Class 11": ["Physics", "Chemistry", "Biology", "Mathematics", "Accountancy", "Economics", "Political Science", "History", "English"],
  "Class 12": ["Physics", "Chemistry", "Biology", "Mathematics", "Accountancy", "Economics", "Political Science", "History", "English"],
};

const ALL_BOARDS = [
  { value: "CBSE",  label: "CBSE",  enabled: true },
  { value: "ICSE",  label: "ICSE",  enabled: false },
  { value: "IGCSE", label: "IGCSE", enabled: false },
  { value: "IB",    label: "IB",    enabled: false },
];

const CLASS_OPTIONS = ["Class 9", "Class 10", "Class 11", "Class 12"];

// ═══════════════════════════════════════════════════════════════════════
// PROGRESS ENGINE
// 5s → 5%  |  25s → 17%  |  40s → 37%  |  60s → 75%
// 60s ke baad 75% pe hold, API response aate hi seedha 100%.
// ═══════════════════════════════════════════════════════════════════════

const PROGRESS_STEPS: { t: number; p: number }[] = [
  { t: 0,  p: 0 },
  { t: 5,  p: 5 },
  { t: 25, p: 17 },
  { t: 40, p: 37 },
  { t: 60, p: 75 },
];

function progressForElapsed(seconds: number): number {
  const last = PROGRESS_STEPS[PROGRESS_STEPS.length - 1];
  if (seconds >= last.t) return last.p;

  for (let i = 1; i < PROGRESS_STEPS.length; i++) {
    const prev = PROGRESS_STEPS[i - 1];
    const next = PROGRESS_STEPS[i];
    if (seconds <= next.t) {
      const ratio = (seconds - prev.t) / (next.t - prev.t);
      return prev.p + (next.p - prev.p) * ratio;
    }
  }
  return 0;
}

function statusForProgress(p: number): string {
  if (p >= 100) return "Paper ready";
  if (p >= 75)  return "Formatting the paper";
  if (p >= 37)  return "Writing questions and answers";
  if (p >= 17)  return "Reading NCERT chapters";
  return "Setting up the blueprint";
}

function useGenerationProgress(isRunning: boolean, hasError: boolean) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const tickRef = useRef<number | null>(null);
  const hideRef = useRef<number | null>(null);
  const wasRunning = useRef(false);
  const errorRef = useRef(hasError);
  errorRef.current = hasError;

  useEffect(() => {
    const stopTick = () => {
      if (tickRef.current !== null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };

    if (isRunning) {
      if (hideRef.current !== null) {
        window.clearTimeout(hideRef.current);
        hideRef.current = null;
      }
      wasRunning.current = true;
      setVisible(true);
      setProgress(0);

      const startedAt = Date.now();
      tickRef.current = window.setInterval(() => {
        setProgress(progressForElapsed((Date.now() - startedAt) / 1000));
      }, 100);
    } else {
      stopTick();
      if (wasRunning.current) {
        wasRunning.current = false;
        if (errorRef.current) {
          // fail hua toh 100% dikhane ka koi matlab nahi
          setVisible(false);
          setProgress(0);
        } else {
          setProgress(100);
          hideRef.current = window.setTimeout(() => {
            setVisible(false);
            setProgress(0);
          }, 900);
        }
      }
    }

    return stopTick;
  }, [isRunning]);

  useEffect(() => () => {
    if (hideRef.current !== null) window.clearTimeout(hideRef.current);
  }, []);

  return { progress, visible };
}

const GenerationProgress = ({ progress, visible }: { progress: number; visible: boolean }) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] flex items-center justify-center px-5 bg-[#F9FAFB]/80 backdrop-blur-md"
        role="status"
        aria-live="polite"
      >
        <style>{`
          @keyframes a4aiSheen { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
          @media (prefers-reduced-motion: reduce) { .a4ai-sheen { animation: none !important; } }
        `}</style>

        <motion.div
          initial={{ y: 12, scale: 0.98 }}
          animate={{ y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 140, damping: 20 }}
          className="w-full max-w-md bg-white rounded-2xl sm:rounded-[24px] border border-white/60
            shadow-[0_20px_60px_rgba(0,0,0,0.10)] px-5 py-6 sm:px-8 sm:py-8"
        >
          <div className="flex items-end justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Generating
              </p>
              <p className="text-[13px] sm:text-sm font-bold text-[#111827] mt-1 truncate">
                {statusForProgress(progress)}
              </p>
            </div>
            <p className="text-3xl sm:text-4xl font-black tabular-nums leading-none text-[#1E5BD6] flex-shrink-0">
              {Math.round(progress)}
              <span className="text-lg sm:text-xl font-bold">%</span>
            </p>
          </div>

          <div className="relative h-3.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="relative h-full rounded-full bg-gradient-to-r from-[#1E5BD6] to-[#4F86F7]
                transition-[width] duration-300 ease-out"
              style={{ width: `${Math.max(progress, 3)}%` }}
            >
              <div
                className="a4ai-sheen absolute inset-0 bg-gradient-to-r from-transparent via-white/45 to-transparent"
                style={{ animation: "a4aiSheen 1.6s linear infinite" }}
              />
            </div>
          </div>

          <p className="mt-4 text-[11px] sm:text-xs text-gray-400 text-center">
            Keep this tab open — a full paper usually takes 60–120 seconds.
          </p>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ═══════════════════════════════════════════════════════════════════════
// STYLED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

const PremiumInput = ({ label, name, placeholder, register }: any) => (
  <div className="space-y-1.5 sm:space-y-2 group">
    <label className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 group-focus-within:text-gray-800 transition-colors">
      {label}
    </label>
    <input
      {...register(name)}
      placeholder={placeholder}
      className="w-full bg-white text-[#111827] text-sm font-semibold placeholder:text-gray-300 placeholder:font-medium
      rounded-xl sm:rounded-2xl border border-[#E5E7EB] px-4 py-3 sm:px-5 sm:py-4 outline-none transition-all duration-200
      shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]
      focus:shadow-[0_0_0_3px_rgba(107,114,128,0.1)] focus:border-gray-400
      hover:border-gray-300"
    />
  </div>
);

const BoardSelect = ({ register, value }: { register: any; value: string }) => (
  <div className="space-y-1.5 sm:space-y-2 group">
    <label className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1.5 group-focus-within:text-gray-800 transition-colors">
      <Library size={11} /> Board
    </label>
    <div className="relative">
      <select
        {...register("board")}
        className="w-full appearance-none bg-white text-[#111827] text-sm font-semibold
        rounded-xl sm:rounded-2xl border border-[#E5E7EB] px-4 py-3 sm:px-5 sm:py-4 outline-none transition-all duration-200
        shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]
        focus:shadow-[0_0_0_3px_rgba(107,114,128,0.1)] focus:border-gray-400
        cursor-pointer hover:border-gray-300"
      >
        {ALL_BOARDS.map((b) => (
          <option key={b.value} value={b.value} disabled={!b.enabled}>
            {b.label}{!b.enabled ? " — Coming Soon" : ""}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
    </div>
  </div>
);

const ClassSelect = ({ register }: { register: any }) => (
  <div className="space-y-1.5 sm:space-y-2 group">
    <label className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1.5 group-focus-within:text-gray-800 transition-colors">
      <GraduationCap size={11} /> Class
    </label>
    <div className="relative">
      <select
        {...register("classGrade")}
        className="w-full appearance-none bg-white text-[#111827] text-sm font-semibold
        rounded-xl sm:rounded-2xl border border-[#E5E7EB] px-4 py-3 sm:px-5 sm:py-4 outline-none transition-all duration-200
        shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]
        focus:shadow-[0_0_0_3px_rgba(107,114,128,0.1)] focus:border-gray-400
        cursor-pointer hover:border-gray-300"
      >
        {CLASS_OPTIONS.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
    </div>
  </div>
);

const SubjectSelect = ({
  register,
  subjects,
}: {
  register: any;
  subjects: string[];
}) => (
  <div className="space-y-1.5 sm:space-y-2 group">
    <label className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1.5 group-focus-within:text-gray-800 transition-colors">
      <Book size={11} /> Subject
    </label>
    <div className="relative">
      <select
        {...register("subject")}
        className="w-full appearance-none bg-white text-[#111827] text-sm font-semibold
        rounded-xl sm:rounded-2xl border border-[#E5E7EB] px-4 py-3 sm:px-5 sm:py-4 outline-none transition-all duration-200
        shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]
        focus:shadow-[0_0_0_3px_rgba(107,114,128,0.1)] focus:border-gray-400
        cursor-pointer hover:border-gray-300"
      >
        <option value="">Select...</option>
        {subjects.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════
// CBSE PATTERN TOGGLE
// ═══════════════════════════════════════════════════════════════════════

const CBSE_SECTIONS = [
  { sec: "A", q: 20, m: 1, type: "MCQ + A&R", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { sec: "B", q: 5,  m: 2, type: "Very Short", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { sec: "C", q: 6,  m: 3, type: "Short Ans",  color: "bg-amber-50 text-amber-700 border-amber-200" },
  { sec: "D", q: 4,  m: 5, type: "Long Ans",   color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { sec: "E", q: 3,  m: 4, type: "Case Study", color: "bg-rose-50 text-rose-700 border-rose-200" },
];

const CBSEPatternToggle = ({ enabled, onToggle }: { enabled: boolean; onToggle: (v: boolean) => void }) => (
  <div className={`rounded-xl sm:rounded-2xl border transition-all duration-200 ${enabled ? "bg-gradient-to-r from-[#111827]/5 to-[#1F2937]/5 border-[#111827]/20" : "bg-white border-[#E5E7EB]"}`}>
    <div className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all flex-shrink-0 ${enabled ? "bg-[#111827] text-white" : "bg-gray-100 text-gray-400"}`}>
            <FileText size={14} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] sm:text-sm font-bold text-[#111827] truncate">CBSE Pattern Paper</p>
            <p className="text-[9px] sm:text-[10px] text-gray-400 font-medium">Sections A–E · 38 Q · 80 marks</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          className={`relative w-11 h-[26px] sm:w-12 sm:h-7 rounded-full transition-all duration-200 flex-shrink-0 ${enabled ? "bg-[#111827]" : "bg-gray-200"}`}
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          <div className={`absolute top-[3px] w-5 h-5 sm:w-6 sm:h-6 bg-white rounded-full shadow-md transition-all duration-200 ${enabled ? "left-[21px] sm:left-[22px]" : "left-[3px] sm:left-0.5"}`} />
        </button>
      </div>

      <AnimatePresence>
        {enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-100">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-2">
                {CBSE_SECTIONS.map((s) => (
                  <div key={s.sec} className={`rounded-lg sm:rounded-xl border p-2 sm:p-2.5 text-center ${s.color}`}>
                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider opacity-60">Sec {s.sec}</p>
                    <p className="text-[13px] sm:text-sm font-black mt-0.5">{s.q}×{s.m}m</p>
                    <p className="text-[8px] sm:text-[9px] font-semibold mt-0.5 opacity-70 truncate">{s.type}</p>
                  </div>
                ))}
              </div>
              <p className="text-[9px] sm:text-[10px] text-gray-400 mt-2.5 sm:mt-3 text-center font-medium">
                Chapters distributed across all sections
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

type TestGeneratorFormProps = {
  /** false ho toh generate block ho jayega aur onBlocked chalega (guest limit) */
  canGenerate?: boolean;
  onBlocked?: () => void;
  /** paper successfully ban jaane par ek baar chalega (guest count badhane ke liye) */
  onGenerated?: () => void;
};

export default function TestGeneratorForm({
  canGenerate = true,
  onBlocked,
  onGenerated,
}: TestGeneratorFormProps) {
  const [activeTab, setActiveTab] = useState<"Simple" | "Blueprint" | "Matrix" | "Buckets">("Simple");
  const [showPreview, setShowPreview] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [cbsePattern, setCbsePattern] = useState(true);

  const { generate, isLoading, result, error, reset } = useTestGenerator();
  const { user } = useAuth();

  // progress bar state
  const { progress, visible: progressVisible } = useGenerationProgress(isLoading, !!error);

  // success hone par ek hi baar parent ko batao
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (result && !notifiedRef.current) {
      notifiedRef.current = true;
      onGenerated?.();
    }
    if (!result) notifiedRef.current = false;
  }, [result, onGenerated]);

  const methods = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      examTitle: "",
      paperDate: new Date().toISOString().split("T")[0],
      board: "CBSE",
      classGrade: "Class 10",
      subject: "Science",
      mode: "Simple",
      simpleData: [{ id: "1", topic: "", quantity: 5, marks: 1, difficulty: "Medium", format: "MCQ" }],
      useNCERT: true,
      ncertChapters: [],
    },
  });

  const classGrade = useWatch({ control: methods.control, name: "classGrade" });
  const subject    = useWatch({ control: methods.control, name: "subject" });
  const board      = useWatch({ control: methods.control, name: "board" });
  const availableSubjects = SUBJECTS_BY_CLASS[classGrade] || SUBJECTS_BY_CLASS["Class 10"];

  useEffect(() => {
    const subs = SUBJECTS_BY_CLASS[classGrade] || [];
    if (subject && !subs.includes(subject)) {
      methods.setValue("subject", subs[0] || "");
    }
  }, [classGrade, subject, methods]);

  const onSubmit = async (data: FormSchema) => {
    if (!canGenerate) {
      onBlocked?.();
      return;
    }

    const userId = user?.id || (data as any).userId;
    const mappedData = {
      ...data,
      simpleData: data.simpleData.map((row) => ({
        ...row,
        format: FORMAT_MAP[row.format] ?? "mcq",
      })),
    };
    const payload = { ...mappedData, cbsePattern, paperDate: data.paperDate, userId };
    console.log("📝 Submitting with userId:", userId ? userId.slice(0, 8) + "..." : "none");
    await generate(payload);
  };

  if (result) {
    return (
      <>
        <GenerationProgress progress={progress} visible={progressVisible} />
        <div className="space-y-4 sm:space-y-6 pb-28 sm:pb-32">
          <GeneratedTestView result={result} onReset={reset} logoBase64={logoBase64} />
        </div>
      </>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
  } satisfies Variants;

  const itemVariants = {
    hidden: { y: 14, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 120, damping: 20 } },
  } satisfies Variants;

  return (
    <FormProvider {...methods}>
      {/* PROGRESS OVERLAY — purana timer/loader iske neeche chhup jata hai */}
      <GenerationProgress progress={progress} visible={progressVisible} />

      <motion.form
        onSubmit={methods.handleSubmit(onSubmit)}
        className="space-y-5 sm:space-y-8 md:space-y-10 pb-28 sm:pb-32"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* 1. HERO CONFIGURATION CARD */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl sm:rounded-[24px] p-4 sm:p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] sm:shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/50"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 md:gap-8">
            <div className="lg:col-span-9 space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="sm:col-span-2">
                  <PremiumInput label="Exam Title" name="examTitle" placeholder="e.g. Annual Final Assessment 2025" register={methods.register} />
                </div>
                <div>
                  <label className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 block mb-1.5 sm:mb-2">
                    Paper Date
                  </label>
                  <input
                    type="date"
                    {...methods.register("paperDate")}
                    className="w-full bg-white text-[#111827] text-sm font-semibold
                      rounded-xl sm:rounded-2xl border border-[#E5E7EB] px-4 py-3 sm:px-5 sm:py-4 outline-none transition-all duration-200
                      shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]
                      focus:shadow-[0_0_0_3px_rgba(107,114,128,0.1)] focus:border-gray-400
                      hover:border-gray-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-5">
                <BoardSelect register={methods.register} value={board} />
                <ClassSelect register={methods.register} />
                <SubjectSelect register={methods.register} subjects={availableSubjects} />
              </div>
            </div>
            <div className="lg:col-span-3">
              <LogoUpload onLogoChange={setLogoBase64} />
            </div>
          </div>
        </motion.div>

        {/* 1.5. CBSE PATTERN TOGGLE */}
        <motion.div variants={itemVariants}>
          <CBSEPatternToggle enabled={cbsePattern} onToggle={setCbsePattern} />
        </motion.div>

        {/* 2. TABBED EDITOR SECTION */}
        <motion.div variants={itemVariants}>
          {!cbsePattern && (
            <>
              <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  <TestRowEditor activeMode={activeTab} />
                </motion.div>
              </AnimatePresence>
            </>
          )}

          {cbsePattern && (
            <div className="bg-white rounded-2xl sm:rounded-[24px] p-4 sm:p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] sm:shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/50">
              <div className="text-center space-y-1 sm:space-y-2">
                <p className="text-[13px] sm:text-sm font-bold text-[#111827]">Chapter Selection</p>
                <p className="text-[11px] sm:text-xs text-gray-400">
                  Select chapters — questions auto-distributed across CBSE sections
                </p>
              </div>
              <div className="mt-3 sm:mt-4">
                <TestRowEditor activeMode={activeTab} />
              </div>
            </div>
          )}
        </motion.div>

        {/* 3. DIFFICULTY MIX & STATS */}
        {!cbsePattern && (
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-2xl sm:rounded-[24px] p-4 sm:p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] sm:shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/50 flex flex-col lg:flex-row gap-5 sm:gap-8 items-center justify-between"
          >
            <div className="w-full lg:w-2/3"><DifficultyMix /></div>
            <SummaryStats />
          </motion.div>
        )}

        {cbsePattern && (
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-2xl sm:rounded-[24px] p-4 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] sm:shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/50"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
              <div>
                <p className="text-[13px] sm:text-sm font-bold text-[#111827]">Paper Summary</p>
                <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">CBSE Standard Pattern</p>
              </div>
              <div className="flex items-center justify-between sm:justify-end sm:gap-6 bg-gray-50 sm:bg-transparent rounded-xl sm:rounded-none p-3 sm:p-0">
                <div className="text-center">
                  <p className="text-xl sm:text-2xl font-black text-[#111827]">38</p>
                  <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase">Questions</p>
                </div>
                <div className="h-8 w-px bg-gray-200" />
                <div className="text-center">
                  <p className="text-xl sm:text-2xl font-black text-[#111827]">80</p>
                  <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase">Marks</p>
                </div>
                <div className="h-8 w-px bg-gray-200" />
                <div className="text-center">
                  <p className="text-xl sm:text-2xl font-black text-[#111827]">5</p>
                  <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase">Sections</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ERROR DISPLAY */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-red-50 border border-red-200 rounded-xl sm:rounded-2xl p-4 sm:p-5 flex items-start gap-2.5 sm:gap-3"
            >
              <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[13px] sm:text-sm font-bold text-red-800">Generation Failed</p>
                <p className="text-[12px] sm:text-sm text-red-600 mt-1 break-words">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 4. STICKY BOTTOM ACTION BAR */}
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 18, delay: 0.6 }}
          className="fixed bottom-0 sm:bottom-6 md:bottom-8 left-0 w-full px-0 sm:px-4 md:px-6 pointer-events-none z-50"
        >
          <div className="max-w-4xl mx-auto
            flex flex-col sm:flex-row items-stretch sm:items-center justify-between
            bg-[#111827] text-white
            p-3 sm:p-3 sm:pl-6
            rounded-none sm:rounded-[20px] md:rounded-[24px]
            shadow-[0_-4px_20px_rgba(0,0,0,0.15)] sm:shadow-[0_20px_40px_rgba(0,0,0,0.3)]
            pointer-events-auto border-t sm:border border-white/10
            gap-2.5 sm:gap-4
            pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-3"
          >
            <div className="flex items-center justify-center sm:justify-start px-1 sm:px-0">
              <div className="flex items-center gap-1.5 sm:gap-2 text-gray-400">
                <Clock size={14} className="flex-shrink-0" />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                  Est: <span className="text-white">{cbsePattern ? "60-120s" : "30-90s"}</span>
                </span>
                {cbsePattern && (
                  <span className="text-[9px] sm:text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-bold hidden xs:inline">CBSE</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => setShowPreview(true)}
                disabled={isLoading}
                className="px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl text-[13px] sm:text-sm font-bold
                  bg-gray-100 text-gray-700 active:bg-gray-200 transition-colors
                  flex-1 sm:flex-none disabled:opacity-50 min-h-[44px]"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                Preview
              </motion.button>

              <motion.button
                whileTap={!isLoading ? { scale: 0.96 } : {}}
                type="submit"
                disabled={isLoading}
                className="px-5 sm:px-8 py-3 sm:py-3.5
                  bg-gradient-to-br from-gray-700 to-gray-900
                  rounded-xl font-bold text-[13px] sm:text-sm text-white
                  shadow-[0_4px_14px_rgba(0,0,0,0.4)]
                  active:shadow-[0_2px_8px_rgba(0,0,0,0.5)]
                  flex items-center justify-center gap-2 transition-all
                  border border-white/10 flex-[1.3] sm:flex-none
                  disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span className="hidden xs:inline">Generating...</span>
                    <span className="xs:hidden">Wait...</span>
                  </>
                ) : (
                  <>
                    <Zap size={16} className="fill-yellow-400 text-yellow-400" />
                    <span className="hidden sm:inline">{cbsePattern ? "Generate CBSE Paper" : "Generate Test"}</span>
                    <span className="sm:hidden">Generate</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* 5. PREVIEW MODAL */}
        <AnimatePresence>
          {showPreview && (
            <PreviewModal isOpen={showPreview} onClose={() => setShowPreview(false)} data={methods.getValues()} />
          )}
        </AnimatePresence>
      </motion.form>
    </FormProvider>
  );
}
