// types/enhanced-types.ts - ENHANCED VERSION
export type CognitiveLevel = "recall" | "understand" | "apply" | "analyze";
export type QuestionType = "mcq" | "short" | "long" | "numerical" | "case_based" | "assertion_reason";
export type DifficultyLevel = "easy" | "medium" | "hard";
export type LanguageCode = "en" | "hi" | "bi";
export type BoardType = "CBSE" | "ICSE" | "State" | "IGCSE" | "IB";
export type SolutionStyle = "steps" | "concise" | "detailed" | "hints";

export interface GenerationBucket {
  id: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  cognitive: CognitiveLevel;
  count: number;
  marks: number;
  chapters: string[];
  topics: string[];
  language: string;
  negativeMarking?: number;
  requireUnits?: boolean;
  timeEstimate?: number; // in minutes
}

export interface EnhancedQuestion {
  id?: string;
  subject: string;
  board: BoardType;
  class: string;
  chapter: string;
  topic: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  cognitive: CognitiveLevel;
  language: LanguageCode;
  stem: string;
  options?: Array<{ label: string; text: string; isCorrect?: boolean }>;
  answer: {
    label?: string;
    explanation: string;
    value: string;
    steps?: string[];
    units?: string;
  };
  marks: number;
  negative: number;
  units_required: boolean;
  images: string[];
  solution_style: SolutionStyle;
  meta: {
    keywords: string[];
    source: string;
    score: number;
    vetted: boolean;
    ncert_aligned: boolean;
    time_estimate: number; // in minutes
    concept_tags: string[];
    created_at: string;
    updated_at: string;
  };
}

export interface ScoreReport {
  avg: number;
  byBucket: Record<string, number>;
  byCognitive: Record<CognitiveLevel, number>;
  byDifficulty: Record<DifficultyLevel, number>;
  totalQuestions: number;
  qualityScore: number;
  recommendations: string[];
}

// NEW: Enhanced input types for generation
export interface EnhancedGenerationInput {
  userId: string;
  requestId?: string;
  board: BoardType;
  classNum: number;
  subject: string;
  chapters: string[];
  topics: string[];
  buckets: GenerationBucket[];
  cognitiveLevels: CognitiveLevel[];
  avoidDuplicates: boolean;
  ncertWeight: number;
  requireUnits: boolean;
  timeLimit?: number;
  shareable: boolean;
  language: LanguageCode;
  solutionStyle: SolutionStyle;
  includeAnswerKey: boolean;
  negativeMarking: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  outputFormat: "PDF" | "DOCX" | "CSV" | "JSON";
  ref_files: Array<{ name: string; path: string }>;
  institute?: string;
  teacherName?: string;
  examTitle?: string;
  examDate?: string;
  customInstructions?: string;
}

// NEW: Question generation result
export interface GenerationResult {
  success: boolean;
  questions: EnhancedQuestion[];
  totalMarks: number;
  totalQuestions: number;
  timeTaken: number;
  qualityScore: number;
  cognitiveDistribution: Record<CognitiveLevel, number>;
  difficultyDistribution: Record<DifficultyLevel, number>;
  warnings: string[];
  metadata: {
    generatedAt: string;
    modelUsed: string;
    version: string;
  };
}

// NEW: Cognitive analysis types
export interface CognitiveAnalysis {
  level: CognitiveLevel;
  count: number;
  percentage: number;
  averageMarks: number;
  averageScore: number;
  recommendations: string[];
}

export interface DifficultyAnalysis {
  level: DifficultyLevel;
  count: number;
  percentage: number;
  averageTime: number;
  successRate: number;
}

// NEW: Validation types
export interface QuestionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  score: number;
}

// NEW: Export types for different formats
export interface PDFExportOptions {
  includeCognitiveLevel: boolean;
  showDifficultyBadges: boolean;
  includeQRCode: boolean;
  watermarkText?: string;
  compactMode: boolean;
  fontSize: "small" | "medium" | "large";
  showMarksDistribution: boolean;
  includeInstructions: boolean;
  copyType: "teacher" | "student" | "answer_key";
}

export interface CSVExportData {
  section: string;
  index: number;
  marks: number;
  type: string;
  difficulty: string;
  cognitive: string;
  text: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  answer: string;
  solution?: string;
  units?: string;
}

// NEW: API response types
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  rid: string;
  timestamp: string;
}

export interface GenerationStatus {
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  currentStep: string;
  estimatedTimeRemaining?: number;
  result?: GenerationResult;
}

// NEW: Storage types
export interface StoredPaper {
  id: string;
  userId: string;
  title: string;
  subject: string;
  board: BoardType;
  class: string;
  questions: EnhancedQuestion[];
  totalMarks: number;
  totalQuestions: number;
  generatedAt: string;
  pdfUrl?: string;
  docxUrl?: string;
  csvUrl?: string;
  meta: {
    cognitiveLevels: CognitiveLevel[];
    difficultyMix: Record<DifficultyLevel, number>;
    ncertWeight: number;
    qualityScore: number;
  };
}

// NEW: Analytics types
export interface GenerationAnalytics {
  totalRequests: number;
  successfulGenerations: number;
  averageQualityScore: number;
  mostUsedSubjects: string[];
  cognitiveDistribution: Record<CognitiveLevel, number>;
  difficultyDistribution: Record<DifficultyLevel, number>;
  averageGenerationTime: number;
  popularBuckets: Array<{
    type: QuestionType;
    difficulty: DifficultyLevel;
    cognitive: CognitiveLevel;
    count: number;
  }>;
}

// Utility types for internal use
export type ScorerConfig = {
  topicWeight: number;
  difficultyWeight: number;
  syllabusWeight: number;
  clarityWeight: number;
  solutionWeight: number;
  styleWeight: number;
  cognitiveWeight: number;
  ncertWeight: number;
};

export type DeduplicationConfig = {
  similarityThreshold: number;
  checkCognitiveLevel: boolean;
  checkTopics: boolean;
  checkConcepts: boolean;
  enableSemanticCheck: boolean;
};

// Type guards
export const isCognitiveLevel = (level: string): level is CognitiveLevel => {
  return ["recall", "understand", "apply", "analyze"].includes(level);
};

export const isDifficultyLevel = (level: string): level is DifficultyLevel => {
  return ["easy", "medium", "hard"].includes(level);
};

export const isQuestionType = (type: string): type is QuestionType => {
  return ["mcq", "short", "long", "numerical", "case_based", "assertion_reason"].includes(type);
};

// Default configurations
export const DEFAULT_SCORER_CONFIG: ScorerConfig = {
  topicWeight: 0.2,
  difficultyWeight: 0.15,
  syllabusWeight: 0.15,
  clarityWeight: 0.1,
  solutionWeight: 0.2,
  styleWeight: 0.1,
  cognitiveWeight: 0.15,
  ncertWeight: 0.15
};

export const DEFAULT_DEDUPLICATION_CONFIG: DeduplicationConfig = {
  similarityThreshold: 0.85,
  checkCognitiveLevel: true,
  checkTopics: true,
  checkConcepts: true,
  enableSemanticCheck: true
};