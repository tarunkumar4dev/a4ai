// Pure chat state for the "Ask a4ai" panel: every AgentEvent maps to exactly one UI block (or to the
// status line / session id). History is append-only — errors add a block, they never clear turns.
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

export interface ChatTurn { id: string; role: "user" | "assistant"; text: string; blocks: Block[]; done: boolean }

export interface ChatState {
  turns: ChatTurn[];
  status: { key: string; params: Record<string, unknown> } | null;
  sessionId: string | null;
  busy: boolean;
  lastUserText: string | null;
}

export type ChatAction =
  | { type: "send"; text: string }
  | { type: "event"; ev: AgentEvent }
  | { type: "fail"; message: string; code?: string }
  | { type: "end" }
  | { type: "approval"; blockId: string; state: ApprovalState; result?: Record<string, unknown> | null; error?: string | null }
  | { type: "clarify_answered"; blockId: string; value: string };

export const initialChatState: ChatState = { turns: [], status: null, sessionId: null, busy: false, lastUserText: null };

let counter = 0;
const nid = (p: string) => `${p}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** Which block (if any) an event becomes. thinking_status / final -> null (status line / session id). */
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

function withLastAssistant(state: ChatState, fn: (t: ChatTurn) => ChatTurn): ChatState {
  const turns = [...state.turns];
  let i = turns.length - 1;
  if (i < 0 || turns[i].role !== "assistant") {
    turns.push({ id: nid("a"), role: "assistant", text: "", blocks: [], done: false });
    i = turns.length - 1;
  }
  turns[i] = fn(turns[i]);
  return { ...state, turns };
}

function mapBlocks(state: ChatState, blockId: string, fn: (b: Block) => Block): ChatState {
  return { ...state, turns: state.turns.map((t) => ({ ...t, blocks: t.blocks.map((b) => (b.id === blockId ? fn(b) : b)) })) };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "send": {
      const text = action.text.trim();
      if (!text) return state;
      return {
        ...state, busy: true, lastUserText: text, status: { key: "status.thinking", params: {} },
        turns: [...state.turns,
          { id: nid("u"), role: "user", text, blocks: [], done: true },
          { id: nid("a"), role: "assistant", text: "", blocks: [], done: false }],
      };
    }
    case "event": {
      const ev = action.ev;
      if (ev.type === "thinking_status") return { ...state, status: { key: ev.key, params: ev.params ?? {} } };
      if (ev.type === "final") {
        const s = withLastAssistant(state, (t) => ({ ...t, done: true }));
        return { ...s, sessionId: ev.session_id || state.sessionId, busy: false, status: null };
      }
      if (ev.type === "text_delta") {
        return withLastAssistant(state, (t) => {
          const last = t.blocks[t.blocks.length - 1];
          if (last && last.kind === "text") {
            return { ...t, blocks: [...t.blocks.slice(0, -1), { ...last, text: last.text + ev.text }] };
          }
          return { ...t, blocks: [...t.blocks, eventToBlock(ev)!] };
        });
      }
      const block = eventToBlock(ev, state.lastUserText);
      if (!block) return state;
      const s = withLastAssistant(state, (t) => (t.blocks.some((b) => b.id === block.id) ? t : { ...t, blocks: [...t.blocks, block] }));
      return ev.type === "error" ? { ...s, busy: false, status: null } : s;
    }
    case "fail": {
      const s = withLastAssistant(state, (t) => ({
        ...t, done: true,
        blocks: [...t.blocks, { kind: "error", id: nid("e"), code: action.code ?? "network", message: action.message, retryText: state.lastUserText }],
      }));
      return { ...s, busy: false, status: null };
    }
    case "end": {
      const s = withLastAssistant(state, (t) => ({ ...t, done: true }));
      return { ...s, busy: false, status: null };
    }
    case "approval":
      return mapBlocks(state, action.blockId, (b) => (b.kind === "approval"
        ? { ...b, state: action.state, result: action.result ?? b.result, error: action.error ?? null } : b));
    case "clarify_answered":
      return mapBlocks(state, action.blockId, (b) => (b.kind === "clarify" ? { ...b, answered: action.value } : b));
    default:
      return state;
  }
}

// ---- status line labels (localized) --------------------------------------------------------
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
