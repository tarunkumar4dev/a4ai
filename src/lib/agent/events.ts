// Runtime parsers for the a4ai Agent contract 1.3. TYPES come from ./types.ts (generated, ./api.gen.ts) and are
// re-exported here so older imports keep working. Every parser is tolerant: bad rows are dropped, unknown event
// types return null, missing optional lists become []. Outputs are the generated wire types themselves.
import type {
  AgentEvent, AgentEventType, MetaResponse, QueryItem, SessionItem, SessionList, StoredMessage, StoredMessagePage,
  Suggestion, SuggestionType,
} from "./types";
export * from "./types";

/** Every `type` the UI accepts: the contract's 16 event types (1.4 adds speech + ui_action). */
export const EVENT_TYPES = [
  "session", "text_delta", "thinking_status", "stat_card", "chart", "table", "clarify", "blueprint",
  "paper_preview", "verification_summary", "pending_approval", "file", "final", "error", "speech", "ui_action",
] as const satisfies readonly AgentEventType[];
// compile-time: EVENT_TYPES lists every AgentEventType (adding one to the contract breaks the build here)
type Missing = Exclude<AgentEventType, (typeof EVENT_TYPES)[number]>;
const _allListed: Missing extends never ? true : Missing = true;
void _allListed;

const KNOWN: ReadonlySet<string> = new Set<string>(EVENT_TYPES);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const iso = (v: unknown): string => (typeof v === "string" ? v : "");

/** Tolerant: returns null for non-objects, unknown `type`s or missing seq/request_id. Fills safe defaults for lists. */
export function parseAgentEvent(raw: unknown): AgentEvent | null {
  if (!isObj(raw)) return null;
  const t = raw.type;
  if (typeof t !== "string" || !KNOWN.has(t)) return null;
  if (typeof raw.seq !== "number" || typeof raw.request_id !== "string") return null;
  const e = { ...raw } as Record<string, unknown>;
  switch (t as AgentEventType) {
    case "session":
      if (typeof e.session_id !== "string" || !e.session_id) return null;
      e.title = str(e.title) ?? "New chat";
      break;
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
    case "pending_approval":
      if (typeof e.approval_id !== "string") return null;
      if (typeof e.status !== "string") e.status = "pending";
      break;
    case "final":
      if (typeof e.session_id !== "string") return null;
      e.cancelled = e.cancelled === true;
      break;
    case "error":
      if (typeof e.message !== "string") e.message = "Something went wrong.";
      if (typeof e.code !== "string") e.code = "internal";
      if (typeof e.retryable !== "boolean") e.retryable = false;
      break;
    case "file":
      if (typeof e.file_id !== "string" || !e.file_id) return null;
      e.name = str(e.name) ?? "a4ai-export";
      if (typeof e.rows !== "number") e.rows = 0;
      e.expires_at = str(e.expires_at) ?? "";
      if (typeof e.download_path !== "string") e.download_path = `/agent/files/${e.file_id}`;
      if (typeof e.kind !== "string") e.kind = "defaulters_export";
      break;
    case "speech":
      if (typeof e.text !== "string" || !e.text.trim()) return null;
      if (e.language !== "hi" && e.language !== "en" && e.language !== "hi-en") e.language = "hi-en";
      break;
    case "ui_action":
      if (e.action !== "navigate" && e.action !== "highlight_confirm") return null;
      // the key is only ever looked up in the registry copy; anything else is dropped there
      if (e.action === "navigate" && (typeof e.route_key !== "string" || !/^[a-z0-9_.]{1,64}$/.test(e.route_key))) return null;
      e.route_key = typeof e.route_key === "string" ? e.route_key : null;
      e.params = isObj(e.params) ? Object.fromEntries(Object.entries(e.params).filter(([, v]) => typeof v === "string")) : {};
      e.label = str(e.label);
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

// ---- REST -------------------------------------------------------------------------------------------

const ROLES: ReadonlySet<string> = new Set(["admin", "hod", "teacher"]);
const SCOPE_LEVELS: ReadonlySet<string> = new Set(["institute", "department", "section", "classes", "none"]);

function parseMetaScope(raw: unknown) {
  if (!isObj(raw)) return undefined;
  const level = typeof raw.level === "string" && SCOPE_LEVELS.has(raw.level) ? raw.level as MetaResponse["scope"] extends infer S ? S extends { level: infer L } ? L : never : never : "none";
  return {
    level,
    batch_count: typeof raw.batch_count === "number" ? raw.batch_count : 0,
    student_count: typeof raw.student_count === "number" ? raw.student_count : 0,
    batches: Array.isArray(raw.batches) ? (raw.batches as unknown[]).filter((b) => typeof b === "string") as string[] : undefined,
  };
}

/** GET /agent/meta (null when the shape is unusable). */
export function parseAgentMeta(raw: unknown): MetaResponse | null {
  if (!isObj(raw)) return null;
  const ds = raw.data_source;
  if (ds !== "live" && ds !== "demo") return null;
  const role = (typeof raw.role === "string" && ROLES.has(raw.role) ? raw.role : "teacher") as MetaResponse["role"];
  const scope = isObj(raw.scope) ? parseMetaScope(raw.scope) : (raw.scope === null ? null : undefined);
  const features = isObj(raw.features) ? {
    paper_generation: raw.features.paper_generation === true,
    defaulters_export: raw.features.defaulters_export === true,
    proctor_month_report: raw.features.proctor_month_report === true,
    cancel: raw.features.cancel !== false,
  } : { paper_generation: false, defaulters_export: false, proctor_month_report: false, cancel: true };
  const limits = isObj(raw.limits) ? {
    chat_turns_per_10min: typeof raw.limits.chat_turns_per_10min === "number" ? raw.limits.chat_turns_per_10min : 20,
    institute_daily_tokens: numOrNull(raw.limits.institute_daily_tokens),
  } : { chat_turns_per_10min: 20, institute_daily_tokens: null };
  return {
    contract_version: typeof raw.contract_version === "string" ? raw.contract_version : "1.3",
    enabled: raw.enabled !== false,
    data_source: ds,
    read_only: raw.read_only !== false,
    role,
    first_name: str(raw.first_name),
    institute_name: str(raw.institute_name),
    scope,
    features,
    limits,
  };
}

function parseSessionItem(s: Record<string, unknown>): SessionItem | null {
  if (typeof s.id !== "string" || !s.id) return null;
  const created = iso(s.created_at);
  return {
    id: s.id, title: str(s.title) ?? "Untitled chat", created_at: created,
    last_message_at: iso(s.last_message_at) || created,
    message_count: typeof s.message_count === "number" ? s.message_count : 0,
    pinned: s.pinned === true, preview: str(s.preview),
  };
}

/** GET /agent/sessions → { items, next_cursor }. A 1.1 backend (only `sessions`) is mapped onto items. */
export function parseSessionList(raw: unknown): SessionList {
  if (!isObj(raw)) return { items: [], next_cursor: null };
  let items = arr<unknown>(raw.items).filter(isObj).map(parseSessionItem).filter((s): s is SessionItem => s !== null);
  if (!Array.isArray(raw.items)) {
    items = arr<unknown>(raw.sessions).filter(isObj).map((s) => parseSessionItem({
      id: s.session_id, title: s.title, created_at: s.created_at, last_message_at: s.updated_at, message_count: 0, pinned: false,
    })).filter((s): s is SessionItem => s !== null);
  }
  return { items: items.slice(0, 200), next_cursor: str(raw.next_cursor) };
}

/** PATCH /agent/sessions/{id} → SessionItem (null if the body isn't one). */
export const parseSessionItemOrNull = (raw: unknown): SessionItem | null => (isObj(raw) ? parseSessionItem(raw) : null);

/** One stored message (unknown role → null; bad events dropped). */
export function parseMessageItem(raw: unknown): StoredMessage | null {
  if (!isObj(raw) || typeof raw.seq !== "number" || (raw.role !== "user" && raw.role !== "assistant")) return null;
  const events = Array.isArray(raw.events) ? raw.events.map(parseAgentEvent).filter((e): e is AgentEvent => e !== null) : null;
  return { seq: raw.seq, role: raw.role, text: typeof raw.text === "string" ? raw.text : null, events, created_at: iso(raw.created_at) };
}

/** GET /agent/sessions/{id}/messages → { items (ascending seq), next_cursor }. */
export function parseMessageList(raw: unknown): StoredMessagePage {
  if (!isObj(raw)) return { items: [], next_cursor: null };
  const items = arr<unknown>(raw.items).map(parseMessageItem).filter((m): m is StoredMessage => m !== null).sort((a, b) => a.seq - b.seq);
  return { items, next_cursor: str(raw.next_cursor) };
}

/** GET /agent/history/queries → QueryItem[] (newest first, blank texts dropped). */
export function parseQueryItems(raw: unknown): QueryItem[] {
  return arr<unknown>(raw).filter(isObj).filter((q) => typeof q.id === "string" && typeof q.text === "string" && q.text.trim())
    .map((q) => ({
      id: q.id as string, text: (q.text as string).trim(), last_used_at: iso(q.last_used_at),
      use_count: typeof q.use_count === "number" ? q.use_count : 1,
    })).slice(0, 100);
}

const SUGGESTION_TYPES: ReadonlySet<string> = new Set<SuggestionType>(["recent", "template", "entity"]);
/** GET /agent/suggestions → Suggestion[]. */
export function parseSuggestions(raw: unknown): Suggestion[] {
  return arr<unknown>(raw).filter(isObj).filter((x) => typeof x.type === "string" && SUGGESTION_TYPES.has(x.type) && typeof x.text === "string" && x.text.trim())
    .map((x) => ({ type: x.type as SuggestionType, text: (x.text as string).trim(), hint: str(x.hint) })).slice(0, 20);
}
