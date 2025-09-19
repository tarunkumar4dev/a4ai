// /src/types/testgen.ts

/* -------------------- Core enums/aliases -------------------- */
export type Language = "en" | "hi" | "bilingual";
export type Difficulty = "Easy" | "Medium" | "Hard" | "Mixed";

export type QuestionType =
  | "MCQ"
  | "Short"
  | "Long"
  | "Numerical"
  | "FillBlank"
  | "AssertionReason"
  | "Match";

/* -------------------- Client → Edge payload -------------------- */
export type GenerateTestRequest = {
  subject: string;
  grade: string;                 // e.g., "Class 11"
  board?: string;                // "CBSE" | "ICSE" | "State" | ...
  topics?: string[];
  chapters?: string[];
  questionType: QuestionType;
  difficulty: Difficulty;
  numQuestions: number;          // 1..50 (guarded server-side)
  maxMarks: number;              // total marks printed on PDF
  durationMins: number;          // duration printed on PDF
  language?: Language;
  referenceText?: string;        // optional source text to summarize
  extraInstructions?: string;    // style, marks split, etc.
  includeSolutions?: boolean;
};

/* -------------------- Generated JSON (strict) -------------------- */
export interface Meta {
  subject: string;
  grade: string;
  board?: string;
  questionType: QuestionType;
  difficulty: Difficulty | string;  // allow string to be safe with model outputs
  language?: Language | string;
  numQuestions: number;
  maxMarks: number;
  durationMins: number;
  topics?: string[];
  chapters?: string[];
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

export interface GeneratedTest {
  meta: Meta;
  questions: Question[];
}

/* -------------------- Server response (Edge) -------------------- */
export type GenerateTestServerResponse = {
  ok: true;
  url: string;                        // public PDF URL (preferred)
  meta: Meta;
  json: GeneratedTest;                // raw JSON the model produced (after validation)
  used: { modelGPT: string; modelDeepseek: string };
} | {
  ok: false;
  error: string;
};

/* -------------------- Narrow helpers (optional) -------------------- */
export function isMCQ(q: Question): q is MCQQuestion {
  return q.type === "MCQ";
}
