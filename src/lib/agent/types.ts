// a4ai Agent types — a THIN layer over the generated contract (./api.gen.ts, from RAG-BACKEND
// docs/agent_openapi_v2.json, contract 1.2; refresh with `npm run agent:contract`). Wire types are never hand-written
// here. Exactly two things are, and each says why:
//   1. AgentMeta — GET /agent/meta has no response model in the OpenAPI document (schema `{}`); mirrors agent/api.py meta().
//   2. FileEvent — the `file` event (export download card) is NOT in contract 1.2 yet; the UI is ready for it.
import type { components, operations } from "./api.gen";

export type Schemas = components["schemas"];
export const AGENT_CONTRACT_VERSION = "1.2";

// ---- SSE events (contract) --------------------------------------------------------------------------
/** Every event the backend can stream / store (MessageItem.events — the contract's own union). */
export type ContractEvent = NonNullable<Schemas["MessageItem"]["events"]>[number];

export type SessionEvent = Schemas["SessionStarted"];
export type TextDelta = Schemas["TextDelta"];
export type ThinkingStatus = Schemas["ThinkingStatus"];
export type StatCard = Schemas["StatCard"];
export type Chart = Schemas["Chart"];
export type ChartSeries = Schemas["ChartSeries"];
export type Table = Schemas["Table"];
export type Clarify = Schemas["Clarify"];
export type ClarifyChip = Schemas["ClarifyChip"];
export type Blueprint = Schemas["Blueprint"];
export type BlueprintSection = Schemas["BlueprintSection"];
export type PaperPreview = Schemas["PaperPreview"];
export type PreviewQuestion = Schemas["PreviewQuestion"];
export type VerificationSummary = Schemas["VerificationSummary"];
export type PendingApproval = Schemas["PendingApproval"];
export type Final = Schemas["Final"];
export type AgentError = Schemas["Error"];
export type QuestionType = PreviewQuestion["qtype"];
export type VerifyStatus = PreviewQuestion["status"];

// ---- not in contract 1.2 (UI ready, backend pending) --------------------------------------------------
/** An export the agent made (e.g. "Excel mein do"): GET /agent/files/{file_id} with the user's token. */
export interface FileEvent {
  type: "file"; seq: number; request_id: string;
  file_id: string; name: string;
  /** rows in the sheet, when it is a table export */ rows?: number | null;
  /** ISO-8601; after this the download returns 404/410 */ expires_at?: string | null;
  mime?: string | null; size_bytes?: number | null;
  source?: string | null;
}

/** What the UI handles: the contract's events plus the pending `file` event. */
export type AgentEvent = ContractEvent | FileEvent;
export type AgentEventType = AgentEvent["type"];

// ---- REST (contract) ---------------------------------------------------------------------------------
export type SessionItem = Schemas["SessionItem"];
export type SessionList = Schemas["SessionList"];
export type SessionPatch = Schemas["SessionPatch"];
export type MessageItem = Schemas["MessageItem"];
export type MessageList = Schemas["MessageList"];
/** A stored message as the UI reads it: the contract's MessageItem, whose events may also hold the pending `file` event. */
export type StoredMessage = Omit<MessageItem, "events"> & { events?: AgentEvent[] | null };
export interface StoredMessagePage { items: StoredMessage[]; next_cursor?: string | null }
export type QueryItem = Schemas["QueryItem"];
export type Suggestion = Schemas["Suggestion"];
export type SuggestionType = Suggestion["type"];
export type FeedbackRequest = Schemas["FeedbackRequest"];
export type Rating = FeedbackRequest["rating"];
export type CancelResponse = Schemas["CancelResponse"];
export type ChatRequest = Schemas["ChatRequest"];
export type ApproveRequest = Schemas["ApproveRequest"];
export type SessionsQuery = NonNullable<operations["list_sessions_agent_sessions_get"]["parameters"]["query"]>;
export type MessagesQuery = NonNullable<operations["list_messages_agent_sessions__session_id__messages_get"]["parameters"]["query"]>;

/** GET /agent/meta (no response model in the OpenAPI document — see agent/api.py `meta`). */
export interface AgentMeta {
  data_source: "live" | "demo"; read_only: boolean; role: "admin" | "hod" | "teacher";
  first_name: string | null; institute_name: string | null;
}
