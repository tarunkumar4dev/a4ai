// UI pieces on contract 1.2: scope / ranking views of the backend's tables, the file card (pending event), error
// states (401 / 429 / 503 / offline), approvals that expired, role-aware cards, message actions, the suggestions
// listbox, shortcuts, step icons and the one live region.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Search, Users, Wrench } from "lucide-react";
import { AgentHttpError, parseRetryAfter } from "@/lib/agent/client";
import type { Block, ChatTurn } from "@/lib/agent/chatState";
import { FILE_FIXTURE, RANKING_TABLE, SCOPE_TABLE } from "@/lib/agent/contract/fixtures";
import { friendlyError } from "@/lib/agent/store";
import { rankSuggestions } from "@/lib/agent/suggest";
import { AgentEventBlock, ErrorCard, type BlockHandlers } from "./AgentEventBlock";
import { AgentMessage } from "./AgentMessage";
import { AgentSuggestions } from "./AgentSuggestions";
import { FileCard, fileMeta } from "./FileCard";
import { rankingRows } from "./RankingTable";
import { agentRole, emptyCards, roleLabel, scopeLine } from "./roles";
import { scopeQuestion, scopeRows, scopeTotal } from "./ScopeCard";
import { isEditable, matchShortcut } from "./shortcuts";
import { stepIcon } from "./StepTimeline";

vi.mock("./lazyBlocks", async () => ({
  LazyChart: (await import("./AgentChart")).AgentChart,
  LazyPaper: (await import("./PaperPreview")).PaperPreview,
}));

const h: BlockHandlers = { busy: false, onAnswer: vi.fn(), onApprove: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn(), onDownload: vi.fn(), onSend: vi.fn(), onPrefill: vi.fn(), onDownloadFile: vi.fn() };
const html = (block: Block) => renderToStaticMarkup(createElement(AgentEventBlock, { block, h }));
const count = (s: string, needle: string) => s.split(needle).length - 1;

describe("my_scope / section_comparison tables", () => {
  it("scope: rows read by column name, total line, one tappable row per batch with role + subjects", () => {
    expect(scopeRows(SCOPE_TABLE).map((r) => [r.name, r.students, r.role])).toEqual([["ECE 1", 22, "teacher"], ["ECE 2", 22, "proctor"], ["ECE 2 A", 15, "proctor"]]);
    expect(scopeTotal(scopeRows(SCOPE_TABLE))).toBe("3 batches · 59 students");
    expect(scopeTotal([])).toBe("Abhi koi batch assign nahi hai");
    expect(scopeQuestion("ECE 1")).toBe("ECE 1 ki is mahine ki attendance");
    const out = html({ kind: "table", id: "t", ev: SCOPE_TABLE });
    expect(count(out, 'data-testid="scope-batch"')).toBe(3);
    expect(out).toContain("Proctor · Signals, Networks");
  });

  it("ranking: backend ranks kept, no-data rows last as —, Top / Sabse kam, ask buttons", () => {
    expect(rankingRows(RANKING_TABLE).map((r) => [r.rank, r.name, r.pct])).toEqual([[1, "ECE 1", 86.4], [2, "ECE 2", 83.8], [null, "ECE 4", null]]);
    const out = html({ kind: "table", id: "t", ev: RANKING_TABLE });
    expect(out).toMatch(/Top: <strong[^>]*>ECE 1<\/strong> 86.4%/);
    expect(out).toMatch(/Sabse kam: <strong[^>]*>ECE 2<\/strong>/);
    expect(out).toContain("Data nahi hai");
    expect(count(out, "ke baare me poochho")).toBe(3);
  });

  it("other tables stay a sortable DataTable", () => {
    expect(html({ kind: "table", id: "t", ev: { ...SCOPE_TABLE, source: "tool:low_attendance_list" } })).toContain('data-testid="data-table"');
  });
});

describe("file card (`file` event, not in contract 1.2 yet)", () => {
  const block = (o: Partial<Extract<Block, { kind: "file" }>> = {}): Extract<Block, { kind: "file" }> => ({ kind: "file", id: "f", ev: FILE_FIXTURE, state: "ready", error: null, ...o });
  it("name, rows, size, expiry; Download button", () => {
    expect(fileMeta(FILE_FIXTURE)).toMatch(/^6 rows · 8 KB · expires /);
    const out = renderToStaticMarkup(createElement(FileCard, { block: block(), onDownload: vi.fn(), onAskAgain: vi.fn() }));
    expect(out).toContain("below-75-ece2.xlsx");
    expect(out).toContain('aria-label="Download below-75-ece2.xlsx"');
  });
  it("expired: no download, offers to make it again", () => {
    const out = renderToStaticMarkup(createElement(FileCard, { block: block({ state: "expired" }), onDownload: vi.fn(), onAskAgain: vi.fn() }));
    expect(out).toContain("Link expire ho gaya");
    expect(out).toContain("Dobara banao");
    expect(out).not.toContain("Download below");
  });
});

describe("error states", () => {
  it("401 / 429 (with Retry-After) / 503 / 5xx / offline → friendly Hinglish", () => {
    expect(friendlyError(new AgentHttpError(401, "x"))?.code).toBe("unauthorized");
    expect(friendlyError(new AgentHttpError(429, "x", 42), 1000)).toEqual({ code: "rate_limited", message: "Bahut saari requests. 42 second baad dobara try karein.", retryAt: 43_000 });
    expect(friendlyError(new AgentHttpError(503, "x"))?.code).toBe("unavailable");
    expect(friendlyError(new AgentHttpError(502, "x"))?.code).toBe("server");
    expect(friendlyError(new DOMException("x", "AbortError"))).toBeNull();
    expect(parseRetryAfter("17")).toBe(17);
    expect(parseRetryAfter(new Date(61_000).toUTCString(), 1000)).toBe(60);
    expect(parseRetryAfter("soon")).toBeNull();
  });
  it("429 card: Retry waits for the countdown; 503 card: Retry now", () => {
    const wait = renderToStaticMarkup(createElement(ErrorCard, { code: "rate_limited", message: "m", retryText: "q", onRetry: vi.fn(), retryAt: Date.now() + 30_000 }));
    expect(wait).toMatch(/disabled=""[^>]*>.*Retry \(3\d?s\)|Retry \(\d+s\)/);
    expect(wait).toContain("Thoda rukiye");
    const now = renderToStaticMarkup(createElement(ErrorCard, { code: "unavailable", message: "m", retryText: "q", onRetry: vi.fn() }));
    expect(now).toContain("Agent abhi available nahi");
    expect(now).not.toContain('disabled=""');
  });
  it("an expired approval has no Approve button", () => {
    const out = html({ kind: "approval", id: "a", state: "expired", result: null, error: null,
      ev: { type: "pending_approval", seq: 1, request_id: "r", approval_id: "a1", action: "finalize_test", summary: "s", args_sha256: "h", expires_at: "2020-01-01T00:00:00+00:00" } });
    expect(out).toContain('data-testid="approval-expired"');
    expect(out).not.toMatch(/>Approve</);
  });
});

describe("roles", () => {
  it("agent role = widest scope; meta has no proctor", () => {
    expect(agentRole("teacher", { primary_role: "teacher", proctor_section_ids: ["s1"] })).toBe("proctor");
    expect(agentRole("teacher", { primary_role: "teacher", hod_department_ids: ["d"], proctor_section_ids: ["s"] })).toBe("hod");
    expect(agentRole("admin", null)).toBe("admin");
    expect(agentRole(null, { primary_role: "teacher" })).toBe("teacher");
    expect(roleLabel("teacher", "teacher", { proctor_section_ids: ["s"] })).toBe("Proctor");
  });
  it("cards per role; teachers see their own batches first", () => {
    expect(emptyCards("proctor")[0].prompt).toBe("Mere section ke 75% se kam wale, Excel mein");
    expect(emptyCards("hod")[0].prompt).toBe("Department ka section-wise comparison");
    expect(emptyCards("admin")[0].prompt).toBe("Aaj poore institute ki attendance");
    const t = emptyCards("teacher", [{ name: "ECE-2" }, { name: "ECE-1" }, { name: "ECE-3" }]);
    expect(t.map((c) => c.prompt)).toEqual(["ECE-2 ki is mahine ki attendance", "ECE-1 ki is mahine ki attendance", "Class 10 trigonometry test banao, 40 marks", "Meri classes me 75% se kam attendance wale students"]);
    expect(scopeLine("admin", 3)).toBe("Poora institute");
    expect(scopeLine("teacher", 1)).toBe("1 batch");
    expect(scopeLine("teacher", null)).toBeNull();
  });
});

const turn = (o: Partial<ChatTurn>): ChatTurn => ({ id: "a1", role: "assistant", text: "", blocks: [], done: true, at: 1, seq: 2, ...o });
describe("message actions", () => {
  const msg = (t: ChatTurn) => renderToStaticMarkup(createElement(AgentMessage, { turn: t, h, ctx: new Map(), isLast: true, onFeedback: vi.fn(), onRegenerate: vi.fn(), onEdit: vi.fn() }));
  it("assistant: Copy, Regenerate, 👍, 👎; stopped mark; user Edit; none while streaming", () => {
    const out = msg(turn({ blocks: [{ kind: "text", id: "t", text: "Jawab" }] }));
    for (const label of ["Copy answer", "Regenerate", "Helpful", "Not helpful"]) expect(out).toContain(`aria-label="${label}"`);
    expect(msg(turn({ stopped: true, blocks: [{ kind: "text", id: "t", text: "Aadha" }] }))).toContain('data-testid="msg-stopped"');
    expect(msg({ id: "u1", role: "user", text: "Q", blocks: [], done: true, at: 1, seq: 1 })).toContain('aria-label="Edit message"');
    expect(msg(turn({ done: false, blocks: [{ kind: "text", id: "t", text: "…" }] }))).not.toContain('data-testid="msg-actions"');
  });
});

describe("suggestions listbox (combobox pattern)", () => {
  const options = rankSuggestions("ece", { server: [{ type: "entity", text: "ECE-1 ki is mahine ki attendance", hint: "Batch · 22 students" }], recent: [{ id: "q1", text: "ECE-2 ki attendance", last_used_at: "", use_count: 1 }], templates: [] });
  const out = renderToStaticMarkup(createElement(AgentSuggestions, { listId: "L", options, active: 1, query: "ece", onRun: vi.fn(), onFill: vi.fn(), onRemove: vi.fn(), onHover: vi.fn(), onClear: vi.fn(), canClear: false }));
  it("listbox + options with ids, one selected, match bold, hint, × only on recent", () => {
    expect(out).toContain('role="listbox"');
    expect(count(out, 'role="option"')).toBe(2);
    expect(out).toContain('id="L-opt-1"');
    expect(count(out, 'aria-selected="true"')).toBe(1);
    expect(out).toContain('<mark class="bg-transparent font-semibold text-foreground">ECE</mark>');
    expect(out).toContain("Batch · 22 students");
    expect(count(out, 'data-testid="suggestion-remove"')).toBe(1);
  });
});

describe("shortcuts, step icons, live region", () => {
  it("Ctrl/⌘+K, Ctrl/⌘+Shift+O, / outside inputs", () => {
    const mod = /Mac/i.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true };
    const div = { tagName: "DIV", isContentEditable: false } as unknown as EventTarget;
    expect(matchShortcut({ key: "k", ...mod }, div)).toBe("open-agent");
    expect(matchShortcut({ key: "O", shiftKey: true, ...mod }, div)).toBe("new-chat");
    expect(matchShortcut({ key: "/" }, div)).toBe("focus-input");
    expect(matchShortcut({ key: "/" }, { tagName: "TEXTAREA" } as unknown as EventTarget)).toBeNull();
    expect(isEditable({ tagName: "INPUT", type: "checkbox" } as unknown as EventTarget)).toBe(false);
  });
  it("icons per tool", () => {
    expect(stepIcon("tool.resolve_entity")).toBe(Search);
    expect(stepIcon("tool.my_scope")).toBe(Users);
    expect(stepIcon("tool.something_new")).toBe(Wrench);
  });
  it("one live region: running step while streaming; fresh error / stop / session expiry after", async () => {
    const { liveStatus } = await import("./AgentChatPanel");
    const now = 1_000_000;
    const base = { turns: [] as ChatTurn[], status: null, sessionId: null, busy: false, lastUserText: null };
    const asst = (o: Partial<ChatTurn>): ChatTurn => ({ id: "a", role: "assistant", text: "", blocks: [], done: true, at: now - 2000, endedAt: now - 1000, ...o });
    expect(liveStatus({ authExpired: false, chat: { ...base, busy: true, turns: [asst({ done: false, steps: [{ id: "s", key: "tool.my_scope", params: {}, status: "running", startedAt: 0, ms: null }] })] } }, now)).toBe("Aapke batches dekh raha hoon…");
    expect(liveStatus({ authExpired: false, chat: { ...base, turns: [asst({ blocks: [{ kind: "error", id: "e", code: "network", message: "Connection nahi bana", retryText: "q" }] })] } }, now)).toBe("Jawab nahi aa paya: Connection nahi bana");
    expect(liveStatus({ authExpired: false, chat: { ...base, turns: [asst({ stopped: true, endedAt: now - 60_000 })] } }, now)).toBe("");
    expect(liveStatus({ authExpired: true, chat: base }, now)).toMatch(/Session expire/);
  });
});
