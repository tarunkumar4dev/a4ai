import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Block, ChatTurn } from "@/lib/agent/chatState";
import type { Chart, StatCard as StatCardEvent } from "@/lib/agent/events";
import { AgentEventBlock, type BlockHandlers } from "./AgentEventBlock";
import { AgentMarkdown } from "./AgentMarkdown";
import { AgentMessage, buildContexts, groupBlocks } from "./AgentMessage";
import { showAskA4ai } from "./AskA4aiLauncher";
import { BLUEPRINT_OK, blueprintMessage, blueprintTotal } from "./BlueprintCard";
import { chartRows } from "./AgentChart";
import { sortRows, toCsv } from "./DataTable";
import { dataSourcePill } from "./AgentHeader";
import { insertPlain } from "./AgentComposer";
import { questionActionMessage } from "./PaperPreview";
import { isStaffRole, roleLabel, suggestionsFor } from "./roles";
import { dash } from "./format";

// the chart / paper are lazy chunks in the app; render them directly here
vi.mock("./lazyBlocks", async () => ({
  LazyChart: (await import("./AgentChart")).AgentChart,
  LazyPaper: (await import("./PaperPreview")).PaperPreview,
}));

const h: BlockHandlers = { busy: false, onAnswer: vi.fn(), onApprove: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn(), onDownload: vi.fn(), onSend: vi.fn(), onPrefill: vi.fn() };
const meta = { seq: 0, request_id: "r" };
const src = { source: "tool:attendance_stats", as_of: "2026-11-05T13:13:43+05:30" };
const future = new Date(Date.now() + 3600_000).toISOString();
const html = (block: Block, handlers: BlockHandlers = h) => renderToStaticMarkup(createElement(AgentEventBlock, { block, h: handlers }));
const md = (text: string) => renderToStaticMarkup(createElement(AgentMarkdown, { text }));
const count = (s: string, needle: string) => s.split(needle).length - 1;
const stat = (o: Partial<StatCardEvent> = {}): StatCardEvent => ({ ...meta, ...src, type: "stat_card", title: "Attendance", value: "83.8", unit: "%", ...o });

describe("AgentEventBlock: event → component", () => {
  it("text → markdown prose (bold, lists, GFM tables)", () => {
    const out = html({ kind: "text", id: "1", text: "**83.8%** attendance\n\n- 10A\n- 10B\n\n| a | b |\n|---|---|\n| 1 | 2 |" });
    expect(out).toContain("<strong");
    expect(out).toContain("<ul");
    expect(out).toContain("<table");
  });

  it("stat_card: big number, unit, period, delta, source + as of footer", () => {
    const out = html({ kind: "stat_card", id: "1", ev: stat({ period: "1–5 Nov 2026", delta: "+2.1 pts vs Oct" }) });
    expect(out).toContain("83.8");
    expect(out).toContain("1–5 Nov 2026");
    expect(out).toContain("+2.1 pts vs Oct");
    expect(out).toContain("Source: Attendance stats");
    expect(out).toMatch(/as of 5 Nov/);
  });

  it("stat_card null value renders — and drops the unit (never 0)", () => {
    const out = html({ kind: "stat_card", id: "1", ev: stat({ value: null }) });
    expect(out).toContain("—");
    expect(out).not.toContain(">%<");
    expect(out).not.toMatch(/>0</);
  });

  it("table: sortable header buttons, null cells —, Copy CSV, phone cards", () => {
    const out = html({ kind: "table", id: "1", ev: { ...meta, ...src, type: "table", title: "Below 75%", columns: ["Student", "%"], rows: [["Aarav", null], ["Diya", "62.5"]] } });
    expect(out).toContain("<table");
    expect(out).toContain('aria-sort="none"');
    expect(out).toContain("Copy CSV");
    expect(out).toContain("—");
    expect(out).toContain("<dl"); // card view (sm:hidden)
  });

  it("empty table → friendly empty state, no Copy CSV", () => {
    const out = html({ kind: "table", id: "1", ev: { ...meta, ...src, type: "table", title: "Below 75%", columns: ["Student"], rows: [] } });
    expect(out).toContain("Koi record nahi mila");
    expect(out).not.toContain("Copy CSV");
  });

  it("chart with no numbers → empty state; with data → figure + hidden data table", () => {
    const empty: Chart = { ...meta, ...src, type: "chart", kind: "line", title: "Trend", series: [{ name: "10A", points: [["W1", null]] }] };
    expect(html({ kind: "chart", id: "1", ev: empty })).toContain("koi data nahi");
    const ev: Chart = { ...empty, series: [{ name: "10A", points: [["W1", 80], ["W2", null], ["W3", 85]] }], y_unit: "%" };
    const out = html({ kind: "chart", id: "1", ev });
    expect(out).toContain("<figure");
    expect(out).toContain('class="sr-only"');
  });

  it("clarify chips are <button>s (≥44px) with aria-pressed", () => {
    const out = html({ kind: "clarify", id: "1", answered: null, ev: { ...meta, type: "clarify", question: "Kaun sa?", chips: [{ label: "Rahul Kumar (10A)", value: "s1" }, { label: "Rahul Kumar (10B)", value: "s2" }] } });
    expect(count(out, "<button")).toBe(2);
    expect(out).toContain("min-h-11");
    expect(out).toContain('aria-pressed="false"');
  });

  it("verification is split (objective · rubric · manual) — never a flat N/N verified", () => {
    const out = html({ kind: "verification", id: "1", ev: { ...meta, type: "verification_summary", objective_verified: 13, objective_total: 13, rubric_checked: 6, rubric_total: 6, manual_review: [], marks_sum_ok: true, duplicates: [], rounds: 2 } });
    expect(out.replace(/<[^>]+>/g, "")).toContain("Objective 13/13 · Rubric 6/6 · Manual review 0");
    expect(out).not.toMatch(/19\/19/);
    expect(out).not.toContain("Details"); // nothing to list
    const withIds = html({ kind: "verification", id: "1", ev: { ...meta, type: "verification_summary", objective_verified: 12, objective_total: 13, rubric_checked: 5, rubric_total: 6, manual_review: ["q7"], marks_sum_ok: true, duplicates: [], rounds: 2 } });
    expect(withIds.replace(/<[^>]+>/g, "")).toContain("Objective 12/13 · Rubric 5/6 · Manual review 1");
    expect(withIds).toContain("Details");
  });

  it("blueprint: editable inputs, live total, destructive on mismatch, Looks good disabled", () => {
    const out = html({ kind: "blueprint", id: "1", ev: { ...meta, type: "blueprint", class_grade: 10, subject: "Mathematics", chapters: ["Trig"], total_marks: 40, duration_min: 90, sections: [{ section: "A", qtype: "mcq", count: 7, marks_each: 1 }, { section: "E", qtype: "case_study", count: 1, marks_each: 4 }] } });
    expect(out).toContain("Total 11 / 40");
    expect(out).toContain("text-destructive");
    expect(count(out, 'type="number"')).toBe(4);
    expect(out).toMatch(/<button[^>]*disabled[^>]*>Looks good/);
  });

  it("paper preview: CBSE header, sections, marks, case study box, menus, KaTeX trust:false, sanitized", () => {
    const out = html({ kind: "paper_preview", id: "1", ev: { ...meta, type: "paper_preview", draft_id: "d", title: "Trigonometry Test", total_marks: 5, duration_min: 90, questions: [
      { id: "q1", section: "A", qtype: "mcq", marks: 1, status: "verified", text: 'Find $\\sin 30^\\circ$ <img src=x onerror="alert(1)">', options: ["$\\frac{1}{2}$", "1", "0", "$\\href{javascript:alert(1)}{x}$"], answer: "A" },
      { id: "q2", section: "E", qtype: "case_study", marks: 4, status: "manual_review", text: "A tower…", sub_questions: [{ text: "Find h", marks: 2 }, { text: "Find d", marks: 2 }] }] } });
    expect(out).toContain("Max. Marks: 5");
    expect(out).toContain("Time: 1 hr 30 min");
    expect(out).toContain("SECTION A");
    expect(out).toContain("SECTION E");
    expect(out).toContain("Case study");
    expect(out).toContain("katex");
    expect(out).not.toContain("<img");
    expect(out).not.toMatch(/href="javascript:/i);
    expect(out).toContain('aria-label="Q1 options"');
    expect(out).toContain("Answer key");
    expect(out).toContain("Manual review"); // q2 marker (sr-only)
  });

  it("pending approval: Approve / Edit / Cancel, irreversible note, no Download", () => {
    const out = html({ kind: "approval", id: "1", state: "pending", result: null, error: null, ev: { ...meta, type: "pending_approval", approval_id: "a", action: "finalize_test", summary: "Class 10 Trig test (40 marks) final karna", args_sha256: "h", expires_at: future, status: "pending" } });
    expect(out).toMatch(/>Approve</);
    expect(out).toMatch(/Edit</);
    expect(out).toMatch(/Cancel</);
    expect(out).toContain("wapas nahi hoga");
    expect(out).not.toContain("Download");
  });

  it("Download PDF only after a successful approve with an agent PDF path", () => {
    const ev = { ...meta, type: "pending_approval" as const, approval_id: "a", action: "finalize_test" as const, summary: "s", args_sha256: "h", expires_at: future, status: "pending" as const };
    expect(html({ kind: "approval", id: "1", state: "approved", error: null, ev, result: { status: "finalized", download_path: "/agent/drafts/0f8fad5b-d9cb-469f-a165-70867728950e/pdf" } })).toContain("Download PDF");
    expect(html({ kind: "approval", id: "1", state: "failed", error: "Approval failed.", ev, result: null })).not.toContain("Download");
    expect(html({ kind: "approval", id: "1", state: "approved", error: null, ev, result: { download_path: "https://evil.example/x.pdf" } })).not.toContain("Download");
  });

  it("error block is an inline retry card", () => {
    const out = html({ kind: "error", id: "1", code: "network", message: "a4ai Agent tak nahi pahunch paye.", retryText: "Aaj ki attendance" });
    expect(out).toContain('data-testid="agent-error"');
    expect(out).not.toContain('role="alert"'); // announced by the one status line instead
    expect(out).toMatch(/Dobara try karein</);
  });
});

describe("markdown sanitiser (assistant prose)", () => {
  it("never renders raw HTML or script tags", () => {
    const out = md('Hi <script>alert(1)</script> <b onclick="x()">bold</b> <iframe src="https://e.x"></iframe>\n\n<div style="color:red">x</div>');
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/<iframe/i);
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toMatch(/<b[ >]/);
    expect(out).not.toMatch(/<div style/);
  });

  it("javascript:, data: and relative links are plain text; http(s) open in a new tab with noopener noreferrer", () => {
    const out = md("[evil](javascript:alert(1)) [data](data:text/html,<b>x</b>) [rel](/admin) [ok](https://a4ai.in/help)");
    expect(out).not.toMatch(/href="javascript/i);
    expect(out).not.toMatch(/href="data:/i);
    expect(out).not.toMatch(/href="\/admin"/);
    expect(count(out, "<a ")).toBe(1);
    expect(out).toContain('href="https://a4ai.in/help"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("images are not rendered", () => {
    expect(md("![x](https://e.x/a.png)")).not.toContain("<img");
  });
});

describe("message rendering", () => {
  const turn = (blocks: Block[], extra: Partial<ChatTurn> = {}): ChatTurn => ({ id: "a1", role: "assistant", text: "", blocks, done: true, at: 1, endedAt: 4201, steps: [], ...extra });

  it("groups consecutive stat cards into one grid", () => {
    const g = groupBlocks([
      { kind: "stat_card", id: "1", ev: stat() }, { kind: "stat_card", id: "2", ev: stat({ title: "Absent" }) },
      { kind: "text", id: "3", text: "x" }, { kind: "stat_card", id: "4", ev: stat() },
    ]);
    expect(g.map((x) => x.kind)).toEqual(["stats", "block", "stats"]);
    const out = renderToStaticMarkup(createElement(AgentMessage, { turn: turn([{ kind: "stat_card", id: "1", ev: stat() }, { kind: "stat_card", id: "2", ev: stat({ title: "Absent" }) }]), h, ctx: new Map(), onFeedback: vi.fn() }));
    expect(count(out, 'data-testid="stat-card"')).toBe(2);
    expect(out).toContain('data-testid="stat-grid"');
    expect(count(out, "Source: ")).toBe(1); // shared footer
  });

  it("waiting turn shows skeletons; done turn shows copy + thumbs + collapsed steps summary", () => {
    const waiting = renderToStaticMarkup(createElement(AgentMessage, { turn: turn([], { done: false }), h, ctx: new Map(), onFeedback: vi.fn() }));
    expect(waiting).toContain('data-testid="msg-skeleton"');
    const steps = [
      { id: "s1", key: "tool.resolve_entity", params: {}, status: "done" as const, startedAt: 1, ms: 400 },
      { id: "s2", key: "tool.attendance_stats", params: {}, status: "done" as const, startedAt: 2, ms: 900 },
      { id: "s3", key: "status.verifying", params: {}, status: "done" as const, startedAt: 3, ms: 2000 },
    ];
    const done = renderToStaticMarkup(createElement(AgentMessage, { turn: turn([{ kind: "text", id: "t", text: "ok" }], { steps }), h, ctx: new Map(), onFeedback: vi.fn() }));
    expect(done).toContain("3 steps");
    expect(done).toContain('aria-label="Copy answer"');
    expect(done).toContain('aria-label="Helpful"');
    expect(done).not.toContain("aria-live");
  });

  it("running steps show Hinglish labels", () => {
    const steps = [{ id: "s1", key: "tool.resolve_entity", params: {}, status: "done" as const, startedAt: 1, ms: 400 }, { id: "s2", key: "tool.attendance_stats", params: {}, status: "running" as const, startedAt: 2, ms: null }];
    const out = renderToStaticMarkup(createElement(AgentMessage, { turn: turn([], { done: false, steps }), h, ctx: new Map(), onFeedback: vi.fn() }));
    expect(out).toContain("Naam dhoondh raha hoon");
    expect(out).toContain("Attendance nikal raha hoon");
    expect(out).toContain("animate-spin");
    expect(out).toContain("400ms");
  });

  it("paper header takes class/subject from the blueprint; verification gets failed ids from the paper", () => {
    const bp: Block = { kind: "blueprint", id: "b", ev: { ...meta, type: "blueprint", class_grade: 10, subject: "Mathematics", chapters: [], total_marks: 1, duration_min: 30, sections: [] } };
    const paper: Block = { kind: "paper_preview", id: "p", ev: { ...meta, type: "paper_preview", draft_id: "d", title: "T", total_marks: 1, duration_min: 30, questions: [{ id: "q9", section: "A", qtype: "mcq", marks: 1, text: "x", status: "failed" }] } };
    const ver: Block = { kind: "verification", id: "v", ev: { ...meta, type: "verification_summary", objective_verified: 0, objective_total: 1, rubric_checked: 0, rubric_total: 0, manual_review: [], marks_sum_ok: true, duplicates: [], rounds: 1 } };
    const ctx = buildContexts([turn([bp]), turn([paper, ver])]);
    expect(ctx.get("p")?.paper).toEqual({ class_grade: 10, subject: "Mathematics" });
    expect(ctx.get("v")?.failedIds).toEqual(["q9"]);
    expect(renderToStaticMarkup(createElement(AgentEventBlock, { block: paper, h, ctx: ctx.get("p") }))).toContain("Class 10 · Mathematics");
  });
});

describe("pure helpers", () => {
  it("blueprint total + confirmation message", () => {
    const s = [{ section: "A", qtype: "mcq" as const, count: 10, marks_each: 1 }, { section: "B", qtype: "short_answer" as const, count: 5, marks_each: 2 }];
    expect(blueprintTotal(s)).toBe(20);
    expect(blueprintMessage(s, s)).toBe(BLUEPRINT_OK);
    expect(blueprintMessage(s, [s[0], { ...s[1], count: 6 }])).toBe(`${BLUEPRINT_OK}. Badlav: Section B (Short answer): 6 × 2 marks`);
  });

  it("question action messages", () => {
    expect(questionActionMessage(5, "q5", "replace")).toBe("Q5 (q5) replace karo");
    expect(questionActionMessage(5, "q5", "easier")).toBe("Q5 (q5) easier karo");
    expect(questionActionMessage(5, "q5", "harder")).toBe("Q5 (q5) harder karo");
    expect(questionActionMessage(5, "q5", "marks")).toBe("Q5 (q5) ke marks change karo: ");
  });

  it("chart rows keep nulls as gaps (never 0)", () => {
    const rows = chartRows({ ...meta, ...src, type: "chart", kind: "line", title: "t", series: [{ name: "A", points: [["W1", 80], ["W2", null]] }, { name: "B", points: [["W2", 70]] }] });
    expect(rows).toEqual([{ x: "W1", s0: 80, s1: null }, { x: "W2", s0: null, s1: 70 }]);
  });

  it("table sort is numeric-aware, nulls last both ways; CSV escapes", () => {
    const rows = [["A", "9.5%"], ["B", null], ["C", "62%"], ["D", "100%"]];
    expect(sortRows(rows, 1, "asc").map((r) => r[0])).toEqual(["A", "C", "D", "B"]);
    expect(sortRows(rows, 1, "desc").map((r) => r[0])).toEqual(["D", "C", "A", "B"]);
    expect(toCsv(["Name", "Note"], [['Sharma, "R"', null]])).toBe('Name,Note\n"Sharma, ""R""",');
  });

  it("data source pill", () => {
    expect(dataSourcePill({ data_source: "live", read_only: true, role: "admin", first_name: null, institute_name: null }, "ok")).toMatchObject({ label: "Live · read-only", tone: "live" });
    expect(dataSourcePill({ data_source: "demo", read_only: true, role: "teacher", first_name: null, institute_name: null }, "ok")).toMatchObject({ label: "Demo data", tone: "demo" });
    expect(dataSourcePill(null, "loading")).toMatchObject({ label: "Connecting…", tone: "unknown" });
    expect(dataSourcePill(null, "error").tone).toBe("unknown");
  });

  it("paste inserts plain text within the 4000 limit", () => {
    expect(insertPlain("ab", 1, 1, "X\r\nY")).toEqual({ value: "aX\nYb", caret: 4 });
    expect(insertPlain("abc", 0, 3, "zz", 4)).toEqual({ value: "zz", caret: 2 });
    expect(insertPlain("abcd", 4, 4, "efg", 5).value).toBe("abcde");
  });

  it("roles: staff only, badge labels, suggestions per role", () => {
    expect(isStaffRole("teacher")).toBe(true);
    expect(isStaffRole("none")).toBe(false);
    expect(isStaffRole("student")).toBe(false);
    expect(roleLabel("hod", "teacher")).toBe("HOD");
    expect(roleLabel(null, "admin")).toBe("Admin");
    expect(suggestionsFor("admin").map((s) => s.title)).toContain("Aaj poore institute ki attendance");
    expect(suggestionsFor("teacher").map((s) => s.title)).toContain("Class 10 trigonometry test banao");
    expect(suggestionsFor("proctor").map((s) => s.prompt)).toContain("Mere section ke 75% se kam wale, Excel mein");
    expect(suggestionsFor("hod").map((s) => s.prompt)).toContain("Department ka section-wise comparison");
    for (const r of ["admin", "hod", "proctor", "teacher"] as const) expect(suggestionsFor(r)).toHaveLength(4);
  });

  it("dash never turns null into 0", () => {
    expect(dash(null)).toBe("—");
    expect(dash("")).toBe("—");
    expect(dash(0)).toBe("0");
  });
});

describe("launcher", () => {
  it("shows only for staff on dashboard routes, not on the agent tab", () => {
    expect(showAskA4ai("/dashboard", "teacher")).toBe(true);
    expect(showAskA4ai("/institute", "admin")).toBe(true);
    expect(showAskA4ai("/hod/sections", "hod")).toBe(true);
    expect(showAskA4ai("/dashboard", "teacher", "?tab=agent")).toBe(false);
    expect(showAskA4ai("/dashboard", "teacher", "?tab=students")).toBe(true);
    expect(showAskA4ai("/dashboard", "none")).toBe(false);
    expect(showAskA4ai("/student/dashboard", "teacher")).toBe(false);
    expect(showAskA4ai("/contests", "admin")).toBe(false);
  });
});
