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
import { loadDraft, saveDraft } from "@/lib/testGenDraft";

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
  { value: "CBSE", label: "CBSE (NCERT)" },
];

const CLASS_OPTIONS = ["Class 9", "Class 10", "Class 11", "Class 12"];

// ═══════════════════════════════════════
// GENERATION STATUS
// The generate call returns one response when the paper is finished. There is no progress feed,
// so this shows elapsed time only: no percentage, no invented estimate.
// ═══════════════════════════════════════

// Collects every validation message (nested rows included) so the teacher sees what to fix after a failed submit.
function collectMessages(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== "object") return out;
  const rec = node as Record<string, unknown>;
  if (typeof rec.message === "string" && rec.message && !out.includes(rec.message)) out.push(rec.message);
  for (const key of Object.keys(rec)) {
    if (key !== "message" && key !== "ref" && key !== "type") collectMessages(rec[key], out);
  }
  return out;
}

function useElapsedSeconds(isRunning: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!isRunning) return;
    const startedAt = Date.now();
    setSeconds(0);
    const id = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [isRunning]);
  return seconds;
}

const GenerationStatus = ({ running, seconds }: { running: boolean; seconds: number }) => {
  if (!running) return null;
  return (
    <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <Loader2 size={18} className="mt-0.5 flex-shrink-0 animate-spin text-[#111111]" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-bold text-[#1B1B1B]">Generating your paper…</p>
        <p className="mt-0.5 text-xs text-gray-500">
          Elapsed {seconds}s. The paper is sent only when it is finished, so there is no partial progress to show.
          You can leave this page open; your settings stay filled in.
        </p>
      </div>
    </div>
  );
};

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

const BoardSelect = ({ register }: { register: any; value?: string }) => (
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
          <option key={b.value} value={b.value}>
            {b.label}
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

// Waits for auth so this user's draft is part of the form's FIRST values. Restoring it after mount made the row
// editor see a class/subject change and clear every chapter. The key remounts the form when the account changes,
// so nothing typed by one user stays on screen for the next.
export default function TestGeneratorForm(props: TestGeneratorFormProps) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-[60vh]" aria-busy="true" />;
  return <GeneratorForm key={user?.id ?? "guest"} {...props} />;
}

function GeneratorForm({
  canGenerate = true,
  onBlocked,
  onGenerated,
}: TestGeneratorFormProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [cbsePattern, setCbsePattern] = useState(false);

  const { generate, isLoading, result, error, reset } = useTestGenerator();
  const { user } = useAuth();

  const elapsed = useElapsedSeconds(isLoading);

  // success hone par ek hi baar parent ko batao
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (result && !notifiedRef.current) {
      notifiedRef.current = true;
      onGenerated?.();
    }
    if (!result) notifiedRef.current = false;
  }, [result, onGenerated]);

  // Signed-in users get their local draft (src/lib/testGenDraft.ts) as the starting values; guests start blank.
  const userId = user?.id ?? null;
  const [initialValues] = useState(() => {
    const draft = userId ? loadDraft(userId) : null;
    // a class this form doesn't offer would leave no subject and no rows
    if (draft?.classGrade && !CLASS_OPTIONS.includes(draft.classGrade)) {
      delete draft.classGrade;
      delete draft.subject;
    }
    return {
      examTitle: "",
      paperDate: new Date().toISOString().split("T")[0],
      board: "CBSE",
      classGrade: "Class 10",
      subject: "Science",
      mode: "Simple",
      simpleData: [{ id: "1", topic: "", quantity: 5, marks: 1, difficulty: "Medium" as const, format: "MCQ" }],
      useNCERT: true,
      ncertChapters: [],
      ...draft,
    };
  });

  const methods = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    if (!userId) return;
    const sub = methods.watch((values) => saveDraft(userId, values as Record<string, unknown>));
    return () => sub.unsubscribe();
  }, [userId, methods]);

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
        <GenerationStatus running={isLoading} seconds={elapsed} />
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
      <div className="mb-4">
        <GenerationStatus running={isLoading} seconds={elapsed} />
      </div>

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

        {/* 2. MODE SELECTOR & ROW EDITOR */}
        <motion.div variants={itemVariants} className="space-y-4">
          <TabBar
            activeMode={cbsePattern ? "cbse" : "custom"}
            onModeChange={(mode) => setCbsePattern(mode === "cbse")}
          />

          {cbsePattern ? (
            <div className="space-y-4">
              {/* CBSE Sections Preview Banner */}
              <div className="bg-white rounded-2xl sm:rounded-[24px] p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#E5E7EB]">
                <div className="mb-3">
                  <h3 className="text-xs sm:text-sm font-bold text-[#111827]">CBSE Standard Pattern (38 Questions · 80 Marks)</h3>
                  <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">Pick chapters below — questions are automatically distributed across Sections A–E.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {CBSE_SECTIONS.map((s) => (
                    <div key={s.sec} className={`rounded-xl border p-2 sm:p-2.5 text-center ${s.color}`}>
                      <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider opacity-70">Sec {s.sec}</p>
                      <p className="text-xs sm:text-sm font-black mt-0.5">{s.q} × {s.m}m</p>
                      <p className="text-[8px] sm:text-[9px] font-semibold mt-0.5 opacity-80 truncate">{s.type}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* CBSE Chapter Row Editor */}
              <TestRowEditor isCbseMode={true} />
            </div>
          ) : (
            <TestRowEditor isCbseMode={false} />
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

        {/* VALIDATION SUMMARY: a failed submit used to fail silently */}
        {methods.formState.submitCount > 0 && collectMessages(methods.formState.errors).length > 0 && (
          <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">Fill in these fields to generate the paper:</p>
            <ul className="mt-1 list-disc pl-5">
              {collectMessages(methods.formState.errors).slice(0, 6).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
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
                {canGenerate && (
                  <button
                    type="button"
                    onClick={() => { void methods.handleSubmit(onSubmit)(); }}
                    disabled={isLoading}
                    className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-[#111111] px-4 text-sm font-bold text-white hover:bg-[#222222] disabled:opacity-50"
                  >
                    Try again with the same settings
                  </button>
                )}
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
                  bg-[#111111] hover:bg-[#222222]
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
