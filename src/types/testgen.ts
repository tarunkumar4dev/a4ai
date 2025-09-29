// /src/types/testgen.ts

/* -------------------- Core enums/aliases -------------------- */
export type Language = "en" | "hi" | "bilingual";

// Keep existing Difficulty literals so old payloads still work
export type Difficulty = "Easy" | "Medium" | "Hard" | "Mixed";

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

/* -------------------- Client → Edge payload -------------------- */
export type GenerateTestRequest = {
  subject: string;
  grade: string;                 // e.g., "Class 11"
  board?: string;                // "CBSE" | "ICSE" | "State" | ...
  topics?: string[];
  chapters?: string[];

  // Existing single-type mode (still supported)
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
};

/* -------------------- Generated JSON (strict) -------------------- */
export interface Meta {
  subject: string;
  grade: string;
  board?: string;

  // Keep original fields for backward compatibility
  questionType?: QuestionType;
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
      url: string;                        // public PDF URL (preferred)
      meta: Meta;
      json: GeneratedTest;                // validated JSON (flat or sectioned)
      used: { modelGPT: string; modelDeepseek: string };
    }
  | {
      ok: false;
      error: string;
    };

/* -------------------- Narrow helpers (optional) -------------------- */
export function isMCQ(q: Question): q is MCQQuestion {
  return q.type === "MCQ";
}
