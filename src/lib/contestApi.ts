// src/lib/contestApi.ts
// ──────────────────────────────────────────────────────────
// Frontend API client for Contest endpoints
// ──────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Types ──

export interface CreateContestPayload {
  title: string;
  subject: string;
  class_grade: string;
  board?: string;
  logo_base64?: string | null;
  duration_minutes: number;
  answer_mode: "instant" | "after_test" | "none";
  show_explanation: boolean;
  enable_camera: boolean;
  enable_tab_detection: boolean;
  allow_back_navigation: boolean;
  max_warnings: number;
  max_attempts?: number;
  scheduled_at?: string | null;
  expires_at?: string | null;
  questions: {
    question_text: string;
    question_type: string;
    options?: { label: string; text: string }[];
    correct_answer?: string;
    explanation?: string;
    marks: number;
    difficulty: string;
    chapter?: string;
  }[];
}

export interface CreateContestResponse {
  contest_id: string;
  short_code: string;
  share_link: string;
  total_questions: number;
  total_marks: number;
}

export interface ContestInfo {
  contest_id: string;
  title: string;
  subject: string;
  class_grade: string;
  board: string;
  logo_base64?: string;
  duration_minutes: number;
  total_questions: number;
  total_marks: number;
  enable_camera: boolean;
  enable_tab_detection: boolean;
  allow_back_navigation: boolean;
  max_warnings: number;
  status: string;
  teacher_name?: string;
  institute_name?: string;
}

export interface ContestQuestion {
  id: string;
  question_number: number;
  question_text: string;
  question_type: string;
  options?: { label: string; text: string }[];
  marks: number;
  difficulty: string;
  chapter?: string;
}

export interface ContestData {
  contest_id: string;
  attempt_id: string;
  title: string;
  subject: string;
  class_grade: string;
  duration_minutes: number;
  enable_camera: boolean;
  enable_tab_detection: boolean;
  allow_back_navigation: boolean;
  max_warnings: number;
  answer_mode: string;
  show_explanation: boolean;
  questions: ContestQuestion[];
}

export interface SubmitPayload {
  student_name?: string;
  student_email?: string;
  answers: {
    questionId: string;
    selected: string | null;
    textAnswer?: string;
    timeSpent: number;
  }[];
  warning_count: number;
  warning_log: { reason: string; at: string }[];
  time_taken_seconds: number;
}

export interface SubmitResponse {
  attempt_id: string;
  status: string;
  score: number | null;
  total_marks: number;
  percentage: number | null;
  answered_count: number;
  total_questions: number;
  questions_with_answers?: any[];
}

// ═══════════════════════════════════════════════════════════
// FIX: Auth helper — correct import path
// BUG WAS: import("@/integrations/supabase/client")
//          → module not found → catch swallowed error
//          → no auth token → backend rejected request
// ═══════════════════════════════════════════════════════════

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  try {
    // FIX: Use correct import path matching the rest of the app
    const { supabase } = await import("@/lib/supabaseClient");
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  } catch (err) {
    console.warn("[contestApi] Auth header failed:", err);
  }
  return headers;
}

// ═══════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════

export const contestApi = {

  async createContest(payload: CreateContestPayload): Promise<CreateContestResponse> {
    const res = await fetch(`${API_BASE}/api/v1/contests`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[contestApi] createContest failed:", res.status, err);
      throw new Error(err.detail || `Failed to create contest (${res.status})`);
    }
    return res.json();
  },

  async getContestInfo(shortCode: string): Promise<ContestInfo> {
    const res = await fetch(`${API_BASE}/api/v1/contests/${shortCode}/info`, {
      headers: { "Content-Type": "application/json" },
    });
    if (res.status === 404) throw new Error("Contest not found");
    if (res.status === 410) throw new Error("This contest has ended");
    if (res.status === 403) throw new Error("This contest is paused");
    if (!res.ok) throw new Error("Failed to load contest");
    return res.json();
  },

  async startAttempt(
    shortCode: string,
    studentName?: string,
    studentEmail?: string,
  ): Promise<ContestData> {
    const res = await fetch(`${API_BASE}/api/v1/contests/${shortCode}/start`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        student_name: studentName,
        student_email: studentEmail,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to start contest");
    }
    return res.json();
  },

  async submitAttempt(
    contestId: string,
    attemptId: string,
    payload: SubmitPayload,
  ): Promise<SubmitResponse> {
    const headers = await getAuthHeaders();
    headers["X-Attempt-Id"] = attemptId;
    const res = await fetch(`${API_BASE}/api/v1/contests/${contestId}/submit`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to submit");
    }
    return res.json();
  },

  async getLeaderboard(contestId: string) {
    const res = await fetch(`${API_BASE}/api/v1/contests/${contestId}/leaderboard`, {
      headers: await getAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load leaderboard");
    return res.json();
  },

  async listMyContests() {
    const res = await fetch(`${API_BASE}/api/v1/contests/my`, {
      headers: await getAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load contests");
    return res.json();
  },
};

export default contestApi;