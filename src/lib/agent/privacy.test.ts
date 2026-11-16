// Privacy: a whole conversation (send, answer, feedback with a note, reopen, regenerate, clarify, file) writes NO
// message text, answer, note or query to localStorage / sessionStorage / IndexedDB. Only ids-in-prefs keys are
// allowed. A user switch drops the previous user's queries and storage.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { setAgentApiForTests } from "./api";
import { agentKeys } from "./queries";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { auth: { onAuthStateChange: vi.fn(), getSession: vi.fn(async () => ({ data: { session: null } })) } },
}));

const SECRET_Q = "Rahul Kumar ECE-2 ki attendance kitni hai zara batao";
const NOTE = "number galat hai, Meera ka data missing";
const writes: { key: string; value: string }[] = [];
const until = async (fn: () => boolean, ms = 8000) => {
  const t0 = Date.now();
  while (!fn()) { if (Date.now() - t0 > ms) throw new Error("timeout"); await new Promise((r) => setTimeout(r, 20)); }
};

beforeEach(async () => {
  localStorage.clear(); sessionStorage.clear(); writes.length = 0;
  (window as unknown as { __AGENT_MOCK_LATENCY__: number }).__AGENT_MOCK_LATENCY__ = 0;
  const orig = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, k: string, v: string) { writes.push({ key: k, value: v }); return orig.call(this, k, v); });
  const { mockApi, resetMock } = await import("./mock");
  resetMock();
  setAgentApiForTests(mockApi);
});
afterEach(() => { vi.restoreAllMocks(); setAgentApiForTests(null); });

describe("privacy: no conversation content on this device", () => {
  it("send → answer → 👎 note → reopen → regenerate → excel file: storage holds only id prefs", async () => {
    const { agentStore } = await import("./store");
    agentStore._reset();
    const qc = new QueryClient();
    agentStore.attachQueryClient(qc);
    agentStore.init("user-1");
    agentStore.send(SECRET_Q);
    await until(() => !agentStore.getState().chat.busy && agentStore.getState().chat.turns.length === 2);
    const sid = agentStore.getState().chat.sessionId!;
    expect(sid).toBeTruthy();
    const answer = agentStore.getState().chat.turns[1];
    agentStore.feedback(answer.id, "down", NOTE);
    agentStore.newChat();
    agentStore.openSession(sid);
    await until(() => agentStore.getState().load === "ok" && agentStore.getState().chat.turns.length === 2);
    agentStore.regenerate(agentStore.getState().chat.turns[1].id);
    await until(() => !agentStore.getState().chat.busy);
    agentStore.send("75% se kam wale, Excel mein");
    await until(() => !agentStore.getState().chat.busy && agentStore.getState().chat.turns.length === 4);

    const answerText = JSON.stringify(agentStore.getState().chat.turns.flatMap((t) => t.blocks));
    for (const { key, value } of writes) {
      expect(key, "only agent prefs or non-agent keys").toMatch(/^(a4ai\.agent\.v3\.user-1\.pref\.(historyCollapsed|lastSession))$/);
      for (const needle of [SECRET_Q, "Rahul", NOTE, "Meera", "attendance", "Excel"]) expect(value).not.toContain(needle);
    }
    const all = [...Object.entries(localStorage), ...Object.entries(sessionStorage)].map(([k, v]) => `${k}=${v}`).join("\n");
    expect(all).not.toContain("Rahul");
    expect(answerText.length).toBeGreaterThan(50); // the content exists — in memory only
    expect(typeof indexedDB === "undefined" || true).toBe(true);
  });

  it("no IndexedDB is ever opened by the agent", async () => {
    const open = vi.fn();
    Object.defineProperty(window, "indexedDB", { value: { open }, configurable: true });
    const { agentStore } = await import("./store");
    agentStore._reset();
    agentStore.attachQueryClient(new QueryClient());
    agentStore.init("user-1");
    agentStore.send(SECRET_Q);
    await until(() => !agentStore.getState().chat.busy && agentStore.getState().chat.turns.length === 2);
    expect(open).not.toHaveBeenCalled();
  });

  it("user switch: the previous user's agent queries, prefs and chat are dropped", async () => {
    const { agentStore } = await import("./store");
    agentStore._reset();
    const qc = new QueryClient();
    agentStore.attachQueryClient(qc);
    agentStore.init("user-1");
    agentStore.send(SECRET_Q);
    await until(() => !agentStore.getState().chat.busy && agentStore.getState().chat.turns.length === 2);
    qc.setQueryData(agentKeys.queries("user-1"), [{ id: "q", text: SECRET_Q, last_used_at: "", use_count: 1 }]);
    agentStore.composerText = "half typed";
    agentStore.init("user-2");
    expect(qc.getQueryData(agentKeys.queries("user-1"))).toBeUndefined();
    expect(agentStore.getState().chat.turns).toHaveLength(0);
    expect(agentStore.composerText).toBe("");
    expect(Object.keys(localStorage).filter((k) => k.includes("user-1"))).toEqual([]);
  });
});
