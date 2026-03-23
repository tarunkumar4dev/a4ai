// src/components/TestGeneratorForm.tsx
// ──────────────────────────────────────────────────────────────────────
// V6 — CBSE Section Pattern Support
//
// v6 changes:
//   - CBSE Pattern toggle (generates Section A-E paper)
//   - Section breakdown info when toggle is ON
//   - cbsePattern field passed to backend
// ──────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Library, GraduationCap, Book, ChevronDown, Clock, Zap,
  Loader2, AlertCircle, Lock, Timer, FileText,
} from "lucide-react";

import { formSchema, FormSchema } from "@/lib/schema";
import { TestRowEditor } from "./TestRowEditor";
import { LogoUpload } from "./LogoUpload";
import { DifficultyMix } from "./DifficultyMix";
import { TabBar } from "./TabBar";
import { PreviewModal } from "./PreviewModal";
import { SummaryStats } from "./SummaryStats";
import GeneratedTestView from "./GeneratedTestView";
import { useTestGenerator } from "@/hooks/useTestGenerator";
import { supabase } from "@/integrations/supabase/client";
import { api } from "@/lib/api";


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
// STYLED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

const PremiumInput = ({ label, name, placeholder, register }: any) => (
  <div className="space-y-2 group">
    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 group-focus-within:text-gray-800 transition-colors">
      {label}
    </label>
    <input
      {...register(name)}
      placeholder={placeholder}
      className="w-full bg-white text-[#111827] text-sm font-semibold placeholder:text-gray-300 placeholder:font-medium
      rounded-2xl border border-[#E5E7EB] px-5 py-4 outline-none transition-all duration-300
      shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]
      focus:shadow-[0_0_0_4px_rgba(107,114,128,0.1)] focus:border-gray-400
      hover:border-gray-300"
    />
  </div>
);

const BoardSelect = ({ register, value }: { register: any; value: string }) => (
  <div className="space-y-2 group">
    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1.5 group-focus-within:text-gray-800 transition-colors">
      <Library size={12} /> Board
    </label>
    <div className="relative">
      <select
        {...register("board")}
        className="w-full appearance-none bg-white text-[#111827] text-sm font-semibold
        rounded-2xl border border-[#E5E7EB] px-5 py-4 outline-none transition-all duration-300
        shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]
        focus:shadow-[0_0_0_4px_rgba(107,114,128,0.1)] focus:border-gray-400
        cursor-pointer hover:border-gray-300"
      >
        {ALL_BOARDS.map((b) => (
          <option key={b.value} value={b.value} disabled={!b.enabled}>
            {b.label}{!b.enabled ? " — Coming Soon" : ""}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-5 top-4.5 text-gray-400 pointer-events-none" size={16} />
    </div>
  </div>
);

const ClassSelect = ({ register }: { register: any }) => (
  <div className="space-y-2 group">
    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1.5 group-focus-within:text-gray-800 transition-colors">
      <GraduationCap size={12} /> Class
    </label>
    <div className="relative">
      <select
        {...register("classGrade")}
        className="w-full appearance-none bg-white text-[#111827] text-sm font-semibold
        rounded-2xl border border-[#E5E7EB] px-5 py-4 outline-none transition-all duration-300
        shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]
        focus:shadow-[0_0_0_4px_rgba(107,114,128,0.1)] focus:border-gray-400
        cursor-pointer hover:border-gray-300"
      >
        {CLASS_OPTIONS.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-5 top-4.5 text-gray-400 pointer-events-none" size={16} />
    </div>
  </div>
);

const SubjectSelect = ({
  register, subjects, isLoadingChapters,
}: {
  register: any;
  subjects: string[];
  isLoadingChapters: boolean;
}) => (
  <div className="space-y-2 group">
    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1.5 group-focus-within:text-gray-800 transition-colors">
      <Book size={12} /> Subject
      {isLoadingChapters && (
        <span className="text-blue-400 flex items-center gap-1">
          <Loader2 size={10} className="animate-spin" /> loading chapters...
        </span>
      )}
    </label>
    <div className="relative">
      <select
        {...register("subject")}
        className="w-full appearance-none bg-white text-[#111827] text-sm font-semibold
        rounded-2xl border border-[#E5E7EB] px-5 py-4 outline-none transition-all duration-300
        shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]
        focus:shadow-[0_0_0_4px_rgba(107,114,128,0.1)] focus:border-gray-400
        cursor-pointer hover:border-gray-300"
      >
        <option value="">Select...</option>
        {subjects.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-5 top-4.5 text-gray-400 pointer-events-none" size={16} />
    </div>
  </div>
);

const GenerationTimer = ({ isRunning }: { isRunning: boolean }) => {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning) {
      setElapsed(0);
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  if (!isRunning) return null;

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = minutes > 0
    ? `${minutes}:${seconds.toString().padStart(2, "0")}`
    : `${seconds}s`;

  const color =
    elapsed < 30 ? "text-emerald-400" :
    elapsed < 60 ? "text-yellow-400" :
    elapsed < 90 ? "text-orange-400" :
    "text-red-400";

  return (
    <div className={`flex items-center gap-2 ${color}`}>
      <Timer size={16} className="animate-pulse" />
      <span className="text-xs font-bold uppercase tracking-wider tabular-nums">
        {timeStr}
      </span>
      <span className="text-[10px] text-gray-500 font-medium">
        {elapsed < 15 ? "Connecting to NCERT..." :
         elapsed < 30 ? "Retrieving content..." :
         elapsed < 50 ? "Generating questions..." :
         elapsed < 70 ? "Quality checking..." :
         elapsed < 90 ? "Almost done..." :
         "Taking longer than usual..."}
      </span>
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════
// CBSE PATTERN TOGGLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════

const CBSEPatternToggle = ({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: (val: boolean) => void;
}) => (
  <div className={`rounded-2xl border transition-all duration-300 ${
    enabled
      ? "bg-gradient-to-r from-[#111827]/5 to-[#1F2937]/5 border-[#111827]/20"
      : "bg-white border-[#E5E7EB]"
  }`}>
    <div className="p-5">
      {/* Toggle header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl transition-all ${
            enabled ? "bg-[#111827] text-white" : "bg-gray-100 text-gray-400"
          }`}>
            <FileText size={16} />
          </div>
          <div>
            <p className="text-sm font-bold text-[#111827]">CBSE Pattern Paper</p>
            <p className="text-[10px] text-gray-400 font-medium">
              Sections A–E · 38 questions · 80 marks
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          className={`relative w-12 h-7 rounded-full transition-all duration-300 ${
            enabled ? "bg-[#111827]" : "bg-gray-200"
          }`}
        >
          <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${
            enabled ? "left-[22px]" : "left-0.5"
          }`} />
        </button>
      </div>

      {/* Section breakdown — shown when enabled */}
      <AnimatePresence>
        {enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-5 gap-2">
                {[
                  { sec: "A", q: 20, m: 1, type: "MCQ + A&R", color: "bg-blue-50 text-blue-700 border-blue-200" },
                  { sec: "B", q: 5, m: 2, type: "Very Short", color: "bg-purple-50 text-purple-700 border-purple-200" },
                  { sec: "C", q: 6, m: 3, type: "Short Ans", color: "bg-amber-50 text-amber-700 border-amber-200" },
                  { sec: "D", q: 4, m: 5, type: "Long Ans", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                  { sec: "E", q: 3, m: 4, type: "Case Study", color: "bg-rose-50 text-rose-700 border-rose-200" },
                ].map((s) => (
                  <div key={s.sec} className={`rounded-xl border p-2.5 text-center ${s.color}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Sec {s.sec}</p>
                    <p className="text-sm font-black mt-0.5">{s.q} × {s.m}m</p>
                    <p className="text-[9px] font-semibold mt-0.5 opacity-70">{s.type}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-3 text-center font-medium">
                Chapters will be distributed evenly across all sections
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

export default function TestGeneratorForm() {
  const [activeTab, setActiveTab] = useState<"Simple" | "Blueprint" | "Matrix" | "Buckets">("Simple");
  const [showPreview, setShowPreview] = useState(false);
  const [availableChapters, setAvailableChapters] = useState<string[]>([]);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [cbsePattern, setCbsePattern] = useState(true);

  const { generate, isLoading, result, error, reset, progress } = useTestGenerator();

  const methods = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      examTitle: "",
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
  const subject = useWatch({ control: methods.control, name: "subject" });
  const board = useWatch({ control: methods.control, name: "board" });

  const availableSubjects = SUBJECTS_BY_CLASS[classGrade] || SUBJECTS_BY_CLASS["Class 10"];

  useEffect(() => {
    const subs = SUBJECTS_BY_CLASS[classGrade] || [];
    if (subject && !subs.includes(subject)) {
      methods.setValue("subject", subs[0] || "");
    }
  }, [classGrade, subject, methods]);

  const loadChapters = useCallback(async () => {
    if (!subject || !classGrade) return;

    setIsLoadingChapters(true);
    try {
      const result = await api.getChapters(subject, classGrade);
      if (result.ok && result.chapters.length > 0) {
        setAvailableChapters(result.chapters);
        methods.setValue("ncertChapters", result.chapters);
      } else {
        setAvailableChapters([]);
      }
    } catch (err) {
      console.error("Failed to load chapters:", err);
      setAvailableChapters([]);
    } finally {
      setIsLoadingChapters(false);
    }
  }, [subject, classGrade, methods]);

  useEffect(() => {
    loadChapters();
  }, [loadChapters]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) methods.setValue("userId", user.id);
      } catch { /* not logged in */ }
    };
    fetchUser();
  }, [methods]);

  const onSubmit = async (data: FormSchema) => {
    // Inject cbsePattern into the data sent to backend
    const payload = { ...data, cbsePattern };
    console.log("📝 Form data:", payload);
    await generate(payload);
  };

  if (result) {
    return (
      <div className="space-y-6 pb-32">
        <GeneratedTestView result={result} onReset={reset} logoBase64={logoBase64} />
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.2 } },
  } satisfies Variants;
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 100 } },
  } satisfies Variants;

  return (
    <FormProvider {...methods}>
      <motion.form
        onSubmit={methods.handleSubmit(onSubmit)}
        className="space-y-10 pb-32"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 1. HERO CONFIGURATION CARD                                    */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-[24px] p-6 md:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/50 backdrop-blur-sm"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-9 space-y-6">
              <PremiumInput
                label="Exam Title"
                name="examTitle"
                placeholder="e.g. Annual Final Assessment 2025"
                register={methods.register}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <BoardSelect register={methods.register} value={board} />
                <ClassSelect register={methods.register} />
                <SubjectSelect
                  register={methods.register}
                  subjects={availableSubjects}
                  isLoadingChapters={isLoadingChapters}
                />
              </div>

              {availableChapters.length > 0 && (
                <div className="flex items-center gap-2 ml-1">
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    {availableChapters.length} NCERT chapters loaded
                  </span>
                  <span className="text-[10px] text-gray-400">
                    for {subject} {classGrade}
                  </span>
                </div>
              )}
            </div>

            <div className="lg:col-span-3">
              <LogoUpload onLogoChange={setLogoBase64} />
            </div>
          </div>
        </motion.div>


        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 1.5. CBSE PATTERN TOGGLE (NEW)                                */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <motion.div variants={itemVariants}>
          <CBSEPatternToggle enabled={cbsePattern} onToggle={setCbsePattern} />
        </motion.div>


        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 2. TABBED EDITOR SECTION                                      */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <motion.div variants={itemVariants}>
          {!cbsePattern && (
            <>
              <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <TestRowEditor activeMode={activeTab} />
                </motion.div>
              </AnimatePresence>
            </>
          )}

          {cbsePattern && (
            <div className="bg-white rounded-[24px] p-6 md:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/50">
              <div className="text-center space-y-2">
                <p className="text-sm font-bold text-[#111827]">Chapter Selection</p>
                <p className="text-xs text-gray-400">
                  Select chapters below — questions will be auto-distributed across CBSE sections
                </p>
              </div>
              <div className="mt-4">
                <TestRowEditor activeMode={activeTab} />
              </div>
            </div>
          )}
        </motion.div>


        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 3. DIFFICULTY MIX & STATS (hidden when CBSE pattern ON)       */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {!cbsePattern && (
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-[24px] p-6 md:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/50 backdrop-blur-sm flex flex-col lg:flex-row gap-8 items-center justify-between"
          >
            <div className="w-full lg:w-2/3">
              <DifficultyMix />
            </div>
            <SummaryStats />
          </motion.div>
        )}

        {cbsePattern && (
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-[24px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#111827]">Paper Summary</p>
                <p className="text-xs text-gray-400 mt-1">CBSE Standard Pattern</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-black text-[#111827]">38</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Questions</p>
                </div>
                <div className="h-8 w-px bg-gray-200" />
                <div className="text-center">
                  <p className="text-2xl font-black text-[#111827]">80</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Marks</p>
                </div>
                <div className="h-8 w-px bg-gray-200" />
                <div className="text-center">
                  <p className="text-2xl font-black text-[#111827]">5</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Sections</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}


        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ERROR DISPLAY                                                 */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3"
            >
              <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-800">Generation Failed</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>


        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 4. STICKY BOTTOM ACTION BAR                                   */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 80, damping: 15, delay: 0.8 }}
          className="fixed bottom-8 left-0 w-full px-4 md:px-6 pointer-events-none z-50"
        >
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between bg-[#111827] text-white p-3 pl-6 rounded-[24px] shadow-[0_20px_40px_rgba(0,0,0,0.3)] pointer-events-auto border border-white/10 gap-4 md:gap-0">

            <div className="flex items-center gap-4">
              {isLoading ? (
                <GenerationTimer isRunning={isLoading} />
              ) : (
                <div className="flex items-center gap-2 text-gray-400">
                  <Clock size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Est. Time: <span className="text-white">{cbsePattern ? "60-120s" : "30-90s"}</span>
                  </span>
                  {cbsePattern && (
                    <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-bold">
                      CBSE Pattern
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => setShowPreview(true)}
                disabled={isLoading}
                className="px-6 py-3.5 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all flex-1 md:flex-none disabled:opacity-50"
              >
                Preview
              </motion.button>

              <motion.button
                whileHover={!isLoading ? { scale: 1.03, boxShadow: "0 0 20px rgba(255,255,255,0.2)" } : {}}
                whileTap={!isLoading ? { scale: 0.97 } : {}}
                type="submit"
                disabled={isLoading}
                className="px-8 py-3.5 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl font-bold text-sm text-white shadow-[0_4px_14px_rgba(0,0,0,0.4)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.6)] flex items-center justify-center gap-2 transition-all border border-white/10 flex-1 md:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap size={18} className="fill-yellow-400 text-yellow-400" />
                    {cbsePattern ? "Generate CBSE Paper" : "Generate Test"}
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>


        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 5. PREVIEW MODAL                                              */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {showPreview && (
            <PreviewModal
              isOpen={showPreview}
              onClose={() => setShowPreview(false)}
              data={methods.getValues()}
            />
          )}
        </AnimatePresence>
      </motion.form>
    </FormProvider>
  );
}