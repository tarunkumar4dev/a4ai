// src/lib/api.ts

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Types ──────────────────────────────────────────────────────────────

export interface GeneratedQuestion {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  marks: number;
  difficulty: string;
  bloomLevel: string | null;
  chapter: string;
  topic: string | null;
  format: string;
  validationStatus: string;
  section: string | null;
  // Manual question fields
  isManual?: boolean;
  imageUrl?: string | null;
  answerTable?: any;
}

export interface GenerateTestResponse {
  ok: boolean;
  testId: string;
  examTitle: string;
  questions: GeneratedQuestion[];
  totalMarks: number;
  totalQuestions: number;
  generationTime: number;
  status: string;
  meta: Record<string, any>;
}

export interface ChaptersResponse {
  ok: boolean;
  subject: string;
  classGrade: string;
  chapters: string[];
  count: number;
}

export interface HealthResponse {
  ok: boolean;
  services: {
    postgresql: boolean;
    supabase: boolean;
    gemini: boolean;
    ncertChunks: number;
  };
  version: string;
}

// Manual question payload type (used when sending to add-manual-question endpoint)
export interface ManualQuestionApiPayload {
  id: string;
  text: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  marks: number;
  difficulty: "easy" | "medium" | "hard";
  chapter?: string;
  format: string; // "mcq" | "short_answer" | "long_answer" | "image" | "manual"
  type?: string;
  imageUrl?: string;
  section?: string;
  isManual: true;
}

// ── Error Class ────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

// ── Core Fetch Helper ──────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      defaultHeaders["Authorization"] = `Bearer ${session.access_token}`;
    }
  } catch {
    // No auth — continue
  }

  const res = await fetch(url, {
    ...options,
    headers: { ...defaultHeaders, ...options.headers },
  });

  if (!res.ok) {
    let detail = "Unknown error";
    try {
      const errBody = await res.json();
      detail = errBody.detail || errBody.error || JSON.stringify(errBody);
    } catch {
      detail = await res.text();
    }
    throw new ApiError(res.status, detail);
  }

  return res.json();
}

// ── API Methods ────────────────────────────────────────────────────────

export const api = {
  /**
   * Generate a test from React form data.
   * POST /api/v1/test-generator/generate-frontend
   */
  async generateTest(payload: {
    examTitle: string;
    paperDate?: string;
    board: string;
    classGrade: string;
    subject: string;
    simpleData: {
      topic: string;
      subtopic?: string;
      quantity: number;
      marks?: number;
      difficulty: string;
      format: string;
    }[];
    mode?: string;
    enableWatermark?: boolean;
    shuffleQuestions?: boolean;
    useNCERT?: boolean;
    ncertChapters?: string[];
    userId?: string;
    cbsePattern?: boolean;
  }): Promise<GenerateTestResponse> {
    return apiFetch<GenerateTestResponse>(
      "/api/v1/test-generator/generate-frontend",
      { method: "POST", body: JSON.stringify(payload) }
    );
  },

  /**
   * Get NCERT chapters for a subject/class.
   */
  async getChapters(subject: string, classGrade: string): Promise<ChaptersResponse> {
    const classNum = classGrade.replace(/\D/g, "") || "10";
    return apiFetch<ChaptersResponse>(
      `/api/v1/test-generator/chapters?subject=${encodeURIComponent(subject)}&class_grade=${classNum}`
    );
  },

  /**
   * Get a saved test by ID.
   */
  async getTest(testId: string, teacherId: string): Promise<any> {
    return apiFetch(
      `/api/v1/test-generator/test/${testId}?teacher_id=${encodeURIComponent(teacherId)}`
    );
  },

  /**
   * Submit teacher feedback.
   */
  async submitFeedback(payload: {
    testId: string;
    teacherId: string;
    feedbacks: { questionId: string; action: "approve" | "reject" | "edit"; comment?: string }[];
    globalComment?: string;
  }): Promise<any> {
    return apiFetch("/api/v1/test-generator/feedback", {
      method: "POST",
      body: JSON.stringify({
        test_id: payload.testId,
        teacher_id: payload.teacherId,
        feedbacks: payload.feedbacks.map((f) => ({
          question_id: f.questionId,
          action: f.action,
          comment: f.comment,
        })),
        global_comment: payload.globalComment,
      }),
    });
  },

  /**
   * Save a test with the final question list (includes manual questions).
   * POST /api/v1/test-generator/save
   */
  async saveTest(
    testId: string,
    teacherId: string,
    questions?: any[]
  ): Promise<any> {
    return apiFetch("/api/v1/test-generator/save", {
      method: "POST",
      body: JSON.stringify({
        test_id: testId,
        teacher_id: teacherId,
        questions: questions,  // include final list (manual + AI questions)
      }),
    });
  },

  /**
   * Add a single manual question to an existing test (immediate persist).
   * POST /api/v1/test-generator/tests/{test_id}/add-manual-question
   * This is optional — /save also handles manual questions in bulk.
   */
  async addManualQuestion(
    testId: string,
    teacherId: string,
    question: ManualQuestionApiPayload
  ): Promise<{ ok: boolean; question: any }> {
    return apiFetch(
      `/api/v1/test-generator/tests/${encodeURIComponent(testId)}/add-manual-question`,
      {
        method: "POST",
        body: JSON.stringify({
          teacher_id: teacherId,
          question: question,
        }),
      }
    );
  },

  /**
   * Export test as PDF or DOCX.
   * Now supports paperDate and manual questions.
   */
  async exportTest(payload: {
    examTitle: string;
    paperDate?: string;
    board: string;
    classGrade: string;
    subject: string;
    questions: any[];
    includeAnswers: boolean;
    includeExplanations: boolean;
    format: "pdf" | "docx";
    logoBase64?: string | null;
  }): Promise<Blob> {
    const url = `${API_BASE}/api/v1/test-generator/export`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let detail = "Export failed";
      try {
        const errBody = await res.json();
        detail = errBody.detail || detail;
      } catch {}
      throw new ApiError(res.status, detail);
    }
    return res.blob();
  },

  /**
   * Health checks.
   */
  async healthDetail(): Promise<HealthResponse> {
    return apiFetch<HealthResponse>("/api/v1/test-generator/health-detail");
  },
  async health(): Promise<{ status: string }> {
    return apiFetch("/health");
  },
};

export default api;