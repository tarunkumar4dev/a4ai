// Stored messages (GET /agent/sessions/{id}/messages) → the same ChatState the live stream built. Every assistant
// message carries the events it streamed, and they go through the SAME reducer, so a reopened chat renders exactly
// as it did live (blocks, steps + durations, clarify picks, stopped marks, feedback). Pure.
import { chatReducer, initialChatState, type ChatState, type ChatTurn } from "./chatState";
import type { StoredMessage } from "./types";

const ms = (iso: string, fallback: number) => { const n = Date.parse(iso); return Number.isFinite(n) ? n : fallback; };

export function replayMessages(messages: StoredMessage[], sessionId: string | null, title: string | null = null): ChatState {
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
    const turn: ChatTurn = {
      id: `a-${m.seq}`, role: "assistant", text: "", blocks: [], done: false, at, steps: [], endedAt: null, seq: m.seq,
      requestId: m.request_id ?? null, feedback: m.feedback?.rating ?? null, feedbackNote: m.feedback?.note ?? null,
    };
    s = { ...s, turns: [...s.turns, turn] };
    for (const ev of m.events ?? []) {
      if (ev.type === "session") continue;
      s = chatReducer(s, { type: "event", ev, at });
    }
    // close the turn: steps that never finished were cut off; duration = the tools' own timings
    const turns = [...s.turns];
    const last = turns[turns.length - 1];
    const stepMs = (last.steps ?? []).reduce((a, x) => a + (x.ms ?? 0), 0);
    turns[turns.length - 1] = {
      ...last, done: true, stopped: m.stopped === true, endedAt: at + stepMs,
      steps: (last.steps ?? []).map((x) => (x.status === "running" ? { ...x, status: "stopped" as const, ms: x.ms ?? 0 } : x)),
    };
    s = { ...s, turns };
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
