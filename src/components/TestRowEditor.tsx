// src/components/TestRowEditor.tsx
// ──────────────────────────────────────────────────────────────────────
// V4 — Grouped chapter dropdown (English: First Flight Prose / Poems / FWF)
//      + Writing Skills & Grammar virtual chapters for English
//
// Changes vs V3:
//   - fetchChaptersFromAPI now also captures `groups` (book + chapter_type)
//   - useChapters returns chapterGroups
//   - MobileCard / TableRow render <optgroup> when groups exist
//   - Flat list fallback preserved for Science / Maths / etc.
//   - English subject: injects "Writing Skills" & "Grammar" virtual chapters
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

// v4: chapter group structure from backend
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
  chapterGroups: ChapterGroup[] | null; // v4
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

// ==================== API: FETCH CHAPTERS ====================
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface ChaptersFetchResult {
  flat: string[];
  groups: ChapterGroup[] | null;
}

async function fetchChaptersFromAPI(classLevel: string, subject: string): Promise<ChaptersFetchResult> {
  const classNum = classLevel.replace(/\D/g, "") || "10";
  const res = await fetch(
    `${API_BASE}/api/v1/test-generator/chapters?subject=${encodeURIComponent(subject)}&class_grade=${encodeURIComponent(classNum)}`
  );
  if (!res.ok) throw new Error(`Failed to fetch chapters: ${res.status}`);
  const data = await res.json();

  const flat: string[] = (data.chapters && Array.isArray(data.chapters)) ? data.chapters : [];
  const groups: ChapterGroup[] | null = (data.groups && Array.isArray(data.groups) && data.groups.length > 0)
    ? data.groups
    : null;

  return { flat, groups };
}

// ==================== HOOK: useChapters ====================
function useChapters(classLevel: string, subject: string) {
  const [chapters, setChapters] = useState<string[]>([]);
  const [chapterGroups, setChapterGroups] = useState<ChapterGroup[] | null>(null); // v4
  const [subtopicsMap, setSubtopicsMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!classLevel || !subject) {
      setChapters([]);
      setChapterGroups(null);
      setSubtopicsMap({});
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchChaptersFromAPI(classLevel, subject)
      .then(({ flat, groups }) => {
        if (cancelled) return;
        setChapters(flat);
        setChapterGroups(groups);
        const sMap: Record<string, string[]> = {};
        flat.forEach((ch) => {
          if (COMMON_SUBTOPICS[ch]) sMap[ch] = COMMON_SUBTOPICS[ch];
        });
        setSubtopicsMap(sMap);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Chapter fetch failed:", err);
        setError(err.message);
        setChapters([]);
        setChapterGroups(null);
        setSubtopicsMap({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [classLevel, subject]);

  return { chapters, chapterGroups, subtopicsMap, loading, error };
}

// ==================== COMMON SUBTOPICS (helper map only) ====================

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
  // --- Physics Class 11 ---
  "UNITS AND MEASUREMENTS": ["International system of units", "Significant figures", "Dimensional analysis", "Errors in measurement"],
  "Motion in a Straight Line": ["Average velocity and speed", "Instantaneous velocity", "Acceleration", "Relative velocity", "Kinematic equations"],
  "Motion in a Plane": ["Scalars and vectors", "Resolution of vectors", "Projectile motion", "Uniform circular motion"],
  "Laws of Motion": ["Inertia", "Newton's laws of motion", "Conservation of momentum", "Equilibrium of a particle", "Friction", "Circular motion dynamics"],
  "Work Energy and Power": ["Work-energy theorem", "Kinetic and potential energy", "Conservation of mechanical energy", "Collisions (Elastic and Inelastic)"],
  "System of Particles and Rotational Motion": ["Centre of mass", "Moment of force (Torque)", "Angular momentum", "Moment of inertia", "Theorems of perpendicular and parallel axes"],
  "Gravitation": ["Kepler's laws", "Universal law of gravitation", "Acceleration due to gravity", "Gravitational potential energy", "Escape speed", "Orbital velocity"],
  "Mechanical Properties of Solids": ["Elastic behavior", "Stress and strain", "Hooke's law", "Young's modulus", "Bulk modulus"],
  "Mechanical Properties of Fluids": ["Pascal's law", "Viscosity", "Bernoulli's principle", "Surface tension", "Stokes' law"],
  "Thermal Properties of Matter": ["Temperature and heat", "Thermal expansion", "Specific heat capacity", "Calorimetry", "Latent heat", "Newton's law of cooling"],
  "Thermodynamics": ["Thermal equilibrium", "First law of thermodynamics", "Isothermal and adiabatic processes", "Second law of thermodynamics", "Reversible and irreversible processes"],
  "Kinetic Theory": ["Molecular nature of matter", "Behavior of gases", "Law of equipartition of energy", "Mean free path"],
  "Oscillations": ["Simple harmonic motion", "Energy in SHM", "Simple pendulum", "Damped and forced oscillations"],
  "Waves": ["Transverse and longitudinal waves", "Displacement relation", "Speed of a travelling wave", "Superposition principle", "Standing waves", "Doppler effect"],

  // --- Chemistry Class 11 ---
  "Some Basic Concepts of Chemistry": ["Atomic and molecular masses", "Mole concept", "Molar mass", "Percentage composition", "Stoichiometry"],
  "Structure of Atom": ["Bohr's model", "Quantum mechanical model", "Quantum numbers", "Electronic configuration", "Photoelectric effect"],
  "Classification of Elements and Periodicity": ["Modern periodic law", "Periodic trends (Atomic radii, Ionization enthalpy, Electronegativity)"],
  "Chemical Bonding and Molecular Structure": ["Ionic and covalent bond", "VSEPR theory", "Valence bond theory", "Hybridization", "Molecular orbital theory"],
  "Thermodynamics (Chemistry)": ["Internal energy and enthalpy", "Heat capacity", "Hess's law", "Entropy", "Gibbs energy change"],
  "Equilibrium": ["Law of mass action", "Le Chatelier's principle", "Ionization of acids and bases", "Solubility product"],
  "Redox Reactions": ["Oxidation number", "Balancing redox reactions", "Electrode processes"],
  "Organic Chemistry Some Basic Principles and Techniques": ["IUPAC nomenclature", "Isomerism", "Inductive and electromeric effects", "Resonance", "Chromatography"],
  "Hydrocarbons": ["Alkanes (Conformations)", "Alkenes (Geometrical isomerism)", "Alkynes", "Aromatic hydrocarbons (Huckel's rule)"],

  // --- Mathematics Class 11 ---
  "Sets": ["Representation of sets", "Empty and finite sets", "Subsets", "Power set", "Venn diagrams", "Operations on sets"],
  "Relations and Functions (Class 11)": ["Cartesian product", "Domain and range", "Identity, constant, and polynomial functions"],
  "Trigonometric Functions": ["Angles (Radian and Degree)", "Signs of trigonometric functions", "Trigonometric equations", "Compound angle formulas"],
  "Complex Numbers and Quadratic Equations": ["Imaginary numbers", "Argand plane", "Modulus and conjugate", "Roots of quadratic equations"],
  "Linear Inequalities": ["Algebraic solutions of linear inequalities", "Graphical representation"],
  "Permutations and Combinations": ["Fundamental principle of counting", "Factorial notation", "Derivation of formulas for nPr and nCr"],
  "Binomial Theorem": ["Binomial theorem for positive integral indices", "Pascal's triangle", "General and middle terms"],
  "Sequences and Series": ["Arithmetic progression (AP)", "Geometric progression (GP)", "Sum to n terms of special series"],
  "Straight Lines": ["Slope of a line", "Various forms of equations of a line", "Distance of a point from a line"],
  "Conic Sections": ["Sections of a cone", "Circle", "Parabola", "Ellipse", "Hyperbola"],
  "Introduction to Three Dimensional Geometry": ["Coordinate axes and planes", "Distance between two points", "Section formula"],
  "Limits and Derivatives": ["Intuitive idea of limits", "Standard limits", "Derivative as rate of change", "Product and quotient rule"],
  "Statistics": ["Measures of dispersion", "Range", "Mean deviation", "Variance and standard deviation"],
  "Probability (Class 11)": ["Random experiments", "Events", "Axiomatic approach to probability"]

};


// ==================== QUESTION TYPE CONFIG ====================
const QUESTION_FORMATS = [
  { value: "MCQ",    label: "MCQ",   icon: ListChecks,     color: "bg-gray-800 text-white" },
  { value: "Short",  label: "Short", icon: AlignLeft,      color: "bg-blue-600 text-white" },
  { value: "Long",   label: "Long",  icon: FileText,       color: "bg-purple-600 text-white" },
  { value: "Essay",  label: "Essay", icon: ArrowLeftRight, color: "bg-amber-600 text-white" },
];

const ACCOUNTANCY_FORMATS = [
  { value: "JournalEntry", label: "Journal",   icon: FileText,   color: "bg-emerald-600 text-white" },
  { value: "Ledger",       label: "Ledger",    icon: BookOpen,   color: "bg-teal-600 text-white" },
  { value: "TrialBalance", label: "Trial Bal", icon: ListChecks, color: "bg-cyan-600 text-white" },
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

// ==================== CHAPTER OPTIONS RENDERER (v4) ====================
function renderChapterOptions(
  chapterGroups: ChapterGroup[] | null,
  flatChapters: string[],
): React.ReactNode {
  if (chapterGroups && chapterGroups.length > 0) {
    return chapterGroups.map((group) => (
      <optgroup
        key={`${group.book || 'x'}-${group.chapter_type || 'x'}`}
        label={group.label}
      >
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
const RefUploadButton: React.FC<RefUploadButtonProps & { fullWidth?: boolean }> = memo(({ index, setValue, watch, fullWidth }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const file = watch(`simpleData.${index}.refFile`);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (selectedFile) setValue(`simpleData.${index}.refFile`, selectedFile);
    else setValue(`simpleData.${index}.refFile`, undefined);
  }, [index, setValue]);

  const handleButtonClick = useCallback(() => {
    if (fileRef.current) fileRef.current.click();
  }, []);

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
        aria-label={`Upload reference file for row ${index + 1}`}
      />
      <motion.button
        whileTap={{ scale: 0.97 }}
        type="button"
        onClick={handleButtonClick}
        className={`${fullWidth ? "w-full justify-center" : ""} min-h-[44px] px-3 py-2.5 rounded-xl transition-all border shadow-sm flex items-center gap-2 ${
          file
            ? 'bg-gray-800 text-white border-gray-800 active:bg-gray-900'
            : 'bg-white text-gray-500 border-[#E5E7EB] active:border-gray-400'
        }`}
        style={{ WebkitTapHighlightColor: "transparent" }}
        title={file ? `Reference: ${file.name}` : "Upload Reference"}
      >
        {file ? <Check size={16} /> : <Paperclip size={16} />}
        <span className="text-xs font-semibold">
          {file
            ? (file.name.length > 16 ? `${file.name.substring(0, 14)}...` : file.name)
            : "Add Reference"}
        </span>
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

// ==================== QUESTION TYPE SELECTOR ====================
const FormatSelector = memo(({ index, subject }: { index: number; subject: string }) => {
  const { watch, setValue } = useFormContext();
  const currentFormat = watch(`simpleData.${index}.format`) || "MCQ";
  const isAccountancy = ACCOUNTANCY_SUBJECTS_FE.includes(subject);

  const visibleFormats = isAccountancy
    ? [...QUESTION_FORMATS, ...ACCOUNTANCY_FORMATS]
    : QUESTION_FORMATS;

  React.useEffect(() => {
    const accValues = ACCOUNTANCY_FORMATS.map(f => f.value);
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
              isActive
                ? `${fmt.color} border-transparent shadow-sm`
                : 'bg-white text-gray-500 border-[#E5E7EB] active:border-gray-400'
            }`}
            style={{ WebkitTapHighlightColor: "transparent" }}
            title={fmt.value}
          >
            <Icon size={11} /> {fmt.label}
          </button>
        );
      })}
    </div>
  );
});
FormatSelector.displayName = 'FormatSelector';

// ═══════════════════════════════════════════════════════════════════════
// MOBILE: Card Row
// ═══════════════════════════════════════════════════════════════════════
const MobileCard = memo(({ index, field, availableTopics, chapterGroups, subtopicsMap, chaptersLoading, remove }: RowProps) => {
  const { register, watch, setValue } = useFormContext<FormValues>();
  const currentTopic = watch(`simpleData.${index}.topic`);
  const subject = watch("subject") || "";
  const subOptions = subtopicsMap[currentTopic] || COMMON_SUBTOPICS[currentTopic] || [];

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
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider bg-gray-100 px-2.5 py-1 rounded-full">
          Section {index + 1}
        </span>
        <button
          type="button"
          onClick={() => remove(index)}
          className="min-w-[36px] min-h-[36px] p-2 rounded-full text-gray-400 active:bg-red-50 active:text-red-500 transition-colors"
          style={{ WebkitTapHighlightColor: "transparent" }}
          aria-label={`Remove section ${index + 1}`}
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div>
        <label className={labelClass}>Chapter</label>
        <div className="relative">
          <select
            {...register(`simpleData.${index}.topic`)}
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

      <div>
        <label className={labelClass}>Subtopic (optional)</label>
        <select
          {...register(`simpleData.${index}.subtopic`)}
          disabled={!currentTopic || subOptions.length === 0}
          className={`${inputClass} disabled:opacity-60 disabled:bg-gray-50`}
        >
          <option value="">
            {!currentTopic ? "Select a chapter first" : subOptions.length === 0 ? "No subtopics available" : "Select subtopic..."}
          </option>
          {subOptions.map(sub => (
            <option key={sub} value={sub}>{sub}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Quantity</label>
          <select
            {...register(`simpleData.${index}.quantity`, { valueAsNumber: true })}
            className={inputClass}
          >
            {[1,2,3,4,5,6,7,8,9,10,15,20].map(num => (
              <option key={num} value={num}>{num}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Marks each</label>
          <select
            {...register(`simpleData.${index}.marks`, { valueAsNumber: true })}
            className={inputClass}
          >
            {[1,2,3,4,5,6,7,8,9,10].map(num => (
              <option key={num} value={num}>{num} marks</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Difficulty</label>
        <select
          {...register(`simpleData.${index}.difficulty`)}
          className={inputClass}
        >
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
          <option value="Mixed">Mixed</option>
        </select>
      </div>

      <div>
        <label className={labelClass}>Question Type</label>
        <FormatSelector index={index} subject={subject} />
      </div>

      <div>
        <label className={labelClass}>Reference (optional)</label>
        <RefUploadButton index={index} setValue={setValue} watch={watch} fullWidth />
      </div>
    </motion.div>
  );
});
MobileCard.displayName = 'MobileCard';

// ═══════════════════════════════════════════════════════════════════════
// DESKTOP: Table Row
// ═══════════════════════════════════════════════════════════════════════
const TableRow = memo(forwardRef<HTMLTableRowElement, RowProps>(({
  index, field, availableTopics, chapterGroups, subtopicsMap, chaptersLoading, remove
}, ref) => {
  const { register, watch, setValue } = useFormContext<FormValues>();
  const currentTopic = watch(`simpleData.${index}.topic`);
  const subject = watch("subject") || "";
  const subOptions = subtopicsMap[currentTopic] || COMMON_SUBTOPICS[currentTopic] || [];
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
        <GripVertical size={16} className="text-gray-300 cursor-grab hover:text-gray-600 transition-colors" />
      </td>

      <td className="py-3 px-4">
        <div className="flex flex-col gap-2">
          <div className="relative">
            <select
              {...register(`simpleData.${index}.topic`)}
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

          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#E5E7EB] group-hover:bg-gray-400 transition-colors" aria-hidden="true" />
            <select
              {...register(`simpleData.${index}.subtopic`)}
              className="w-full bg-transparent text-xs font-semibold text-gray-500 outline-none cursor-pointer disabled:opacity-50 hover:text-gray-700 appearance-none"
              disabled={!currentTopic || subOptions.length === 0}
            >
              <option value="">
                {!currentTopic ? "Select Subtopic (Optional)..." : subOptions.length === 0 ? "No subtopics available" : "Select Subtopic (Optional)..."}
              </option>
              {subOptions.map(subtopic => (
                <option key={subtopic} value={subtopic}>{subtopic}</option>
              ))}
            </select>
          </div>
        </div>
      </td>

      <td className="py-3 px-4 text-center">
        <select
          {...register(`simpleData.${index}.quantity`, { valueAsNumber: true })}
          className="w-16 bg-[#F3F4F6] border-none rounded-xl py-2 text-center text-xs font-bold text-[#111827] focus:ring-2 focus:ring-gray-400/20 outline-none appearance-none"
        >
          {[1,2,3,4,5,6,7,8,9,10,15,20].map(num => <option key={num} value={num}>{num}</option>)}
        </select>
      </td>

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
          <option value={7}>7m</option>
          <option value={8}>8m</option>
          <option value={9}>9m</option>
          <option value={10}>10m</option>
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
          aria-label={`Remove row ${rowNumber}`}
        >
          <Trash2 size={16} />
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

  const {
    chapters: apiChapters,
    chapterGroups: apiChapterGroups,
    subtopicsMap,
    loading: chaptersLoading,
    error: chaptersError,
  } = useChapters(classLevel, currentSubject);

  // ═════════════════════════════════════════════════════════════════════
  // Inject Writing Skills & Grammar for English
  // ═════════════════════════════════════════════════════════════════════
  const isEnglish = currentSubject?.toLowerCase() === "english";

  const finalChapters = React.useMemo(() => {
    if (!isEnglish) return apiChapters;
    return [...apiChapters, "Writing Skills", "Grammar"];
  }, [apiChapters, isEnglish]);

  const finalChapterGroups = React.useMemo(() => {
    if (!isEnglish) return apiChapterGroups;

    const baseGroups: ChapterGroup[] = (apiChapterGroups && apiChapterGroups.length > 0)
      ? [...apiChapterGroups]
      : [];

    // FIX: If backend returned flat chapters but no groups, wrap as fallback group
    if (baseGroups.length === 0 && apiChapters.length > 0) {
      baseGroups.push({
        book: "literature",
        chapter_type: "all",
        label: "Literature Chapters",
        chapters: apiChapters.map((name, i) => ({ name, order: i + 1 })),
      });
    }

    // Always append Writing & Grammar
    baseGroups.push({
      book: "writing_grammar",
      chapter_type: "skills",
      label: "Writing & Grammar",
      chapters: [
        { name: "Writing Skills", order: 1 },
        { name: "Grammar", order: 2 },
      ],
    });

    return baseGroups;
  }, [apiChapterGroups, apiChapters, isEnglish]);

  const availableTopics = finalChapters;

  // ─────────────────────────────────────────────────────────────────────
  // Reset topic/subtopic when class/subject changes
  // ─────────────────────────────────────────────────────────────────────
  const prevKeyRef = useRef(`${classLevel}-${currentSubject}`);
  const fieldsLengthRef = useRef(fields.length);

  useEffect(() => {
    fieldsLengthRef.current = fields.length;
  }, [fields.length]);

  useEffect(() => {
    const newKey = `${classLevel}-${currentSubject}`;
    if (prevKeyRef.current !== newKey && prevKeyRef.current !== "-") {
      const len = fieldsLengthRef.current;
      for (let idx = 0; idx < len; idx++) {
        setFormValue(`simpleData.${idx}.topic` as any, "");
        setFormValue(`simpleData.${idx}.subtopic` as any, "");
      }
    }
    prevKeyRef.current = newKey;
  }, [classLevel, currentSubject, setFormValue]);

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
      className="bg-white rounded-2xl sm:rounded-[24px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] sm:shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/50"
    >
      {/* Context Banner */}
      <div className="px-4 sm:px-6 py-3 bg-blue-50 border-b border-blue-100 rounded-t-2xl sm:rounded-t-[22px]">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-blue-800">
          <BookOpen size={14} className="flex-shrink-0" />
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
            {classLevel && (
              <span className="truncate">
                <span className="font-semibold">Class:</span> {classLevel}
              </span>
            )}
            <span className="truncate">
              <span className="font-semibold">Subject:</span> {currentSubject || "Not selected"}
            </span>
            {finalChapters.length > 0 && (
              <span className="text-[10px] sm:text-xs text-blue-600">
                ({finalChapters.length} chapters
                {finalChapterGroups && finalChapterGroups.length > 0
                  ? `, ${finalChapterGroups.length} groups`
                  : ""})
              </span>
            )}
            {chaptersError && (
              <span className="text-[10px] sm:text-xs text-red-600">(failed to load)</span>
            )}
          </div>
        </div>
      </div>

      {/* Empty state — no class/subject selected */}
      {(!classLevel || !currentSubject) && (
        <div className="py-10 sm:py-12 text-center text-gray-400 px-4">
          <BookOpen size={32} className="mx-auto mb-3 opacity-50" />
          <p className="font-semibold text-sm sm:text-base">Select a Class and Subject above</p>
          <p className="text-xs mt-1">Chapters will load automatically</p>
        </div>
      )}

      {/* Empty state when API returned no chapters */}
      {classLevel && currentSubject && !chaptersLoading && finalChapters.length === 0 && (
        <div className="py-8 sm:py-10 text-center px-4 bg-amber-50/50 border-b border-amber-100">
          <AlertCircle size={28} className="mx-auto mb-3 text-amber-500" />
          <p className="font-bold text-sm text-amber-900">
            No chapters available for {currentSubject} · {classLevel}
          </p>
          <p className="text-xs mt-1.5 text-amber-700 max-w-md mx-auto">
            Either this subject is not yet ingested for this class, or the request failed.
            Try another subject or class, or contact support.
          </p>
        </div>
      )}

      {classLevel && currentSubject && finalChapters.length > 0 && (
        <>
          {/* MOBILE: Card list */}
          <div className="block sm:hidden p-3 space-y-3">
            <AnimatePresence>
              {fields.map((field, index) => (
                <MobileCard
                  key={field.id}
                  index={index}
                  field={field}
                  availableTopics={availableTopics}
                  chapterGroups={finalChapterGroups}
                  subtopicsMap={subtopicsMap}
                  chaptersLoading={chaptersLoading}
                  remove={remove}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* DESKTOP: Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <caption className="sr-only">Test configuration table</caption>
              <thead>
                <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-[#F3F4F6]">
                  <th className="py-4 px-6 w-12 text-center"></th>
                  <th className="py-4 px-4">Chapter & Topics</th>
                  <th className="py-4 px-4 w-20 text-center">Quantity</th>
                  <th className="py-4 px-4 w-20 text-center">Marks</th>
                  <th className="py-4 px-4 w-32">Difficulty</th>
                  <th className="py-4 px-4 w-48">Question Type</th>
                  <th className="py-4 px-4 w-20 text-center">Reference</th>
                  <th className="py-4 px-4 w-12 text-center"></th>
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
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <PlusCircle size={18} className="group-hover:scale-110 transition-transform" />
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
      <div className="p-10 sm:p-16 text-center text-gray-400 font-bold bg-white rounded-2xl sm:rounded-[24px] border border-white shadow-sm">
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