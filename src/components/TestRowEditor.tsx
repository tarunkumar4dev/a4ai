// src/components/TestRowEditor.tsx
// ──────────────────────────────────────────────────────────────────────
// V8 — Mobile selection persistence fix (Controller)
//
// v8 changes vs v7.1:
//   - Topic & Subtopic selects migrated from `value={watch} + onChange={setValue}`
//     to react-hook-form <Controller>.
//     WHY: on mobile (native picker close + in-app browsers), the watch->setValue
//     propagation lagged one render tick, so React snapped the <select> back to
//     the placeholder right after a user picked an option ("select karne ke baad gayab").
//     Controller binds field.value/field.onChange through RHF's own subscription,
//     guaranteeing the rendered value matches form state in the same render — no snap-back.
//   - Chapter change now auto-clears that row's subtopic (avoids stale subtopic).
//   - Mobile chapter select: added a visible ChevronDown affordance.
//   - register-based selects (quantity/marks/difficulty) left untouched.
//
// Retained from v7.1:
//   - Complete Class XII Maths subtopics (all 13 NCERT chapters)
//   - prevKeyRef = "" (no false reset on first render)
//   - AbortController fetch, mock fallback, English pseudo-chapters
// ──────────────────────────────────────────────────────────────────────

import React, { useRef, memo, useCallback, forwardRef, useState, useEffect } from "react";
import { useFieldArray, useFormContext, Controller, UseFormSetValue, UseFormWatch, FieldValues } from "react-hook-form";
import {
  GripVertical, Paperclip, Trash2, PlusCircle, Check, FileText, BookOpen,
  AlignLeft, ListChecks, ArrowLeftRight, Loader2, AlertCircle, ChevronDown,
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

// ==================== COMMON SUBTOPICS (helper map only) ====================
const COMMON_SUBTOPICS: Record<string, string[]> = {

  // ═══════════════════════════════════════════════════════════════════
  // BIOLOGY — Class XI (NCERT) | UPPERCASE keys (Phy/Chem convention)
  // Covers full + rationalised. Chapters marked "(removed 2025-26)" are
  // not in the latest textbook but kept here harmlessly for older ingest.
  // ═══════════════════════════════════════════════════════════════════
  "THE LIVING WORLD": ["What is living", "Diversity in the living world", "Taxonomic categories", "Nomenclature and classification", "Taxonomical aids"],
  "BIOLOGICAL CLASSIFICATION": ["Five kingdom classification", "Kingdom Monera", "Kingdom Protista", "Kingdom Fungi", "Viruses, viroids and lichens"],
  "PLANT KINGDOM": ["Algae", "Bryophytes", "Pteridophytes", "Gymnosperms", "Angiosperms", "Alternation of generations"],
  "ANIMAL KINGDOM": ["Basis of classification", "Levels of organisation", "Symmetry and body plan", "Non-chordate phyla", "Phylum Chordata and vertebrate classes"],
  "MORPHOLOGY OF FLOWERING PLANTS": ["The root", "The stem and modifications", "The leaf", "Inflorescence", "The flower", "Fruit and seed", "Floral formula and families"],
  "ANATOMY OF FLOWERING PLANTS": ["The tissues", "Tissue systems", "Anatomy of dicot and monocot root", "Anatomy of stem and leaf", "Secondary growth"],
  "STRUCTURAL ORGANISATION IN ANIMALS": ["Animal tissues", "Epithelial and connective tissue", "Muscular and neural tissue", "Earthworm", "Cockroach", "Frog"],
  "CELL: THE UNIT OF LIFE": ["Cell theory", "Prokaryotic and eukaryotic cells", "Cell membrane and cell wall", "Cell organelles", "The nucleus", "Cytoskeleton, cilia and flagella"],
  "BIOMOLECULES": ["Carbohydrates", "Proteins and amino acids", "Lipids", "Nucleic acids", "Enzymes and enzyme action", "Metabolic basis of living"],
  "CELL CYCLE AND CELL DIVISION": ["Cell cycle phases", "Mitosis", "Meiosis", "Significance of meiosis"],
  "TRANSPORT IN PLANTS": ["Means of transport", "Water potential", "Absorption of water and minerals", "Transpiration", "Phloem transport"], // (removed 2025-26)
  "MINERAL NUTRITION": ["Essential mineral elements", "Macro and micronutrients", "Mechanism of absorption", "Nitrogen metabolism"], // (removed 2025-26)
  "PHOTOSYNTHESIS IN HIGHER PLANTS": ["Site of photosynthesis", "Photosynthetic pigments", "Light reaction", "Electron transport", "C3 and C4 pathways", "Photorespiration", "Factors affecting photosynthesis"],
  "RESPIRATION IN PLANTS": ["Glycolysis", "Fermentation", "Aerobic respiration (Krebs cycle)", "Electron transport system", "Respiratory quotient", "Amphibolic pathway"],
  "PLANT GROWTH AND DEVELOPMENT": ["Phases and rate of growth", "Plant growth regulators", "Photoperiodism", "Vernalisation", "Seed dormancy"],
  "DIGESTION AND ABSORPTION": ["Digestive system and glands", "Digestion of food", "Absorption and assimilation", "Disorders of digestive system"], // (moved/removed in 2025-26)
  "BREATHING AND EXCHANGE OF GASES": ["Respiratory organs", "Mechanism of breathing", "Exchange of gases", "Transport of gases", "Regulation of respiration", "Respiratory disorders"],
  "BODY FLUIDS AND CIRCULATION": ["Blood and its composition", "Blood groups", "Lymph", "Human circulatory system", "Cardiac cycle and ECG", "Double circulation", "Disorders of circulatory system"],
  "EXCRETORY PRODUCTS AND THEIR ELIMINATION": ["Modes of excretion", "Human excretory system", "Urine formation", "Regulation of kidney function", "Role of other organs", "Disorders"],
  "LOCOMOTION AND MOVEMENT": ["Types of movement", "Muscle structure and contraction", "Skeletal system", "Joints", "Disorders of muscular and skeletal system"],
  "NEURAL CONTROL AND COORDINATION": ["Neuron and nerve impulse", "Central nervous system", "Peripheral nervous system", "Reflex action", "Sensory reception (eye and ear)"],
  "CHEMICAL COORDINATION AND INTEGRATION": ["Endocrine glands and hormones", "Hypothalamus and pituitary", "Thyroid, parathyroid and adrenal", "Pancreas and other glands", "Mechanism of hormone action"],

  // ═══════════════════════════════════════════════════════════════════
  // BIOLOGY — Class XII (NCERT) | UPPERCASE keys
  // ═══════════════════════════════════════════════════════════════════
  "REPRODUCTION IN ORGANISMS": ["Asexual reproduction", "Sexual reproduction", "Life span and reproductive events"], // (removed 2025-26)
  "SEXUAL REPRODUCTION IN FLOWERING PLANTS": ["Structure of flower", "Pre-fertilisation events", "Pollination", "Double fertilisation", "Post-fertilisation events", "Apomixis and polyembryony"],
  "HUMAN REPRODUCTION": ["Male reproductive system", "Female reproductive system", "Gametogenesis", "Menstrual cycle", "Fertilisation and implantation", "Pregnancy and parturition", "Lactation"],
  "REPRODUCTIVE HEALTH": ["Reproductive health and strategies", "Population and birth control", "Contraception", "Medical termination of pregnancy", "STDs", "Infertility and ART"],
  "PRINCIPLES OF INHERITANCE AND VARIATION": ["Mendel's laws of inheritance", "Inheritance of one and two genes", "Deviations from Mendelism", "Chromosomal theory of inheritance", "Sex determination", "Mutation", "Genetic disorders"],
  "MOLECULAR BASIS OF INHERITANCE": ["The DNA", "Search for genetic material", "DNA replication", "Transcription", "Genetic code", "Translation", "Regulation of gene expression (lac operon)", "Human Genome Project", "DNA fingerprinting"],
  "EVOLUTION": ["Origin of life", "Evidences for evolution", "Theories of evolution", "Mechanism of evolution", "Hardy-Weinberg principle", "Adaptive radiation", "Human evolution"],
  "HUMAN HEALTH AND DISEASE": ["Common diseases in humans", "Immunity", "AIDS", "Cancer", "Drugs and alcohol abuse"],
  "STRATEGIES FOR ENHANCEMENT IN FOOD PRODUCTION": ["Animal husbandry", "Plant breeding", "Single cell protein", "Tissue culture"], // (removed 2025-26)
  "MICROBES IN HUMAN WELFARE": ["Microbes in household products", "Microbes in industrial products", "Microbes in sewage treatment", "Microbes in biogas production", "Microbes as biocontrol agents", "Microbes as biofertilisers"],
  "BIOTECHNOLOGY: PRINCIPLES AND PROCESSES": ["Principles of biotechnology", "Tools of recombinant DNA technology", "Restriction enzymes and vectors", "Processes of recombinant DNA technology"],
  "BIOTECHNOLOGY AND ITS APPLICATIONS": ["Biotechnological applications in agriculture", "Applications in medicine", "Genetically modified organisms", "Gene therapy", "Molecular diagnosis", "Transgenic animals and ethical issues"],
  "ORGANISMS AND POPULATIONS": ["Organism and its environment", "Population attributes", "Population growth", "Life history variation", "Population interactions"],
  "ECOSYSTEM": ["Ecosystem structure and function", "Productivity", "Decomposition", "Energy flow", "Ecological pyramids", "Nutrient cycling", "Ecological succession"],
  "BIODIVERSITY AND CONSERVATION": ["Biodiversity and its patterns", "Importance of biodiversity", "Loss of biodiversity", "Biodiversity conservation (in-situ and ex-situ)"],
  "ENVIRONMENTAL ISSUES": ["Air pollution and control", "Water pollution and control", "Solid waste management", "Agrochemicals", "Global warming and ozone depletion", "Deforestation"], // (removed 2025-26)
  
  // ─────────── Class X Science ───────────
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

  // ─────────── Class X Maths ───────────
  "Real Numbers": ["Euclid's division", "Fundamental theorem", "Irrational numbers", "Decimal expansions"],
  "Polynomials": ["Zeros of polynomial", "Relationship between zeros", "Division algorithm"],
  "Quadratic Equations": ["Standard form", "Solution by factorization", "Quadratic formula", "Nature of roots"],

  // ─────────── Class IX Science ───────────
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

  // ─────────── Class X Civics ───────────
  "Power Sharing": ["Belgium model", "Sri Lanka model", "Forms of power sharing"],
  "Federalism": ["Union list", "State list", "Concurrent list", "Decentralisation", "Panchayati Raj"],
  "Gender Religion and Caste": ["Gender division", "Religion and politics", "Caste and politics"],
  "Political Parties": ["Functions of parties", "National parties", "State parties"],
  "Outcomes of Democracy": ["Accountability", "Economic growth", "Inequality", "Social diversity"],

  // ─────────── Accountancy ───────────
  "Introduction to Accounting": ["Meaning and objectives", "Accounting as information system", "Users of accounting", "Accounting terms"],
  "Recording of Transactions": ["Accounting equation", "Rules of debit and credit", "Journal", "Ledger posting"],
  "Ledger": ["Format of ledger", "Posting from journal", "Balancing accounts", "T-account"],
  "Trial Balance": ["Objectives", "Methods of preparation", "Errors and rectification"],
  "Bank Reconciliation Statement": ["Need and purpose", "Preparation", "Adjustments"],
  "Depreciation": ["Meaning and causes", "Methods", "Accounting treatment"],
  "Financial Statements": ["Trading account", "Profit and loss account", "Balance sheet", "Adjustments"],
  "Accounting for Partnership": ["Nature", "Partnership deed", "Profit sharing ratio", "Capital accounts"],

  // ─────────── Class XII Maths (NCERT 2025-26) ───────────
  "Relations and Functions": [
    "Types of relations",
    "Equivalence relations",
    "Types of functions",
    "Composition of functions",
    "Invertible functions",
    "Binary operations",
  ],
  "Inverse Trigonometric Functions": [
    "Basic concepts and definitions",
    "Domain and range of inverse trig functions",
    "Principal value branches",
    "Properties of inverse trig functions",
    "Graphs of inverse trig functions",
  ],
  "Matrices": [
    "Types of matrices",
    "Operations on matrices",
    "Transpose of a matrix",
    "Symmetric and skew-symmetric matrices",
    "Elementary row and column operations",
    "Invertible matrices",
  ],
  "Determinants": [
    "Determinant of a matrix",
    "Properties of determinants",
    "Area of a triangle",
    "Minors and cofactors",
    "Adjoint and inverse of a matrix",
    "Applications: System of linear equations",
    "Cramer's rule",
  ],
  "Continuity and Differentiability": [
    "Continuity at a point",
    "Algebra of continuous functions",
    "Differentiability",
    "Derivatives of composite functions (Chain rule)",
    "Derivatives of implicit functions",
    "Derivatives of inverse trig functions",
    "Exponential and logarithmic functions",
    "Logarithmic differentiation",
    "Derivatives in parametric form",
    "Second order derivatives",
    "Mean Value Theorem (Rolle's and Lagrange's)",
  ],
  "Application of Derivatives": [
    "Rate of change of quantities",
    "Increasing and decreasing functions",
    "Tangents and normals",
    "Approximations",
    "Maxima and minima",
    "First and second derivative test",
    "Absolute maximum and minimum",
  ],
  "Integrals": [
    "Indefinite integrals",
    "Integration by substitution",
    "Integration using trigonometric identities",
    "Integration by partial fractions",
    "Integration by parts",
    "Integrals of special functions",
    "Definite integrals",
    "Fundamental theorem of calculus",
    "Properties of definite integrals",
  ],
  "Application of Integrals": [
    "Area under simple curves",
    "Area between two curves",
    "Area bounded by a curve and a line",
    "Area using definite integrals",
  ],
  "Differential Equations": [
    "Basic concepts and definitions",
    "Order and degree of differential equations",
    "General and particular solutions",
    "Formation of differential equations",
    "Variable separable method",
    "Homogeneous differential equations",
    "Linear differential equations",
  ],
  "Vector Algebra": [
    "Types of vectors",
    "Addition of vectors",
    "Multiplication of vector by a scalar",
    "Components of a vector",
    "Position vector",
    "Direction cosines and direction ratios",
    "Section formula",
    "Scalar (dot) product",
    "Vector (cross) product",
    "Projection of vector on a line",
  ],
  "Three Dimensional Geometry": [
    "Direction cosines and direction ratios of a line",
    "Equation of a line in space",
    "Angle between two lines",
    "Shortest distance between two lines",
    "Coplanar and skew lines",
    "Equation of a plane",
    "Angle between two planes",
    "Distance of a point from a plane",
    "Angle between a line and a plane",
  ],
  "Linear Programming": [
    "Introduction and definitions",
    "Mathematical formulation of LPP",
    "Graphical method of solution",
    "Feasible and infeasible regions",
    "Optimal solutions",
    "Different types of LPP (manufacturing, diet, transportation problems)",
  ],
  "Probability": [
    "Conditional probability",
    "Multiplication theorem on probability",
    "Independent events",
    "Bayes' theorem",
    "Total probability theorem",
    "Random variables and probability distribution",
    "Mean and variance of random variable",
    "Bernoulli trials and binomial distribution",
  ],

  // --- Physics Class 11 ---
  "GRAVITATION": ["Kepler's laws", "Universal law of gravitation", "Acceleration due to gravity", "Escape speed", "Orbital velocity"],
  "KINETIC THEORY": ["Behavior of gases", "Law of equipartition of energy", "Mean free path"],
  "LAWS OF MOTION": ["Inertia", "Newton's laws of motion", "Conservation of momentum", "Friction", "Circular motion dynamics"],
  "MECHANICAL PROPERTIES OF FLUIDS": ["Pascal's law", "Viscosity", "Bernoulli's principle", "Surface tension"],
  "MECHANICAL PROPERTIES OF SOLIDS": ["Elastic behavior", "Stress and strain", "Hooke's law", "Young's modulus"],
  "MOTION IN A PLANE": ["Scalars and vectors", "Resolution of vectors", "Projectile motion", "Uniform circular motion"],
  "MOTION IN A STRAIGHT LINE": ["Average velocity and speed", "Instantaneous velocity", "Acceleration", "Relative velocity", "Kinematic equations"],
  "OSCILLATIONS": ["Simple harmonic motion", "Energy in SHM", "Simple pendulum"],
  "SYSTEMS OF PARTICLES AND ROTATIONAL MOTION": ["Centre of mass", "Torque", "Angular momentum", "Moment of inertia", "Parallel axes theorem"],
  "THERMAL PROPERTIES OF MATTER": ["Thermal expansion", "Specific heat capacity", "Calorimetry", "Newton's law of cooling"],
  "THERMODYNAMICS": ["First law of thermodynamics", "Isothermal and adiabatic processes", "Second law of thermodynamics"],
  "UNITS AND MEASUREMENT": ["International system of units", "Significant figures", "Dimensional analysis", "Errors in measurement"],
  "WAVES": ["Transverse and longitudinal waves", "Superposition principle", "Standing waves", "Doppler effect"],
  "WORK, ENERGY AND POWER": ["Work-energy theorem", "Kinetic and potential energy", "Conservation of mechanical energy", "Collisions"],

  // --- Mathematics Class 11 (Matched to UI Dropdown) ---
  "BINOMIALTHEOREM": ["Pascal's triangle", "General and middle terms"],
  "COMPLEX NUMBERS AND QUADRATIC EQUATIONS": ["Argand plane", "Modulus and conjugate", "Roots of quadratic equations"],
  "CONIC SECTIONS": ["Circle", "Parabola", "Ellipse", "Hyperbola"],
  "INTRODUCTION TO THREE DIMENSIONAL GEOMETRY": ["Coordinate axes", "Distance formula", "Section formula"],
  "LIMITS AND DERIVATIVES": ["Standard limits", "Derivative as rate of change", "Product and quotient rule"],
  "LINEAR INEQUALITIES": ["Algebraic solutions", "Graphical representation"],
  "PERMUTATIONS AND COMBINATIONS": ["Fundamental principle of counting", "Factorials", "nPr and nCr formulas"],
  "PROBABILITY_CLASS_11": ["Random experiments", "Events", "Axiomatic approach"],
  "RELATIONS AND FUNCTIONS_CLASS_11": ["Cartesian product", "Domain and range", "Types of functions"],
  "SEQUENCES AND SERIES": ["Arithmetic progression (AP)", "Geometric progression (GP)"],
  "SETS": ["Representation of sets", "Subsets", "Venn diagrams", "Operations on sets"],
  "STATISTICS": ["Measures of dispersion", "Mean deviation", "Variance and standard deviation"],
  "STRAIGHT LINES": ["Slope of a line", "Equations of a line", "Distance formulas"],
  "TRIGONOMETRIC FUNCTIONS": ["Radian and Degree", "Trigonometric equations", "Compound angle formulas"],

  // --- Chemistry Class 11 (Matched to UI Dropdown) ---
  "Chemical Bonding and Molecular Structure": ["VSEPR theory", "Valence bond theory", "Hybridization", "Molecular orbital theory"],
  "Classification of Elements and Periodicity in Properties": ["Modern periodic law", "Periodic trends", "Atomic radii", "Electronegativity"],
  "Equilibrium": ["Le Chatelier's principle", "Ionization of acids and bases", "Solubility product"],
  "Some Basic Concepts of Chemistry": ["Atomic and molecular masses", "Mole concept", "Stoichiometry"],
  "Structure of Atom": ["Bohr's model", "Quantum numbers", "Electronic configuration", "Photoelectric effect"],
  "Thermodynamics": ["Internal energy", "Enthalpy", "Hess's law", "Entropy", "Gibbs energy"],
  
  // --- Mathematics Class 12 (Matched to UI Dropdown) ---
  "APPLICATION OF DERIVATIVES": ["Rate of change", "Increasing and decreasing functions", "Maxima and minima"],
  "APPLICATION OF INTEGRALS": ["Area under simple curves", "Area between curves"],
  "CONTINUITY AND DIFFERENTIABILITY": ["Chain rule", "Implicit differentiation", "Logarithmic differentiation", "Second order derivatives"],
  "DETERMINANTS": ["Adjoint of matrix", "Inverse of matrix", "Solving linear equations", "Area of triangle"],
  "DIFFERENTIAL EQUATIONS": ["Order and degree", "Variable separable method", "Homogeneous equations", "Linear differential equations"],
  "INTEGRALS": ["Integration by substitution", "Integration by parts", "Definite integrals", "Partial fractions"],
  "INVERSE TRIGONOMETRIC FUNCTIONS": ["Principal value branch", "Domain and range of inverse trig", "Graphs"],
  "LINEAR PROGRAMMING": ["Feasible region", "Objective function", "Optimization"],
  "MATRICES": ["Types of matrices", "Matrix operations", "Transpose", "Symmetric and skew-symmetric"],
  "PROBABILITY_CLASS_12": ["Conditional probability", "Bayes' theorem", "Random variables", "Multiplication theorem"],
  "RELATIONS AND FUNCTIONS_CLASS_12": ["Equivalence relations", "One-to-one and onto functions", "Composition of functions"],
  "THREE DIMENSIONAL GEOMETRY": ["Shortest distance between lines", "Equation of a line", "Direction ratios"],
  "VECTOR ALGEBRA": ["Dot product", "Cross product", "Direction cosines", "Position vector"],
   
  // --- Physics Class 12 (Matched to UI Dropdown) ---
  "Alternating Current (AC)": ["AC voltage applied to a resistor", "LC oscillations", "LCR series circuit", "Resonance", "Transformers", "Power in AC circuits"],
  "Atoms": ["Alpha-particle scattering experiment", "Rutherford's model of atom", "Bohr model of hydrogen atom", "Hydrogen line spectra"],
  "Current Electricity": ["Ohm's law", "Drift velocity", "Resistivity and conductivity", "Kirchhoff's rules", "Wheatstone bridge", "Cells in series and parallel"],
  "Dual Nature of Radiation and Matter": ["Electron emission", "Photoelectric effect", "Einstein's photoelectric equation", "Experimental study of photoelectric effect", "de Broglie hypothesis"],
  "Electric Charges and Fields": ["Coulomb's law", "Electric field lines", "Electric dipole", "Electric flux", "Gauss's law and its applications"],
  "Electromagnetic Induction (EMI)": ["Magnetic flux", "Faraday's law of induction", "Lenz's law", "Motional electromotive force", "Self-induction and mutual induction"],
  "Electromagnetic Waves (EM Waves)": ["Displacement current", "Electromagnetic spectrum (Radio, Micro, IR, Visible, UV, X-ray, Gamma)", "Characteristics of EM waves"],
  "Electrostatic Potential and Capacitance": ["Electrostatic potential", "Potential energy of a dipole", "Capacitors and capacitance", "Dielectrics and polarization", "Energy stored in a capacitor"],
  "Magnetism and Matter": ["The bar magnet", "Magnetic field lines", "Earth's magnetic field", "Magnetic properties of materials (Dia-, Para-, Ferro-magnetism)"],
  "Moving Charges and Magnetism": ["Biot-Savart law", "Ampere's circuital law", "Force on a moving charge in a magnetic field", "Cyclotron", "Moving coil galvanometer"],
  "Nuclei": ["Composition and size of nucleus", "Mass-energy equivalence", "Nuclear binding energy", "Nuclear fission and fusion"],
  "Ray Optics and Optical Instruments": ["Reflection by spherical mirrors", "Refraction and total internal reflection", "Refraction at spherical surfaces and by lenses", "Power of a lens", "Microscopes and astronomical telescopes"],
  "Semiconductor Electronics Materials, Devices and Simple Circuits": ["Energy bands in solids", "Intrinsic and extrinsic semiconductors", "p-n junction diode", "Diode as a rectifier", "LED, photodiode, and solar cell"],
  "Wave Optics": ["Huygens principle", "Refraction and reflection of plane waves", "Coherent and incoherent addition of waves", "Interference of light waves and Young's double slit experiment", "Diffraction"],

  // --- Chemistry Class 12 (Matched to UI Dropdown) ---
  "Alcohols, Phenols and Ethers": ["Nomenclature and structures", "Mechanism of dehydration of alcohols", "Electrophilic aromatic substitution of phenols", "Preparation and reactions of ethers"],
  "Aldehydes, Ketones and Carboxylic Acids": ["Nomenclature and carbonyl group structure", "Nucleophilic addition reactions", "Aldol condensation", "Cannizzaro reaction", "Acidity of carboxylic acids"],
  "Amines": ["Structure and classification", "Basic character of amines", "Gabriel phthalimide synthesis", "Hoffmann bromamide degradation reaction", "Diazonium salts"],
  "Biomolecules": ["Classification of carbohydrates (Glucose and Fructose)", "Structure of proteins (Amino acids, Peptide bond)", "Denaturation of proteins", "Vitamins", "Nucleic acids (DNA and RNA)"],
  "Chemical Kinetics": ["Rate of a chemical reaction", "Factors affecting rate of reaction", "Integrated rate equations (Zero and First order)", "Half-life of a reaction", "Arrhenius equation"],
  "Coordination Compounds": ["Werner's theory", "Nomenclature of coordination compounds", "Isomerism in coordination compounds", "Valence Bond Theory (VBT)", "Crystal Field Theory (CFT)"],
  "Electrochemistry": ["Galvanic cells", "Nernst equation", "Conductance in electrolytic solutions", "Kohlrausch's law", "Electrolysis", "Batteries and fuel cells", "Corrosion"],
  "Haloalkanes and Haloarenes": ["Nomenclature and nature of C-X bond", "Mechanisms of substitution reactions (SN1 and SN2)", "Polyhalogen compounds", "Electrophilic substitution in haloarenes"],
  "Solutions": ["Types of solutions", "Expressing concentration of solutions", "Solubility (Henry's law)", "Raoult's law and ideal/non-ideal solutions", "Colligative properties", "Abnormal molar mass (Van 't Hoff factor)"],
  "The d- and f-Block Elements": ["Electronic configurations and general trends", "Lanthanoid contraction", "Properties of transition metals (Catalytic, Magnetic, Interstitial)", "Preparation and properties of KMnO4 and K2Cr2O7"],

  // --- Biology Class 11 (Matched to UI Dropdown) ---
  "Anatomy of Flowering Plants": ["Tissues", "Tissue system", "Anatomy of dicotyledonous and monocotyledonous plants", "Secondary growth"],
  "Animal Kingdom": ["Basis of classification", "Classification of animals (Non-chordates to Chordates)"],
  "Biological Classification": ["Kingdom Monera", "Kingdom Protista", "Kingdom Fungi", "Kingdom Plantae", "Kingdom Animalia", "Viruses, Viroids and Lichens"],
  "Biomolecule": ["How to analyze chemical composition?", "Primary and secondary metabolites", "Biomacromolecules", "Proteins", "Polysaccharides", "Nucleic acids", "Structure of proteins", "Nature of bond linking monomers in a polymer", "Dynamic state of body constituents", "Metabolic basis for living", "The living state", "Enzymes"],
  "Breathing and Exchange of Gases": ["Respiratory organs", "Mechanism of breathing", "Exchange of gases", "Transport of gases", "Regulation of respiration", "Disorders of respiratory system"],
  "Cell Cycle and Cell Division": ["Cell cycle", "Mitosis", "Meiosis", "Significance of mitosis and meiosis"],
  "Cell The Unit of Life": ["What is a cell?", "Cell theory", "An overview of cell", "Prokaryotic cells", "Eukaryotic cells"],
  "Chemical Coordination and Integration": ["Endocrine glands and hormones", "Human endocrine system", "Hormones of heart, kidney and gastrointestinal tract", "Mechanism of hormone action"],
  "Excretory Products and their Elimination": ["Human excretory system", "Urine formation", "Function of the tubules", "Mechanism of concentration of the filtrate", "Regulation of kidney function", "Micturition", "Role of other organs in excretion", "Disorders of the excretory system"],
  "Morphology of Flowering Plants": ["The root", "The stem", "The leaf", "The inflorescence", "The flower", "The fruit", "The seed", "Semi-technical description of a typical flowering plant", "Description of some important families"],
  "Neural Control and Coordination": ["Neural system", "Human neural system", "Neuron as structural and functional unit of neural system", "Central neural system", "Reflex action and reflex arc", "Sensory reception and processing"],
  "Photosynthesis in Higher Plants": ["What do we know?", "Early experiments", "Where does photosynthesis take place?", "How many pigments are involved in photosynthesis?", "What is light reaction?", "The electron transport", "Where are the ATP and NADPH used?", "The C4 pathway", "Photorespiration", "Factors affecting photosynthesis"],
  "Plant Growth and Development": ["Growth", "Differentiation, dedifferentiation and redifferentiation", "Development", "Plant growth regulators", "Photoperiodism", "Vernalization"],
  "Plant Kingdom": ["Algae", "Bryophytes", "Pteridophytes", "Gymnosperms", "Angiosperms", "Plant life cycles and alternation of generations"],
  "Respiration in Plants": ["Do plants breathe?", "Glycolysis", "Fermentation", "Aerobic respiration", "The respiratory balance sheet", "Amphibolic pathway", "Respiratory quotient"],
  "Structural Organisation in Animals": ["Animal tissues", "Organ and organ system", "Earthworm", "Cockroach", "Frogs"],
  "The Living World": ["What is 'living'?", "Diversity in the living world", "Taxonomic categories", "Taxonomical aids"],

  // --- Chemistry Class 12 / Duplicates (Matched to UI Dropdown Variations) ---
  "Chemical Coordination": ["Coordination entity", "Central atom/ion", "Ligands", "Coordination number", "Coordination polyhedron", "Homoleptic and heteroleptic complexes"],
  "The d and f block elements": ["General properties of d-block elements", "Lanthanoids", "Actinoids"],
  "Aldehydes, Ketones and Carboxylic acids": ["Nomenclature and carbonyl group structure", "Nucleophilic addition reactions", "Aldol condensation", "Cannizzaro reaction", "Acidity of carboxylic acids"],

  // --- Biology Class 12 (Matched to UI Dropdown) ---
  "Biodiversity and Conservation": ["Biodiversity", "Patterns of biodiversity", "Loss of biodiversity", "Biodiversity conservation"],
  "Biotechnology Principles and Processes": ["Principles of biotechnology", "Tools of recombinant DNA technology", "Processes of recombinant DNA technology"],
  "Biotechnology and its Applications": ["Biotechnological applications in agriculture", "Biotechnological applications in medicine", "Transgenic animals", "Ethical issues"],
  "Evolution": ["Origin of life", "Evolution of life forms - a theory", "What are the evidences for evolution?", "What is adaptive radiation?", "Biological evolution", "Mechanism of evolution", "Hardy-Weinberg principle", "A brief account of evolution", "Origin and evolution of man"],
  "Human Health and Disease": ["Common diseases in humans", "Immunity", "AIDS", "Cancer", "Drugs and alcohol abuse"],
  "Microbes in Human Welfare": ["Microbes in household products", "Microbes in industrial products", "Microbes in sewage treatment", "Microbes in production of biogas", "Microbes as biocontrol agents", "Microbes as biofertilizers"],
  "Molecular Basis of Inheritance": ["The DNA", "The search for genetic material", "RNA world", "Replication", "Transcription", "Genetic code", "Translation", "Regulation of gene expression", "Human genome project", "DNA fingerprinting"],
  "Organisms and Populations": ["Organism and its environment", "Populations (Attributes, Growth, Growth models)", "Population interactions (Predation, Competition, Parasitism, Mutualism)"],
  "Principles of Inheritance and Variation": ["Mendel's laws of inheritance", "Inheritance of one gene", "Inheritance of two genes", "Sex determination", "Mutation", "Genetic disorders"],
  "Reproductive Health": ["Reproductive health - problems and strategies", "Population explosion and birth control", "Medical termination of pregnancy (MTP)", "Sexually transmitted diseases (STDs)", "Infertility"],
  "Sexual Reproduction in Flowering Plants": ["Flower - a fascinating organ of angiosperms", "Pre-fertilization: structures and events", "Double fertilization", "Post-fertilization: structures and events", "Apomixis and polyembryony"],
  
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
  const { control, register, watch, setValue } = useFormContext<FormValues>();

  // Read-only derivations (for subtopic options + disabled logic).
  // NOTE: the <select> binding itself is via <Controller> below — NOT this watch —
  // which is what stops the mobile snap-back.
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

      {/* ✅ v8: Chapter — Controller (no snap-back on mobile) */}
      <div>
        <label className={labelClass}>Chapter</label>
        <div className="relative">
          <Controller
            name={`simpleData.${index}.topic`}
            control={control}
            render={({ field: f }) => (
              <select
                value={f.value ?? ""}
                onChange={(e) => {
                  f.onChange(e.target.value);
                  // chapter badla → us row ka subtopic clear
                  setValue(`simpleData.${index}.subtopic`, "", { shouldDirty: true });
                }}
                onBlur={f.onBlur}
                disabled={chaptersLoading || availableTopics.length === 0}
                className={`${inputClass} pr-9 disabled:opacity-60`}
              >
                <option value="">
                  {chaptersLoading ? "Loading chapters..." : availableTopics.length === 0 ? "No chapters available" : "Select a chapter..."}
                </option>
                {renderChapterOptions(chapterGroups, availableTopics)}
              </select>
            )}
          />
          {chaptersLoading ? (
            <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
          ) : (
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          )}
        </div>
      </div>

      {/* ✅ v8: Subtopic — Controller */}
      <div>
        <label className={labelClass}>Subtopic (optional)</label>
        <Controller
          name={`simpleData.${index}.subtopic`}
          control={control}
          render={({ field: f }) => (
            <select
              value={f.value ?? ""}
              onChange={(e) => f.onChange(e.target.value)}
              onBlur={f.onBlur}
              disabled={!currentTopic || subOptions.length === 0}
              className={`${inputClass} disabled:opacity-60 disabled:bg-gray-50`}
            >
              <option value="">
                {!currentTopic ? "Select a chapter first" : subOptions.length === 0 ? "No subtopics available" : "Select subtopic..."}
              </option>
              {subOptions.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
            </select>
          )}
        />
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
  const { control, register, watch, setValue } = useFormContext<FormValues>();

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

          {/* ✅ v8: Chapter — Controller */}
          <div className="relative">
            <Controller
              name={`simpleData.${index}.topic`}
              control={control}
              render={({ field: f }) => (
                <select
                  value={f.value ?? ""}
                  onChange={(e) => {
                    f.onChange(e.target.value);
                    setValue(`simpleData.${index}.subtopic`, "", { shouldDirty: true });
                  }}
                  onBlur={f.onBlur}
                  className="w-full bg-transparent text-sm font-bold text-[#111827] outline-none border-b border-dashed border-gray-300 focus:border-gray-500 py-1 cursor-pointer appearance-none hover:text-gray-600 disabled:opacity-50"
                  disabled={chaptersLoading || availableTopics.length === 0}
                >
                  <option value="">
                    {chaptersLoading ? "Loading chapters..." : availableTopics.length === 0 ? "No chapters available" : "Select Chapter/Topic..."}
                  </option>
                  {renderChapterOptions(chapterGroups, availableTopics)}
                </select>
              )}
            />
            {chaptersLoading && <Loader2 size={14} className="absolute right-2 top-2 animate-spin text-gray-400" />}
          </div>

          {/* ✅ v8: Subtopic — Controller */}
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#E5E7EB] group-hover:bg-gray-400 transition-colors" />
            <Controller
              name={`simpleData.${index}.subtopic`}
              control={control}
              render={({ field: f }) => (
                <select
                  value={f.value ?? ""}
                  onChange={(e) => f.onChange(e.target.value)}
                  onBlur={f.onBlur}
                  className="w-full bg-transparent text-xs font-semibold text-gray-500 outline-none cursor-pointer disabled:opacity-50 hover:text-gray-700 appearance-none"
                  disabled={!currentTopic || subOptions.length === 0}
                >
                  <option value="">
                    {!currentTopic ? "Select Subtopic (Optional)..." : subOptions.length === 0 ? "No subtopics available" : "Select Subtopic (Optional)..."}
                  </option>
                  {subOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            />
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

  const prevKeyRef   = useRef<string>("");
  const fieldsLenRef = useRef(fields.length);
  useEffect(() => { fieldsLenRef.current = fields.length; }, [fields.length]);

  useEffect(() => {
    if (!classLevel || !currentSubject) return;

    const newKey = `${classLevel}-${currentSubject}`;

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