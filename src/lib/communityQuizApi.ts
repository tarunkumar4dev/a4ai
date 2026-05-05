// src/lib/communityQuizApi.ts
// ──────────────────────────────────────────────────────────
// API wrapper for Community Quiz endpoints
// Backend: app/api/v1/endpoints/community_quiz.py
// ──────────────────────────────────────────────────────────

import { supabase } from "@/lib/supabaseClient";

const API_BASE_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) ||
  "http://localhost:8000";

const API_PREFIX = `${API_BASE_URL}/api/v1/community-quizzes`;

/* ─────────── Types ─────────── */

export interface VideoPreview {
  video_id: string;
  url: string;
  title: string;
  channel: string;
  thumbnail: string;
  language: string;
  transcript_word_count: number;
  transcript_preview: string;
}

export interface GeneratedQuestion {
  question_text: string;
  options: string[];
  correct_option: number;
  explanation: string;
}

export interface CreateQuizPayload {
  title: string;
  description?: string;
  subject: string;
  chapter?: string;
  class_level?: string;
  source_type: "video" | "ncert" | "manual" | "bank";
  source_url?: string;
  duration_minutes: number;
  duration_window_hours: number;
  question_count: number;
  difficulty: "easy" | "medium" | "hard" | "mixed";
  focus: "conceptual" | "factual" | "mixed";
  creator_name?: string;
  creator_logo_url?: string;
  creator_channel_url?: string;
  show_leaderboard_to_participants?: boolean;
  show_correct_answers_after_submit?: boolean;
}

export interface CreateQuizResponse {
  quiz_id: string;
  share_slug: string;
  share_link: string;
  total_questions: number;
  ends_at: string;
  generation_seconds: number;
}

export interface QuizListItem {
  id: string;
  title: string;
  subject: string;
  chapter: string | null;
  share_slug: string;
  status: string;
  starts_at: string;
  ends_at: string;
  total_questions: number;
  total_attempts: number;
  total_completions: number;
  source_type: string;
  source_metadata: any;
  created_at: string;
}

export interface LeaderboardEntry {
  attempt_id: string;
  participant_name: string;
  participant_phone: string;
  participant_email: string | null;
  participant_class: string | null;
  total_score: number;
  correct_count: number;
  attempted_count: number;
  time_taken_seconds: number;
  submitted_at: string;
  rank: number;
}

export interface LeaderboardResponse {
  quiz: {
    id: string;
    title: string;
    total_questions: number;
    total_marks: number;
  };
  total_participants: number;
  leaderboard: LeaderboardEntry[];
}

/* ─────────── Auth helper ─────────── */

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/* ─────────── Error helper ─────────── */

class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = "unknown", status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail: any;
    try {
      detail = await res.json();
    } catch {
      throw new ApiError(`Request failed (${res.status})`, "http_error", res.status);
    }
    const d = detail?.detail;
    if (typeof d === "object" && d !== null) {
      throw new ApiError(d.message || "Request failed", d.code || "api_error", res.status);
    }
    throw new ApiError(typeof d === "string" ? d : "Request failed", "api_error", res.status);
  }
  return res.json();
}

/* ─────────── Endpoints ─────────── */

/** Step 1: Teacher pastes URL → preview video info. ~5-15s. */
export async function previewVideo(url: string): Promise<VideoPreview> {
  const res = await fetch(`${API_PREFIX}/preview-video`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ url }),
  });
  return handleResponse<VideoPreview>(res);
}

/** Step 2: Create quiz — fetch + Gemini gen + save. 60-90s. */
export async function createQuiz(payload: CreateQuizPayload): Promise<CreateQuizResponse> {
  const res = await fetch(`${API_PREFIX}`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<CreateQuizResponse>(res);
}

/** List teacher's quizzes. */
export async function listMyQuizzes(): Promise<{ quizzes: QuizListItem[] }> {
  const res = await fetch(`${API_PREFIX}`, {
    method: "GET",
    headers: await authHeaders(),
  });
  return handleResponse<{ quizzes: QuizListItem[] }>(res);
}

/** Teacher leaderboard. */
export async function getLeaderboard(quizId: string): Promise<LeaderboardResponse> {
  const res = await fetch(`${API_PREFIX}/${quizId}/leaderboard`, {
    method: "GET",
    headers: await authHeaders(),
  });
  return handleResponse<LeaderboardResponse>(res);
}

export { ApiError };