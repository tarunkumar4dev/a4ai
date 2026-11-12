// What the agent may keep on this device: UI prefs only (no message text, answers, feedback, queries).
import { beforeEach, describe, expect, it } from "vitest";
import { _resetPurgeFlag, clearAgentStorage, isSafeId, loadPref, purgeLegacyAgentStorage, savePref, titleFrom } from "./persist";

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); _resetPurgeFlag(); });

describe("persist (prefs only)", () => {
  it("prefs round-trip per user; null removes", () => {
    savePref("u1", "historyCollapsed", "1");
    savePref("u1", "lastSession", "5e55-0001");
    expect(loadPref("u1", "historyCollapsed")).toBe("1");
    expect(loadPref("u2", "historyCollapsed")).toBeNull();
    savePref("u1", "lastSession", null);
    expect(loadPref("u1", "lastSession")).toBeNull();
    expect(Object.keys(localStorage)).toEqual(["a4ai.agent.v3.u1.pref.historyCollapsed"]);
  });

  it("only ids pass as a session id (never text)", () => {
    expect(isSafeId("6b0e1c2d-aaaa-4bbb-8ccc-000000000000")).toBe(true);
    expect(isSafeId("ECE 1 ki attendance")).toBe(false);
    expect(isSafeId("")).toBe(false);
  });

  it("purges what older builds cached (chat text, sign-in draft, mock DB) but keeps v3 prefs and other apps' keys", () => {
    localStorage.setItem("a4ai.agent.v1.u1.index", "{}");
    localStorage.setItem("a4ai.agent.v1.u1.chat.c-1", JSON.stringify({ turns: [{ text: "Rahul ki attendance" }] }));
    localStorage.setItem("a4ai.agent.mock.v2", "{}");
    sessionStorage.setItem("a4ai.agent.pendingDraft", "secret");
    localStorage.setItem("a4ai.auth.token", "keep");
    savePref("u1", "historyCollapsed", "1");
    purgeLegacyAgentStorage();
    expect(Object.keys(localStorage).sort()).toEqual(["a4ai.agent.v3.u1.pref.historyCollapsed", "a4ai.auth.token"]);
    expect(sessionStorage.length).toBe(0);
  });

  it("sign-out / user switch clears every agent key, nothing else", () => {
    savePref("u1", "lastSession", "abc12345");
    savePref("u2", "historyCollapsed", "0");
    localStorage.setItem("a4ai.auth.token", "keep");
    clearAgentStorage();
    expect(Object.keys(localStorage)).toEqual(["a4ai.auth.token"]);
  });

  it("survives a throwing storage", () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException("full", "QuotaExceededError"); };
    try { expect(() => savePref("u1", "historyCollapsed", "1")).not.toThrow(); } finally { Storage.prototype.setItem = orig; }
  });

  it("titles from the first message", () => {
    expect(titleFrom("  Sharma ma'am ki\nattendance ")).toBe("Sharma ma'am ki");
    expect(titleFrom("")).toBe("New chat");
  });
});
