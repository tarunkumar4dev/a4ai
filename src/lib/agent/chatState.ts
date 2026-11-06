// Pure chat state for the a4ai Agent (workspace page + sheet): every AgentEvent maps to exactly one UI block, to
// the status line, to a step of the turn's activity timeline (thinking_status) or to the session id (final).
// History is append-only — errors add a block, they never clear turns. Timestamps are client clock (ms).
import type {
  AgentEvent, Blueprint, Chart, Clarify, PaperPreview, PendingApproval, StatCard, Table, VerificationSummary,
} from "./events";

export type ApprovalState = "pending" | "approving" | "approved" | "cancelled" | "failed";

export type Block =
  | { kind: "text"; id: string; text: string }
  | { kind: "stat_card"; id: string; ev: StatCard }
  | { kind: "table"; id: string; ev: Table }
  | { kind: "chart"; id: string; ev: Chart }
  | { kind: "clarify"; id: string; ev: Clarify; answered: string | null }
  | { kind: "blueprint"; id: string; ev: Blueprint }
  | { kind: "paper_preview"; id: string; ev: PaperPreview }
  | { kind: "verification"; id: string; ev: VerificationSummary }
  | { kind: "approval"; id: string; ev: PendingApproval; state: ApprovalState; result: Record<string, unknown> | null; error: string | null }
  | { kind: "error"; id: string; code: string; message: string; retryText: string | null };

export type BlockKind = Block["kind"];

export type StepStatus = "running" | "done" | "failed" | "stopped";
/** One row of the activity timeline: a tool call (tool.<name>) or a paper-pipeline phase (status.*). */
export interface Step { id: string; key: string; params: Record<string, unknown>; status: StepStatus; startedAt: number; ms: number | null }

export type Feedback = "up" | "down" | null;

export interface ChatTurn {
  id: string; role: "user" | "assistant"; text: string; blocks: Block[]; done: boolean;
  /** created (ms since epoch) */ at: number;
  /** assistant: when the stream ended */ endedAt?: number | null;
  steps?: Step[];
  /** local only — never sent anywhere */ feedback?: Feedback;
}

export interface ChatState {
  turns: ChatTurn[];
  status: { key: string; params: Record<string, unknown> } | null;
  sessionId: string | null;
  busy: boolean;
  lastUserText: string | null;
}

export type ChatAction =
  | { type: "send"; text: string; at?: number }
  | { type: "event"; ev: AgentEvent; at?: number }
  | { type: "fail"; message: string; code?: string; at?: number }
  | { type: "end"; at?: number }
  | { type: "stop"; at?: number }
  | { type: "approval"; blockId: string; state: ApprovalState; result?: Record<string, unknown> | null; error?: string | null }
  | { type: "clarify_answered"; blockId: string; value: string }
  | { type: "feedback"; turnId: string; value: Feedback }
  | { type: "load"; state: ChatState };

export const initialChatState: ChatState = { turns: [], status: null, sessionId: null, busy: false, lastUserText: null };

let counter = 0;
const nid = (p: string) => `${p}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** Which block (if any) an event becomes. thinking_status / final -> null (status line / steps / session id). */
export function eventToBlock(ev: AgentEvent, retryText: string | null = null): Block | null {
  const id = `${ev.request_id}-${ev.seq}`;
  switch (ev.type) {
    case "text_delta": return { kind: "text", id, text: ev.text };
    case "stat_card": return { kind: "stat_card", id, ev };
    case "table": return { kind: "table", id, ev };
    case "chart": return { kind: "chart", id, ev };
    case "clarify": return { kind: "clarify", id, ev, answered: null };
    case "blueprint": return { kind: "blueprint", id, ev };
    case "paper_preview": return { kind: "paper_preview", id, ev };
    case "verification_summary": return { kind: "verification", id, ev };
    case "pending_approval": return { kind: "approval", id, ev, state: "pending", result: null, error: null };
    case "error": return { kind: "error", id, code: ev.code, message: ev.message, retryText };
    default: return null;
  }
}

// ---- steps (activity timeline) ---------------------------------------------------------------
/** Paper-pipeline phases that become timeline steps (status.thinking / querying stay status-line only). */
const PHASE_KEYS = new Set(["status.retrieving_ncert", "status.generating", "status.verifying", "status.regenerating"]);
export const isStepKey = (key: string) => key.startsWith("tool.") || PHASE_KEYS.has(key);

const closeRunning = (steps: Step[], at: number, status: StepStatus, only?: (s: Step) => boolean): Step[] =>
  steps.map((s) => (s.status === "running" && (!only || only(s)) ? { ...s, status, ms: s.ms ?? Math.max(0, at - s.startedAt) } : s));

export function applyStep(steps: Step[], key: string, params: Record<string, unknown>, at: number): Step[] {
  if (key.startsWith("tool.")) {
    if (params.phase === "done") {
      const ms = typeof params.ms === "number" && Number.isFinite(params.ms) ? Math.max(0, params.ms) : null;
      const status: StepStatus = params.ok === false ? "failed" : "done";
      for (let i = steps.length - 1; i >= 0; i--) {
        if (steps[i].key === key && steps[i].status === "running") {
          const next = [...steps];
          next[i] = { ...steps[i], status, ms: ms ?? Math.max(0, at - steps[i].startedAt) };
          return next;
        }
      }
      return [...steps, { id: nid("st"), key, params, status, startedAt: at - (ms ?? 0), ms }];
    }
    return [...steps, { id: nid("st"), key, params, status: "running", startedAt: at, ms: null }];
  }
  // a new pipeline phase ends the previous one
  const closed = closeRunning(steps, at, "done", (s) => s.key.startsWith("status."));
  return [...closed, { id: nid("st"), key, params, status: "running", startedAt: at, ms: null }];
}

function withLastAssistant(state: ChatState, at: number, fn: (t: ChatTurn) => ChatTurn): ChatState {
  const turns = [...state.turns];
  let i = turns.length - 1;
  if (i < 0 || turns[i].role !== "assistant") {
    turns.push({ id: nid("a"), role: "assistant", text: "", blocks: [], done: false, at, steps: [] });
    i = turns.length - 1;
  }
  turns[i] = fn(turns[i]);
  return { ...state, turns };
}

function mapBlocks(state: ChatState, blockId: string, fn: (b: Block) => Block): ChatState {
  return { ...state, turns: state.turns.map((t) => ({ ...t, blocks: t.blocks.map((b) => (b.id === blockId ? fn(b) : b)) })) };
}

const finish = (t: ChatTurn, at: number, status: StepStatus = "done"): ChatTurn => ({
  ...t, done: true, endedAt: t.endedAt ?? at, steps: closeRunning(t.steps ?? [], at, status),
});

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  const at = "at" in action && typeof action.at === "number" ? action.at : Date.now();
  switch (action.type) {
    case "send": {
      const text = action.text.trim();
      if (!text) return state;
      return {
        ...state, busy: true, lastUserText: text, status: { key: "status.thinking", params: {} },
        turns: [...state.turns,
          { id: nid("u"), role: "user", text, blocks: [], done: true, at },
          { id: nid("a"), role: "assistant", text: "", blocks: [], done: false, at, steps: [], endedAt: null }],
      };
    }
    case "event": {
      const ev = action.ev;
      if (ev.type === "thinking_status") {
        const params = ev.params ?? {};
        const s = isStepKey(ev.key)
          ? withLastAssistant(state, at, (t) => ({ ...t, steps: applyStep(t.steps ?? [], ev.key, params, at) }))
          : state;
        return { ...s, status: { key: ev.key, params } };
      }
      if (ev.type === "final") {
        const s = withLastAssistant(state, at, (t) => finish(t, at));
        return { ...s, sessionId: ev.session_id || state.sessionId, busy: false, status: null };
      }
      if (ev.type === "text_delta") {
        return withLastAssistant(state, at, (t) => {
          const last = t.blocks[t.blocks.length - 1];
          if (last && last.kind === "text") {
            return { ...t, blocks: [...t.blocks.slice(0, -1), { ...last, text: last.text + ev.text }] };
          }
          return { ...t, blocks: [...t.blocks, eventToBlock(ev)!] };
        });
      }
      const block = eventToBlock(ev, state.lastUserText);
      if (!block) return state;
      const s = withLastAssistant(state, at, (t) => {
        if (t.blocks.some((b) => b.id === block.id)) return t;
        const next = { ...t, blocks: [...t.blocks, block] };
        return ev.type === "error" ? finish(next, at, "stopped") : next;
      });
      return ev.type === "error" ? { ...s, busy: false, status: null } : s;
    }
    case "fail": {
      const s = withLastAssistant(state, at, (t) => finish({
        ...t, blocks: [...t.blocks, { kind: "error", id: nid("e"), code: action.code ?? "network", message: action.message, retryText: state.lastUserText }],
      }, at, "stopped"));
      return { ...s, busy: false, status: null };
    }
    case "end": {
      if (!state.busy && state.turns[state.turns.length - 1]?.done) return state;
      const s = withLastAssistant(state, at, (t) => finish(t, at));
      return { ...s, busy: false, status: null };
    }
    case "stop": {
      if (!state.busy) return state;
      const s = withLastAssistant(state, at, (t) => finish(t, at, "stopped"));
      return { ...s, busy: false, status: null };
    }
    case "approval":
      return mapBlocks(state, action.blockId, (b) => (b.kind === "approval"
        ? { ...b, state: action.state, result: action.result ?? b.result, error: action.error ?? null } : b));
    case "clarify_answered":
      return mapBlocks(state, action.blockId, (b) => (b.kind === "clarify" ? { ...b, answered: action.value } : b));
    case "feedback":
      return { ...state, turns: state.turns.map((t) => (t.id === action.turnId && t.role === "assistant" ? { ...t, feedback: action.value } : t)) };
    case "load":
      return action.state;
    default:
      return state;
  }
}

/** Markdown source of an assistant turn (for Copy). */
export const turnText = (t: ChatTurn): string =>
  t.blocks.filter((b): b is Extract<Block, { kind: "text" }> => b.kind === "text").map((b) => b.text.trim()).filter(Boolean).join("\n\n");

/** "3 steps · 4.2s" */
export function stepsSummary(t: ChatTurn): string {
  const n = t.steps?.length ?? 0;
  const ms = typeof t.endedAt === "number" && typeof t.at === "number" ? Math.max(0, t.endedAt - t.at) : (t.steps ?? []).reduce((a, s) => a + (s.ms ?? 0), 0);
  return `${n} step${n === 1 ? "" : "s"} · ${fmtMs(ms)}`;
}

export function fmtMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "";
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

// ---- Hinglish activity labels (timeline + the one aria-live status line) ----------------------
const STEP_LABELS: Record<string, string> = {
  "tool.resolve_entity": "Naam dhoondh raha hoon",
  "tool.attendance_stats": "Attendance nikal raha hoon",
  "tool.low_attendance_list": "Kam attendance wale students dekh raha hoon",
  "tool.attendance_trend": "Trend bana raha hoon",
  "tool.marks_stats": "Marks dekh raha hoon",
  "tool.tests_created_by_teacher": "Tests gin raha hoon",
  "tool.blueprint_defaults": "Blueprint bana raha hoon",
  "tool.generate_questions": "Sawaal likh raha hoon",
  "tool.verify_paper": "Verify kar raha hoon",
  "tool.regenerate_failed": "Galat sawaal dobara likh raha hoon",
  "tool.save_draft": "Draft save kar raha hoon",
  "tool.finalize_test": "Test final kar raha hoon",
  "tool.assign_to_section": "Section ko bhej raha hoon",
  "tool.export_pdf": "PDF bana raha hoon",
  "status.thinking": "Soch raha hoon",
  "status.querying": "Data dekh raha hoon",
  "status.retrieving_ncert": "NCERT padh raha hoon",
  "status.generating": "Sawaal likh raha hoon",
  "status.verifying": "Verify kar raha hoon",
  "status.regenerating": "Galat sawaal dobara likh raha hoon",
};

export function stepLabel(key: string, params: Record<string, unknown> = {}): string {
  const base = STEP_LABELS[key] ?? "Kaam chal raha hai";
  if (key === "status.generating" && typeof params.n === "number") return `${params.n} sawaal likh raha hoon`;
  if (key === "status.verifying" && typeof params.round === "number" && params.round > 1) return `${base} · round ${params.round}`;
  if (key === "status.regenerating") {
    const n = Array.isArray(params.ids) ? params.ids.length : typeof params.count === "number" ? params.count : null;
    if (n) return `${n} galat sawaal dobara likh raha hoon`;
  }
  return base;
}

// ---- status line labels (localized; kept for callers that want en/hi) ---------------------------
type Locale = "en" | "hi";
const LABELS: Record<Locale, Record<string, string>> = {
  en: {
    "status.thinking": "Thinking…",
    "status.retrieving_ncert": "Reading NCERT…",
    "status.generating": "Writing {n} questions…",
    "status.verifying": "Checking answers (round {round})…",
    "status.regenerating": "Rewriting {count} question(s) that failed checks…",
    "status.querying": "Looking up the numbers…",
  },
  hi: {
    "status.thinking": "सोच रहा हूँ…",
    "status.retrieving_ncert": "NCERT पढ़ रहा हूँ…",
    "status.generating": "{n} प्रश्न लिख रहा हूँ…",
    "status.verifying": "उत्तर जाँच रहा हूँ (राउंड {round})…",
    "status.regenerating": "जाँच में फेल हुए {count} प्रश्न दोबारा लिख रहा हूँ…",
    "status.querying": "आँकड़े देख रहा हूँ…",
  },
};
const FALLBACK: Record<Locale, string> = { en: "Working…", hi: "काम चल रहा है…" };

export function pickLocale(lang?: string | null): Locale {
  const l = (lang ?? (typeof navigator !== "undefined" ? navigator.language : "en") ?? "en").toLowerCase();
  return l.startsWith("hi") ? "hi" : "en";
}

export function statusLabel(key: string, params: Record<string, unknown> = {}, locale: Locale = pickLocale()): string {
  const tpl = LABELS[locale][key];
  if (!tpl) return FALLBACK[locale];
  const vals: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) vals[k] = Array.isArray(v) ? String(v.length) : String(v ?? "");
  if (Array.isArray(params.ids)) vals.count = String((params.ids as unknown[]).length);
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vals[k] ?? "—");
}
