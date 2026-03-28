import React, { useRef, memo, useCallback, forwardRef, useState, useEffect } from "react";
import { useFieldArray, useFormContext, UseFormSetValue, UseFormWatch, FieldValues } from "react-hook-form";
import { GripVertical, Paperclip, Trash2, PlusCircle, Check, FileText, BookOpen, AlignLeft, ListChecks, ArrowLeftRight, Loader2 } from "lucide-react";
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

interface TableRowProps {
  index: number;
  field: { id: string };
  availableTopics: string[];
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

interface ChapterAPIResponse {
  chapters: {
    name: string;
    subtopics?: string[];
  }[];
}

// ==================== API: FETCH CHAPTERS ====================
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function fetchChaptersFromAPI(
  classLevel: string,
  subject: string
): Promise<ChapterAPIResponse> {
  // Extract class number: "Class 10" → "10"
  const classNum = classLevel.replace(/\D/g, "") || "10";
  
  const res = await fetch(
    `${API_BASE}/api/v1/test-generator/chapters?subject=${encodeURIComponent(subject)}&class_grade=${encodeURIComponent(classNum)}`
  );
  if (!res.ok) throw new Error(`Failed to fetch chapters: ${res.status}`);
  return res.json();
}

// ==================== HOOK: useChapters ====================
function useChapters(classLevel: string, subject: string) {
  const [chapters, setChapters] = useState<string[]>([]);
  const [subtopicsMap, setSubtopicsMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!classLevel || !subject) {
      setChapters([]);
      setSubtopicsMap({});
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchChaptersFromAPI(classLevel, subject)
      .then((data) => {
        if (cancelled) return;

        const chapterNames = data.chapters.map((ch) => ch.name);
        const sMap: Record<string, string[]> = {};
        data.chapters.forEach((ch) => {
          if (ch.subtopics && ch.subtopics.length > 0) {
            sMap[ch.name] = ch.subtopics;
          }
        });

        setChapters(chapterNames);
        setSubtopicsMap((prev) => ({ ...prev, ...sMap }));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Chapter fetch failed, using fallback:", err);
        setError(err.message);

        const fallback = SUBJECT_TOPICS_FALLBACK[subject] || [];
        setChapters(fallback);
        setSubtopicsMap(COMMON_SUBTOPICS_FALLBACK);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [classLevel, subject]);

  return { chapters, subtopicsMap, loading, error };
}

// ==================== FALLBACK DATA ====================
const SUBJECT_TOPICS_FALLBACK: Record<string, string[]> = {
  "Science": [
    "Chemical Reactions & Equations", "Acids, Bases & Salts", "Metals & Non-metals",
    "Carbon & Its Compounds", "Periodic Classification", "Life Processes",
    "Control & Coordination", "How do Organisms Reproduce", "Heredity & Evolution",
    "Light - Reflection & Refraction", "Human Eye & Colorful World", "Electricity",
    "Magnetic Effects of Electric Current", "Our Environment"
  ],
  "Physics": [
    "Electricity", "Magnetic Effects of Electric Current", "Light - Reflection & Refraction",
    "Human Eye & Colorful World", "Sources of Energy", "Motion", "Force & Laws of Motion",
    "Gravitation", "Work & Energy", "Sound", "Thermal Properties"
  ],
  "Chemistry": [
    "Chemical Reactions & Equations", "Acids, Bases & Salts", "Metals & Non-metals",
    "Carbon & Its Compounds", "Periodic Classification", "Matter in Our Surroundings",
    "Is Matter Around Us Pure", "Atoms & Molecules", "Structure of Atom"
  ],
  "Biology": [
    "Life Processes", "Control & Coordination", "How do Organisms Reproduce",
    "Heredity & Evolution", "Our Environment", "Management of Natural Resources",
    "Diversity in Living Organisms", "Tissues", "Why do We Fall Ill"
  ],
  "Mathematics": [
    "SETS", "RELATIONS AND FUNCTIONS", "TRIGONOMETRIC FUNCTIONS",
    "COMPLEX NUMBERS AND QUADRATIC EQUATIONS", "LINEAR INEQUALITIES",
    "PERMUTATIONS AND COMBINATIONS", "BINOMIAL THEOREM",
    "SEQUENCES AND SERIES", "STRAIGHT LINES",
    "CONIC SECTIONS", "THREE DIMENSIONAL GEOMETRY", "LIMITS AND DERIVATIVES",
    "STATISTICS", "PROBABILITY"
  ],
  "Social Science": [
    "The Rise of Nationalism in Europe", "Nationalism in India", "The Making of a Global World",
    "The Age of Industrialisation", "Print Culture & Modern World", "Resources & Development",
    "Forest & Wildlife Resources", "Water Resources", "Agriculture", "Minerals & Energy Resources",
    "Manufacturing Industries", "Lifelines of National Economy", "Power Sharing", "Federalism",
    "Democracy & Diversity", "Gender, Religion & Caste", "Popular Struggles & Movements",
    "Political Parties", "Outcomes of Democracy", "Development", "Sectors of Indian Economy",
    "Money & Credit", "Globalisation & Indian Economy", "Consumer Rights"
  ],
  "Political Science": [
    "Power Sharing", "Federalism", "Gender, Religion and Caste",
    "Political Parties", "Outcomes of Democracy"
  ],
  "Accountancy": [
    "Introduction to Accounting", "Theory Base of Accounting", "Recording of Transactions",
    "Ledger", "Trial Balance", "Bank Reconciliation Statement", "Depreciation",
    "Provisions and Reserves", "Bill of Exchange", "Financial Statements",
    "Accounts from Incomplete Records", "Accounting for Partnership", "Reconstitution of Partnership",
    "Dissolution of Partnership", "Accounting for Companies", "Analysis of Financial Statements",
    "Cash Flow Statement"
  ],
  "Accounts": [
    "Introduction to Accounting", "Theory Base of Accounting", "Recording of Transactions",
    "Ledger", "Trial Balance", "Bank Reconciliation Statement", "Depreciation",
    "Provisions and Reserves", "Bill of Exchange", "Financial Statements",
    "Accounts from Incomplete Records", "Accounting for Partnership", "Reconstitution of Partnership",
    "Dissolution of Partnership", "Accounting for Companies", "Analysis of Financial Statements",
    "Cash Flow Statement"
  ],
  "Accounting": [
    "Introduction to Accounting", "Theory Base of Accounting", "Recording of Transactions",
    "Ledger", "Trial Balance", "Bank Reconciliation Statement", "Depreciation",
    "Provisions and Reserves", "Bill of Exchange", "Financial Statements",
    "Accounts from Incomplete Records", "Accounting for Partnership", "Reconstitution of Partnership",
    "Dissolution of Partnership", "Accounting for Companies", "Analysis of Financial Statements",
    "Cash Flow Statement"
  ],
};

const COMMON_SUBTOPICS_FALLBACK: Record<string, string[]> = {
  "Chemical Reactions & Equations": ["Chemical reactions", "Balanced chemical equations", "Types of reactions", "Oxidation and reduction", "Corrosion and rancidity"],
  "Acids, Bases & Salts": ["Properties of acids and bases", "pH scale", "Common salts", "Uses of acids, bases and salts"],
  "Metals & Non-metals": ["Physical and chemical properties", "Reactivity series", "Extraction of metals", "Corrosion and prevention"],
  "Carbon & Its Compounds": ["Covalent bonding", "Homologous series", "Functional groups", "Ethanol and ethanoic acid", "Soaps and detergents"],
  "Periodic Classification": ["Mendeleev's table", "Modern periodic table", "Trends in periodic table"],
  "Light - Reflection & Refraction": ["Reflection by mirrors", "Refraction", "Lenses", "Power of lens"],
  "Human Eye & Colorful World": ["Structure of eye", "Defects of vision", "Dispersion and scattering of light"],
  "Electricity": ["Electric current", "Ohm's law", "Resistance", "Electric power"],
  "Magnetic Effects of Electric Current": ["Magnetic field", "Electric motor", "Electromagnetic induction", "Generator"],
  "Life Processes": ["Nutrition", "Respiration", "Transportation", "Excretion"],
  "Control & Coordination": ["Nervous system", "Hormonal coordination", "Endocrine glands"],
  "How do Organisms Reproduce": ["Asexual reproduction", "Sexual reproduction", "Reproductive health"],
  "Heredity & Evolution": ["Mendel's experiments", "Inheritance of traits", "Evolution and speciation"],
  "Our Environment": ["Ecosystem", "Food chains", "Energy flow", "Pollution"],
  "Power Sharing": ["Belgium model", "Sri Lanka model", "Forms of power sharing"],
  "Federalism": ["Union list", "State list", "Concurrent list", "Decentralisation", "Panchayati Raj"],
  "Gender, Religion and Caste": ["Gender division", "Religion and politics", "Caste and politics"],
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
  { value: "MCQ",    label: "MCQ",   icon: ListChecks,     color: "bg-gray-800 text-white" },
  { value: "Short",  label: "Short", icon: AlignLeft,      color: "bg-blue-600 text-white" },
  { value: "Long",   label: "Long",  icon: FileText,       color: "bg-purple-600 text-white" },
  { value: "Essay",  label: "Essay", icon: ArrowLeftRight, color: "bg-amber-600 text-white" },
];

const ACCOUNTANCY_FORMATS = [
  { value: "JournalEntry", label: "Journal",  icon: FileText,       color: "bg-emerald-600 text-white" },
  { value: "Ledger",       label: "Ledger",   icon: BookOpen,       color: "bg-teal-600 text-white" },
  { value: "TrialBalance", label: "Trial Bal",icon: ListChecks,     color: "bg-cyan-600 text-white" },
];

const ACCOUNTANCY_SUBJECTS_FE = ["Accountancy", "Accounts", "Accounting"];

// ==================== UUID GENERATOR ====================
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// ==================== FILE UPLOAD HANDLER ====================
const RefUploadButton: React.FC<RefUploadButtonProps> = memo(({ index, setValue, watch }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const file = watch(`simpleData.${index}.refFile`);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (fileRef.current) {
      fileRef.current.value = '';
    }
    if (selectedFile) {
      setValue(`simpleData.${index}.refFile`, selectedFile);
    } else {
      setValue(`simpleData.${index}.refFile`, undefined);
    }
  }, [index, setValue]);

  const handleButtonClick = useCallback(() => {
    if (fileRef.current) {
      fileRef.current.click();
    }
  }, []);

  const handleClearFile = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setValue(`simpleData.${index}.refFile`, undefined);
  }, [index, setValue]);

  return (
    <div className="relative">
      <input
        type="file"
        ref={fileRef}
        className="hidden"
        onChange={handleFileChange}
        accept=".pdf,.doc,.docx,.txt,.md"
        aria-label={`Upload reference file for row ${index + 1}`}
      />
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        type="button"
        onClick={handleButtonClick}
        className={`p-2.5 rounded-xl transition-all border shadow-sm ${
          file
            ? 'bg-gray-800 text-white border-gray-800 hover:bg-gray-900'
            : 'bg-white text-gray-400 border-[#E5E7EB] hover:border-gray-400 hover:text-gray-600'
        }`}
        title={file ? `Reference: ${file.name}` : "Upload Reference"}
        aria-label={file ? `Change reference file ${file.name}` : "Add reference file"}
      >
        <div className="flex items-center gap-2">
          {file ? <Check size={16} /> : <Paperclip size={16} />}
          {file && (
            <span className="text-xs max-w-[80px] truncate">
              {file.name.length > 10 ? `${file.name.substring(0, 8)}...` : file.name}
            </span>
          )}
        </div>
      </motion.button>

      {file && (
        <button
          type="button"
          onClick={handleClearFile}
          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
          aria-label={`Remove reference file ${file.name}`}
        >
          ×
        </button>
      )}
    </div>
  );
});

RefUploadButton.displayName = 'RefUploadButton';

// ==================== QUESTION TYPE SELECTOR (FIXED) ====================
const FormatSelector = memo(({ index, subject }: { index: number; subject: string }) => {
  const { watch, setValue } = useFormContext();
  const currentFormat = watch(`simpleData.${index}.format`) || "MCQ";
  const isAccountancy = ACCOUNTANCY_SUBJECTS_FE.includes(subject);

  const visibleFormats = isAccountancy
    ? [...QUESTION_FORMATS, ...ACCOUNTANCY_FORMATS]
    : QUESTION_FORMATS;

  // Reset to MCQ if switching away from Accountancy but accountancy format is selected
  React.useEffect(() => {
    const accValues = ACCOUNTANCY_FORMATS.map(f => f.value);
    if (!isAccountancy && accValues.includes(currentFormat)) {
      setValue(`simpleData.${index}.format`, "MCQ");
    }
  }, [isAccountancy, currentFormat, index, setValue]);

  return (
    <div className="flex gap-1 flex-wrap">
      {visibleFormats.map((fmt) => {
        const isActive = currentFormat === fmt.value;
        const Icon = fmt.icon;
        return (
          <button
            key={fmt.value}
            type="button"
            onClick={() => setValue(`simpleData.${index}.format`, fmt.value)}
            className={`px-2 py-1.5 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-all border ${
              isActive
                ? `${fmt.color} border-transparent shadow-sm`
                : 'bg-white text-gray-400 border-[#E5E7EB] hover:border-gray-400 hover:text-gray-600'
            }`}
            title={fmt.value}
          >
            <Icon size={10} /> {fmt.label}
          </button>
        );
      })}
    </div>
  );
});
FormatSelector.displayName = 'FormatSelector';

// ==================== TABLE ROW ====================
const TableRow = memo(forwardRef<HTMLTableRowElement, TableRowProps>(({
  index,
  field,
  availableTopics,
  subtopicsMap,
  chaptersLoading,
  remove
}, ref) => {
  const { register, watch, setValue } = useFormContext<FormValues>();
  const currentTopic = watch(`simpleData.${index}.topic`);
  const subject = watch("subject") || ""; // ← ADDED: Get subject from form context

  const subOptions = subtopicsMap[currentTopic] || COMMON_SUBTOPICS_FALLBACK[currentTopic] || [];

  const rowNumber = index + 1;

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
        <GripVertical
          size={16}
          className="text-gray-300 cursor-grab hover:text-gray-600 transition-colors"
          aria-label={`Drag to reorder row ${rowNumber}`}
        />
      </td>

      <td className="py-3 px-4">
        <div className="flex flex-col gap-2">
          <div className="relative">
            <select
              {...register(`simpleData.${index}.topic`, {
                required: "Topic is required"
              })}
              className="w-full bg-transparent text-sm font-bold text-[#111827] outline-none border-b border-dashed border-gray-300 focus:border-gray-500 py-1 cursor-pointer appearance-none hover:text-gray-600 disabled:opacity-50"
              disabled={chaptersLoading}
              aria-label={`Select topic for row ${rowNumber}`}
            >
              <option value="">
                {chaptersLoading ? "Loading chapters..." : "Select Chapter/Topic..."}
              </option>
              {availableTopics.map(topic => (
                <option key={topic} value={topic}>{topic}</option>
              ))}
            </select>
            {chaptersLoading && (
              <Loader2 size={14} className="absolute right-2 top-2 animate-spin text-gray-400" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#E5E7EB] group-hover:bg-gray-400 transition-colors" aria-hidden="true" />
            <select
              {...register(`simpleData.${index}.subtopic`)}
              className="w-full bg-transparent text-xs font-semibold text-gray-500 outline-none cursor-pointer disabled:opacity-50 hover:text-gray-700 appearance-none"
              disabled={!currentTopic || subOptions.length === 0}
              aria-label={`Select subtopic for ${currentTopic || 'topic'} in row ${rowNumber}`}
            >
              <option value="">
                {!currentTopic
                  ? "Select Subtopic (Optional)..."
                  : subOptions.length === 0
                    ? "No subtopics available"
                    : "Select Subtopic (Optional)..."
                }
              </option>
              {subOptions.map(subtopic => (
                <option key={subtopic} value={subtopic}>{subtopic}</option>
              ))}
            </select>
          </div>
        </div>
      </td>

      {/* QUANTITY */}
      <td className="py-3 px-4 text-center">
        <select
          {...register(`simpleData.${index}.quantity`, { valueAsNumber: true })}
          className="w-16 bg-[#F3F4F6] border-none rounded-xl py-2 text-center text-xs font-bold text-[#111827] focus:ring-2 focus:ring-gray-400/20 outline-none appearance-none"
          aria-label={`Select number of questions for row ${rowNumber}`}
        >
          {[1,2,3,4,5,6,7,8,9,10].map(num => (
            <option key={num} value={num}>{num}</option>
          ))}
        </select>
      </td>

      {/* MARKS */}
      <td className="py-3 px-4 text-center">
        <select
          {...register(`simpleData.${index}.marks`, { valueAsNumber: true })}
          className="w-16 bg-[#F3F4F6] border-none rounded-xl py-2 text-center text-xs font-bold text-[#111827] focus:ring-2 focus:ring-gray-400/20 outline-none appearance-none"
        >
          <option value={1}>1m</option>
          <option value={2}>2m</option>
          <option value={3}>3m</option>
          <option value={4}>4m</option>
          <option value={5}>5m</option>
          <option value={6}>6m</option>
          <option value={6}>7m</option>
          <option value={6}>8m</option>
          <option value={6}>9m</option>
          <option value={6}>10m</option>
        </select>
      </td>

      {/* DIFFICULTY */}
      <td className="py-3 px-4">
        <select
          {...register(`simpleData.${index}.difficulty`)}
          className="w-full bg-white border border-[#E5E7EB] text-xs font-bold text-gray-600 rounded-xl py-2 px-3 outline-none cursor-pointer hover:border-gray-400 transition-colors shadow-sm appearance-none"
          aria-label={`Select difficulty for row ${rowNumber}`}
        >
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
          <option value="Mixed">Mixed</option>
        </select>
      </td>

      {/* QUESTION TYPE */}
      <td className="py-3 px-4">
        <FormatSelector index={index} subject={subject} />
      </td>

      {/* REFERENCE */}
      <td className="py-3 px-4 text-center">
        <RefUploadButton index={index} setValue={setValue} watch={watch} />
      </td>

      {/* DELETE */}
      <td className="py-3 px-4 text-center">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          type="button"
          onClick={() => remove(index)}
          className="p-2 rounded-full bg-white border border-transparent hover:border-red-100 hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all shadow-sm"
          aria-label={`Remove row ${rowNumber}`}
        >
          <Trash2 size={16} aria-hidden="true" />
        </motion.button>
      </td>
    </motion.tr>
  );
}));

TableRow.displayName = 'TableRow';

// ==================== SIMPLE MODE VIEW ====================
const SimpleModeView: React.FC = () => {
  const { control, watch, setValue: setFormValue } = useFormContext<FormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "simpleData",
  });

  const classLevel = watch("classGrade") || "";
  const currentSubject = watch("subject") || "";
  const useNCERT = watch("useNCERT");
  const ncertChapters = watch("ncertChapters") || [];

  const availableTopics = React.useMemo(() => {
    if (ncertChapters.length > 0) {
      return ncertChapters;
    }
    return SUBJECT_TOPICS_FALLBACK[currentSubject] || [];
  }, [ncertChapters, currentSubject]);

  const chaptersLoading = false;
  const subtopicsMap: Record<string, string[]> = {};

  const prevKeyRef = useRef(`${classLevel}-${currentSubject}`);
  useEffect(() => {
    const newKey = `${classLevel}-${currentSubject}`;
    if (prevKeyRef.current !== newKey && prevKeyRef.current !== "-") {
      fields.forEach((_, idx) => {
        setFormValue(`simpleData.${idx}.topic` as any, "");
        setFormValue(`simpleData.${idx}.subtopic` as any, "");
      });
    }
    prevKeyRef.current = newKey;
  }, [classLevel, currentSubject, fields, setFormValue]);

  const handleAddRow = useCallback(() => {
    append({
      id: generateUUID(),
      topic: "",
      quantity: 5,
      marks: 1,
      difficulty: "Medium",
      format: "MCQ",
    });
  }, [append]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/50 backdrop-blur-sm p-2"
    >
      <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 rounded-t-[22px]">
        <div className="flex items-center gap-2 text-sm text-blue-800">
          <BookOpen size={16} aria-hidden="true" />
          <div className="flex items-center gap-3 flex-wrap">
            {classLevel && (
              <span>
                <span className="font-semibold">Class:</span> {classLevel}
              </span>
            )}
            <span>
              <span className="font-semibold">Subject:</span> {currentSubject || "Not selected"}
            </span>
            {ncertChapters.length > 0 && (
              <span>
                <span className="font-semibold">NCERT Chapters:</span> {ncertChapters.slice(0, 3).join(", ")}
                {ncertChapters.length > 3 && ` +${ncertChapters.length - 3} more`}
              </span>
            )}
          </div>
        </div>
      </div>

      {(!classLevel || !currentSubject) && (
        <div className="py-12 text-center text-gray-400">
          <BookOpen size={32} className="mx-auto mb-3 opacity-50" />
          <p className="font-semibold">Select a Class and Subject above</p>
          <p className="text-xs mt-1">Chapters will load automatically</p>
        </div>
      )}

      {classLevel && currentSubject && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <caption className="sr-only">Test configuration table with chapters and questions</caption>
              <thead>
                <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-[#F3F4F6]">
                  <th scope="col" className="py-4 px-6 w-12 text-center" aria-label="Drag handle"></th>
                  <th scope="col" className="py-4 px-4">Chapter & Topics</th>
                  <th scope="col" className="py-4 px-4 w-20 text-center">Quantity</th>
                  <th scope="col" className="py-4 px-4 w-20 text-center">Marks</th>
                  <th scope="col" className="py-4 px-4 w-32">Difficulty</th>
                  <th scope="col" className="py-4 px-4 w-48">Question Type</th>
                  <th scope="col" className="py-4 px-4 w-20 text-center">Reference</th>
                  <th scope="col" className="py-4 px-4 w-12 text-center" aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <AnimatePresence>
                  {fields.map((field, index) => (
                    <TableRow
                      key={field.id}
                      index={index}
                      field={field}
                      availableTopics={availableTopics}
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
            whileHover={{ backgroundColor: "#F3F4F6" }}
            whileTap={{ scale: 0.99 }}
            type="button"
            onClick={handleAddRow}
            className="w-full py-5 mt-2 bg-[#F9FAFB] text-sm font-bold text-gray-400 hover:text-gray-600 rounded-b-[22px] flex items-center justify-center gap-2 transition-all group"
            aria-label="Add new chapter section"
          >
            <PlusCircle size={18} className="group-hover:scale-110 transition-transform" aria-hidden="true" />
            Add Chapter Section
          </motion.button>
        </>
      )}
    </motion.div>
  );
};

// ==================== MAIN COMPONENT ====================
export const TestRowEditor = ({ activeMode }: { activeMode: string }) => {
  if (activeMode !== "Simple") {
    return (
      <div
        className="p-16 text-center text-gray-400 font-bold bg-white rounded-[24px] border border-white shadow-sm"
        aria-live="polite"
      >
        Coming Soon
      </div>
    );
  }

  return <SimpleModeView />;
};

// ==================== FORMAT MAP FOR API CALL ====================
export const FORMAT_MAP: Record<string, string> = {
  MCQ:          "mcq",
  Short:        "short_answer",
  Long:         "long_answer",
  Essay:        "long_answer",
  JournalEntry: "journal_entry",
  Ledger:       "ledger",
  TrialBalance: "trial_balance",
};