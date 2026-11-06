// Mirror of RAG-BACKEND agent/schemas.py (FROZEN CONTRACT 1.1). Do not rename fields.
// 1.1: stat_card.period / stat_card.delta (optional); thinking_status key "tool.<name>" with
//      params {phase:"start"} then {phase:"done", ms, ok}.
export const AGENT_CONTRACT_VERSION = "1.1";

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
export interface ClarifyChip { label: string; value: string }
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

/** GET /agent/meta */
export interface AgentMeta {
  data_source: "live" | "demo"; read_only: boolean; role: "admin" | "hod" | "teacher";
  first_name: string | null; institute_name: string | null;
}
/** GET /agent/sessions → sessions[] */
export interface AgentSessionInfo { session_id: string; title: string; created_at: string; updated_at: string }

export type AgentEvent =
  | TextDelta | ThinkingStatus | StatCard | Chart | Table | Clarify | Blueprint | PaperPreview
  | VerificationSummary | PendingApproval | Final | AgentError;
export type AgentEventType = AgentEvent["type"];

const KNOWN: ReadonlySet<string> = new Set<AgentEventType>([
  "text_delta", "thinking_status", "stat_card", "chart", "table", "clarify", "blueprint",
  "paper_preview", "verification_summary", "pending_approval", "final", "error",
]);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Tolerant: returns null for non-objects, unknown `type`s or missing seq/request_id. Fills safe defaults for lists. */
export function parseAgentEvent(raw: unknown): AgentEvent | null {
  if (!isObj(raw)) return null;
  const t = raw.type;
  if (typeof t !== "string" || !KNOWN.has(t)) return null;
  if (typeof raw.seq !== "number" || typeof raw.request_id !== "string") return null;
  const e = { ...raw } as Record<string, unknown>;
  switch (t) {
    case "text_delta": if (typeof e.text !== "string") return null; break;
    case "thinking_status": if (typeof e.key !== "string") return null; e.params = isObj(e.params) ? e.params : {}; break;
    case "stat_card":
      if (typeof e.title !== "string") return null;
      if (e.value === undefined) e.value = null;
      if (typeof e.period !== "string") e.period = null;
      if (typeof e.delta !== "string") e.delta = null;
      break;
    case "chart": e.series = arr(e.series); break;
    case "table": e.columns = arr(e.columns); e.rows = arr<unknown>(e.rows).filter(Array.isArray); break;
    case "clarify": e.chips = arr<unknown>(e.chips).filter((c) => isObj(c) && typeof c.label === "string" && typeof c.value === "string").slice(0, 5); break;
    case "blueprint": e.sections = arr(e.sections); e.chapters = arr(e.chapters); break;
    case "paper_preview": e.questions = arr(e.questions); break;
    case "verification_summary": e.manual_review = arr(e.manual_review); e.duplicates = arr(e.duplicates); if (typeof e.rounds !== "number") e.rounds = 0; break;
    case "pending_approval": if (typeof e.approval_id !== "string") return null; break;
    case "final": if (typeof e.session_id !== "string") return null; break;
    case "error": if (typeof e.message !== "string") e.message = "Something went wrong."; break;
  }
  return e as unknown as AgentEvent;
}

/**
 * Incremental SSE parser. Feed decoded text chunks; returns the `data:` payload of every
 * complete event (blocks separated by a blank line). Multi-line data is joined with "\n".
 * Comments (":") and other fields (event/id/retry) are ignored.
 */
export function createSseParser() {
  let buf = "";
  const take = (block: string): string | null => {
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    return data.length ? data.join("\n") : null;
  };
  return {
    push(chunk: string): string[] {
      buf += chunk.replace(/\r\n?/g, "\n");
      const out: string[] = [];
      let i: number;
      while ((i = buf.indexOf("\n\n")) !== -1) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const d = take(block);
        if (d !== null) out.push(d);
      }
      return out;
    },
    /** Flush a trailing event without the final blank line (stream ended). */
    end(): string[] {
      const d = buf.trim() ? take(buf) : null;
      buf = "";
      return d !== null ? [d] : [];
    },
  };
}

/** JSON-decode one SSE data payload into an AgentEvent (null on bad JSON / unknown type). */
export function decodeSseData(data: string): AgentEvent | null {
  try { return parseAgentEvent(JSON.parse(data)); } catch { return null; }
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** Tolerant decode of GET /agent/meta (null when the shape is unusable). */
export function parseAgentMeta(raw: unknown): AgentMeta | null {
  if (!isObj(raw)) return null;
  const ds = raw.data_source;
  if (ds !== "live" && ds !== "demo") return null;
  const role = raw.role === "admin" || raw.role === "hod" ? raw.role : "teacher";
  return { data_source: ds, read_only: raw.read_only !== false, role, first_name: str(raw.first_name), institute_name: str(raw.institute_name) };
}

/** Tolerant decode of GET /agent/sessions (bad rows are dropped). */
export function parseAgentSessions(raw: unknown): AgentSessionInfo[] {
  const list = isObj(raw) ? arr<unknown>(raw.sessions) : [];
  return list.filter(isObj).filter((s) => typeof s.session_id === "string" && s.session_id).map((s) => ({
    session_id: s.session_id as string,
    title: str(s.title) ?? "Untitled chat",
    created_at: typeof s.created_at === "string" ? s.created_at : "",
    updated_at: typeof s.updated_at === "string" ? s.updated_at : (typeof s.created_at === "string" ? s.created_at : ""),
  })).slice(0, 50);
}
