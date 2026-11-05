import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Block, ChatState } from "@/lib/agent/chatState";
import { initialChatState } from "@/lib/agent/chatState";
import AgentChatPanel from "./AgentChatPanel";
import { AgentEventBlock, type BlockHandlers } from "./AgentEventBlock";
import { showAskA4ai } from "./AskA4aiLauncher";
import type { AgentChat } from "./useAgentChat";

const h: BlockHandlers = { busy: false, onAnswer: vi.fn(), onApprove: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn(), onDownload: vi.fn() };
const meta = { seq: 0, request_id: "r" };
const src = { source: "tool:attendance_stats", as_of: "2026-11-05T13:13:43+05:30" };
const html = (block: Block, handlers: BlockHandlers = h) => renderToStaticMarkup(createElement(AgentEventBlock, { block, h: handlers }));
const count = (s: string, needle: string) => s.split(needle).length - 1;

describe("AgentEventBlock", () => {
  it("stat_card shows — for a null value and its source", () => {
    const out = html({ kind: "stat_card", id: "1", ev: { ...meta, ...src, type: "stat_card", title: "Attendance", value: null, unit: "%" } });
    expect(out).toContain("—");
    expect(out).not.toContain("%</span>");
    expect(out).toContain("attendance_stats");
  });

  it("table renders null cells as —", () => {
    const out = html({ kind: "table", id: "1", ev: { ...meta, ...src, type: "table", title: "Below 75%", columns: ["Student", "%"], rows: [["Aarav", null]] } });
    expect(out).toContain("<table");
    expect(out).toContain("—");
  });

  it("clarify chips are <button>s", () => {
    const out = html({ kind: "clarify", id: "1", answered: null, ev: { ...meta, type: "clarify", question: "Kaun sa?", chips: [{ label: "Rahul Kumar (10A)", value: "Rahul Kumar (10A)" }, { label: "Rahul Kumar (10B)", value: "Rahul Kumar (10B)" }] } });
    expect(count(out, "<button")).toBe(2);
    expect(out).toContain('type="button"');
  });

  it("verification is always split, never a flat N/N verified", () => {
    const out = html({ kind: "verification", id: "1", ev: { ...meta, type: "verification_summary", objective_verified: 13, objective_total: 13, rubric_checked: 6, rubric_total: 6, manual_review: [], marks_sum_ok: true, duplicates: [], rounds: 2 } });
    expect(out).toContain("Objective 13/13 verified");
    expect(out).toContain("Rubric 6/6 checked");
    expect(out).toContain("0 manual review");
    expect(out).not.toMatch(/>\s*19\/19 verified/);
  });

  it("blueprint shows a live total and flags a mismatch", () => {
    const out = html({ kind: "blueprint", id: "1", ev: { ...meta, type: "blueprint", class_grade: 10, subject: "Mathematics", chapters: ["Trig"], total_marks: 40, duration_min: 90, sections: [{ section: "A", qtype: "mcq", count: 7, marks_each: 1 }, { section: "E", qtype: "case_study", count: 1, marks_each: 4 }] } });
    expect(out).toContain("Total 11 / 40");
    expect(out).toContain("text-destructive");
    expect(count(out, 'type="number"')).toBe(4);
  });

  it("paper preview sanitizes HTML and renders KaTeX with trust:false", () => {
    const out = html({ kind: "paper_preview", id: "1", ev: { ...meta, type: "paper_preview", draft_id: "d", title: "Trig", total_marks: 1, duration_min: 10, questions: [
      { id: "q1", section: "A", qtype: "mcq", marks: 1, status: "verified", text: 'Find $\\sin 30^\\circ$ <img src=x onerror="alert(1)">', options: ["$\\frac{1}{2}$", "1", "0", "$\\href{javascript:alert(1)}{x}$"], answer: "A" }] } });
    expect(out).toContain("katex");
    expect(out).not.toContain("<img");
    expect(out).not.toMatch(/href="javascript:/i);
    expect(out).toContain("<details");
  });

  it("pending approval: Approve + Cancel, no Download", () => {
    const out = html({ kind: "approval", id: "1", state: "pending", result: null, error: null, ev: { ...meta, type: "pending_approval", approval_id: "a", action: "finalize_test", summary: "finalize test", args_sha256: "h", expires_at: "2026-11-05T08:15:00Z" } });
    expect(out).toContain(">Approve<");
    expect(out).toContain(">Cancel<");
    expect(out).not.toContain("Download");
  });

  it("Download PDF appears only after a successful approve with an agent PDF path", () => {
    const ev = { ...meta, type: "pending_approval" as const, approval_id: "a", action: "finalize_test" as const, summary: "s", args_sha256: "h", expires_at: "2026-11-05T08:15:00Z" };
    const ok = html({ kind: "approval", id: "1", state: "approved", error: null, ev, result: { status: "finalized", download_path: "/agent/drafts/0f8fad5b-d9cb-469f-a165-70867728950e/pdf" } });
    expect(ok).toContain("Download PDF");
    const failed = html({ kind: "approval", id: "1", state: "failed", error: "Approval failed.", ev, result: null });
    expect(failed).not.toContain("Download");
    const foreign = html({ kind: "approval", id: "1", state: "approved", error: null, ev, result: { download_path: "https://evil.example/x.pdf" } });
    expect(foreign).not.toContain("Download");
  });

  it("error block is an inline retry card", () => {
    const out = html({ kind: "error", id: "1", code: "network", message: "Can't reach a4ai Agent.", retryText: "Aaj ki attendance" });
    expect(out).toContain('role="alert"');
    expect(out).toContain(">Retry<");
  });
});

describe("AgentChatPanel + launcher", () => {
  const chat = (state: ChatState): AgentChat => ({ state, send: vi.fn(), answerClarify: vi.fn(), approve: vi.fn(), cancelApproval: vi.fn(), download: vi.fn(), stop: vi.fn() });

  it("has exactly one aria-live region (the status line) and role chips as buttons", () => {
    const admin = renderToStaticMarkup(createElement(AgentChatPanel, { chat: chat(initialChatState), role: "admin" }));
    expect(count(admin, "aria-live")).toBe(1);
    expect(admin).toContain(">Aaj ki attendance</button>");
    expect(admin).toContain(">Sharma ma&#x27;am ki attendance</button>");
    const teacher = renderToStaticMarkup(createElement(AgentChatPanel, { chat: chat(initialChatState), role: "teacher" }));
    expect(teacher).toContain(">Class 10 trigonometry test banao</button>");
    expect(teacher).not.toContain("Aaj ki attendance");
  });

  it("shows the localized status while busy", () => {
    const busy = { ...initialChatState, busy: true, status: { key: "status.generating", params: { n: 19 } } };
    const out = renderToStaticMarkup(createElement(AgentChatPanel, { chat: chat(busy), role: "teacher" }));
    expect(out).toMatch(/aria-live="polite"[^>]*>(Writing 19 questions…|19 प्रश्न लिख रहा हूँ…)</);
    expect(out).toContain(">Stop<");
  });

  it("launcher shows only for staff on dashboard routes", () => {
    expect(showAskA4ai("/dashboard", "teacher")).toBe(true);
    expect(showAskA4ai("/institute", "admin")).toBe(true);
    expect(showAskA4ai("/hod/sections", "hod")).toBe(true);
    expect(showAskA4ai("/dashboard", "none")).toBe(false);
    expect(showAskA4ai("/student/dashboard", "teacher")).toBe(false);
    expect(showAskA4ai("/contests", "admin")).toBe(false);
  });
});
