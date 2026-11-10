// a4ai Agent types — a THIN layer over the generated contract (./api.gen.ts, from RAG-BACKEND
// docs/agent_openapi_v2.json, contract 1.3; refresh with `npm run agent:contract`). Wire types are never hand-written
// here. The only hand-written type is StoredMessage (adds the widened events array for old `file` events that may
// carry fields the contract no longer sends).
import type { components, operations } from "./api.gen";

export type Schemas = components["schemas"];
export const AGENT_CONTRACT_VERSION = "1.3";

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
export type FileReady = Schemas["FileReady"];
export type ApprovalStatus = NonNullable<PendingApproval["status"]>;

/** @deprecated Use FileReady (contract 1.3 name). Alias kept for migration of existing code. */
export type FileEvent = FileReady;

/** What the UI handles: all contract events (file is now in the contract). */
export type AgentEvent = ContractEvent;
export type AgentEventType = AgentEvent["type"];

// ---- REST (contract) ---------------------------------------------------------------------------------
export type SessionItem = Schemas["SessionItem"];
export type SessionList = Schemas["SessionList"];
export type SessionPatch = Schemas["SessionPatch"];
export type MessageItem = Schemas["MessageItem"];
export type MessageList = Schemas["MessageList"];
/** A stored message as the UI reads it: the contract's MessageItem. */
export type StoredMessage = Omit<MessageItem, "events"> & { events?: AgentEvent[] | null };
export interface StoredMessagePage { items: StoredMessage[]; next_cursor?: string | null }
export type QueryItem = Schemas["QueryItem"];
export type Suggestion = Schemas["Suggestion"];
export type SuggestionType = Suggestion["type"];
export type FeedbackRequest = Schemas["FeedbackRequest"];
export type FeedbackResponse = Schemas["FeedbackResponse"];
export type Rating = FeedbackRequest["rating"];
export type CancelResponse = Schemas["CancelResponse"];
export type ChatRequest = Schemas["ChatRequest"];
export type ApproveRequest = Schemas["ApproveRequest"];
export type SessionsQuery = NonNullable<operations["list_sessions_agent_sessions_get"]["parameters"]["query"]>;
export type MessagesQuery = NonNullable<operations["list_messages_agent_sessions__session_id__messages_get"]["parameters"]["query"]>;

// ---- Meta (contract 1.3 — now fully typed) ----------------------------------------------------------
export type MetaResponse = Schemas["MetaResponse"];
export type MetaScope = Schemas["MetaScope"];
export type MetaFeatures = Schemas["MetaFeatures"];
export type MetaLimits = Schemas["MetaLimits"];
export type RateLimitDetail = Schemas["RateLimitDetail"];
export type RateLimitResponse = Schemas["RateLimitResponse"];

/** @deprecated Use MetaResponse (contract 1.3). Alias kept so existing imports compile. */
export type AgentMeta = MetaResponse;
