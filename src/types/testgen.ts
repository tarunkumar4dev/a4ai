// /src/types/testgen.ts

/* -------------------- Core enums/aliases -------------------- */
/** New client-side preference; backend still expects "English" | "Hindi". */
export type Language = "en" | "hi" | "bilingual" | "English" | "Hindi";

/** Keep existing Difficulty literals so old payloads still work */
export type Difficulty = "Easy" | "Medium" | "Hard" | "Mixed";

/** Broader set to keep UI flexible; backend maps to MCQ/VSA/SA/LA internally */
export type QuestionType =
  | "MCQ"
  | "Short"
  | "Long"
  | "Numerical"
  | "FillBlank"
  | "AssertionReason"
  | "Match";

/* -------------------- NEW: Section + Mix types (optional) -------------------- */
// % split for difficulty. Values can be 0..100; we’ll normalize server-side.
export type DifficultyMix = {
  easy?: number;   // e.g., 50
  medium?: number; // e.g., 35
  hard?: number;   // e.g., 15
};

// Paper sections like A/B/C with marks per question and allowed types.
export type SectionSpec = {
  id?: "A" | "B" | "C" | "D" | string; // string to allow E/F in future
  title?: string;                       // e.g., "Section A"
  marksEach: number;                    // 1 | 2 | 3 | 4 | 5 | 6 ...
  count: number;                        // how many questions in this section
  allowedTypes?: QuestionType[];        // e.g., ["MCQ","Short"]
  difficultyMix?: DifficultyMix;        // optional per-section override
  instructions?: string[];              // section-specific notes
};

// Optional top header/branding info printed on PDF
export type PaperBranding = {
  paperTitle?: string;     // e.g., "Unit Test – Chemical Reactions"
  institute?: string;      // e.g., "Education Beast"
  teacherName?: string;
  date?: string;           // YYYY-MM-DD
  footerNote?: string;     // e.g., "All the best!"
};

/* -------------------- Client → Edge payloads -------------------- */
/** Preferred modern request (sectioned mode capable) */
export type NewGenerateTestRequest = {
  // Identity (optional but useful for storage paths / DB rows)
  userId?: string;
  requestId?: string;

  subject: string;
  grade: string;                 // e.g., "Class 11"
  board?: string;                // "CBSE" | "ICSE" | "State" | ...
  topics?: string[];
  chapters?: string[];

  // Single-type mode (still supported)
  questionType?: QuestionType;   // optional now if sections are used
  difficulty?: Difficulty;       // "Mixed" or single level
  numQuestions?: number;         // used only when not providing sections

  // NEW: sectioned mode (preferred for real papers)
  sections?: SectionSpec[];      // if present, orchestrator generates per-section
  difficultyMix?: DifficultyMix; // global default mix if section doesn't override

  // Paper totals/print
  maxMarks: number;              // printed on PDF (we’ll validate against sections)
  durationMins: number;          // printed on PDF

  language?: Language;
  referenceText?: string;        // optional source text to summarize
  extraInstructions?: string;    // free-text style, any notes
  includeSolutions?: boolean;

  // NEW toggles
  ncertOnly?: boolean;           // restrict prompts to NCERT alignment
  instructions?: string[];       // top-level bullet points (before sections)

  // NEW branding (all optional)
  branding?: PaperBranding;

  /* ---- Compatibility fields mapped by the FE adapter (optional) ---- */
  // When passing references via Supabase Storage instead of inline text:
  ref_files?: Array<{ name: string; path: string }>;
  // If UI already serializes sections to JSON for the backend:
  sectionsJSON?: string;
  // For older UIs that compute total marks on the client:
  computedTotalMarks?: string;

  // Preferred output (server may still return multiple)
  outputFormat?: "PDF" | "DOCX" | "CSV" | "JSON";
};

/** Legacy minimal request that existing UI used earlier */
export type LegacyGenerateTestRequest = {
  // Identity (optional)
  userId?: string;
  requestId?: string;

  // core
  subject: string;
  difficulty?: Difficulty | string;
  questionType?: string;   // e.g., "Multiple Choice" | "Short Answer" | "Mixed"
  qCount?: number;         // total questions
  outputFormat?: "PDF" | "DOCX" | "CSV" | "JSON";

  // optional extras that backend tolerates
  board?: string;
  grade?: string;          // sometimes stored as "Class 10" or "10"
  language?: Language;
  topics?: string[];
  chapters?: string[];
  notes?: string;
  ref_files?: Array<{ name: string; path: string }>;
};

export type GenerateTestRequest = NewGenerateTestRequest | LegacyGenerateTestRequest;

/* -------------------- Generated JSON (strict) -------------------- */
export interface Meta {
  subject: string;
  grade: string;
  board?: string;

  // Keep original fields for backward compatibility
  questionType?: QuestionType | string;
  difficulty?: Difficulty | string;
  language?: Language | string;
  numQuestions?: number;

  // Totals
  maxMarks: number;
  durationMins: number;

  topics?: string[];
  chapters?: string[];

  // NEW echoes
  sections?: SectionSpec[];
  branding?: PaperBranding;
  ncertOnly?: boolean;
  instructions?: string[];
  difficultyMix?: DifficultyMix;

  // passthrough ids
  requestId?: string;
  userId?: string;
}

export interface BaseQuestion {
  id: string;
  type: QuestionType;
  marks: number;
  text: string;
  rationale?: string;
}

export interface MCQQuestion extends BaseQuestion {
  type: "MCQ";
  // exactly 4 options; keeps UI simple and avoids “All/None of the above”
  options: [string, string, string, string];
  // 0..3 only
  answerIndex: 0 | 1 | 2 | 3;
}

export interface NonMCQQuestion extends BaseQuestion {
  type: Exclude<QuestionType, "MCQ">;
  // can be string or list (e.g., matching columns)
  answer?: string | string[];
}

export type Question = MCQQuestion | NonMCQQuestion;

/* -------------------- NEW: sectioned result (optional) -------------------- */
export type SectionBlock = {
  spec: SectionSpec;
  questions: Question[];
};

/* The generator can return either a flat list (legacy) or sectioned (preferred).
   We keep both to avoid breaking old UI code. */
export interface GeneratedTest {
  meta: Meta;
  questions?: Question[];         // legacy flat mode
  sections?: SectionBlock[];      // new structured mode
}

/* -------------------- Server response (Edge) -------------------- */
export type GenerateTestServerResponse =
  | {
      ok: true;
      // Preferred explicit URLs (new backend)
      pdfUrl?: string | null;
      docxUrl?: string | null;
      csvUrl?: string | null;

      // Back-compat single URL (PDF)
      url: string;

      meta: Meta;
      json: GeneratedTest; // validated JSON (flat or sectioned)
      used: { modelGPT: string; modelDeepseek: string };

      // Optional ids
      requestId?: string;
      rid?: string;
    }
  | {
      ok: false;
      error: string;
    };

/* -------------------- Narrow helpers (optional) -------------------- */
export function isMCQ(q: Question): q is MCQQuestion {
  return q.type === "MCQ";
}
