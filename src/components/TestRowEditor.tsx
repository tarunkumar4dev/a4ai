// src/components/TestRowEditor.tsx
// ──────────────────────────────────────────────────────────────────────
// V7 — Chapter selection fix
//
// v7 changes vs v6:
//   - prevKeyRef initialized as "" — eliminates false reset on first render
//   - Chapter select: controlled (value + onChange) instead of register-only
//     → fixes Android old Chrome selection not persisting
//   - Subtopic select also controlled for same reason
//   - All other v6 fixes retained (AbortController, mock fallback, etc.)
// ──────────────────────────────────────────────────────────────────────

import React, { useRef, memo, useCallback, forwardRef, useState, useEffect } from "react";
import { useFieldArray, useFormContext, UseFormSetValue, UseFormWatch, FieldValues } from "react-hook-form";
import {
  GripVertical, Paperclip, Trash2, PlusCircle, Check, FileText, BookOpen,
  AlignLeft, ListChecks, ArrowLeftRight, Loader2, AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ==================== TYPES ====================
interface SimpleRowData {
  id: string;
  topic: string;
  subtopic?: string;
  quantity: number;
  marks: number;
  difficulty: "Easy" | "Medium" | "Hard" | "Mixed";
  format: "MCQ" | "Short" | "Long" | "Essay" | "JournalEntry" | "Ledger" | "TrialBalance";
  refFile?: File;
}

interface RefUploadButtonProps {
  index: number;
  setValue: UseFormSetValue<FieldValues>;
  watch: UseFormWatch<FieldValues>;
}

interface ChapterGroup {
  book: string;
  chapter_type: string;
  label: string;
  chapters: { name: string; order: number | null }[];
}

interface RowProps {
  index: number;
  field: { id: string };
  availableTopics: string[];
  chapterGroups: ChapterGroup[] | null;
  subtopicsMap: Record<string, string[]>;
  chaptersLoading: boolean;
  remove: (index: number) => void;
}

interface FormValues {
  classGrade: string;
  subject: string;
  useNCERT: boolean;
  ncertChapters: string[];
  simpleData: SimpleRowData[];
}

// ==================== API CONFIGURATION ====================
const getApiBaseUrl = (): string => {
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_API_URL || "";
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `http://${hostname}:8000`;
    }
  }
  return "http://localhost:8000";
};

// ==================== MOCK FALLBACK ====================
const MOCK_CHAPTERS: Record<string, string[]> = {
  Science: [
    "Chemical Reactions and Equations",
    "Acids Bases and Salts",
    "Metals and Non-metals",
    "Carbon and Its Compounds",
    "Periodic Classification",
    "Life Processes",
    "Control and Coordination",
    "How do Organisms Reproduce",
    "Heredity and Evolution",
    "Light Reflection and Refraction",
    "Human Eye and Colorful World",
    "Electricity",
    "Magnetic Effects of Electric Current",
    "Our Environment",
  ],
  Maths: [
    "Real Numbers", "Polynomials", "Pair of Linear Equations",
    "Quadratic Equations", "Arithmetic Progressions", "Triangles",
    "Coordinate Geometry", "Introduction to Trigonometry",
    "Some Applications of Trigonometry", "Circles", "Constructions",
    "Areas Related to Circles", "Surface Areas and Volumes",
    "Statistics", "Probability",
  ],
};

// ==================== API: FETCH CHAPTERS ====================
interface ChaptersFetchResult {
  flat: string[];
  groups: ChapterGroup[] | null;
}

async function fetchChaptersFromAPI(
  classLevel: string,
  subject: string,
  signal: AbortSignal,
): Promise<ChaptersFetchResult> {
  const classNum = classLevel.replace(/\D/g, "") || "10";
  const base = getApiBaseUrl();
  const url = `${base}/api/v1/test-generator/chapters?subject=${encodeURIComponent(subject)}&class_grade=${encodeURIComponent(classNum)}`;

  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

  const data = await res.json();
  const flat: string[] = Array.isArray(data.chapters) ? data.chapters : [];
  const groups: ChapterGroup[] | null =
    Array.isArray(data.groups) && data.groups.length > 0 ? data.groups : null;

  if (flat.length === 0 && MOCK_CHAPTERS[subject]) {
    return { flat: MOCK_CHAPTERS[subject], groups: null };
  }

  return { flat, groups };
}

// ==================== HOOK: useChapters ====================
function useChapters(classLevel: string, subject: string) {
  const [chapters, setChapters]          = useState<string[]>([]);
  const [chapterGroups, setChapterGroups] = useState<ChapterGroup[] | null>(null);
  const [subtopicsMap, setSubtopicsMap]  = useState<Record<string, string[]>>({});
  const [loading, setLoading]            = useState(false);
  const [error, setError]                = useState<string | null>(null);

  useEffect(() => {
    if (!classLevel || !subject) {
      setChapters([]);
      setChapterGroups(null);
      setSubtopicsMap({});
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchChaptersFromAPI(classLevel, subject, controller.signal)
      .then(({ flat, groups }) => {
        setChapters(flat);
        setChapterGroups(groups);
        const sMap: Record<string, string[]> = {};
        flat.forEach((ch) => {
          if (COMMON_SUBTOPICS[ch]) sMap[ch] = COMMON_SUBTOPICS[ch];
        });
        setSubtopicsMap(sMap);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        console.error("Chapter fetch failed:", err.message);
        setError(err.message);
        if (MOCK_CHAPTERS[subject]) {
          setChapters(MOCK_CHAPTERS[subject]);
          setChapterGroups(null);
        } else {
          setChapters([]);
          setChapterGroups(null);
        }
        setSubtopicsMap({});
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => { controller.abort(); };
  }, [classLevel, subject]);

  return { chapters, chapterGroups, subtopicsMap, loading, error };
}

// ==================== COMMON SUBTOPICS ====================
const COMMON_SUBTOPICS: Record<string, string[]> = {
  "Chemical Reactions and Equations": ["Chemical reactions", "Balanced chemical equations", "Types of reactions", "Oxidation and reduction", "Corrosion and rancidity"],
  "Acids Bases and Salts": ["Properties of acids and bases", "pH scale", "Common salts", "Uses of acids, bases and salts"],
  "Metals and Non-metals": ["Physical and chemical properties", "Reactivity series", "Extraction of metals", "Corrosion and prevention"],
  "Carbon and Its Compounds": ["Covalent bonding", "Homologous series", "Functional groups", "Ethanol and ethanoic acid", "Soaps and detergents"],
  "Periodic Classification": ["Mendeleev's table", "Modern periodic table", "Trends in periodic table"],
  "Light Reflection and Refraction": ["Reflection by mirrors", "Refraction", "Lenses", "Power of lens"],
  "Human Eye and Colorful World": ["Structure of eye", "Defects of vision", "Dispersion and scattering of light"],
  "Electricity": ["Electric current", "Ohm's law", "Resistance", "Electric power"],
  "Magnetic Effects of Electric Current": ["Magnetic field", "Electric motor", "Electromagnetic induction", "Generator"],
  "Life Processes": ["Nutrition", "Respiration", "Transportation", "Excretion"],
  "Control and Coordination": ["Nervous system", "Hormonal coordination", "Endocrine glands"],
  "How do Organisms Reproduce": ["Asexual reproduction", "Sexual reproduction", "Reproductive health"],
  "Heredity and Evolution": ["Mendel's experiments", "Inheritance of traits", "Evolution and speciation"],
  "Our Environment": ["Ecosystem", "Food chains", "Energy flow", "Pollution"],
  "Real Numbers": ["Euclid's division", "Fundamental theorem", "Irrational numbers", "Decimal expansions"],
  "Polynomials": ["Zeros of polynomial", "Relationship between zeros", "Division algorithm"],
  "Quadratic Equations": ["Standard form", "Solution by factorization", "Quadratic formula", "Nature of roots"],
  "Matter in Our Surroundings": ["States of matter", "Physical and chemical changes", "Latent heat", "Evaporation"],
  "Is Matter Around Us Pure": ["Mixtures", "Solutions", "Separation techniques", "Compounds and elements"],
  "Atoms and Molecules": ["Laws of chemical combination", "Atomic mass", "Mole concept", "Molecular mass"],
  "Structure of the Atom": ["Atomic models", "Isotopes and isobars", "Electronic configuration", "Valency"],
  "The Fundamental Unit of Life": ["Cell structure", "Organelles", "Prokaryotic vs Eukaryotic", "Cell division"],
  "Tissues": ["Plant tissues", "Animal tissues", "Meristems", "Connective tissue"],
  "Motion": ["Distance and displacement", "Velocity and acceleration", "Equations of motion", "Graphs of motion"],
  "Force and Laws of Motion": ["Newton's laws", "Inertia", "Momentum", "Conservation of momentum"],
  "Gravitation": ["Universal law", "Free fall", "Buoyancy", "Archimedes principle"],
  "Work and Energy": ["Work", "Kinetic energy", "Potential energy", "Power"],
  "Sound": ["Production of sound", "Sound propagation", "Reflection of sound", "SONAR"],
  "Power Sharing": ["Belgium model", "Sri Lanka model", "Forms of power sharing"],
  "Federalism": ["Union list", "State list", "Concurrent list", "Decentralisation", "Panchayati Raj"],
  "Gender Religion and Caste": ["Gender division", "Religion and politics", "Caste and politics"],
  "Political Parties": ["Functions of parties", "National parties", "State parties"],
  "Outcomes of Democracy": ["Accountability", "Economic growth", "Inequality", "Social diversity"],
  "Introduction to Accounting": ["Meaning and objectives", "Accounting as information system", "Users of accounting", "Accounting terms"],
  "Recording of Transactions": ["Accounting equation", "Rules of debit and credit", "Journal", "Ledger posting"],
  "Ledger": ["Format of ledger", "Posting from journal", "Balancing accounts", "T-account"],
  "Trial Balance": ["Objectives", "Methods of preparation", "Errors and rectification"],
  "Bank Reconciliation Statement": ["Need and purpose", "Preparation", "Adjustments"],
  "Depreciation": ["Meaning and causes", "Methods", "Accounting treatment"],
  "Financial Statements": ["Trading account", "Profit and loss account", "Balance sheet", "Adjustments"],
  "Accounting for Partnership": ["Nature", "Partnership deed", "Profit sharing ratio", "Capital accounts"],
};

// ==================== QUESTION TYPE CONFIG ====================
const QUESTION_FORMATS = [
  { value: "MCQ",   label: "MCQ",   icon: ListChecks,     color: "bg-gray-800 text-white" },
  { value: "Short", label: "Short", icon: AlignLeft,      color: "bg-blue-600 text-white" },
  { value: "Long",  label: "Long",  icon: FileText,       color: "bg-purple-600 text-white" },
  { value: "Essay", label: "Essay", icon: ArrowLeftRight, color: "bg-amber-600 text-white" },
];

const ACCOUNTANCY_FORMATS = [
  { value: "JournalEntry", label: "Journal",   icon: FileText,   color: "bg-emerald-600 text-white" },
  { value: "Ledger",       label: "Ledger",    icon: BookOpen,   color: "bg-teal-600 text-white" },
  { value: "TrialBalance", label: "Trial Bal", icon: ListChecks, color: "bg-cyan-600 text-white" },
];

const ACCOUNTANCY_SUBJECTS_FE = ["Accountancy", "Accounts", "Accounting"];

// ==================== UUID GENERATOR ====================
const generateUUID = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
};

// ==================== CHAPTER OPTIONS RENDERER ====================
function renderChapterOptions(
  chapterGroups: ChapterGroup[] | null,
  flatChapters: string[],
): React.ReactNode {
  if (chapterGroups && chapterGroups.length > 0) {
    return chapterGroups.map((group) => (
      <optgroup key={`${group.book || "x"}-${group.chapter_type || "x"}`} label={group.label}>
        {group.chapters.map((ch) => (
          <option key={ch.name} value={ch.name}>{ch.name}</option>
        ))}
      </optgroup>
    ));
  }
  return flatChapters.map((topic) => (
    <option key={topic} value={topic}>{topic}</option>
  ));
}

// ==================== FILE UPLOAD HANDLER ====================
const RefUploadButton: React.FC<RefUploadButtonProps & { fullWidth?: boolean }> = memo(
  ({ index, setValue, watch, fullWidth }) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const file = watch(`simpleData.${index}.refFile`);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (fileRef.current) fileRef.current.value = "";
      setValue(`simpleData.${index}.refFile`, f ?? undefined);
    }, [index, setValue]);

    const handleClearFile = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      setValue(`simpleData.${index}.refFile`, undefined);
    }, [index, setValue]);

    return (
      <div className={`relative ${fullWidth ? "w-full" : ""}`}>
        <input
          type="file"
          ref={fileRef}
          className="hidden"
          onChange={handleFileChange}
          accept=".pdf,.doc,.docx,.txt,.md"
        />
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`${fullWidth ? "w-full justify-center" : ""} min-h-[44px] px-3 py-2.5 rounded-xl transition-all border shadow-sm flex items-center gap-2 ${
            file ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-500 border-[#E5E7EB]"
          }`}
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          {file ? <Check size={16} /> : <Paperclip size={16} />}
          <span className="text-xs font-semibold">
            {file ? (file.name.length > 16 ? `${file.name.substring(0, 14)}...` : file.name) : "Add Reference"}
          </span>
        </motion.button>
        {file && (
          <button
            type="button"
            onClick={handleClearFile}
            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
          >
            ×
          </button>
        )}
      </div>
    );
  },
);
RefUploadButton.displayName = "RefUploadButton";

// ==================== FORMAT SELECTOR ====================
const FormatSelector = memo(({ index, subject }: { index: number; subject: string }) => {
  const { watch, setValue } = useFormContext();
  const currentFormat = watch(`simpleData.${index}.format`) || "MCQ";
  const isAccountancy  = ACCOUNTANCY_SUBJECTS_FE.includes(subject);
  const visibleFormats = isAccountancy ? [...QUESTION_FORMATS, ...ACCOUNTANCY_FORMATS] : QUESTION_FORMATS;

  useEffect(() => {
    const accValues = ACCOUNTANCY_FORMATS.map((f) => f.value);
    if (!isAccountancy && accValues.includes(currentFormat)) {
      setValue(`simpleData.${index}.format`, "MCQ");
    }
  }, [isAccountancy, currentFormat, index, setValue]);

  return (
    <div className="flex gap-1.5 flex-wrap">
      {visibleFormats.map((fmt) => {
        const isActive = currentFormat === fmt.value;
        const Icon = fmt.icon;
        return (
          <button
            key={fmt.value}
            type="button"
            onClick={() => setValue(`simpleData.${index}.format`, fmt.value)}
            className={`min-h-[36px] px-3 py-2 text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition-all border ${
              isActive ? `${fmt.color} border-transparent shadow-sm` : "bg-white text-gray-500 border-[#E5E7EB]"
            }`}
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            <Icon size={11} /> {fmt.label}
          </button>
        );
      })}
    </div>
  );
});
FormatSelector.displayName = "FormatSelector";

// ═══════════════════════════════════════════════════════════════════════
// MOBILE: Card Row
// ═══════════════════════════════════════════════════════════════════════
const MobileCard = memo(({
  index, field, availableTopics, chapterGroups, subtopicsMap, chaptersLoading, remove,
}: RowProps) => {
  const { register, watch, setValue } = useFormContext<FormValues>();

  // ✅ v7: controlled values — guarantees display matches form state on Android
  const currentTopic = watch(`simpleData.${index}.topic`) ?? "";
  const subject      = watch("subject") ?? "";
  const subOptions   = subtopicsMap[currentTopic] || COMMON_SUBTOPICS[currentTopic] || [];

  const inputClass = "w-full min-h-[44px] bg-white border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-sm font-semibold text-[#111827] outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-400/10 transition-all appearance-none";
  const labelClass = "text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 200, damping: 24 }}
      layout
      className="bg-white rounded-2xl border border-[#E5E7EB] p-4 space-y-3.5 shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider bg-gray-100 px-2.5 py-1 rounded-full">
          Section {index + 1}
        </span>
        <button
          type="button"
          onClick={() => remove(index)}
          className="min-w-[36px] min-h-[36px] p-2 rounded-full text-gray-400 active:bg-red-50 active:text-red-500 transition-colors"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* ✅ v7: Chapter — CONTROLLED select (value + onChange) */}
      <div>
        <label className={labelClass}>Chapter</label>
        <div className="relative">
          <select
            value={currentTopic}
            onChange={(e) => setValue(`simpleData.${index}.topic`, e.target.value, { shouldValidate: true, shouldDirty: true })}
            disabled={chaptersLoading || availableTopics.length === 0}
            className={`${inputClass} pr-9 disabled:opacity-60`}
          >
            <option value="">
              {chaptersLoading ? "Loading chapters..." : availableTopics.length === 0 ? "No chapters available" : "Select a chapter..."}
            </option>
            {renderChapterOptions(chapterGroups, availableTopics)}
          </select>
          {chaptersLoading && (
            <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
          )}
        </div>
      </div>

      {/* ✅ v7: Subtopic — CONTROLLED select */}
      <div>
        <label className={labelClass}>Subtopic (optional)</label>
        <select
          value={watch(`simpleData.${index}.subtopic`) ?? ""}
          onChange={(e) => setValue(`simpleData.${index}.subtopic`, e.target.value, { shouldDirty: true })}
          disabled={!currentTopic || subOptions.length === 0}
          className={`${inputClass} disabled:opacity-60 disabled:bg-gray-50`}
        >
          <option value="">
            {!currentTopic ? "Select a chapter first" : subOptions.length === 0 ? "No subtopics available" : "Select subtopic..."}
          </option>
          {subOptions.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
        </select>
      </div>

      {/* Quantity + Marks */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Quantity</label>
          <select {...register(`simpleData.${index}.quantity`, { valueAsNumber: true })} className={inputClass}>
            {[1,2,3,4,5,6,7,8,9,10,15,20].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Marks each</label>
          <select {...register(`simpleData.${index}.marks`, { valueAsNumber: true })} className={inputClass}>
            {[1,2,3,4,5,6,7,8,9,10].map((n) => <option key={n} value={n}>{n} marks</option>)}
          </select>
        </div>
      </div>

      {/* Difficulty */}
      <div>
        <label className={labelClass}>Difficulty</label>
        <select {...register(`simpleData.${index}.difficulty`)} className={inputClass}>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
          <option value="Mixed">Mixed</option>
        </select>
      </div>

      {/* Format */}
      <div>
        <label className={labelClass}>Question Type</label>
        <FormatSelector index={index} subject={subject} />
      </div>

      {/* Reference */}
      <div>
        <label className={labelClass}>Reference (optional)</label>
        <RefUploadButton index={index} setValue={setValue} watch={watch} fullWidth />
      </div>
    </motion.div>
  );
});
MobileCard.displayName = "MobileCard";

// ═══════════════════════════════════════════════════════════════════════
// DESKTOP: Table Row
// ═══════════════════════════════════════════════════════════════════════
const TableRow = memo(forwardRef<HTMLTableRowElement, RowProps>(({
  index, field, availableTopics, chapterGroups, subtopicsMap, chaptersLoading, remove,
}, ref) => {
  const { register, watch, setValue } = useFormContext<FormValues>();

  // ✅ v7: controlled values
  const currentTopic = watch(`simpleData.${index}.topic`) ?? "";
  const subject      = watch("subject") ?? "";
  const subOptions   = subtopicsMap[currentTopic] || COMMON_SUBTOPICS[currentTopic] || [];

  return (
    <motion.tr
      ref={ref}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 120 }}
      className="group hover:bg-[#F9FAFB] transition-colors"
      layout
    >
      <td className="py-3 px-6 text-center">
        <GripVertical size={16} className="text-gray-300 cursor-grab hover:text-gray-600 transition-colors" />
      </td>

      <td className="py-3 px-4">
        <div className="flex flex-col gap-2">

          {/* ✅ v7: Chapter — controlled */}
          <div className="relative">
            <select
              value={currentTopic}
              onChange={(e) => setValue(`simpleData.${index}.topic`, e.target.value, { shouldValidate: true, shouldDirty: true })}
              className="w-full bg-transparent text-sm font-bold text-[#111827] outline-none border-b border-dashed border-gray-300 focus:border-gray-500 py-1 cursor-pointer appearance-none hover:text-gray-600 disabled:opacity-50"
              disabled={chaptersLoading || availableTopics.length === 0}
            >
              <option value="">
                {chaptersLoading ? "Loading chapters..." : availableTopics.length === 0 ? "No chapters available" : "Select Chapter/Topic..."}
              </option>
              {renderChapterOptions(chapterGroups, availableTopics)}
            </select>
            {chaptersLoading && <Loader2 size={14} className="absolute right-2 top-2 animate-spin text-gray-400" />}
          </div>

          {/* ✅ v7: Subtopic — controlled */}
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#E5E7EB] group-hover:bg-gray-400 transition-colors" />
            <select
              value={watch(`simpleData.${index}.subtopic`) ?? ""}
              onChange={(e) => setValue(`simpleData.${index}.subtopic`, e.target.value, { shouldDirty: true })}
              className="w-full bg-transparent text-xs font-semibold text-gray-500 outline-none cursor-pointer disabled:opacity-50 hover:text-gray-700 appearance-none"
              disabled={!currentTopic || subOptions.length === 0}
            >
              <option value="">
                {!currentTopic ? "Select Subtopic (Optional)..." : subOptions.length === 0 ? "No subtopics available" : "Select Subtopic (Optional)..."}
              </option>
              {subOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </td>

      <td className="py-3 px-4 text-center">
        <select
          {...register(`simpleData.${index}.quantity`, { valueAsNumber: true })}
          className="w-16 bg-[#F3F4F6] border-none rounded-xl py-2 text-center text-xs font-bold text-[#111827] focus:ring-2 focus:ring-gray-400/20 outline-none appearance-none"
        >
          {[1,2,3,4,5,6,7,8,9,10,15,20].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </td>

      <td className="py-3 px-4 text-center">
        <select
          {...register(`simpleData.${index}.marks`, { valueAsNumber: true })}
          className="w-16 bg-[#F3F4F6] border-none rounded-xl py-2 text-center text-xs font-bold text-[#111827] focus:ring-2 focus:ring-gray-400/20 outline-none appearance-none"
        >
          {[1,2,3,4,5,6,7,8,9,10].map((n) => <option key={n} value={n}>{n}m</option>)}
        </select>
      </td>

      <td className="py-3 px-4">
        <select
          {...register(`simpleData.${index}.difficulty`)}
          className="w-full bg-white border border-[#E5E7EB] text-xs font-bold text-gray-600 rounded-xl py-2 px-3 outline-none cursor-pointer hover:border-gray-400 transition-colors shadow-sm appearance-none"
        >
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
          <option value="Mixed">Mixed</option>
        </select>
      </td>

      <td className="py-3 px-4">
        <FormatSelector index={index} subject={subject} />
      </td>

      <td className="py-3 px-4 text-center">
        <RefUploadButton index={index} setValue={setValue} watch={watch} />
      </td>

      <td className="py-3 px-4 text-center">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          type="button"
          onClick={() => remove(index)}
          className="p-2 rounded-full bg-white border border-transparent hover:border-red-100 hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all shadow-sm"
        >
          <Trash2 size={16} />
        </motion.button>
      </td>
    </motion.tr>
  );
}));
TableRow.displayName = "TableRow";

// ==================== SIMPLE MODE VIEW ====================
const SimpleModeView: React.FC = () => {
  const { control, watch, setValue: setFormValue } = useFormContext<FormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "simpleData" });

  const classLevel     = watch("classGrade") ?? "";
  const currentSubject = watch("subject") ?? "";

  const { chapters: apiChapters, chapterGroups: apiChapterGroups, subtopicsMap, loading: chaptersLoading, error: chaptersError } =
    useChapters(classLevel, currentSubject);

  const isEnglish = currentSubject?.toLowerCase() === "english";

  const finalChapters = React.useMemo(() => {
    if (!isEnglish) return apiChapters;
    return [...apiChapters, "Writing Skills", "Grammar"];
  }, [apiChapters, isEnglish]);

  const finalChapterGroups = React.useMemo(() => {
    if (!isEnglish) return apiChapterGroups;
    const base: ChapterGroup[] = apiChapterGroups ? [...apiChapterGroups] : [];
    if (base.length === 0 && apiChapters.length > 0) {
      base.push({
        book: "literature", chapter_type: "all", label: "Literature Chapters",
        chapters: apiChapters.map((n, i) => ({ name: n, order: i + 1 })),
      });
    }
    base.push({
      book: "writing_grammar", chapter_type: "skills", label: "Writing & Grammar",
      chapters: [{ name: "Writing Skills", order: 1 }, { name: "Grammar", order: 2 }],
    });
    return base;
  }, [apiChapterGroups, apiChapters, isEnglish]);

  // ✅ v7: prevKeyRef initialized as "" — no false reset on first render
  const prevKeyRef   = useRef<string>("");
  const fieldsLenRef = useRef(fields.length);
  useEffect(() => { fieldsLenRef.current = fields.length; }, [fields.length]);

  useEffect(() => {
    // Only act when both values are valid
    if (!classLevel || !currentSubject) return;

    const newKey = `${classLevel}-${currentSubject}`;

    // ✅ Only reset if: we have a previous valid key AND it actually changed
    if (prevKeyRef.current && prevKeyRef.current !== newKey) {
      const len = fieldsLenRef.current;
      for (let idx = 0; idx < len; idx++) {
        setFormValue(`simpleData.${idx}.topic`   as any, "");
        setFormValue(`simpleData.${idx}.subtopic` as any, "");
      }
    }

    prevKeyRef.current = newKey;
  }, [classLevel, currentSubject, setFormValue]);

  const handleAddRow = useCallback(() => {
    append({ id: generateUUID(), topic: "", quantity: 5, marks: 1, difficulty: "Medium", format: "MCQ" });
  }, [append]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-2xl sm:rounded-[24px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] sm:shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/50"
    >
      {/* Context Banner */}
      <div className="px-4 sm:px-6 py-3 bg-blue-50 border-b border-blue-100 rounded-t-2xl sm:rounded-t-[22px]">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-blue-800">
          <BookOpen size={14} className="flex-shrink-0" />
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
            {classLevel && <span className="truncate"><span className="font-semibold">Class:</span> {classLevel}</span>}
            <span className="truncate"><span className="font-semibold">Subject:</span> {currentSubject || "Not selected"}</span>
            {finalChapters.length > 0 && (
              <span className="text-[10px] sm:text-xs text-blue-600">
                ({finalChapters.length} chapters{finalChapterGroups && finalChapterGroups.length > 0 ? `, ${finalChapterGroups.length} groups` : ""})
              </span>
            )}
            {chaptersError && <span className="text-[10px] sm:text-xs text-amber-600">(using fallback)</span>}
          </div>
        </div>
      </div>

      {/* Empty — no selection */}
      {(!classLevel || !currentSubject) && (
        <div className="py-10 sm:py-12 text-center text-gray-400 px-4">
          <BookOpen size={32} className="mx-auto mb-3 opacity-50" />
          <p className="font-semibold text-sm sm:text-base">Select a Class and Subject above</p>
          <p className="text-xs mt-1">Chapters will load automatically</p>
        </div>
      )}

      {/* Loading */}
      {classLevel && currentSubject && chaptersLoading && (
        <div className="py-10 sm:py-12 text-center px-4">
          <Loader2 size={32} className="mx-auto mb-3 animate-spin text-blue-500" />
          <p className="font-semibold text-sm">Loading chapters...</p>
        </div>
      )}

      {/* No chapters */}
      {classLevel && currentSubject && !chaptersLoading && finalChapters.length === 0 && (
        <div className="py-8 sm:py-10 text-center px-4 bg-amber-50/50 border-b border-amber-100">
          <AlertCircle size={28} className="mx-auto mb-3 text-amber-500" />
          <p className="font-bold text-sm text-amber-900">No chapters for {currentSubject} · {classLevel}</p>
          <p className="text-xs mt-1.5 text-amber-700">Try another subject or class.</p>
        </div>
      )}

      {/* Main content */}
      {classLevel && currentSubject && finalChapters.length > 0 && (
        <>
          {/* MOBILE */}
          <div className="block sm:hidden p-3 space-y-3">
            <AnimatePresence>
              {fields.map((field, index) => (
                <MobileCard
                  key={field.id}
                  index={index}
                  field={field}
                  availableTopics={finalChapters}
                  chapterGroups={finalChapterGroups}
                  subtopicsMap={subtopicsMap}
                  chaptersLoading={chaptersLoading}
                  remove={remove}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* DESKTOP */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <caption className="sr-only">Test configuration table</caption>
              <thead>
                <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-[#F3F4F6]">
                  <th className="py-4 px-6 w-12 text-center" />
                  <th className="py-4 px-4">Chapter & Topics</th>
                  <th className="py-4 px-4 w-20 text-center">Quantity</th>
                  <th className="py-4 px-4 w-20 text-center">Marks</th>
                  <th className="py-4 px-4 w-32">Difficulty</th>
                  <th className="py-4 px-4 w-48">Question Type</th>
                  <th className="py-4 px-4 w-20 text-center">Reference</th>
                  <th className="py-4 px-4 w-12 text-center" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <AnimatePresence>
                  {fields.map((field, index) => (
                    <TableRow
                      key={field.id}
                      index={index}
                      field={field}
                      availableTopics={finalChapters}
                      chapterGroups={finalChapterGroups}
                      subtopicsMap={subtopicsMap}
                      chaptersLoading={chaptersLoading}
                      remove={remove}
                    />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          <motion.button
            whileTap={{ scale: 0.99 }}
            type="button"
            onClick={handleAddRow}
            className="w-full py-4 sm:py-5 mt-2 bg-[#F9FAFB] active:bg-[#F3F4F6] text-sm font-bold text-gray-500 hover:text-gray-700 rounded-b-2xl sm:rounded-b-[22px] flex items-center justify-center gap-2 transition-all group min-h-[48px]"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            <PlusCircle size={18} className="group-hover:scale-110 transition-transform" />
            Add Chapter Section
          </motion.button>
        </>
      )}
    </motion.div>
  );
};

// ==================== MAIN EXPORT ====================
export const TestRowEditor = ({ activeMode }: { activeMode: string }) => {
  if (activeMode !== "Simple") {
    return (
      <div className="p-10 sm:p-16 text-center text-gray-400 font-bold bg-white rounded-2xl sm:rounded-[24px] border border-white shadow-sm">
        Coming Soon
      </div>
    );
  }
  return <SimpleModeView />;
};

export const FORMAT_MAP: Record<string, string> = {
  MCQ:          "mcq",
  Short:        "short_answer",
  Long:         "long_answer",
  Essay:        "long_answer",
  JournalEntry: "journal_entry",
  Ledger:       "ledger",
  TrialBalance: "trial_balance",
};