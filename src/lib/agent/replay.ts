// Stored messages (GET /agent/sessions/{id}/messages, contract 1.2) → the same ChatState the live stream built.
// Each assistant message carries the exact events it streamed (session … final), and they go through the SAME
// reducer, so a reopened chat renders exactly as it did live: blocks, steps + durations, clarify picks, and a
// cancelled turn (final.cancelled) marked as stopped. Approvals: the contract stores no approval outcome, so a
// past one is shown as expired once its expires_at has passed (never as approvable). Pure.
import { chatReducer, initialChatState, type ChatState, type ChatTurn } from "./chatState";
import type { StoredMessage } from "./types";

const ms = (iso: string, fallback: number) => { const n = Date.parse(iso); return Number.isFinite(n) ? n : fallback; };

export function replayMessages(messages: StoredMessage[], sessionId: string | null, title: string | null = null, now = Date.now()): ChatState {
  const sorted = [...messages].sort((a, b) => a.seq - b.seq);
  let s: ChatState = { ...initialChatState, sessionId, title };
  let prevAt = 0;
  for (const m of sorted) {
    const at = ms(m.created_at, prevAt);
    prevAt = at;
    if (m.role === "user") {
      const text = (m.text ?? "").trim();
      const turn: ChatTurn = { id: `u-${m.seq}`, role: "user", text, blocks: [], done: true, at, seq: m.seq };
      s = { ...s, turns: [...s.turns, turn], lastUserText: text || s.lastUserText };
      continue;
    }
    const turn: ChatTurn = { id: `a-${m.seq}`, role: "assistant", text: "", blocks: [], done: false, at, steps: [], endedAt: null, seq: m.seq };
    s = { ...s, busy: true, turns: [...s.turns, turn] };
    for (const ev of m.events ?? []) {
      if (ev.type === "session") continue;
      s = chatReducer(s, { type: "event", ev, at });
    }
    // close the turn: steps that never finished were cut off; duration = the tools' own timings
    const turns = [...s.turns];
    const last = turns[turns.length - 1];
    const stepMs = (last.steps ?? []).reduce((a, x) => a + (x.ms ?? 0), 0);
    const ended = !(m.events ?? []).some((e) => e.type === "final");
    turns[turns.length - 1] = {
      ...last, done: true, endedAt: at + stepMs, requestId: null,
      // a turn whose stream died without `final` (server restart) counts as stopped
      stopped: last.stopped || ended,
      steps: (last.steps ?? []).map((x) => (x.status === "running" ? { ...x, status: "stopped" as const, ms: x.ms ?? 0 } : x)),
      blocks: last.blocks.map((b) => (b.kind === "approval" && b.state === "pending" && Date.parse(b.ev.expires_at) < now ? { ...b, state: "expired" as const } : b)),
    };
    s = { ...s, turns, busy: false };
  }
  // a clarify question is "answered" by the user message right after it, when it matches a chip
  const turns = s.turns.map((t, i) => {
    if (t.role !== "assistant") return t;
    const next = s.turns[i + 1];
    if (!next || next.role !== "user") return t;
    return {
      ...t,
      blocks: t.blocks.map((b) => (b.kind === "clarify" && b.answered === null && b.ev.chips.some((c) => c.value === next.text)
        ? { ...b, answered: next.text } : b)),
    };
  });
  return { ...s, turns, busy: false, status: null, requestId: null };
}
