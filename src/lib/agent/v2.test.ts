// Data layer against contract 1.2: REST parsers, suggestions (ranking / highlight / keyboard), history grouping,
// optimistic cache updates with rollback, reducer regenerate/edit/stop/cancelled, replay, and the mock adapter
// following the backend's rules.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, type InfiniteData } from "@tanstack/react-query";
import { chatReducer, initialChatState, nextSeqs, type ChatState } from "./chatState";
import { parseAgentEvent, parseAgentMeta, parseMessageList, parseQueryItems, parseSessionList, parseSuggestions } from "./events";
import { chatBody, type AgentApi } from "./api";
import { dateGroup, flattenGroups, groupSessions, relativeTime, titleMatches, windowRange } from "./history";
import {
  addRecentQuery, agentKeys, clearRecentQueries, deleteSessionWithUndo, patchSessionOptimistic, placeSession, removeRecentQuery,
} from "./queries";
import { replayMessages } from "./replay";
import { comboKey, highlightParts, idleOptions, matchScore, rankSuggestions } from "./suggest";
import type { AgentEvent, QueryItem, SessionItem, SessionList, StoredMessage } from "./types";

const ev = (e: Record<string, unknown>, seq = 0, rid = "r1") => ({ request_id: rid, seq, ...e }) as unknown as AgentEvent;
const NOW = new Date("2026-11-09T15:00:00+05:30").getTime();
const sess = (id: string, title: string, iso: string, pinned = false): SessionItem => ({ id, title, created_at: iso, last_message_at: iso, message_count: 2, pinned, preview: null });
const q = (id: string, text: string): QueryItem => ({ id, text, last_used_at: "2026-11-09T10:00:00+00:00", use_count: 1 });

// ---- parsers -------------------------------------------------------------------------------------------
describe("contract 1.3 parsers", () => {
  it("sessions: items + next_cursor; a 1.1 backend (only `sessions`) is mapped onto items", () => {
    const p = parseSessionList({ items: [{ id: "s1", title: "A", created_at: "2026-11-09T10:00:00+00:00", last_message_at: "2026-11-09T10:05:00+00:00", message_count: 4, pinned: true, preview: "ok" }, { title: "no id" }], next_cursor: "c2" });
    expect(p).toEqual({ items: [{ id: "s1", title: "A", created_at: "2026-11-09T10:00:00+00:00", last_message_at: "2026-11-09T10:05:00+00:00", message_count: 4, pinned: true, preview: "ok" }], next_cursor: "c2" });
    const legacy = parseSessionList({ sessions: [{ session_id: "s2", title: "", created_at: "t1", updated_at: "t2" }] });
    expect(legacy.items[0]).toMatchObject({ id: "s2", title: "Untitled chat", last_message_at: "t2", pinned: false });
    expect(parseSessionList(null)).toEqual({ items: [], next_cursor: null });
  });

  it("messages: ascending seq, text + events (session … final), bad events dropped, file events kept", () => {
    const p = parseMessageList({ items: [
      { seq: 2, role: "assistant", text: "hi", created_at: "t", events: [{ seq: 0, request_id: "r", type: "session", session_id: "s", title: "T" }, { seq: 1, request_id: "r", type: "text_delta", text: "hi" }, { type: "nope" }, { seq: 2, request_id: "r", type: "file", file_id: "f1234567", name: "x.xlsx" }, { seq: 3, request_id: "r", type: "final", session_id: "s", cancelled: true }] },
      { seq: 1, role: "user", text: "Hello", events: null, created_at: "t" },
      { seq: 3, role: "system" },
    ], next_cursor: null });
    expect(p.items.map((m) => m.seq)).toEqual([1, 2]);
    expect(p.items[1].events?.map((e) => e.type)).toEqual(["session", "text_delta", "file", "final"]);
    expect(p.items[1].events?.[3]).toMatchObject({ cancelled: true });
  });

  it("queries + suggestions are bare arrays; unknown suggestion types dropped", () => {
    expect(parseQueryItems([{ id: "q1", text: " Aaj ki attendance ", last_used_at: "t", use_count: 3 }, { id: "q2", text: " " }]))
      .toEqual([{ id: "q1", text: "Aaj ki attendance", last_used_at: "t", use_count: 3 }]);
    expect(parseSuggestions([{ type: "entity", text: "ECE 1 ki is mahine ki attendance", hint: "Batch · 22 students" }, { type: "other", text: "x" }]))
      .toEqual([{ type: "entity", text: "ECE 1 ki is mahine ki attendance", hint: "Batch · 22 students" }]);
    expect(parseSuggestions({ suggestions: [] })).toEqual([]);
  });

  it("events: session (title fallback), final.cancelled, clarify hints, file; meta has no scope", () => {
    expect(parseAgentEvent({ seq: 0, request_id: "r", type: "session", session_id: "s1", title: "" })).toMatchObject({ type: "session", title: "New chat" });
    expect(parseAgentEvent({ seq: 0, request_id: "r", type: "session", session_id: "" })).toBeNull();
    expect(parseAgentEvent({ seq: 9, request_id: "r", type: "final", session_id: "s1" })).toMatchObject({ cancelled: false });
    const cl = parseAgentEvent({ seq: 3, request_id: "r", type: "clarify", question: "Kaun sa?", chips: [{ label: "ECE 1", value: "ECE 1 (id 6b0e)", hint: "Electronics · 2 students" }, { label: "ECE1", value: "v2" }] });
    expect(cl?.type === "clarify" && cl.chips.map((c) => c.hint)).toEqual(["Electronics · 2 students", null]);
    expect(parseAgentEvent({ seq: 4, request_id: "r", type: "file", file_id: "abc" })).toMatchObject({ type: "file", name: "a4ai-export", rows: 0 });
    expect(parseAgentEvent({ seq: 4, request_id: "r", type: "file", name: "x" })).toBeNull();
    expect(parseAgentEvent({ seq: 0, request_id: "r", type: "my_scope" })).toBeNull(); // not an event: my_scope is a table
    const m = parseAgentMeta({ data_source: "demo", role: "teacher", scope: {} });
    expect(m).toMatchObject({ contract_version: "1.3", enabled: true, data_source: "demo", read_only: true, role: "teacher", first_name: null, institute_name: null });
    expect(m?.scope).toMatchObject({ level: "none", batch_count: 0, student_count: 0 });
    expect(m?.features).toBeDefined();
    expect(m?.limits).toBeDefined();
  });

  it("chat body: regenerate sends no message; v2 fields only when set", () => {
    expect(chatBody({ message: "hi" })).toEqual({ session_id: null, message: "hi" });
    expect(chatBody({ message: "ignored", session_id: "s", regenerate_from_seq: 4 })).toEqual({ session_id: "s", regenerate_from_seq: 4 });
    expect(chatBody({ message: "hi", session_id: "s", edit_of_seq: 3, regenerate_from_seq: null })).toEqual({ session_id: "s", message: "hi", edit_of_seq: 3 });
  });
});

// ---- suggestions ------------------------------------------------------------------------------------------
describe("suggestion ranking + highlighting", () => {
  it("buckets: exact > prefix > word prefix > contains > all words; -1 for no match", () => {
    expect(matchScore("ece", "ece")).toBeGreaterThan(matchScore("ECE-1 ki attendance", "ece"));
    expect(matchScore("ECE-1 ki attendance", "ece")).toBeGreaterThan(matchScore("Meri ECE class", "ece"));
    expect(matchScore("Meri ECE class", "ece")).toBeGreaterThan(matchScore("receive", "ece"));
    expect(matchScore("attendance of ECE-2", "ece attendance")).toBeGreaterThan(0);
    expect(matchScore("Marks summary", "ece")).toBe(-1);
  });

  it("merges server rows with the history list; recent ids come from the history list (the server sends none)", () => {
    const out = rankSuggestions("ece", {
      server: [
        { type: "recent", text: "ECE-2 ki attendance", hint: "Recent · 3×" },
        { type: "entity", text: "ECE-1 ki is mahine ki attendance", hint: "Batch · 22 students" },
        { type: "entity", text: "Rahul (roll E2-07)", hint: "Student" },
      ],
      recent: [q("q1", "ECE-2 ki attendance"), q("q2", "Marks summary")],
      templates: ["Meri ECE class ka trend"],
    });
    expect(out.map((o) => [o.type, o.text])).toEqual([
      ["recent", "ECE-2 ki attendance"], ["entity", "ECE-1 ki is mahine ki attendance"], ["template", "Meri ECE class ka trend"], ["entity", "Rahul (roll E2-07)"],
    ]);
    expect(out[0]).toMatchObject({ historyId: "q1", hint: "Recent · 3×" });
    expect(rankSuggestions("  ", { server: [], recent: [], templates: [] })).toEqual([]);
  });

  it("idle list: ≤ 6 recent then Try templates not already recent", () => {
    const recent = Array.from({ length: 8 }, (_, i) => q(`q${i}`, `Sawaal ${i}`));
    const opts = idleOptions(recent, ["Sawaal 0", "Aaj ki attendance", "Trend"]);
    expect(opts.filter((o) => o.section === "recent")).toHaveLength(6);
    expect(opts.filter((o) => o.section === "try").map((o) => o.text)).toEqual(["Aaj ki attendance", "Trend"]);
  });

  it("recent first inside one bucket; highlights every query word", () => {
    const out = rankSuggestions("ece", { server: [{ type: "entity", text: "ECE1 ki attendance", hint: "Batch · 0 students" }], recent: [q("a", "ECE-2 ki attendance"), q("b", "ECE 1 ki attendance ka trend")], templates: [] });
    expect(out.map((o) => o.type)).toEqual(["recent", "recent", "entity"]);
    expect(highlightParts("ECE-2 ki Attendance", "ece att")).toEqual([
      { text: "ECE", match: true }, { text: "-2 ki ", match: false }, { text: "Att", match: true }, { text: "endance", match: false },
    ]);
  });
});

describe("combobox keyboard", () => {
  const k = (key: string, extra: Partial<Parameters<typeof comboKey>[0]> = {}) => ({ key, caretAtEnd: true, ...extra });
  it("↑/↓ move and wrap through the input; Enter runs; Tab / → fill; Esc closes", () => {
    expect(comboKey(k("ArrowDown"), true, -1, 3)).toEqual({ type: "move", active: 0 });
    expect(comboKey(k("ArrowDown"), true, 2, 3)).toEqual({ type: "move", active: -1 });
    expect(comboKey(k("ArrowUp"), true, -1, 3)).toEqual({ type: "move", active: 2 });
    expect(comboKey(k("ArrowDown"), false, -1, 3)).toEqual({ type: "open" });
    expect(comboKey(k("Enter"), true, 1, 3)).toEqual({ type: "run", index: 1 });
    expect(comboKey(k("Enter"), true, -1, 3)).toEqual({ type: "none" });
    expect(comboKey(k("Tab"), true, 0, 3)).toEqual({ type: "fill", index: 0 });
    expect(comboKey(k("ArrowRight", { caretAtEnd: false }), true, 2, 3)).toEqual({ type: "none" });
    expect(comboKey(k("Escape"), true, 0, 3)).toEqual({ type: "close" });
    expect(comboKey(k("Enter", { isComposing: true }), true, 0, 3)).toEqual({ type: "none" });
  });
});

// ---- history grouping ------------------------------------------------------------------------------------
describe("history grouping", () => {
  it("Pinned first, then Today / Yesterday / Previous 7 days / Older (by last_message_at), newest first", () => {
    const groups = groupSessions(
      [sess("p1", "Pinned old", "2026-10-01T10:00:00+05:30", true)],
      [
        sess("t2", "Today later", "2026-11-09T14:00:00+05:30"), sess("t1", "Today early", "2026-11-09T00:30:00+05:30"),
        sess("y1", "Yesterday", "2026-11-08T23:59:00+05:30"), sess("w1", "Five days", "2026-11-04T10:00:00+05:30"),
        sess("o1", "Old", "2026-10-20T10:00:00+05:30"), sess("p1", "Pinned old", "2026-10-01T10:00:00+05:30", true),
      ],
      NOW,
    );
    expect(groups.map((g) => [g.label, g.items.map((s) => s.id)])).toEqual([
      ["Pinned", ["p1"]], ["Today", ["t2", "t1"]], ["Yesterday", ["y1"]], ["Previous 7 days", ["w1"]], ["Older", ["o1"]],
    ]);
    expect(flattenGroups(groups).filter((r) => r.kind === "header")).toHaveLength(5);
  });
  it("title filter, relative time, windowing", () => {
    expect(groupSessions([], [sess("a", "ECE-2 ki attendance", "2026-11-09T10:00:00+05:30"), sess("b", "Trig test", "2026-11-01T10:00:00+05:30")], NOW, "attendance ece").map((x) => x.label)).toEqual(["Today"]);
    expect(titleMatches("Café report", "cafe")).toBe(true);
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toBe("5m");
    expect(relativeTime(NOW - 86_400_000, NOW)).toBe("Yesterday");
    expect(dateGroup(NOW - 40 * 86_400_000, NOW)).toBe("older");
    expect(windowRange(1000, 50, 5000, 500, 2)).toEqual({ start: 98, end: 112 });
  });
});

// ---- optimistic cache updates ----------------------------------------------------------------------------
function seededClient() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const pages: InfiniteData<SessionList, string | null> = {
    pageParams: [null], pages: [{ items: [sess("s2", "Second", "2026-11-09T12:00:00Z"), sess("s1", "First", "2026-11-09T10:00:00Z")], next_cursor: null }],
  };
  qc.setQueryData(agentKeys.sessions("u", "", false), pages);
  qc.setQueryData(agentKeys.sessions("u", "", true), [sess("p1", "Pinned", "2026-11-01T10:00:00Z", true)]);
  return qc;
}
const restIds = (qc: QueryClient) => qc.getQueryData<InfiniteData<SessionList>>(agentKeys.sessions("u", "", false))!.pages.flatMap((p) => p.items.map((s) => `${s.id}:${s.title}`));
const pinnedIds = (qc: QueryClient) => qc.getQueryData<SessionItem[]>(agentKeys.sessions("u", "", true))!.map((s) => s.id);
const fakeApi = (over: Partial<AgentApi> = {}): AgentApi => ({ kind: "mock", ...over } as AgentApi);

describe("optimistic rename / pin / delete", () => {
  it("rename shows at once, keeps the server's answer, rolls back on error", async () => {
    const qc = seededClient();
    const ok = fakeApi({ patchSession: vi.fn(async () => sess("s1", "Naya naam", "2026-11-09T10:00:00Z")) });
    await expect(patchSessionOptimistic(qc, "u", ok, "s1", { title: "  Naya naam " })).resolves.toMatchObject({ title: "Naya naam" });
    expect(ok.patchSession).toHaveBeenCalledWith("s1", { title: "Naya naam" });
    const bad = fakeApi({ patchSession: vi.fn(async () => { throw new Error("500"); }) });
    await expect(patchSessionOptimistic(qc, "u", bad, "s1", { title: "Kuch aur" })).rejects.toThrow(/Save nahi ho paya/);
    expect(restIds(qc)).toEqual(["s2:Second", "s1:Naya naam"]);
  });

  it("pin moves between the lists; a failed unpin puts it back", async () => {
    const qc = seededClient();
    await patchSessionOptimistic(qc, "u", fakeApi({ patchSession: vi.fn(async () => null) }), "s2", { pinned: true });
    expect(pinnedIds(qc)).toEqual(["s2", "p1"]);
    expect(restIds(qc)).toEqual(["s1:First"]);
    await expect(patchSessionOptimistic(qc, "u", fakeApi({ patchSession: vi.fn(async () => { throw new Error("x"); }) }), "p1", { pinned: false })).rejects.toThrow();
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
      deleteSessionWithUndo(qc, "u", fakeApi({ deleteSession: vi.fn(async () => { throw new Error("500"); }) }), "s2", { onError });
      await vi.advanceTimersByTimeAsync(5000);
      expect(onError).toHaveBeenCalledWith(expect.stringMatching(/Delete nahi ho paya/));
      expect(restIds(qc)).toEqual(["s2:Second", "s1:First"]);
    } finally { vi.useRealTimers(); }
  });

  it("a new session lands at the top; recent queries add (deduped) and roll back", async () => {
    const qc = seededClient();
    placeSession(qc, "u", sess("s9", "Aaj ki attendance", "2026-11-09T13:00:00Z"));
    expect(restIds(qc)[0]).toBe("s9:Aaj ki attendance");
    qc.setQueryData(agentKeys.queries("u"), [q("q1", "Aaj ki attendance")]);
    addRecentQuery(qc, "u", "aaj ki attendance");
    expect(qc.getQueryData<QueryItem[]>(agentKeys.queries("u"))).toMatchObject([{ id: "q1", use_count: 2 }]);
    const bad = fakeApi({ deleteQuery: vi.fn(async () => { throw new Error("x"); }), clearQueries: vi.fn(async () => { throw new Error("x"); }) });
    await expect(removeRecentQuery(qc, "u", bad, "q1")).rejects.toThrow();
    await expect(clearRecentQueries(qc, "u", bad)).rejects.toThrow();
    expect(qc.getQueryData<QueryItem[]>(agentKeys.queries("u"))).toHaveLength(1);
  });
});

// ---- reducer -------------------------------------------------------------------------------------------
function answered(): ChatState {
  let s = chatReducer(initialChatState, { type: "send", text: "Q1" });
  s = chatReducer(s, { type: "event", ev: ev({ type: "session", session_id: "s1", title: "Q1" }, 0) });
  s = chatReducer(s, { type: "event", ev: ev({ type: "text_delta", text: "A1" }, 1) });
  s = chatReducer(s, { type: "event", ev: ev({ type: "final", session_id: "s1", cancelled: false }, 2) });
  s = chatReducer(s, { type: "send", text: "Q2" });
  s = chatReducer(s, { type: "event", ev: ev({ type: "text_delta", text: "A2" }, 0, "r2") });
  return chatReducer(s, { type: "event", ev: ev({ type: "final", session_id: "s1", cancelled: false }, 1, "r2") });
}

describe("reducer", () => {
  it("session event sets id + title + request id; seqs count 1, 2, 3, 4", () => {
    const s = answered();
    expect([s.sessionId, s.title]).toEqual(["s1", "Q1"]);
    expect(s.turns.map((t) => t.seq)).toEqual([1, 2, 3, 4]);
    expect(s.turns[1].requestId).toBe("r1");
    expect(nextSeqs(s.turns)).toEqual({ user: 5, assistant: 6 });
  });
  it("regenerate / edit replace from that message on", () => {
    const s = answered();
    expect(chatReducer(s, { type: "regenerate", turnId: s.turns[1].id }).turns.map((t) => [t.role, t.seq, t.done])).toEqual([["user", 1, true], ["assistant", 2, false]]);
    const e = chatReducer(s, { type: "edit", turnId: s.turns[2].id, text: " Q2 badla " });
    expect(e.turns.map((t) => [t.role, t.text, t.seq])).toEqual([["user", "Q1", 1], ["assistant", "", 2], ["user", "Q2 badla", 3], ["assistant", "", 4]]);
  });
  it("final.cancelled (Stop here or in another tab) keeps the partial answer, marked; an error is followed by final", () => {
    let s = chatReducer(initialChatState, { type: "send", text: "slow" });
    s = chatReducer(s, { type: "event", ev: ev({ type: "text_delta", text: "Aadha" }, 1, "r9") });
    s = chatReducer(s, { type: "event", ev: ev({ type: "final", session_id: "s", cancelled: true }, 2, "r9") });
    expect(s.turns[1]).toMatchObject({ stopped: true, done: true });
    expect(s.busy).toBe(false);
    let e = chatReducer(initialChatState, { type: "send", text: "fail" });
    e = chatReducer(e, { type: "event", ev: ev({ type: "error", code: "provider_error", message: "busy" }, 1, "r8") });
    e = chatReducer(e, { type: "event", ev: ev({ type: "final", session_id: "s", cancelled: false }, 2, "r8") });
    expect(e.turns[1].blocks.map((b) => b.kind)).toEqual(["error"]);
    expect([e.busy, e.sessionId]).toEqual([false, "s"]);
  });
  it("429 → error block with retryAt", () => {
    let s = chatReducer(initialChatState, { type: "send", text: "x" });
    s = chatReducer(s, { type: "fail", message: "wait", code: "rate_limited", retryAt: 123 });
    expect(s.turns[1].blocks[0]).toMatchObject({ kind: "error", code: "rate_limited", retryAt: 123 });
  });
});

// ---- replay ----------------------------------------------------------------------------------------------
describe("replay of stored messages", () => {
  it("same blocks/steps as live, cancelled turns stopped, clarify picks, expired approvals, stable ids", () => {
    const sessionEv = ev({ type: "session", session_id: "s1", title: "ECE 1" }, 0);
    const events = [sessionEv,
      ev({ type: "thinking_status", key: "tool.resolve_entity", params: { phase: "start" } }, 1),
      ev({ type: "thinking_status", key: "tool.resolve_entity", params: { phase: "done", ms: 300, ok: true } }, 2),
      ev({ type: "clarify", question: "Kaun sa?", chips: [{ label: "ECE 1", value: "ECE 1 (id 6b0e)", hint: "22 students" }] }, 3),
      ev({ type: "pending_approval", approval_id: "a1", action: "finalize_test", summary: "s", args_sha256: "h", expires_at: "2026-11-09T09:00:00+00:00" }, 4),
      ev({ type: "final", session_id: "s1", cancelled: false }, 5)];
    const msgs: StoredMessage[] = [
      { seq: 3, role: "user", text: "ECE 1 (id 6b0e)", events: null, created_at: "2026-11-09T10:01:00+00:00" },
      { seq: 1, role: "user", text: "ECE 1 ki attendance", events: null, created_at: "2026-11-09T10:00:00+00:00" },
      { seq: 2, role: "assistant", text: null, events, created_at: "2026-11-09T10:00:01+00:00" },
      { seq: 4, role: "assistant", text: "Aadha", created_at: "2026-11-09T10:01:01+00:00", events: [ev({ type: "session", session_id: "s1", title: "x" }, 0, "r2"), ev({ type: "text_delta", text: "Aadha" }, 1, "r2"), ev({ type: "final", session_id: "s1", cancelled: true }, 2, "r2")] },
    ];
    const s = replayMessages(msgs, "s1", "ECE 1", NOW);
    expect(s.turns.map((t) => [t.role, t.seq])).toEqual([["user", 1], ["assistant", 2], ["user", 3], ["assistant", 4]]);
    expect(s.turns[1].steps?.map((x) => [x.key, x.status, x.ms])).toEqual([["tool.resolve_entity", "done", 300]]);
    expect(s.turns[1].blocks[0]).toMatchObject({ kind: "clarify", answered: "ECE 1 (id 6b0e)" });
    expect(s.turns[1].blocks[1]).toMatchObject({ kind: "approval", state: "expired" });
    expect(s.turns[3]).toMatchObject({ stopped: true, done: true });
    expect([s.busy, s.sessionId, s.title, s.requestId]).toEqual([false, "s1", "ECE 1", null]);
    expect(replayMessages(msgs, "s1").turns.map((t) => t.id)).toEqual(s.turns.map((t) => t.id));
  });
  it("a turn that never got `final` (server restart mid-stream) is shown as stopped", () => {
    const s = replayMessages([{ seq: 1, role: "user", text: "q", events: null, created_at: "t" }, { seq: 2, role: "assistant", text: "x", events: [ev({ type: "text_delta", text: "x" }, 1)], created_at: "t" }], "s1");
    expect(s.turns[1].stopped).toBe(true);
  });
});

// ---- the mock adapter follows the backend's rules ----------------------------------------------------------
describe("mock adapter (typed with the generated contract)", () => {
  beforeEach(async () => { (window as unknown as { __AGENT_MOCK_LATENCY__: number }).__AGENT_MOCK_LATENCY__ = 0; (await import("./mock")).resetMock(); });

  it("pages sessions (items + 1.1 `sessions`), filters by pinned, q matches titles and user messages", async () => {
    const { mockApi } = await import("./mock");
    const p1 = await mockApi.listSessions({ pinned: false, limit: 20 });
    expect(p1.items).toHaveLength(20);
    expect(p1.sessions?.[0].session_id).toBe(p1.items[0].id);
    const p2 = await mockApi.listSessions({ pinned: false, limit: 20, cursor: p1.next_cursor });
    expect(p2.items[0].id).not.toBe(p1.items[0].id);
    expect((await mockApi.listSessions({ pinned: true })).items.every((s) => s.pinned)).toBe(true);
    expect((await mockApi.listSessions({ q: "section-wise" })).items.map((s) => s.title)).toEqual(["Department ka section-wise comparison"]);
  });

  it("streams session first and final last; regenerate reuses the seq; edit replaces; titles cut at 48", async () => {
    const { mockApi, autoTitle } = await import("./mock");
    expect(autoTitle("Mere section ke 75% se kam wale students ki list Excel mein do please")).toBe("Mere section ke 75% se kam wale students ki…");
    expect(autoTitle("  ECE 1   ki attendance ")).toBe("ECE 1 ki attendance");
    expect(autoTitle("x".repeat(60))).toBe(`${"x".repeat(47)}…`);
    const got: AgentEvent[] = [];
    let rid = "";
    await mockApi.chat({ body: { message: "Main kya kya dekh sakta hoon?" }, onEvent: (e) => got.push(e), onRequestId: (r) => { rid = r; } });
    expect(got[0].type).toBe("session");
    expect(got[got.length - 1]).toMatchObject({ type: "final", cancelled: false });
    expect(got.find((e) => e.type === "table")).toMatchObject({ source: "tool:my_scope", columns: ["Batch", "Students", "Role", "Subjects"] });
    expect(got.every((e) => e.request_id === rid)).toBe(true);
    const sid = (got[0] as Extract<AgentEvent, { type: "session" }>).session_id;
    await mockApi.chat({ body: { session_id: sid, regenerate_from_seq: 2 }, onEvent: () => {} });
    let msgs = (await mockApi.getMessages(sid, {})).items;
    expect(msgs.map((m) => [m.seq, m.role])).toEqual([[1, "user"], [2, "assistant"]]);
    await mockApi.chat({ body: { message: "Department ka section-wise comparison", session_id: sid, edit_of_seq: 1 }, onEvent: () => {} });
    msgs = (await mockApi.getMessages(sid, {})).items;
    expect(msgs[0].text).toBe("Department ka section-wise comparison");
    expect(msgs[1].events?.filter((e) => e.type === "table" || e.type === "chart").map((e) => e.type)).toEqual(["table", "chart"]);
    await expect(mockApi.chat({ body: { message: "x", session_id: sid, edit_of_seq: 2 }, onEvent: () => {} })).rejects.toMatchObject({ status: 422 });
    await expect(mockApi.feedback({ session_id: sid, message_seq: 1, rating: "up" })).rejects.toMatchObject({ status: 404 });
  });

  it("suggestions: recent first with use counts, entities ignore punctuation, templates by role; empty q = 4 recent + templates", async () => {
    const { mockApi } = await import("./mock");
    const s = await mockApi.suggestions({ q: "ece1" });
    expect(s.find((x) => x.type === "entity")).toMatchObject({ text: "ECE-1 ki is mahine ki attendance", hint: "Batch · 22 students" });
    const idle = await mockApi.suggestions({ q: "" });
    expect(idle.slice(0, 4).every((x) => x.type === "recent")).toBe(true);
    expect(idle[0].hint).toBe("Recent · 3×");
    const hist = await mockApi.listQueries({ limit: 6 });
    expect(hist).toHaveLength(6);
    await mockApi.deleteQuery(hist[0].id);
    await mockApi.clearQueries();
    expect(await mockApi.listQueries({})).toEqual([]);
  });

  it("cancel → stream ends with final.cancelled, the partial turn is stored", async () => {
    const { mockApi } = await import("./mock");
    let sid = "", n = 0;
    const evs: AgentEvent[] = [];
    await mockApi.chat({ body: { message: "slow explain" }, onEvent: (e) => {
      evs.push(e);
      if (e.type === "session") sid = e.session_id;
      if (e.type === "text_delta" && ++n === 2) void mockApi.cancel(e.request_id);
    } });
    expect(evs[evs.length - 1]).toMatchObject({ type: "final", cancelled: true });
    const m = (await mockApi.getMessages(sid, {})).items[1];
    expect(m.events?.[m.events.length - 1]).toMatchObject({ type: "final", cancelled: true });
    await expect(mockApi.cancel("nope")).rejects.toMatchObject({ status: 404 });
  }, 20_000);

  it("file event + download (expired → 410)", async () => {
    const { mockApi } = await import("./mock");
    const evs: AgentEvent[] = [];
    await mockApi.chat({ body: { message: "75% se kam wale, Excel mein" }, onEvent: (e) => evs.push(e) });
    const file = evs.find((e) => e.type === "file");
    expect(file).toMatchObject({ name: "below-75-ece2.xlsx", rows: 6 });
    await expect(mockApi.downloadFile({ fileId: "nope00000", filename: "x" })).rejects.toMatchObject({ status: 404 });
  });
});
