// v2 UI pieces: event → component for my_scope / section_comparison / clarify hints, ranking, empty-state cards,
// message actions (regenerate / edit / stopped / feedback), suggestions listbox markup, shortcuts, step icons.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Search, Users, Wrench } from "lucide-react";
import type { Block, ChatTurn } from "@/lib/agent/chatState";
import { rankSuggestions } from "@/lib/agent/suggest";
import type { MyScope, SectionComparison as Cmp } from "@/lib/agent/types";
import { AgentEventBlock, type BlockHandlers } from "./AgentEventBlock";
import { AgentMessage } from "./AgentMessage";
import { AgentSuggestions } from "./AgentSuggestions";
import { comparisonChart, rankRows } from "./SectionComparison";
import { emptyCards, scopeSummary } from "./roles";
import { isEditable, matchShortcut } from "./shortcuts";
import { stepIcon } from "./StepTimeline";

vi.mock("./lazyBlocks", async () => ({
  LazyChart: (await import("./AgentChart")).AgentChart,
  LazyPaper: (await import("./PaperPreview")).PaperPreview,
}));

const h: BlockHandlers = { busy: false, onAnswer: vi.fn(), onApprove: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn(), onDownload: vi.fn(), onSend: vi.fn(), onPrefill: vi.fn() };
const html = (block: Block) => renderToStaticMarkup(createElement(AgentEventBlock, { block, h }));
const base = { seq: 1, request_id: "r", source: "tool:x", as_of: "2026-11-09T10:00:00+05:30" };
const count = (s: string, needle: string) => s.split(needle).length - 1;

const scope: MyScope = {
  ...base, type: "my_scope", role: "teacher", title: "Aap ye dekh sakte hain", departments: ["ECE"], total_students: 44,
  batches: [
    { batch_id: "b1", name: "ECE-1", students: 22, kind: "Section", department: "ECE", via: "teacher" },
    { batch_id: "b2", name: "ECE-2", students: 22, kind: "Section", department: "ECE", via: "proctor" },
  ],
};
const cmp: Cmp = {
  ...base, type: "section_comparison", title: "Attendance by section", metric: "Attendance", unit: "%", period: "1–9 Nov",
  rows: [{ name: "ECE-3", value: 77.1, students: 41 }, { name: "ECE-4", value: null, students: 0, detail: "No classes yet" }, { name: "ECE-1", value: 86.4, students: 22 }, { name: "ECE-2", value: 86.4, students: 22 }],
};

describe("new blocks: event → component", () => {
  it("my_scope → ScopeCard: total line, one tappable row per batch with its count and role", () => {
    const out = html({ kind: "my_scope", id: "s", ev: scope });
    expect(out).toContain('data-testid="scope-card"');
    expect(out).toContain("2 batches · 44 students");
    expect(count(out, 'data-testid="scope-batch"')).toBe(2);
    expect(out).toContain("Proctor");
    expect(out).toContain("ECE-2: 22 students");
    expect(out).toContain("Source: X");
  });

  it("my_scope with no batches says so (never a blank card)", () => {
    const out = html({ kind: "my_scope", id: "s", ev: { ...scope, batches: [], total_students: null } });
    expect(out).toContain("Abhi koi batch assign nahi hai");
    expect(out).toContain("HOD se batch assign");
  });

  it("section_comparison → ranking table (ties share a rank, null last as —) + bar chart", () => {
    const out = html({ kind: "section_comparison", id: "c", ev: cmp });
    expect(out).toContain('data-testid="ranking-table"');
    expect(out).toContain('data-testid="agent-chart"');
    const table = out.slice(out.indexOf('data-testid="ranking-table"'), out.indexOf("</table>", out.indexOf('data-testid="ranking-table"')));
    const rows = table.split("<tr").slice(2); // header row first
    expect(rows.map((r) => (r.match(/>(ECE-\d)</) ?? [])[1])).toEqual(["ECE-1", "ECE-2", "ECE-3", "ECE-4"]);
    expect(out).toContain("86.4%");
    expect(out).toContain("No classes yet");
    expect(out).toMatch(/Top: <strong[^>]*>ECE-1<\/strong>/);
    expect(out).toMatch(/Sabse kam: <strong[^>]*>ECE-3<\/strong>/);
  });

  it("rankRows: competition ranking, lower-is-better, nulls last", () => {
    expect(rankRows(cmp.rows).map((r) => [r.name, r.rank])).toEqual([["ECE-1", 1], ["ECE-2", 1], ["ECE-3", 3], ["ECE-4", null]]);
    expect(rankRows(cmp.rows, false).map((r) => r.name)).toEqual(["ECE-3", "ECE-1", "ECE-2", "ECE-4"]);
    const chart = comparisonChart(cmp, rankRows(cmp.rows));
    expect(chart).toMatchObject({ type: "chart", kind: "bar", y_unit: "%" });
    expect(chart.series[0].points).toEqual([["ECE-1", 86.4], ["ECE-2", 86.4], ["ECE-3", 77.1], ["ECE-4", null]]);
  });

  it("clarify chips show hints so look-alike names can be told apart", () => {
    const out = html({ kind: "clarify", id: "q", answered: null, ev: { seq: 1, request_id: "r", type: "clarify", question: "Kaun sa?", chips: [
      { label: "ECE 1", value: "a", hint: "ECE 1 · 22 students" }, { label: "ECE1", value: "b", hint: "ECE1 · 0 students" }, { label: "Plain", value: "c", hint: null }] } });
    expect(out).toContain("ECE 1 · 22 students");
    expect(out).toContain("ECE1 · 0 students");
    expect(count(out, 'data-testid="clarify-chip"')).toBe(3);
  });
});

describe("empty state from scope + role", () => {
  it("scope summary line", () => {
    expect(scopeSummary(scope)).toBe("2 batches · 44 students");
    expect(scopeSummary({ batches: [{ name: "A", students: 1 }], total_students: null })).toBe("1 batch · 1 student");
    expect(scopeSummary({ batches: [{ name: "A", students: null }], total_students: null })).toBe("1 batch");
    expect(scopeSummary(null)).toBeNull();
  });
  it("4 cards: own batches first, then compare, then role templates (no repeats)", () => {
    const cards = emptyCards(scope, "teacher", "teacher");
    expect(cards).toHaveLength(4);
    expect(cards.slice(0, 3).map((c) => c.prompt)).toEqual(["ECE-1 ki attendance", "ECE-2 ki attendance", "Sections ki attendance compare karo"]);
    expect(cards[0].hint).toBe("22 students · Aap padhate hain");
    expect(new Set(cards.map((c) => c.prompt)).size).toBe(4);
    expect(emptyCards(null, "hod", "hod").map((c) => c.title)[0]).toBe("Department ki attendance");
  });
});

const turn = (o: Partial<ChatTurn>): ChatTurn => ({ id: "a1", role: "assistant", text: "", blocks: [], done: true, at: 1, seq: 2, ...o });

describe("message actions", () => {
  const msg = (t: ChatTurn) => renderToStaticMarkup(createElement(AgentMessage, { turn: t, h, ctx: new Map(), isLast: true, onFeedback: vi.fn(), onRegenerate: vi.fn(), onEdit: vi.fn() }));
  it("assistant: Copy, Regenerate, 👍, 👎", () => {
    const out = msg(turn({ blocks: [{ kind: "text", id: "t", text: "Jawab" }] }));
    for (const label of ["Copy answer", "Regenerate", "Helpful", "Not helpful"]) expect(out).toContain(`aria-label="${label}"`);
  });
  it("a stopped partial answer is marked and can still be regenerated", () => {
    const out = msg(turn({ stopped: true, blocks: [{ kind: "text", id: "t", text: "Aadha" }] }));
    expect(out).toContain('data-testid="msg-stopped"');
    expect(out).toContain('aria-label="Regenerate"');
  });
  it("user: Edit and resend", () => {
    const out = msg({ id: "u1", role: "user", text: "Q", blocks: [], done: true, at: 1, seq: 1 });
    expect(out).toContain('aria-label="Edit message"');
    expect(out).toContain(">Q<");
  });
  it("no actions while streaming", () => {
    expect(msg(turn({ done: false, blocks: [{ kind: "text", id: "t", text: "…" }] }))).not.toContain('data-testid="msg-actions"');
  });
});

describe("suggestions listbox markup (combobox pattern)", () => {
  const options = rankSuggestions("ece", { server: [{ type: "entity", text: "ECE-1 ki attendance", hint: "Batch · 22 students" }], recent: [{ id: "q1", text: "ECE-2 ki attendance", created_at: "" }], templates: [] });
  const out = renderToStaticMarkup(createElement(AgentSuggestions, {
    listId: "L", options, active: 1, query: "ece", onRun: vi.fn(), onFill: vi.fn(), onRemove: vi.fn(), onHover: vi.fn(), onClear: vi.fn(), canClear: false,
  }));
  it("listbox + options with ids, one selected, match bold, hint, × only on recent", () => {
    expect(out).toContain('role="listbox"');
    expect(count(out, 'role="option"')).toBe(2);
    expect(out).toContain('id="L-opt-1"');
    expect(count(out, 'aria-selected="true"')).toBe(1);
    expect(out).toContain('<mark class="bg-transparent font-semibold text-foreground">ECE</mark>');
    expect(out).toContain("Batch · 22 students");
    expect(count(out, 'data-testid="suggestion-remove"')).toBe(1);
    expect(out).not.toContain("Clear history");
  });
});

describe("shortcuts + step icons", () => {
  const ta = { tagName: "TEXTAREA" } as unknown as EventTarget;
  const div = { tagName: "DIV", isContentEditable: false } as unknown as EventTarget;
  it("Ctrl/⌘+K opens, +Shift+O new chat, / focuses only outside inputs", () => {
    const mod = /Mac/i.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true };
    expect(matchShortcut({ key: "k", ...mod }, ta)).toBe("open-agent");
    expect(matchShortcut({ key: "O", shiftKey: true, ...mod }, div)).toBe("new-chat");
    expect(matchShortcut({ key: "/" }, div)).toBe("focus-input");
    expect(matchShortcut({ key: "/" }, ta)).toBeNull();
    expect(matchShortcut({ key: "k" }, div)).toBeNull();
    expect(matchShortcut({ key: "k", defaultPrevented: true, ...mod }, div)).toBeNull();
    expect(isEditable({ tagName: "INPUT", type: "checkbox" } as unknown as EventTarget)).toBe(false);
    expect(isEditable({ tagName: "INPUT", type: "search" } as unknown as EventTarget)).toBe(true);
  });
  it("each tool has its own icon; unknown → wrench", () => {
    expect(stepIcon("tool.resolve_entity")).toBe(Search);
    expect(stepIcon("tool.my_scope")).toBe(Users);
    expect(stepIcon("tool.something_new")).toBe(Wrench);
  });
});

describe("the one live region", () => {
  it("streaming → running step; after → fresh error / stop / failed approval / expired session; old turns stay quiet", async () => {
    const { liveStatus } = await import("./AgentChatPanel");
    const now = 1_000_000;
    const base = { turns: [] as ChatTurn[], status: null, sessionId: null, busy: false, lastUserText: null };
    const asst = (o: Partial<ChatTurn>): ChatTurn => ({ id: "a", role: "assistant", text: "", blocks: [], done: true, at: now - 2000, endedAt: now - 1000, ...o });
    expect(liveStatus({ authExpired: false, chat: { ...base, busy: true, turns: [asst({ done: false, steps: [{ id: "s", key: "tool.my_scope", params: {}, status: "running", startedAt: 0, ms: null }] })] } }, now))
      .toBe("Aapke batches dekh raha hoon…");
    expect(liveStatus({ authExpired: false, chat: { ...base, turns: [asst({ blocks: [{ kind: "error", id: "e", code: "network", message: "Connection nahi bana", retryText: "q" }] })] } }, now))
      .toBe("Jawab nahi aa paya: Connection nahi bana");
    expect(liveStatus({ authExpired: false, chat: { ...base, turns: [asst({ stopped: true })] } }, now)).toBe("Jawab rok diya gaya.");
    expect(liveStatus({ authExpired: false, chat: { ...base, turns: [asst({ stopped: true, endedAt: now - 60_000 })] } }, now)).toBe("");
    expect(liveStatus({ authExpired: true, chat: base }, now)).toMatch(/Session expire/);
  });
});
