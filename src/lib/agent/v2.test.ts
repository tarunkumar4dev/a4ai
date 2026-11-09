// v2 data layer: REST parsers, suggestions (ranking / highlight / keyboard), history grouping, optimistic cache
// updates with rollback, replay of stored messages, regenerate / edit in the reducer, and the mock adapter contract.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, type InfiniteData } from "@tanstack/react-query";
import { chatReducer, initialChatState, nextSeqs, type ChatState } from "./chatState";
import {
  parseAgentEvent, parseAgentMeta, parseMessagesPage, parseQueryHistory, parseSessionsPage, parseSuggestions,
} from "./events";
import { chatBody, type AgentApi } from "./api";
import { dateGroup, flattenGroups, groupSessions, relativeTime, titleMatches, windowRange } from "./history";
import {
  addRecentQuery, agentKeys, clearRecentQueries, deleteSessionWithUndo, patchSessionOptimistic, placeSession, removeRecentQuery,
} from "./queries";
import { replayMessages } from "./replay";
import { comboKey, highlightParts, idleOptions, matchScore, rankSuggestions } from "./suggest";
import type { AgentEvent, QueryHistoryItem, SessionSummary, SessionsPage, StoredMessage } from "./types";

const ev = (e: Record<string, unknown>, seq = 0, rid = "r1") => ({ request_id: rid, seq, ...e }) as unknown as AgentEvent;
const NOW = new Date("2026-11-09T15:00:00+05:30").getTime();
const sess = (id: string, title: string, iso: string, pinned = false): SessionSummary => ({ session_id: id, title, created_at: iso, updated_at: iso, pinned });

// ---- parsers -------------------------------------------------------------------------------------------
describe("v2 parsers", () => {
  it("sessions page: v2 shape with cursor + pinned, and the v1 shape", () => {
    const p = parseSessionsPage({ sessions: [{ session_id: "s1", title: "A", created_at: "2026-11-09T10:00:00Z", pinned: true }, { title: "no id" }], next_cursor: "20" });
    expect(p).toEqual({ sessions: [{ session_id: "s1", title: "A", created_at: "2026-11-09T10:00:00Z", updated_at: "2026-11-09T10:00:00Z", pinned: true }], next_cursor: "20" });
    expect(parseSessionsPage({ sessions: [{ session_id: "s2", title: "" }] }).sessions[0]).toMatchObject({ title: "Untitled chat", pinned: false });
    expect(parseSessionsPage(null)).toEqual({ sessions: [], next_cursor: null });
  });

  it("messages page: sorted by seq, bad events and rows dropped, feedback kept", () => {
    const p = parseMessagesPage({ messages: [
      { seq: 2, role: "assistant", created_at: "t", events: [{ seq: 0, request_id: "r", type: "text_delta", text: "hi" }, { type: "nope" }], feedback: { rating: "down", note: "galat" } },
      { seq: 1, role: "user", text: "Hello", created_at: "t" },
      { seq: 3, role: "system" },
    ], next_cursor: null });
    expect(p.messages.map((m) => m.seq)).toEqual([1, 2]);
    expect(p.messages[1].events).toHaveLength(1);
    expect(p.messages[1].feedback).toEqual({ rating: "down", note: "galat" });
  });

  it("query history + suggestions (array or wrapped), unknown types dropped", () => {
    expect(parseQueryHistory({ queries: [{ id: "q1", text: " Aaj ki attendance ", created_at: "t" }, { id: "q2", text: " " }] }))
      .toEqual([{ id: "q1", text: "Aaj ki attendance", created_at: "t" }]);
    expect(parseSuggestions([{ type: "entity", text: "ECE-1", hint: "Batch · 22 students" }, { type: "other", text: "x" }]))
      .toEqual([{ type: "entity", text: "ECE-1", hint: "Batch · 22 students", id: null }]);
    expect(parseSuggestions({ suggestions: [{ type: "recent", text: "a", id: "q9" }] })[0]).toMatchObject({ id: "q9" });
  });

  it("new events: session, my_scope, section_comparison, clarify hints; meta scope only when sent", () => {
    expect(parseAgentEvent({ seq: 0, request_id: "r", type: "session", session_id: "s1", title: "" })).toMatchObject({ type: "session", title: "New chat" });
    expect(parseAgentEvent({ seq: 0, request_id: "r", type: "session", session_id: "" })).toBeNull();
    const scope = parseAgentEvent({ seq: 1, request_id: "r", type: "my_scope", source: "tool:my_scope", as_of: "t", role: "teacher",
      batches: [{ batch_id: "b1", name: "ECE-1", students: 22 }, { name: "" }, { name: "Lab", students: "x" }], total_students: 22 });
    expect(scope?.type === "my_scope" && scope.batches.map((b) => [b.name, b.students])).toEqual([["ECE-1", 22], ["Lab", null]]);
    const cmp = parseAgentEvent({ seq: 2, request_id: "r", type: "section_comparison", source: "tool:section_comparison", as_of: "t", title: "T", metric: "Attendance", rows: [{ name: "A", value: 80 }, { name: "B", value: "?" }] });
    expect(cmp?.type === "section_comparison" && cmp.rows.map((r) => r.value)).toEqual([80, null]);
    expect(cmp?.type === "section_comparison" && cmp.higher_is_better).toBe(true);
    const cl = parseAgentEvent({ seq: 3, request_id: "r", type: "clarify", question: "Kaun sa?", chips: [{ label: "ECE 1", value: "v1", hint: "ECE 1 · 22 students" }, { label: "ECE1", value: "v2" }] });
    expect(cl?.type === "clarify" && cl.chips.map((c) => c.hint)).toEqual(["ECE 1 · 22 students", null]);
    expect(parseAgentMeta({ data_source: "demo", role: "teacher" })).not.toHaveProperty("scope");
    expect(parseAgentMeta({ data_source: "demo", scope: { batches: [{ name: "ECE-1", students: 22 }], total_students: 22 } })?.scope?.total_students).toBe(22);
  });

  it("chat body: v2 fields only when set", () => {
    expect(chatBody({ message: "hi" })).toEqual({ session_id: null, message: "hi" });
    expect(chatBody({ message: "hi", session_id: "s", regenerate_from_seq: 4 })).toEqual({ session_id: "s", message: "hi", regenerate_from_seq: 4 });
    expect(chatBody({ message: "hi", session_id: "s", edit_of_seq: 3, regenerate_from_seq: null })).toEqual({ session_id: "s", message: "hi", edit_of_seq: 3 });
  });
});

// ---- suggestions ------------------------------------------------------------------------------------------
describe("suggestion ranking + highlighting", () => {
  it("scores exact > prefix > word prefix > contains > all words; -1 for no match", () => {
    const q = "ece";
    expect(matchScore("ece", q)).toBeGreaterThan(matchScore("ECE-1 ki attendance", q));
    expect(matchScore("ECE-1 ki attendance", q)).toBeGreaterThan(matchScore("Meri ECE class", q));
    expect(matchScore("Meri ECE class", q)).toBeGreaterThan(matchScore("receive", q));
    expect(matchScore("attendance of ECE-2", "ece attendance")).toBeGreaterThan(0);
    expect(matchScore("Marks summary", q)).toBe(-1);
  });

  it("merges server + recent + templates, one row per text (recent wins, entity hint kept), ranked", () => {
    const recent: QueryHistoryItem[] = [{ id: "q1", text: "ECE-2 ki attendance", created_at: "" }, { id: "q2", text: "Marks summary", created_at: "" }];
    const out = rankSuggestions("ece", {
      server: [
        { type: "entity", text: "ECE-2 ki attendance", hint: "Batch · 22 students" },
        { type: "entity", text: "ECE-1 ki attendance", hint: "Batch · 22 students" },
        { type: "template", text: "Sections compare karo" },
        { type: "entity", text: "Rahul (roll E2-07)", hint: "Student" }, // server-side match we can't see
      ],
      recent,
      templates: ["Meri ECE class ka trend"],
    });
    expect(out.map((o) => [o.type, o.text])).toEqual([
      ["recent", "ECE-2 ki attendance"],
      ["entity", "ECE-1 ki attendance"],
      ["template", "Meri ECE class ka trend"],
      ["entity", "Rahul (roll E2-07)"],
    ]);
    expect(out[0]).toMatchObject({ hint: "Batch · 22 students", historyId: "q1" });
    expect(rankSuggestions("  ", { server: [], recent, templates: [] })).toEqual([]);
    expect(rankSuggestions("e", { server: [], recent: [], templates: Array.from({ length: 20 }, (_, i) => `e${i}`) }, 5)).toHaveLength(5);
  });

  it("idle list: ≤ 6 recent then Try templates that aren't already recent", () => {
    const recent = Array.from({ length: 8 }, (_, i) => ({ id: `q${i}`, text: `Sawaal ${i}`, created_at: "" }));
    const opts = idleOptions(recent, ["Sawaal 0", "Aaj ki attendance", "Trend"]);
    expect(opts.filter((o) => o.section === "recent")).toHaveLength(6);
    expect(opts.filter((o) => o.section === "try").map((o) => o.text)).toEqual(["Aaj ki attendance", "Trend"]);
  });

  it("highlights every query word, case-insensitive, merged", () => {
    expect(highlightParts("ECE-2 ki Attendance", "ece att")).toEqual([
      { text: "ECE", match: true }, { text: "-2 ki ", match: false }, { text: "Att", match: true }, { text: "endance", match: false },
    ]);
    expect(highlightParts("abc", "")).toEqual([{ text: "abc", match: false }]);
    expect(highlightParts("aaaa", "aa")).toEqual([{ text: "aaaa", match: true }]);
  });
});

describe("combobox keyboard", () => {
  const k = (key: string, extra: Partial<Parameters<typeof comboKey>[0]> = {}) => ({ key, caretAtEnd: true, ...extra });
  it("Down/Up move through options and back to the input", () => {
    expect(comboKey(k("ArrowDown"), true, -1, 3)).toEqual({ type: "move", active: 0 });
    expect(comboKey(k("ArrowDown"), true, 2, 3)).toEqual({ type: "move", active: -1 });
    expect(comboKey(k("ArrowUp"), true, -1, 3)).toEqual({ type: "move", active: 2 });
    expect(comboKey(k("ArrowUp"), true, 0, 3)).toEqual({ type: "move", active: -1 });
    expect(comboKey(k("ArrowDown"), false, -1, 3)).toEqual({ type: "open" });
    expect(comboKey(k("ArrowDown"), true, -1, 0)).toEqual({ type: "none" });
  });
  it("Enter runs the highlighted option, else falls through (send); Tab / Right fill; Esc closes", () => {
    expect(comboKey(k("Enter"), true, 1, 3)).toEqual({ type: "run", index: 1 });
    expect(comboKey(k("Enter"), true, -1, 3)).toEqual({ type: "none" });
    expect(comboKey(k("Enter", { shiftKey: true }), true, 1, 3)).toEqual({ type: "none" });
    expect(comboKey(k("Tab"), true, 0, 3)).toEqual({ type: "fill", index: 0 });
    expect(comboKey(k("Tab"), true, -1, 3)).toEqual({ type: "none" });
    expect(comboKey(k("ArrowRight"), true, 2, 3)).toEqual({ type: "fill", index: 2 });
    expect(comboKey(k("ArrowRight", { caretAtEnd: false }), true, 2, 3)).toEqual({ type: "none" });
    expect(comboKey(k("Escape"), true, 0, 3)).toEqual({ type: "close" });
    expect(comboKey(k("Enter", { isComposing: true }), true, 0, 3)).toEqual({ type: "none" });
    expect(comboKey(k("ArrowDown", { ctrlKey: true }), true, 0, 3)).toEqual({ type: "none" });
  });
});

// ---- history grouping ------------------------------------------------------------------------------------
describe("history grouping", () => {
  it("Pinned first, then Today / Yesterday / Previous 7 days / Older (local days), newest first", () => {
    const groups = groupSessions(
      [sess("p1", "Pinned old", "2026-10-01T10:00:00+05:30", true)],
      [
        sess("t2", "Today later", "2026-11-09T14:00:00+05:30"),
        sess("t1", "Today early", "2026-11-09T00:30:00+05:30"),
        sess("y1", "Yesterday", "2026-11-08T23:59:00+05:30"),
        sess("w1", "Five days", "2026-11-04T10:00:00+05:30"),
        sess("o1", "Old", "2026-10-20T10:00:00+05:30"),
        sess("p1", "Pinned old", "2026-10-01T10:00:00+05:30", true), // also in the rest list (race) → once
      ],
      NOW,
    );
    expect(groups.map((g) => [g.label, g.items.map((s) => s.session_id)])).toEqual([
      ["Pinned", ["p1"]], ["Today", ["t2", "t1"]], ["Yesterday", ["y1"]], ["Previous 7 days", ["w1"]], ["Older", ["o1"]],
    ]);
    expect(flattenGroups(groups).filter((r) => r.kind === "header")).toHaveLength(5);
  });

  it("title search: every word, any order, accents/case ignored; empty groups dropped", () => {
    const g = groupSessions([], [sess("a", "ECE-2 ki attendance", "2026-11-09T10:00:00+05:30"), sess("b", "Trig test", "2026-11-01T10:00:00+05:30")], NOW, "attendance ece");
    expect(g.map((x) => x.label)).toEqual(["Today"]);
    expect(titleMatches("Café report", "cafe")).toBe(true);
  });

  it("relative time + date groups + windowing", () => {
    expect(relativeTime(NOW - 20_000, NOW)).toBe("now");
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toBe("5m");
    expect(relativeTime(NOW - 3 * 3_600_000, NOW)).toBe("3h");
    expect(relativeTime(NOW - 86_400_000, NOW)).toBe("Yesterday");
    expect(relativeTime(NOW - 4 * 86_400_000, NOW)).toBe("4d");
    expect(dateGroup(NOW - 40 * 86_400_000, NOW)).toBe("older");
    expect(windowRange(1000, 50, 5000, 500, 2)).toEqual({ start: 98, end: 112 });
    expect(windowRange(3, 50, 0, 500)).toEqual({ start: 0, end: 3 });
    expect(windowRange(0, 50, 0, 500)).toEqual({ start: 0, end: 0 });
  });
});

// ---- optimistic cache updates ----------------------------------------------------------------------------
function seededClient() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const pages: InfiniteData<SessionsPage, string | null> = {
    pageParams: [null],
    pages: [{ sessions: [sess("s2", "Second", "2026-11-09T12:00:00Z"), sess("s1", "First", "2026-11-09T10:00:00Z")], next_cursor: null }],
  };
  qc.setQueryData(agentKeys.sessions("u", "", false), pages);
  qc.setQueryData(agentKeys.sessions("u", "", true), [sess("p1", "Pinned", "2026-11-01T10:00:00Z", true)]);
  return qc;
}
const restIds = (qc: QueryClient) => qc.getQueryData<InfiniteData<SessionsPage>>(agentKeys.sessions("u", "", false))!.pages.flatMap((p) => p.sessions.map((s) => `${s.session_id}:${s.title}`));
const pinnedIds = (qc: QueryClient) => qc.getQueryData<SessionSummary[]>(agentKeys.sessions("u", "", true))!.map((s) => s.session_id);
const fakeApi = (over: Partial<AgentApi> = {}): AgentApi => ({ kind: "mock", ...over } as AgentApi);

describe("optimistic rename / pin / delete", () => {
  it("rename shows at once and stays when the server agrees", async () => {
    const qc = seededClient();
    let resolve!: (v: SessionSummary) => void;
    const api = fakeApi({ patchSession: vi.fn(() => new Promise<SessionSummary>((r) => { resolve = r; })) });
    const p = patchSessionOptimistic(qc, "u", api, "s1", { title: "  Naya naam " });
    expect(restIds(qc)).toContain("s1:Naya naam");
    resolve(sess("s1", "Naya naam", "2026-11-09T10:00:00Z"));
    await expect(p).resolves.toMatchObject({ title: "Naya naam" });
    expect(api.patchSession).toHaveBeenCalledWith("s1", { title: "Naya naam" });
  });

  it("rename rolls back when the server fails", async () => {
    const qc = seededClient();
    const api = fakeApi({ patchSession: vi.fn(async () => { throw new Error("500"); }) });
    await expect(patchSessionOptimistic(qc, "u", api, "s1", { title: "Naya" })).rejects.toThrow(/Save nahi ho paya/);
    expect(restIds(qc)).toEqual(["s2:Second", "s1:First"]);
    await expect(patchSessionOptimistic(qc, "u", api, "s1", { title: "   " })).rejects.toThrow(/khaali/);
  });

  it("pin moves between the lists; a failed pin puts it back", async () => {
    const qc = seededClient();
    await patchSessionOptimistic(qc, "u", fakeApi({ patchSession: vi.fn(async () => null) }), "s2", { pinned: true });
    expect(pinnedIds(qc)).toEqual(["s2", "p1"]);
    expect(restIds(qc)).toEqual(["s1:First"]);
    const bad = fakeApi({ patchSession: vi.fn(async () => { throw new Error("x"); }) });
    await expect(patchSessionOptimistic(qc, "u", bad, "p1", { pinned: false })).rejects.toThrow();
    expect(pinnedIds(qc)).toEqual(["s2", "p1"]);
  });

  it("delete: gone at once, Undo restores without a request, a failed DELETE restores + reports", async () => {
    vi.useFakeTimers();
    try {
      const qc = seededClient();
      const del = vi.fn(async () => {});
      const h = deleteSessionWithUndo(qc, "u", fakeApi({ deleteSession: del }), "s1", { onError: vi.fn() });
      expect(restIds(qc)).toEqual(["s2:Second"]);
      expect(h.undo()).toBe(true);
      expect(restIds(qc)).toEqual(["s2:Second", "s1:First"]);
      await vi.advanceTimersByTimeAsync(6000);
      expect(del).not.toHaveBeenCalled();

      const onError = vi.fn();
      const fail = vi.fn(async () => { throw new Error("500"); });
      deleteSessionWithUndo(qc, "u", fakeApi({ deleteSession: fail }), "s2", { onError, delayMs: 5000 });
      expect(restIds(qc)).toEqual(["s1:First"]);
      await vi.advanceTimersByTimeAsync(5000);
      expect(fail).toHaveBeenCalledWith("s2");
      expect(onError).toHaveBeenCalledWith(expect.stringMatching(/Delete nahi ho paya/));
      expect(restIds(qc)).toEqual(["s2:Second", "s1:First"]);
    } finally { vi.useRealTimers(); }
  });

  it("a new session lands at the top; a search cache only gets matching titles", () => {
    const qc = seededClient();
    qc.setQueryData(agentKeys.sessions("u", "trig", false), { pageParams: [null], pages: [{ sessions: [], next_cursor: null }] });
    placeSession(qc, "u", sess("s9", "Aaj ki attendance", "2026-11-09T13:00:00Z"));
    expect(restIds(qc)[0]).toBe("s9:Aaj ki attendance");
    expect(qc.getQueryData<InfiniteData<SessionsPage>>(agentKeys.sessions("u", "trig", false))!.pages[0].sessions).toHaveLength(0);
  });

  it("recent queries: add on send (deduped), remove + clear roll back on error", async () => {
    const qc = seededClient();
    qc.setQueryData(agentKeys.queries("u"), [{ id: "q1", text: "Aaj ki attendance", created_at: "" }]);
    addRecentQuery(qc, "u", "aaj ki attendance");
    expect(qc.getQueryData<QueryHistoryItem[]>(agentKeys.queries("u"))).toHaveLength(1);
    const bad = fakeApi({ deleteQuery: vi.fn(async () => { throw new Error("x"); }), clearQueries: vi.fn(async () => { throw new Error("x"); }) });
    qc.setQueryData(agentKeys.queries("u"), [{ id: "q1", text: "A", created_at: "" }]);
    await expect(removeRecentQuery(qc, "u", bad, "q1")).rejects.toThrow();
    expect(qc.getQueryData<QueryHistoryItem[]>(agentKeys.queries("u"))).toHaveLength(1);
    await expect(clearRecentQueries(qc, "u", bad)).rejects.toThrow();
    expect(qc.getQueryData<QueryHistoryItem[]>(agentKeys.queries("u"))).toHaveLength(1);
  });
});

// ---- reducer: regenerate / edit / session / stop ---------------------------------------------------------
function answered(): ChatState {
  let s = chatReducer(initialChatState, { type: "send", text: "Q1" });
  s = chatReducer(s, { type: "event", ev: ev({ type: "session", session_id: "s1", title: "Q1" }, 0) });
  s = chatReducer(s, { type: "event", ev: ev({ type: "text_delta", text: "A1" }, 1) });
  s = chatReducer(s, { type: "event", ev: ev({ type: "final", session_id: "s1" }, 2) });
  s = chatReducer(s, { type: "send", text: "Q2" });
  s = chatReducer(s, { type: "event", ev: ev({ type: "text_delta", text: "A2" }, 0, "r2") });
  return chatReducer(s, { type: "event", ev: ev({ type: "final", session_id: "s1" }, 1, "r2") });
}

describe("reducer v2", () => {
  it("session event sets id + title + request id; seqs count 1, 2, 3, 4", () => {
    const s = answered();
    expect([s.sessionId, s.title]).toEqual(["s1", "Q1"]);
    expect(s.turns.map((t) => t.seq)).toEqual([1, 2, 3, 4]);
    expect(s.turns[1].requestId).toBe("r1");
    expect(nextSeqs(s.turns)).toEqual({ user: 5, assistant: 6 });
    expect(nextSeqs([{ id: "x", role: "user", text: "", blocks: [], done: true, at: 0 }])).toEqual({ user: 2, assistant: 3 });
  });

  it("regenerate replaces that answer and everything after it, keeping its seq", () => {
    const s = answered();
    const r = chatReducer(s, { type: "regenerate", turnId: s.turns[1].id });
    expect(r.turns.map((t) => [t.role, t.seq, t.done])).toEqual([["user", 1, true], ["assistant", 2, false]]);
    expect([r.busy, r.lastUserText]).toEqual([true, "Q1"]);
    expect(chatReducer(r, { type: "regenerate", turnId: r.turns[1].id })).toBe(r); // busy
  });

  it("edit replaces the user message (same seq) and drops what came after", () => {
    const s = answered();
    const e = chatReducer(s, { type: "edit", turnId: s.turns[2].id, text: " Q2 badla " });
    expect(e.turns.map((t) => [t.role, t.text, t.seq])).toEqual([["user", "Q1", 1], ["assistant", "", 2], ["user", "Q2 badla", 3], ["assistant", "", 4]]);
    expect(chatReducer(s, { type: "edit", turnId: s.turns[1].id, text: "x" })).toBe(s); // not a user turn
  });

  it("stop keeps the partial answer and marks it", () => {
    let s = chatReducer(initialChatState, { type: "send", text: "slow" });
    s = chatReducer(s, { type: "event", ev: ev({ type: "text_delta", text: "Aadha" }, 0, "r9") });
    expect(s.requestId).toBe("r9");
    s = chatReducer(s, { type: "stop" });
    expect(s.turns[1]).toMatchObject({ stopped: true, done: true });
    expect(s.turns[1].blocks[0]).toMatchObject({ kind: "text", text: "Aadha" });
    expect([s.busy, s.requestId]).toEqual([false, null]);
  });

  it("feedback note only with thumbs down", () => {
    const s = answered();
    const d = chatReducer(s, { type: "feedback", turnId: s.turns[1].id, value: "down", note: "galat number" });
    expect([d.turns[1].feedback, d.turns[1].feedbackNote]).toEqual(["down", "galat number"]);
    const u = chatReducer(d, { type: "feedback", turnId: s.turns[1].id, value: "up" });
    expect([u.turns[1].feedback, u.turns[1].feedbackNote]).toEqual(["up", null]);
  });
});

// ---- replay ----------------------------------------------------------------------------------------------
describe("replay of stored messages", () => {
  it("renders the same blocks/steps as live, marks stopped, restores feedback and clarify picks", () => {
    const events = [
      ev({ type: "thinking_status", key: "tool.resolve_entity", params: { phase: "start" } }, 0),
      ev({ type: "thinking_status", key: "tool.resolve_entity", params: { phase: "done", ms: 300, ok: true } }, 1),
      ev({ type: "clarify", question: "Kaun sa?", chips: [{ label: "ECE-1", value: "ECE-1 ki attendance", hint: "22 students" }] }, 2),
      ev({ type: "final", session_id: "s1" }, 3),
    ];
    const msgs: StoredMessage[] = [
      { seq: 3, role: "user", text: "ECE-1 ki attendance", created_at: "2026-11-09T10:01:00Z" },
      { seq: 1, role: "user", text: "ECE 1 ki attendance", created_at: "2026-11-09T10:00:00Z" },
      { seq: 2, role: "assistant", created_at: "2026-11-09T10:00:01Z", events, feedback: { rating: "up" } },
      { seq: 4, role: "assistant", created_at: "2026-11-09T10:01:01Z", events: [ev({ type: "text_delta", text: "Aadha jawab" }, 0, "r2")], stopped: true },
    ];
    const s = replayMessages(msgs, "s1", "ECE 1 ki attendance");
    expect(s.turns.map((t) => [t.role, t.seq])).toEqual([["user", 1], ["assistant", 2], ["user", 3], ["assistant", 4]]);
    expect(s.turns[1].steps?.map((x) => [x.key, x.status, x.ms])).toEqual([["tool.resolve_entity", "done", 300]]);
    expect(s.turns[1].blocks[0]).toMatchObject({ kind: "clarify", answered: "ECE-1 ki attendance" });
    expect(s.turns[1].feedback).toBe("up");
    expect(s.turns[3]).toMatchObject({ stopped: true, done: true });
    expect([s.busy, s.sessionId, s.title, s.lastUserText]).toEqual([false, "s1", "ECE 1 ki attendance", "ECE-1 ki attendance"]);
    // stable ids: replaying twice gives the same keys (no remounts)
    expect(replayMessages(msgs, "s1").turns.map((t) => t.id)).toEqual(s.turns.map((t) => t.id));
    expect(s.turns[1].blocks[0].id).toBe("r1-2");
  });
});

// ---- the mock adapter follows the contract ----------------------------------------------------------------
describe("mock adapter", () => {
  beforeEach(async () => { localStorage.clear(); (window as unknown as { __AGENT_MOCK_LATENCY__: number }).__AGENT_MOCK_LATENCY__ = 0; (await import("./mock")).resetMock(); });

  it("pages sessions, filters by pinned and title", async () => {
    const { mockApi } = await import("./mock");
    const p1 = await mockApi.listSessions({ pinned: false, limit: 20 });
    expect(p1.sessions).toHaveLength(20);
    expect(p1.next_cursor).toBe("20");
    const p2 = await mockApi.listSessions({ pinned: false, limit: 20, cursor: p1.next_cursor });
    expect(p2.sessions[0].session_id).not.toBe(p1.sessions[0].session_id);
    expect((await mockApi.listSessions({ pinned: true })).sessions.every((s) => s.pinned)).toBe(true);
    expect((await mockApi.listSessions({ q: "compare" })).sessions.map((s) => s.title)).toEqual(["Sections ki attendance compare karo"]);
  });

  it("streams session → events → final; regenerate and edit replace from the given seq", async () => {
    const { mockApi } = await import("./mock");
    const got: AgentEvent[] = [];
    await mockApi.chat({ body: { message: "Main kya kya dekh sakta hoon?" }, onEvent: (e) => got.push(e) });
    expect(got[0].type).toBe("session");
    expect(got.some((e) => e.type === "my_scope")).toBe(true);
    expect(got[got.length - 1].type).toBe("final");
    const sid = (got[0] as Extract<AgentEvent, { type: "session" }>).session_id;
    let msgs = (await mockApi.getMessages(sid, null)).messages;
    expect(msgs.map((m) => [m.seq, m.role])).toEqual([[1, "user"], [2, "assistant"]]);
    expect(msgs[1].events?.some((e) => e.type === "session")).toBe(false);

    await mockApi.chat({ body: { message: "ignored", session_id: sid, regenerate_from_seq: 2 }, onEvent: () => {} });
    msgs = (await mockApi.getMessages(sid, null)).messages;
    expect(msgs.map((m) => [m.seq, m.role, m.text ?? ""])).toEqual([[1, "user", "Main kya kya dekh sakta hoon?"], [2, "assistant", ""]]);

    await mockApi.chat({ body: { message: "Sections compare karo", session_id: sid, edit_of_seq: 1 }, onEvent: () => {} });
    msgs = (await mockApi.getMessages(sid, null)).messages;
    expect(msgs[0].text).toBe("Sections compare karo");
    expect(msgs[1].events?.some((e) => e.type === "section_comparison")).toBe(true);
    await mockApi.feedback({ session_id: sid, message_seq: 2, rating: "down", note: "x" });
    expect((await mockApi.getMessages(sid, null)).messages[1].feedback).toEqual({ rating: "down", note: "x" });
  });

  it("suggestions: entities with hints while typing; recent ids; history delete + clear", async () => {
    const { mockApi } = await import("./mock");
    const s = await mockApi.suggestions({ q: "ece 1" });
    expect(s.find((x) => x.type === "entity")).toMatchObject({ text: "ECE-1 ki attendance", hint: "Batch · 22 students" });
    const q = await mockApi.listQueries({ limit: 6 });
    expect(q).toHaveLength(6);
    await mockApi.deleteQuery(q[0].id);
    expect((await mockApi.listQueries({})).some((x) => x.id === q[0].id)).toBe(false);
    await mockApi.clearQueries();
    expect(await mockApi.listQueries({})).toEqual([]);
  });

  it("cancel stops the stream and stores the partial answer as stopped", async () => {
    const { mockApi } = await import("./mock");
    let rid = "";
    let sid = "";
    let n = 0;
    await mockApi.chat({ body: { message: "slow explain" }, onEvent: (e) => {
      if (e.type === "session") sid = e.session_id;
      rid = e.request_id;
      if (e.type === "text_delta" && ++n === 2) void mockApi.cancel(rid);
    } });
    const m = (await mockApi.getMessages(sid, null)).messages[1];
    expect(m.stopped).toBe(true);
    expect(m.events?.some((e) => e.type === "final")).toBe(false);
  }, 20_000);
});
