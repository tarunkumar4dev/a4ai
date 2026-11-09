// ALL a4ai Agent types in one place: the SSE event contract (mirror of RAG-BACKEND agent/schemas.py 1.1) and the
// v2 REST contract (RAG-BACKEND docs/AGENT_API_V2.md — not published yet; this file IS the contract the mock adapter
// in ./mock.ts follows). Fields marked "v2 (assumed)" are where we had to pick a shape; see docs/AGENT_UI.md §Contract.
export const AGENT_CONTRACT_VERSION = "1.1";
export const AGENT_API_VERSION = "2";

// ---- SSE events (contract 1.1 + v2 additions) ---------------------------------------------------
export type QuestionType =
  | "mcq" | "numeric" | "assertion_reason" | "short_answer" | "long_answer" | "case_study" | "very_short";
export type VerifyStatus = "verified" | "failed" | "manual_review" | "rubric_ok";

interface Base { seq: number; request_id: string }
interface Sourced extends Base { source: string; as_of: string }

export interface TextDelta extends Base { type: "text_delta"; text: string }
export interface ThinkingStatus extends Base { type: "thinking_status"; key: string; params: Record<string, unknown> }
export interface StatCard extends Sourced {
  type: "stat_card"; title: string; value: string | null; unit?: string | null; subtitle?: string | null;
  /** e.g. "1–5 Nov 2026" */ period?: string | null;
  /** e.g. "+2.1 pts vs Oct" — only when the tool computed it */ delta?: string | null;
}
export interface ChartSeries { name: string; points: [string, number | null][] }
export interface Chart extends Sourced {
  type: "chart"; kind: "line" | "bar"; title: string; series: ChartSeries[]; y_unit?: string | null;
}
export interface Table extends Sourced {
  type: "table"; title: string; columns: string[]; rows: (string | null)[][];
}
/** v2: optional `hint`, e.g. "ECE 1 · 22 students" vs "ECE1 · 0 students". */
export interface ClarifyChip { label: string; value: string; hint?: string | null }
export interface Clarify extends Base { type: "clarify"; question: string; chips: ClarifyChip[] }
export interface BlueprintSection { section: string; qtype: QuestionType; count: number; marks_each: number }
export interface Blueprint extends Base {
  type: "blueprint"; class_grade: number; subject: string; chapters: string[];
  total_marks: number; duration_min: number; sections: BlueprintSection[];
}
export interface PreviewQuestion {
  id: string; section: string; qtype: QuestionType; marks: number; text: string;
  options?: string[] | null; answer?: string | null; marking_scheme?: string[] | null;
  sub_questions?: Record<string, unknown>[] | null; status: VerifyStatus;
}
export interface PaperPreview extends Base {
  type: "paper_preview"; draft_id: string; title: string; total_marks: number;
  duration_min: number; questions: PreviewQuestion[];
}
export interface VerificationSummary extends Base {
  type: "verification_summary"; objective_verified: number; objective_total: number;
  rubric_checked: number; rubric_total: number; manual_review: string[];
  marks_sum_ok: boolean; duplicates: string[]; rounds: number;
}
export interface PendingApproval extends Base {
  type: "pending_approval"; approval_id: string; action: "finalize_test" | "assign_to_section";
  summary: string; args_sha256: string; expires_at: string;
}
export interface Final extends Base { type: "final"; session_id: string; usage?: Record<string, unknown> }
export interface AgentError extends Base {
  type: "error";
  code: "budget_exceeded" | "forbidden" | "not_found" | "provider_error" | "invalid_input" | "internal";
  message: string; partial?: Record<string, unknown>;
}
/** v2: first event of a stream — the session exists now (new chats get their id + title before any answer). */
export interface SessionEvent extends Base { type: "session"; session_id: string; title: string }

/** v2 (assumed): one batch the caller can see, and why. */
export interface ScopeBatch {
  batch_id: string; name: string; students: number | null;
  /** "Section" | "Lab" | … — shown as the row's kind */ kind?: string | null;
  department?: string | null;
  /** why it is in scope: "teacher" (teaches it) | "proctor" | "hod" | "admin" */ via?: string | null;
}
/** v2 (assumed): result of the my_scope tool — what the caller can see. */
export interface MyScope extends Sourced {
  type: "my_scope"; role: string; title?: string | null;
  batches: ScopeBatch[]; total_students: number | null; departments?: string[];
}
/** v2 (assumed): one row of section_comparison (value null = no data, ranks last). */
export interface ComparisonRow { id?: string | null; name: string; value: number | null; students?: number | null; detail?: string | null }
/** v2 (assumed): result of the section_comparison tool — ranking table + bar chart. */
export interface SectionComparison extends Sourced {
  type: "section_comparison"; title: string; metric: string; unit?: string | null; period?: string | null;
  /** default true (attendance, marks) */ higher_is_better?: boolean;
  rows: ComparisonRow[];
}

export type AgentEvent =
  | TextDelta | ThinkingStatus | StatCard | Chart | Table | Clarify | Blueprint | PaperPreview
  | VerificationSummary | PendingApproval | Final | AgentError | SessionEvent | MyScope | SectionComparison;
export type AgentEventType = AgentEvent["type"];

// ---- REST: meta --------------------------------------------------------------------------------
/** v2 (assumed): optional scope summary on /agent/meta for the empty state ("2 batches · 44 students"). */
export interface ScopeSummary { batches: ScopeBatch[]; total_students: number | null }
/** GET /agent/meta */
export interface AgentMeta {
  data_source: "live" | "demo"; read_only: boolean; role: "admin" | "hod" | "teacher";
  first_name: string | null; institute_name: string | null;
  scope?: ScopeSummary | null;
}

// ---- REST: sessions (chat history) ---------------------------------------------------------------
/** GET /agent/sessions?cursor&limit&q&pinned → { sessions, next_cursor } */
export interface SessionSummary {
  session_id: string; title: string; created_at: string; updated_at: string; pinned: boolean;
}
export interface SessionsPage { sessions: SessionSummary[]; next_cursor: string | null }
export interface SessionsQuery { cursor?: string | null; limit?: number; q?: string; pinned?: boolean }
/** PATCH /agent/sessions/{id} */
export interface SessionPatch { title?: string; pinned?: boolean }

/** v2 (assumed): user feedback stored with an assistant message. */
export type Rating = "up" | "down";
export interface StoredFeedback { rating: Rating; note?: string | null }
/**
 * GET /agent/sessions/{id}/messages?cursor → { messages, next_cursor }. Oldest → newest inside a page; next_cursor
 * pages towards OLDER messages. Every message has a per-session `seq` (1, 2, 3 … user and assistant each take one).
 * An assistant message carries the exact events it streamed, so a replay renders exactly what was shown live.
 */
export interface StoredMessage {
  seq: number; role: "user" | "assistant"; created_at: string;
  /** user */ text?: string;
  /** assistant */ events?: AgentEvent[];
  /** assistant: the user pressed Stop — partial answer */ stopped?: boolean;
  feedback?: StoredFeedback | null;
  request_id?: string | null;
}
export interface MessagesPage { messages: StoredMessage[]; next_cursor: string | null }

// ---- REST: query history + suggestions ---------------------------------------------------------
/** GET /agent/history/queries?q&limit → { queries } (newest first). DELETE …/{id}; DELETE /agent/history/queries = clear. */
export interface QueryHistoryItem { id: string; text: string; created_at: string }

export type SuggestionType = "recent" | "template" | "entity";
/** GET /agent/suggestions?q&limit → [{ type, text, hint }]. `id` (v2, assumed) only on recent items (for removal). */
export interface Suggestion { type: SuggestionType; text: string; hint?: string | null; id?: string | null }

// ---- REST: chat, feedback, cancel ----------------------------------------------------------------
/** POST /agent/chat (SSE). regenerate_from_seq = the assistant message to replace; edit_of_seq = the user message to replace. */
export interface ChatRequestBody {
  message: string; session_id?: string | null; regenerate_from_seq?: number | null; edit_of_seq?: number | null;
}
/** POST /agent/feedback (rating null clears it). */
export interface FeedbackBody { session_id: string; message_seq: number; rating: Rating | null; note?: string | null }
