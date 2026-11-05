import { describe, expect, it } from "vitest";
import { chatReducer, eventToBlock, initialChatState, statusLabel, type ChatState } from "./chatState";
import { agentBaseUrl, agentUrl } from "./config";
import { isAgentPdfPath } from "./client";
import type { AgentEvent } from "./events";

const base = { request_id: "r1" };
let seq = 0;
const ev = (e: Record<string, unknown>) => ({ ...base, seq: seq++, ...e }) as unknown as AgentEvent;
const src = { source: "tool:attendance_stats", as_of: "2026-11-05T13:13:43+05:30" };
const send = (s: ChatState, text: string) => chatReducer(s, { type: "send", text });
const apply = (s: ChatState, ...evs: AgentEvent[]) => evs.reduce((acc, e) => chatReducer(acc, { type: "event", ev: e }), s);
const lastBlocks = (s: ChatState) => s.turns[s.turns.length - 1].blocks;

describe("event -> block mapping", () => {
  it.each([
    [{ type: "text_delta", text: "hi" }, "text"],
    [{ type: "stat_card", ...src, title: "Attendance", value: "83.8", unit: "%" }, "stat_card"],
    [{ type: "table", ...src, source: "tool:low_attendance_list", title: "Below 75%", columns: ["a"], rows: [["x"]] }, "table"],
    [{ type: "chart", ...src, kind: "bar", title: "t", series: [] }, "chart"],
    [{ type: "clarify", question: "Which one?", chips: [{ label: "Rahul (10A)", value: "Rahul (10A)" }] }, "clarify"],
    [{ type: "blueprint", class_grade: 10, subject: "Mathematics", chapters: ["Trig"], total_marks: 40, duration_min: 90, sections: [] }, "blueprint"],
    [{ type: "paper_preview", draft_id: "d", title: "T", total_marks: 40, duration_min: 90, questions: [] }, "paper_preview"],
    [{ type: "verification_summary", objective_verified: 12, objective_total: 13, rubric_checked: 6, rubric_total: 6, manual_review: ["q7"], marks_sum_ok: true, duplicates: [], rounds: 2 }, "verification"],
    [{ type: "pending_approval", approval_id: "a1", action: "finalize_test", summary: "s", args_sha256: "h", expires_at: "2026-11-05T08:15:00Z" }, "approval"],
    [{ type: "error", code: "budget_exceeded", message: "Budget exceeded" }, "error"],
  ])("%o -> %s", (e, kind) => {
    expect(eventToBlock(ev(e))?.kind).toBe(kind);
  });

  it("thinking_status and final never become blocks", () => {
    expect(eventToBlock(ev({ type: "thinking_status", key: "status.verifying", params: {} }))).toBeNull();
    expect(eventToBlock(ev({ type: "final", session_id: "s1" }))).toBeNull();
  });
});

describe("chatReducer", () => {
  it("send adds a user turn + empty assistant turn and a status", () => {
    const s = send(initialChatState, "  Aaj ki attendance  ");
    expect(s.turns.map((t) => t.role)).toEqual(["user", "assistant"]);
    expect(s.turns[0].text).toBe("Aaj ki attendance");
    expect(s.busy).toBe(true);
    expect(s.status?.key).toBe("status.thinking");
    expect(send(initialChatState, "   ")).toBe(initialChatState);
  });

  it("text_delta appends to the current text block; thinking_status only updates the status line", () => {
    let s = send(initialChatState, "q");
    s = apply(s, ev({ type: "text_delta", text: "Sharma " }), ev({ type: "thinking_status", key: "status.generating", params: { n: 19 } }),
      ev({ type: "text_delta", text: "ma'am" }));
    expect(lastBlocks(s)).toHaveLength(1);
    expect(lastBlocks(s)[0]).toMatchObject({ kind: "text", text: "Sharma ma'am" });
    expect(s.status).toEqual({ key: "status.generating", params: { n: 19 } });
  });

  it("final stores the session id and clears busy/status", () => {
    const s = apply(send(initialChatState, "q"), ev({ type: "final", session_id: "sess-1" }));
    expect(s).toMatchObject({ sessionId: "sess-1", busy: false, status: null });
    expect(s.turns[1].done).toBe(true);
  });

  it("errors add an inline retry card and never clear history", () => {
    let s = apply(send(initialChatState, "first"), ev({ type: "text_delta", text: "ok" }), ev({ type: "final", session_id: "s" }));
    s = send(s, "second");
    s = apply(s, ev({ type: "error", code: "provider_error", message: "APIError" }));
    expect(s.turns).toHaveLength(4);
    expect(lastBlocks(s)[0]).toMatchObject({ kind: "error", retryText: "second" });
    expect(s.busy).toBe(false);
    s = chatReducer(s, { type: "fail", message: "Can't reach a4ai Agent." });
    expect(s.turns).toHaveLength(4);
    expect(s.turns[1].blocks[0]).toMatchObject({ kind: "text", text: "ok" });
    expect(s.sessionId).toBe("s");
  });

  it("duplicate events (same request_id + seq) are not rendered twice", () => {
    const e = ev({ type: "stat_card", ...src, title: "A", value: null });
    const s = apply(send(initialChatState, "q"), e, e);
    expect(lastBlocks(s)).toHaveLength(1);
  });

  it("approval + clarify state updates target one block", () => {
    let s = apply(send(initialChatState, "q"),
      ev({ type: "pending_approval", approval_id: "a1", action: "finalize_test", summary: "s", args_sha256: "h", expires_at: "x" }),
      ev({ type: "clarify", question: "?", chips: [{ label: "A", value: "A" }] }));
    const [appr, clar] = lastBlocks(s);
    s = chatReducer(s, { type: "approval", blockId: appr.id, state: "approved", result: { status: "finalized" } });
    s = chatReducer(s, { type: "clarify_answered", blockId: clar.id, value: "A" });
    expect(lastBlocks(s)[0]).toMatchObject({ kind: "approval", state: "approved", result: { status: "finalized" } });
    expect(lastBlocks(s)[1]).toMatchObject({ kind: "clarify", answered: "A" });
  });
});

describe("status labels, URLs", () => {
  it("localizes keys, fills params, falls back for unknown keys", () => {
    expect(statusLabel("status.generating", { n: 19 }, "en")).toBe("Writing 19 questions…");
    expect(statusLabel("status.regenerating", { ids: ["q3", "q4"] }, "en")).toContain("2 question(s)");
    expect(statusLabel("status.verifying", { round: 2 }, "hi")).toContain("2");
    expect(statusLabel("status.something_new", {}, "en")).toBe("Working…");
  });

  it("agent base URL from VITE_AGENT_URL with a localhost default", () => {
    expect(agentBaseUrl("")).toBe("http://localhost:8000");
    expect(agentUrl("/agent/chat", "https://agent.a4ai.in/")).toBe("https://agent.a4ai.in/agent/chat");
    expect(agentUrl("/agent/chat", "https://agent.a4ai.in/agent")).toBe("https://agent.a4ai.in/agent/chat");
  });

  it("only the agent's own draft PDF path is downloadable", () => {
    expect(isAgentPdfPath("/agent/drafts/0f8fad5b-d9cb-469f-a165-70867728950e/pdf")).toBe(true);
    expect(isAgentPdfPath("https://evil.example/agent/drafts/x/pdf")).toBe(false);
    expect(isAgentPdfPath(undefined)).toBe(false);
  });
});

describe("dev role header", () => {
  it("adds X-Dev-Role only in dev with a valid role", async () => {
    const { agentDevRole, agentHeaders } = await import("./client");
    expect(agentDevRole({ DEV: true, VITE_AGENT_DEV_ROLE: "Admin" })).toBe("admin");
    expect(agentDevRole({ DEV: false, VITE_AGENT_DEV_ROLE: "admin" })).toBeNull();
    expect(agentDevRole({ DEV: true, VITE_AGENT_DEV_ROLE: "root" })).toBeNull();
    expect(agentHeaders(null, {}, "teacher")).toEqual({ "X-Dev-Role": "teacher" });
    expect(agentHeaders("t", { "Content-Type": "application/json" }, null)).toEqual({ "Content-Type": "application/json", Authorization: "Bearer t" });
  });
});
