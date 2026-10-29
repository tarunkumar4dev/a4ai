// src/lib/contestApi.ts
// ──────────────────────────────────────────────────────────
// Frontend API client for Contest endpoints
// ──────────────────────────────────────────────────────────

import { getBackendApiBase } from "@/lib/apiBase";

const API_V1 = `${getBackendApiBase()}/v1`;

// ── Types ──

export interface CreateContestPayload {
  title: string;
  subject: string;
  class_grade: string;
  board?: string;
  logo_base64?: string | null;
  duration_minutes: number;
  /** teacher_release = hidden until the teacher publishes (newer backend; older ones reject it → caller falls back to "none") */
  answer_mode: AnswerMode;
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

export type AnswerMode = "instant" | "after_test" | "teacher_release" | "none";

export interface MyContest {
  contest_id: string;
  title: string;
  subject: string;
  class_grade: string;
  short_code: string;
  share_link: string;
  total_questions: number;
  total_marks: number;
  total_attempts: number;
  duration_minutes: number;
  answer_mode: string;
  status: string;
  created_at: string;
  results_published?: boolean;
  // newer backend (feat/contest-results)
  attempts_count?: number;
  scheduled_at?: string | null;
  expires_at?: string | null;
  results_published_at?: string | null;
}

/** One leaderboard row. Students get only names / scores / time; the contest's teacher also gets the rest. */
export interface LeaderboardRow {
  attempt_id: string;
  /** null: still running (teacher view only) */
  rank?: number | null;
  student_name?: string | null;
  status: string;
  score?: number | null;
  total_marks: number;
  percentage?: number | null;
  time_taken_seconds?: number | null;
  correct?: number | null;
  wrong?: number | null;
  left?: number | null;
  submitted_at?: string | null;
  is_me?: boolean;
  retry?: boolean;
  retry_of?: string | null;
  // teacher only
  student_email?: string | null;
  warning_count?: number | null;
  submitted_via?: string | null;
  late?: boolean | null;
}

export interface LeaderboardResponse {
  contest_id: string;
  title: string;
  total_attempts: number;
  attempts: LeaderboardRow[];
  /** teacher_release, not published, caller isn't the teacher: no rows */
  results_pending?: boolean;
  total_participants?: number;
  my_rank?: number | null;
}

export interface CreateContestResponse {
  /** false: the backend could not read the teacher's login — the contest has no owner (newer backend) */
  teacher_attached?: boolean;
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
  // ── newer backend (all optional: an old backend sends none of them) ──
  started_at?: string | null;
  deadline_at?: string | null;
  server_now?: string | null;
  /** present when /start resumes the same attempt */
  progress?: {
    answers?: { questionId: string; selected: string | null; textAnswer?: string; timeSpent: number; flagged?: boolean }[];
    current_index?: number;
    warning_count?: number;
    warning_log?: { type: string; at: string; detail?: string }[];
  } | null;
  /** periodic camera snapshots are allowed for this contest (also needs VITE_CONTEST_SNAPSHOTS=1) */
  snapshots_enabled?: boolean;
  /** a NEW attempt the backend opened because the previous one ended on a technical issue */
  retry_of?: string | null;
}

export interface ProgressPayload {
  answers: { questionId: string; selected: string | null; textAnswer?: string; timeSpent: number; flagged: boolean }[];
  current_index: number;
  warning_count: number;
  warning_log: { type: string; at: string; detail?: string }[];
}

/** PUT progress → {ok} or, when the server already closed the attempt (deadline), the submit result */
export type ProgressResponse = { ok?: boolean; finalized?: boolean } & Partial<SubmitResponse>;

export interface SubmitPayload {
  student_name?: string;
  student_email?: string;
  answers: {
    questionId: string;
    selected: string | null;
    textAnswer?: string;
    timeSpent: number;
    flagged?: boolean;
  }[];
  warning_count: number;
  warning_log: { type?: string; reason?: string; at: string; detail?: string }[];
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
  // newer backend (feat/contest-results)
  submitted_at?: string | null;
  submitted_via?: string | null;
  late?: boolean;
  /** server-measured, capped at the duration */
  time_taken_seconds?: number | null;
  retry_of?: string | null;
  retry?: boolean;
  /** teacher_release, not published yet: score / answers withheld */
  results_pending?: boolean;
}

// ═══════════════════════════════════════════════════════════
// Errors: FastAPI "detail" can be a string, an object ({code, message, ...}) or a 422 list
// ([{loc, msg}]) — turn any of them into one readable line.
// ═══════════════════════════════════════════════════════════

export class ContestApiError extends Error {
  status: number;
  code: string | null;
  /** the JSON body (top-level fields, e.g. {code, scheduled_at, detail}) */
  body: Record<string, any>;
  /** `detail` when it is an object ({code, message, scheduled_at, ...}), else {} */
  detail: Record<string, any>;
  constructor(message: string, status: number, code: string | null = null, body: Record<string, any> = {}, detail: Record<string, any> = {}) {
    super(message);
    this.name = "ContestApiError";
    this.status = status;
    this.code = code;
    this.body = body;
    this.detail = detail;
  }
}

export function detailMessage(body: any): string | null {
  const d = body?.detail ?? body;
  if (!d) return null;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    const msgs = d.map((e) => (typeof e === "string" ? e : e?.msg ? `${e.msg}${Array.isArray(e.loc) ? ` (${e.loc.filter((x: any) => x !== "body").join(".")})` : ""}` : null)).filter(Boolean);
    return msgs.length ? msgs.join("; ") : null;
  }
  if (typeof d === "object") return d.message || d.msg || d.error || (typeof body?.message === "string" ? body.message : null);
  return null;
}

/** Read a failed Response into a ContestApiError (never throws while reading). */
export async function errorFromResponse(res: Response, fallback: string): Promise<ContestApiError> {
  const raw = await res.json().catch(() => ({} as any));
  const body = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const d = body.detail;
  const obj = d && typeof d === "object" && !Array.isArray(d) ? d : {};
  // top-level first ({"code": "...", "detail": "<string>"}), then the object form ({"detail": {"code": ...}})
  const code = body.code || obj.code || null;
  return new ContestApiError(detailMessage(body) || `${fallback} (${res.status})`, res.status, code, body, obj);
}

/** "25 Oct 2026, 10:00 am IST". A timestamp without an offset ("2026-10-25T04:30:00") is read as UTC. */
export function formatIst(iso: string): string {
  const t = iso.trim();
  const noZone = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(t);
  const d = new Date(noZone ? `${t.replace(" ", "T")}Z` : t);
  if (isNaN(d.getTime())) return iso;
  return `${d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })} IST`;
}

const NOT_STARTED_POLL_MS = 15000;

/**
 * When to look again after 403 CONTEST_NOT_STARTED. The opening moment comes from the SERVER
 * (scheduled_at − server_now, placed on this device's clock at receivedAt), never from the phone's own clock.
 * opensAt = null when the server sent no server_now (then only the 15 s poll).
 */
export function notStartedTiming(err: unknown, receivedAt: number, now = receivedAt): { opensAt: number | null; nextCheckMs: number } {
  const pick = (k: string) => (err instanceof ContestApiError ? err.body?.[k] ?? err.detail?.[k] : undefined);
  const sched = Date.parse(String(pick("scheduled_at") ?? pick("starts_at") ?? ""));
  const server = Date.parse(String(pick("server_now") ?? ""));
  if (isNaN(sched) || isNaN(server)) return { opensAt: null, nextCheckMs: NOT_STARTED_POLL_MS };
  const opensAt = receivedAt + (sched - server);
  // re-check just after it opens (+300 ms), but never wait longer than the 15 s poll
  return { opensAt, nextCheckMs: Math.min(NOT_STARTED_POLL_MS, Math.max(500, opensAt - now + 300)) };
}

/** Text for a failed /start: a scheduled contest that hasn't opened shows its opening time. */
export function startErrorMessage(err: unknown, fallback = "Could not start the contest."): string {
  if (err instanceof ContestApiError && err.code === "CONTEST_NOT_STARTED") {
    const keys = ["scheduled_at", "starts_at", "start_time", "opens_at"];
    const at = [err.body.scheduled_at, err.detail.scheduled_at, ...keys.slice(1).flatMap((k) => [err.body[k], err.detail[k]])]
      .find((v) => typeof v === "string" && v.trim());
    return at ? `This contest opens on ${formatIst(String(at))}. Please come back then.` : "This contest hasn't started yet. Please come back later.";
  }
  return (err as any)?.message || fallback;
}

// ═══════════════════════════════════════════════════════════
// FIX: Auth helper — correct import path
// BUG WAS: import("@/integrations/supabase/client")
//          → module not found → catch swallowed error
//          → no auth token → backend rejected request
// ═══════════════════════════════════════════════════════════

export async function getAuthHeaders(): Promise<Record<string, string>> {
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
    const res = await fetch(`${API_V1}/contests`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await errorFromResponse(res, "Failed to create contest");
      console.error("[contestApi] createContest failed:", res.status, err.message);
      throw err;
    }
    return res.json();
  },

  async getContestInfo(shortCode: string): Promise<ContestInfo> {
    // no-store: "Check again" / the auto re-check must reach the server, never a cached "not started"
    const res = await fetch(`${API_V1}/contests/${shortCode}/info`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (res.status === 404) throw new Error("Contest not found");
    if (res.status === 410) throw new Error("This contest has ended");
    if (res.status === 403) {
      const err = await errorFromResponse(res, "This contest is paused");
      if (err.code === "CONTEST_NOT_STARTED") throw err;   // startErrorMessage() shows the opening time
      throw new ContestApiError("This contest is paused", 403, err.code);
    }
    if (!res.ok) throw new Error("Failed to load contest");
    return res.json();
  },

  async startAttempt(
    shortCode: string,
    studentName?: string,
    studentEmail?: string,
  ): Promise<ContestData> {
    const res = await fetch(`${API_V1}/contests/${shortCode}/start`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        student_name: studentName,
        student_email: studentEmail,
      }),
    });
    if (!res.ok) throw await errorFromResponse(res, "Failed to start contest");
    return res.json();
  },

  async submitAttempt(
    contestId: string,
    attemptId: string,
    payload: SubmitPayload,
  ): Promise<SubmitResponse> {
    const headers = await getAuthHeaders();
    headers["X-Attempt-Id"] = attemptId;
    const res = await fetch(`${API_V1}/contests/${contestId}/submit`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await errorFromResponse(res, "Failed to submit");
    return res.json();
  },

  /** keepalive: the page is hiding/closing — the browser finishes the request after the page is gone */
  async saveProgress(contestId: string, attemptId: string, payload: ProgressPayload, keepalive = false): Promise<ProgressResponse> {
    const headers = await getAuthHeaders();
    headers["X-Attempt-Id"] = attemptId;
    const res = await fetch(`${API_V1}/contests/${contestId}/attempts/${attemptId}/progress`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
      keepalive,
    });
    if (!res.ok) throw await errorFromResponse(res, "Failed to save progress");
    return res.json().catch(() => ({ ok: true }));
  },

  /** P1, off by default (VITE_CONTEST_SNAPSHOTS=1 + snapshots_enabled): register an uploaded camera snapshot */
  async postSnapshot(contestId: string, attemptId: string, path: string): Promise<void> {
    const headers = await getAuthHeaders();
    headers["X-Attempt-Id"] = attemptId;
    const res = await fetch(`${API_V1}/contests/${contestId}/attempts/${attemptId}/snapshots`, {
      method: "POST", headers, body: JSON.stringify({ path }),
    });
    if (!res.ok) throw await errorFromResponse(res, "Failed to save snapshot");
  },

  /** attemptId (X-Attempt-Id) marks the caller's own row (is_me / my_rank) */
  async getLeaderboard(contestId: string, attemptId?: string | null): Promise<LeaderboardResponse> {
    const headers = await getAuthHeaders();
    if (attemptId) headers["X-Attempt-Id"] = attemptId;
    const res = await fetch(`${API_V1}/contests/${contestId}/leaderboard`, { headers, cache: "no-store" });
    if (!res.ok) throw await errorFromResponse(res, "Failed to load results");
    return res.json();
  },

  /** Hide published results again (backend: POST /contests/{id}/unpublish-results — not built yet → 404/405) */
  async unpublishResults(contestId: string): Promise<{ ok?: boolean }> {
    const res = await fetch(`${API_V1}/contests/${contestId}/unpublish-results`, { method: "POST", headers: await getAuthHeaders() });
    if (!res.ok) throw await errorFromResponse(res, "Failed to hide results");
    return res.json().catch(() => ({ ok: true }));
  },

  async listMyContests(): Promise<{ contests: MyContest[] }> {
    const res = await fetch(`${API_V1}/contests/my`, {
      headers: await getAuthHeaders(),
    });
    if (!res.ok) throw await errorFromResponse(res, "Failed to load contests");
    return res.json();
  },

  /** teacher_release contests: make scores + answers visible to students (backend: POST /contests/{id}/publish-results) */
  async publishResults(contestId: string): Promise<{ ok?: boolean; published_at?: string }> {
    const res = await fetch(`${API_V1}/contests/${contestId}/publish-results`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
    if (!res.ok) throw await errorFromResponse(res, "Failed to publish results");
    return res.json().catch(() => ({ ok: true }));
  },
};

export default contestApi;