// Parsers for the a4ai Agent contract. The TYPES live in ./types.ts (one place) and are re-exported here so older
// imports keep working. Every parser is tolerant: bad rows are dropped, unknown event types return null.
import type {
  AgentEvent, AgentEventType, AgentMeta, ComparisonRow, MessagesPage, QueryHistoryItem, ScopeBatch, ScopeSummary,
  SessionSummary, SessionsPage, StoredFeedback, StoredMessage, Suggestion, SuggestionType,
} from "./types";
export * from "./types";

const KNOWN: ReadonlySet<string> = new Set<AgentEventType>([
  "text_delta", "thinking_status", "stat_card", "chart", "table", "clarify", "blueprint",
  "paper_preview", "verification_summary", "pending_approval", "final", "error",
  "session", "my_scope", "section_comparison",
]);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const iso = (v: unknown): string => (typeof v === "string" ? v : "");

function parseScopeBatches(v: unknown): ScopeBatch[] {
  return arr<unknown>(v).filter(isObj).filter((b) => typeof b.name === "string" && b.name.trim()).slice(0, 200).map((b) => ({
    batch_id: typeof b.batch_id === "string" ? b.batch_id : String(b.name),
    name: String(b.name), students: numOrNull(b.students), kind: str(b.kind), department: str(b.department), via: str(b.via),
  }));
}

function parseComparisonRows(v: unknown): ComparisonRow[] {
  return arr<unknown>(v).filter(isObj).filter((r) => typeof r.name === "string").slice(0, 100).map((r) => ({
    id: str(r.id), name: String(r.name), value: numOrNull(r.value), students: numOrNull(r.students), detail: str(r.detail),
  }));
}

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
    case "clarify":
      if (typeof e.question !== "string") e.question = "";
      e.chips = arr<unknown>(e.chips).filter(isObj).filter((c) => typeof c.label === "string" && typeof c.value === "string")
        .slice(0, 5).map((c) => ({ label: c.label, value: c.value, hint: str(c.hint) }));
      break;
    case "blueprint": e.sections = arr(e.sections); e.chapters = arr(e.chapters); break;
    case "paper_preview": e.questions = arr(e.questions); break;
    case "verification_summary": e.manual_review = arr(e.manual_review); e.duplicates = arr(e.duplicates); if (typeof e.rounds !== "number") e.rounds = 0; break;
    case "pending_approval": if (typeof e.approval_id !== "string") return null; break;
    case "final": if (typeof e.session_id !== "string") return null; break;
    case "error": if (typeof e.message !== "string") e.message = "Something went wrong."; break;
    case "session":
      if (typeof e.session_id !== "string" || !e.session_id) return null;
      e.title = str(e.title) ?? "New chat";
      break;
    case "my_scope":
      e.batches = parseScopeBatches(e.batches);
      e.total_students = numOrNull(e.total_students);
      e.departments = arr<unknown>(e.departments).filter((d): d is string => typeof d === "string");
      if (typeof e.role !== "string") e.role = "teacher";
      if (typeof e.source !== "string") e.source = "tool:my_scope";
      if (typeof e.as_of !== "string") e.as_of = "";
      break;
    case "section_comparison":
      if (typeof e.title !== "string") e.title = "Section comparison";
      if (typeof e.metric !== "string") e.metric = "Value";
      e.rows = parseComparisonRows(e.rows);
      e.higher_is_better = e.higher_is_better !== false;
      if (typeof e.source !== "string") e.source = "tool:section_comparison";
      if (typeof e.as_of !== "string") e.as_of = "";
      break;
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


/** Tolerant decode of GET /agent/meta (null when the shape is unusable). `scope` only when the backend sends it. */
export function parseAgentMeta(raw: unknown): AgentMeta | null {
  if (!isObj(raw)) return null;
  const ds = raw.data_source;
  if (ds !== "live" && ds !== "demo") return null;
  const role = raw.role === "admin" || raw.role === "hod" ? raw.role : "teacher";
  const meta: AgentMeta = { data_source: ds, read_only: raw.read_only !== false, role, first_name: str(raw.first_name), institute_name: str(raw.institute_name) };
  if (isObj(raw.scope)) {
    const scope: ScopeSummary = { batches: parseScopeBatches(raw.scope.batches), total_students: numOrNull(raw.scope.total_students) };
    meta.scope = scope;
  }
  return meta;
}

function parseSession(s: Record<string, unknown>): SessionSummary {
  const created = iso(s.created_at);
  return {
    session_id: s.session_id as string,
    title: str(s.title) ?? "Untitled chat",
    created_at: created,
    updated_at: iso(s.updated_at) || created,
    pinned: s.pinned === true,
  };
}

/** GET /agent/sessions → page. Also accepts the v1 shape ({ sessions } without cursor / pinned). */
export function parseSessionsPage(raw: unknown): SessionsPage {
  const list = isObj(raw) ? arr<unknown>(raw.sessions) : Array.isArray(raw) ? raw : [];
  const sessions = list.filter(isObj).filter((s) => typeof s.session_id === "string" && s.session_id).map(parseSession).slice(0, 200);
  return { sessions, next_cursor: isObj(raw) ? str(raw.next_cursor) : null };
}

/** v1 helper kept for callers that only want the list. */
export const parseAgentSessions = (raw: unknown): SessionSummary[] => parseSessionsPage(raw).sessions.slice(0, 50);

/** One stored message (bad events are dropped, unknown roles → null). */
export function parseStoredMessage(raw: unknown): StoredMessage | null {
  if (!isObj(raw) || typeof raw.seq !== "number" || (raw.role !== "user" && raw.role !== "assistant")) return null;
  const r = isObj(raw.feedback) ? raw.feedback.rating : null;
  const fb: StoredFeedback | null = r === "up" || r === "down" ? { rating: r, note: str((raw.feedback as Record<string, unknown>).note) } : null;
  const m: StoredMessage = { seq: raw.seq, role: raw.role, created_at: iso(raw.created_at), feedback: fb, request_id: str(raw.request_id) };
  if (raw.role === "user") m.text = typeof raw.text === "string" ? raw.text : "";
  else {
    m.events = arr<unknown>(raw.events).map(parseAgentEvent).filter((e): e is AgentEvent => e !== null);
    m.stopped = raw.stopped === true;
  }
  return m;
}

/** GET /agent/sessions/{id}/messages → page, sorted oldest → newest by seq. */
export function parseMessagesPage(raw: unknown): MessagesPage {
  const list = isObj(raw) ? arr<unknown>(raw.messages) : [];
  const messages = list.map(parseStoredMessage).filter((m): m is StoredMessage => m !== null).sort((a, b) => a.seq - b.seq);
  return { messages, next_cursor: isObj(raw) ? str(raw.next_cursor) : null };
}

/** GET /agent/history/queries → items (newest first, blank texts dropped). */
export function parseQueryHistory(raw: unknown): QueryHistoryItem[] {
  const list = isObj(raw) ? arr<unknown>(raw.queries) : Array.isArray(raw) ? raw : [];
  return list.filter(isObj).filter((q) => typeof q.id === "string" && typeof q.text === "string" && q.text.trim())
    .map((q) => ({ id: q.id as string, text: (q.text as string).trim(), created_at: iso(q.created_at) })).slice(0, 100);
}

const SUGGESTION_TYPES: ReadonlySet<string> = new Set<SuggestionType>(["recent", "template", "entity"]);
/** GET /agent/suggestions → [{type, text, hint}] (also accepts { suggestions: [...] }). */
export function parseSuggestions(raw: unknown): Suggestion[] {
  const list = Array.isArray(raw) ? raw : isObj(raw) ? arr<unknown>(raw.suggestions) : [];
  return list.filter(isObj).filter((x) => typeof x.type === "string" && SUGGESTION_TYPES.has(x.type) && typeof x.text === "string" && x.text.trim())
    .map((x) => ({ type: x.type as SuggestionType, text: (x.text as string).trim(), hint: str(x.hint), id: str(x.id) })).slice(0, 20);
}
