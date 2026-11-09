import { beforeEach, describe, expect, it } from "vitest";
import { chatReducer, initialChatState, type ChatState } from "./chatState";
import type { AgentEvent } from "./events";
import {
  MAX_CHATS, MAX_CHAT_BYTES, clearUser, loadChat, loadIndex, normalizeLoaded, saveChat, saveIndex, serializeChat, titleFrom, savePendingDraft, takePendingDraft,
} from "./persist";

const ev = (e: Record<string, unknown>, seq = 0) => ({ request_id: "r", seq, ...e }) as unknown as AgentEvent;

function chatWith(n: number, textSize = 10): ChatState {
  let s = initialChatState;
  for (let i = 0; i < n; i++) {
    s = chatReducer(s, { type: "send", text: `q${i}` });
    s = chatReducer(s, { type: "event", ev: ev({ type: "text_delta", text: "x".repeat(textSize) }, i * 2) });
    s = chatReducer(s, { type: "event", ev: ev({ type: "final", session_id: "sess" }, i * 2 + 1) });
  }
  return s;
}

beforeEach(() => localStorage.clear());

describe("persist", () => {
  it("round-trips a chat and restores it settled (never busy)", () => {
    let s = chatWith(2);
    s = chatReducer(s, { type: "send", text: "still streaming" });
    s = chatReducer(s, { type: "event", ev: ev({ type: "thinking_status", key: "tool.attendance_stats", params: { phase: "start" } }, 99) });
    expect(saveChat("u1", "c1", s)).toBe(true);
    const back = loadChat("u1", "c1")!;
    expect(back.busy).toBe(false);
    expect(back.sessionId).toBe("sess");
    expect(back.turns).toHaveLength(6);
    expect(back.turns.every((t) => t.done)).toBe(true);
    expect(back.turns[5].steps?.[0].status).toBe("stopped");
    expect(back.lastUserText).toBe("still streaming");
  });

  it("an approval that was in flight comes back as failed (approve again), never auto-approved", () => {
    let s = chatReducer(initialChatState, { type: "send", text: "final karo" });
    s = chatReducer(s, { type: "event", ev: ev({ type: "pending_approval", approval_id: "a", action: "finalize_test", summary: "s", args_sha256: "h", expires_at: "x" }, 1) });
    const id = s.turns[1].blocks[0].id;
    s = chatReducer(s, { type: "approval", blockId: id, state: "approving" });
    const back = normalizeLoaded(JSON.parse(serializeChat(s)))!;
    expect(back.turns[1].blocks[0]).toMatchObject({ kind: "approval", state: "failed" });
  });

  it("caps turns and bytes (oldest dropped first)", () => {
    const many = JSON.parse(serializeChat(chatWith(40)));
    expect(many.turns.length).toBeLessThanOrEqual(60);
    expect(many.turns[0].role).toBe("user");
    const big = serializeChat(chatWith(20, 30_000));
    expect(big.length).toBeLessThanOrEqual(MAX_CHAT_BYTES);
    expect(JSON.parse(big).turns.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects junk and survives a throwing localStorage", () => {
    expect(normalizeLoaded({ v: 2, turns: [] })).toBeNull();
    expect(normalizeLoaded("nope")).toBeNull();
    localStorage.setItem("a4ai.agent.v1.u1.index", "{broken");
    expect(loadIndex("u1")).toEqual({ chats: [], hidden: [], activeKey: null });
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException("full", "QuotaExceededError"); };
    try { expect(saveChat("u1", "c1", chatWith(1))).toBe(false); } finally { Storage.prototype.setItem = orig; }
  });

  it("index keeps the newest MAX_CHATS and deletes the rest", () => {
    const chats = Array.from({ length: MAX_CHATS + 3 }, (_, i) => ({ key: `c${i}`, sessionId: null, title: `t${i}`, createdAt: i, updatedAt: i }));
    chats.forEach((c) => saveChat("u1", c.key, chatWith(1)));
    const idx = saveIndex("u1", { chats, hidden: [], activeKey: null });
    expect(idx.chats).toHaveLength(MAX_CHATS);
    expect(loadChat("u1", "c0")).toBeNull();
    expect(loadChat("u1", `c${MAX_CHATS + 2}`)).not.toBeNull();
  });

  it("clearUser removes only that user's keys", () => {
    saveChat("u1", "c1", chatWith(1));
    saveChat("u2", "c1", chatWith(1));
    clearUser("u1");
    expect(loadChat("u1", "c1")).toBeNull();
    expect(loadChat("u2", "c1")).not.toBeNull();
  });

  it("titles from the first message", () => {
    expect(titleFrom("  Sharma ma'am ki\nattendance ")).toBe("Sharma ma'am ki");
    expect(titleFrom("x".repeat(80))).toHaveLength(58);
    expect(titleFrom("")).toBe("New chat");
  });
});

describe("pending draft (sign in again)", () => {
  it("is kept once in sessionStorage and read back once", () => {
    savePendingDraft("ECE-2 ki attendance");
    expect(takePendingDraft()).toBe("ECE-2 ki attendance");
    expect(takePendingDraft()).toBeNull();
    savePendingDraft("   ");
    expect(takePendingDraft()).toBeNull();
  });
});
