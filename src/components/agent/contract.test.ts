// Contract test: every event variant of contract 1.3 (RAG-BACKEND docs/agent_openapi_v2.json, snapshot in
// src/lib/agent/contract/) has a typed fixture, survives the wire parser unchanged, goes through the reducer, and
// renders. A new event type in the backend fails here (and at compile time in fixtures.ts / chatState.eventToBlock).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CONTRACT_FIXTURES, FILE_FIXTURE, RANKING_TABLE, SCOPE_TABLE } from "@/lib/agent/contract/fixtures";
import { chatReducer, eventToBlock, initialChatState } from "@/lib/agent/chatState";
import { EVENT_TYPES, decodeSseData, parseAgentEvent } from "@/lib/agent/events";
import type { AgentEvent } from "@/lib/agent/types";
import { AgentEventBlock, type BlockHandlers } from "./AgentEventBlock";
import { AgentMessage } from "./AgentMessage";

vi.mock("./lazyBlocks", async () => ({
  LazyChart: (await import("./AgentChart")).AgentChart,
  LazyPaper: (await import("./PaperPreview")).PaperPreview,
}));

const h: BlockHandlers = { busy: false, onAnswer: vi.fn(), onApprove: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn(), onDownload: vi.fn(), onSend: vi.fn(), onPrefill: vi.fn(), onDownloadFile: vi.fn() };

const spec: unknown = JSON.parse(readFileSync(resolve(process.cwd(), "src/lib/agent/contract/agent_openapi_v2.json"), "utf8"));
type Ref = { $ref: string };
const schemas = (spec as { components: { schemas: Record<string, { properties?: Record<string, { const?: string; default?: string }> }> } }).components.schemas;
const eventRefs = ((spec as { components: { schemas: { MessageItem: { properties: { events: { anyOf: { items?: { oneOf: Ref[] } }[] } } } } } })
  .components.schemas.MessageItem.properties.events.anyOf.find((x) => x.items)!.items!.oneOf).map((r) => r.$ref.split("/").pop()!);
const typeOf = (name: string) => { const t = schemas[name].properties?.type; return t?.const ?? t?.default ?? null; };

describe("contract 1.3 ↔ UI", () => {
  it("the snapshot lists 14 event schemas (file is now in the contract) and every one has a fixture", () => {
    const types = eventRefs.map(typeOf);
    expect(types).not.toContain(null);
    expect([...types].sort()).toEqual(Object.keys(CONTRACT_FIXTURES).sort());
    expect(types).toHaveLength(14);
    expect([...EVENT_TYPES].sort()).toEqual([...types].sort());
  });

  it("every fixture survives SSE decoding unchanged (no field dropped or renamed)", () => {
    for (const ev of [...Object.values(CONTRACT_FIXTURES), SCOPE_TABLE, RANKING_TABLE, FILE_FIXTURE] as AgentEvent[]) {
      expect(decodeSseData(JSON.stringify(ev)), ev.type).toEqual(ev);
      expect(parseAgentEvent(ev), ev.type).toEqual(ev);
    }
  });

  it("every event maps to a block or to state, and every block renders", () => {
    const blockless = new Set(["session", "thinking_status", "final"]);
    for (const ev of [...Object.values(CONTRACT_FIXTURES), SCOPE_TABLE, RANKING_TABLE, FILE_FIXTURE] as AgentEvent[]) {
      const block = eventToBlock(ev, "retry me");
      if (blockless.has(ev.type)) { expect(block, ev.type).toBeNull(); continue; }
      expect(block, ev.type).not.toBeNull();
      const html = renderToStaticMarkup(createElement(AgentEventBlock, { block: block!, h }));
      expect(html.length, ev.type).toBeGreaterThan(40);
    }
  });

  it("special tables get their own views; a full stream renders as one message", () => {
    const scope = renderToStaticMarkup(createElement(AgentEventBlock, { block: eventToBlock(SCOPE_TABLE)!, h }));
    expect(scope).toContain('data-testid="scope-card"');
    expect(scope).toContain("3 batches · 59 students");
    const rank = renderToStaticMarkup(createElement(AgentEventBlock, { block: eventToBlock(RANKING_TABLE)!, h }));
    expect(rank).toContain('data-testid="ranking-table"');
    let s = chatReducer(initialChatState, { type: "send", text: "ECE 1 ki attendance" });
    for (const ev of Object.values(CONTRACT_FIXTURES) as AgentEvent[]) s = chatReducer(s, { type: "event", ev });
    expect(s.sessionId).toBe(CONTRACT_FIXTURES.session.session_id);
    expect(s.busy).toBe(false);
    const html = renderToStaticMarkup(createElement(AgentMessage, { turn: s.turns[1], h, ctx: new Map(), onFeedback: vi.fn() }));
    for (const id of ["stat-card", "agent-chart", "data-table", "clarify", "blueprint", "paper-preview", "verification", "approval", "agent-error"]) {
      expect(html, id).toContain(`data-testid="${id}"`);
    }
  });
});
