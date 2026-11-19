// The "Connecting…" bug: an unreachable agent used to show "Connecting…" forever (loading and error looked the same,
// no timeout, no retry). Now: slow after 8 s, backoff retries, then Failed with Retry; 401 stops at once.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { META_RETRY_DELAYS_MS, META_SLOW_MS, connectionView, nextRetryDelay } from "./connection";
import { setAgentApiForTests, type AgentApi } from "./api";
import { AgentHttpError } from "./client";
import { agentStore } from "./store";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { auth: { onAuthStateChange: vi.fn(), getSession: vi.fn(async () => ({ data: { session: null } })) } },
}));

describe("connection view (pure)", () => {
  it("ready shows nothing; every other state has a view", () => {
    expect(connectionView("ok", false)).toBe("none");
    expect(connectionView("loading", false)).toBe("connecting");
    expect(connectionView("slow", false)).toBe("slow");
    expect(connectionView("reconnecting", false)).toBe("reconnecting");
    expect(connectionView("error", false)).toBe("failed");
    expect(connectionView("ok", true)).toBe("offline");
    expect([0, 1, 2, 3].map(nextRetryDelay)).toEqual([...META_RETRY_DELAYS_MS, null]);
  });
});

describe("store connection machine", () => {
  let calls = 0;
  const api = (impl: () => Promise<unknown>) => ({ meta: () => { calls++; return impl(); } }) as unknown as AgentApi;
  beforeEach(() => { vi.useFakeTimers(); calls = 0; agentStore._reset(); });
  afterEach(() => { agentStore._reset(); setAgentApiForTests(null); vi.useRealTimers(); });

  it("unreachable: reconnecting with backoff, then failed — never stuck on connecting", async () => {
    setAgentApiForTests(api(() => Promise.reject(new TypeError("Failed to fetch"))));
    agentStore.init("u1");
    await vi.advanceTimersByTimeAsync(10);
    expect(agentStore.getState().metaStatus).toBe("reconnecting");
    for (const d of META_RETRY_DELAYS_MS) await vi.advanceTimersByTimeAsync(d + 10);
    expect(agentStore.getState().metaStatus).toBe("error");
    expect(calls).toBe(1 + META_RETRY_DELAYS_MS.length);
  });

  it("a hanging server turns slow after 8 s; Retry starts over", async () => {
    setAgentApiForTests(api(() => new Promise(() => undefined)));
    agentStore.init("u2");
    await vi.advanceTimersByTimeAsync(META_SLOW_MS - 100);
    expect(agentStore.getState().metaStatus).toBe("loading");
    await vi.advanceTimersByTimeAsync(200);
    expect(agentStore.getState().metaStatus).toBe("slow");
    setAgentApiForTests(api(() => Promise.resolve({ role: "teacher", data_source: "demo", features: {}, scope: {} })));
    agentStore.retryMeta();
    await vi.advanceTimersByTimeAsync(10);
    expect(agentStore.getState().metaStatus).toBe("ok");
  });

  it("401 is not retried", async () => {
    setAgentApiForTests(api(() => Promise.reject(new AgentHttpError(401, "no"))));
    agentStore.init("u3");
    await vi.advanceTimersByTimeAsync(10);
    expect(agentStore.getState().metaStatus).toBe("error");
    expect(agentStore.getState().authExpired).toBe(true);
    expect(calls).toBe(1);
  });
});
