// /src/types/testgen.ts - UPDATED WITH RAG FIELDS

/* ------------------------------------------------------------------ */
/* ENUMS & UNIONS                                                     */
/* ------------------------------------------------------------------ */
export type DifficultyLevel = "easy" | "medium" | "hard" | "mixed";
export type QuestionType = "mcq" | "short" | "long" | "numerical" | "case_based";
export type CognitiveLevel = "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
export type OutputFormat = "pdf" | "docx" | "csv";
export type BoardType = "CBSE" | "ICSE" | "State" | "IGCSE" | "IB";

/* ------------------------------------------------------------------ */
/* RAG-SPECIFIC TYPES                                                 */
/* ------------------------------------------------------------------ */
export interface RAGSource {
  content: string;
  metadata: {
    source?: string;
    page?: string | number;
    chapter?: string;
    document_id?: string;
    [key: string]: any;
  };
  similarity: number;
}

export interface RAGContext {
  // Context text from NCERT (summarized/processed)
  content: string;
  
  // Raw sources for reference
  sources: RAGSource[];
  
  // RAG query used
  query: string;
  
  // Metadata
  chunksRetrieved: number;
  confidence?: number;
}

/* ------------------------------------------------------------------ */
/* UI COMPONENT TYPES (From TestRowEditor)                            */
/* ------------------------------------------------------------------ */
export interface SimpleRowData {
  id: string;
  topic: string;
  subtopic?: string;
  quantity: number;
  difficulty: "Easy" | "Medium" | "Hard" | "Mixed"; // UI casing
  format: "PDF" | "DOC";
  refFile?: File;
  
  // Optional RAG-specific fields
  useNCERT?: boolean;
  ncertChapter?: string;
}

/* ------------------------------------------------------------------ */
/* BACKEND BUCKET TYPES                                               */
/* ------------------------------------------------------------------ */
export interface TestBucket {
  type: QuestionType;
  difficulty: DifficultyLevel;
  cognitive?: CognitiveLevel;
  count: number;
  marks: number;
  negativeMarking?: number;
  chapters?: string[];
  
  // RAG-specific: Which NCERT chapters to focus on for this bucket
  ncertChapters?: string[];
  useNCERT?: boolean;
}

/* ------------------------------------------------------------------ */
/* API PAYLOAD REQUEST (For generateTest.ts)                          */
/* ------------------------------------------------------------------ */
export interface GenerateTestRequest {
  // Core Identity
  userId: string;
  requestId?: string;
  
  // Meta Data
  subject: string;
  classNum: number; // Always number for backend
  board?: BoardType;
  examTitle?: string;
  
  // Topic/Scope
  topic?: string;
  chapters?: string[];
  
  // Question Configuration
  qCount?: number;
  difficulty?: DifficultyLevel;
  patternMode?: "simple" | "blueprint" | "matrix";
  
  // NCERT Configuration (CRITICAL FOR FILTERING)
  useNCERT: boolean;
  ncertClass?: number;
  ncertSubject?: string;
  ncertChapters: string[];
  ncertWeight?: number;
  
  // RAG-Specific Configuration
  ragContext?: string;                    // Pre-fetched NCERT context
  ragSources?: RAGSource[];               // Source documents
  ragQuery?: string;                      // The query used to get context
  useRAG?: boolean;                       // Explicit flag to use RAG
  
  // Buckets (Processed from simpleData)
  buckets?: TestBucket[];
  
  // Simple Data (For fallback/context)
  simpleData?: SimpleRowData[];
  
  // Settings
  language?: "English" | "Hindi";
  outputFormat?: OutputFormat;
  watermark?: boolean;
  shuffleQuestions?: boolean;
  
  // Optional
  notes?: string;
  teacherName?: string;
  examDate?: string;
  
  // Advanced RAG options
  ragThreshold?: number;                  // Similarity threshold
  ragTopK?: number;                       // Number of chunks to retrieve
  includePageNumbers?: boolean;           // Include page numbers in questions
}

/* ------------------------------------------------------------------ */
/* API RESPONSE TYPES                                                 */
/* ------------------------------------------------------------------ */
export interface GenerateTestResponse {
  ok: boolean;
  pdfUrl?: string | null;
  docxUrl?: string | null;
  csvUrl?: string | null;
  requestId?: string;
  meta: {
    mode?: string;
    totalQuestions?: number;
    useNCERT?: boolean;
    ncertWeight?: number;
    sections?: string[];
    
    // RAG Metadata
    ragUsed?: boolean;
    ragSourcesCount?: number;
    ragConfidence?: number;
    ncertBased?: boolean;
    chaptersCovered?: string[];
    
    [key: string]: any;
  };
  json: any;
  
  // Optional: Include RAG context in response for debugging/display
  ragContext?: RAGContext;
}

/* ------------------------------------------------------------------ */
/* CHAT/QA RELATED TYPES                                              */
/* ------------------------------------------------------------------ */
export interface NCERTQueryRequest {
  question: string;
  subject?: string;
  classNum?: number;
  chapter?: string;
  includeSources?: boolean;
}

export interface NCERTQueryResponse {
  success: boolean;
  answer: string;
  sources?: RAGSource[];
  queryTime?: number;
  confidence?: number;
}

/* ------------------------------------------------------------------ */
/* HELPER TYPES                                                       */
/* ------------------------------------------------------------------ */
export interface HealthCheck {
  ok: boolean;
  keys: {
    openai: boolean;
    deepseek: boolean;
    gemini: boolean;
  };
  models: {
    openai: string;
    deepseek: string;
    gemini: string;
  };
  // Add RAG health check
  rag?: {
    available: boolean;
    chunksCount?: number;
    apiEndpoint?: string;
  };
}

/* ------------------------------------------------------------------ */
/* DOCUMENT INGESTION TYPES (Optional - for admin)                    */
/* ------------------------------------------------------------------ */
export interface DocumentIngestionRequest {
  documentId: string;
  text: string;
  metadata: {
    source: string;
    subject: string;
    class: number;
    chapter: string;
    pages?: string;
    author?: string;
    year?: number;
  };
}