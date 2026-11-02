// /contests data layer: partial bodies, error kinds, timeout + abort of superseded requests, server clock sync.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls: { fn: string; args: Record<string, unknown>; signal: AbortSignal | null }[] = [];
let respond: (fn: string, signal: AbortSignal) => Promise<{ data: unknown; error: unknown; status: number }>;
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => ({
      abortSignal: (signal: AbortSignal) => {
        calls.push({ fn, args, signal });
        return respond(fn, signal);
      },
    }),
  },
}));

import { classifyError, fetchFeedPage, FeedError, parseFeedPage, registerForContest, REQUEST_TIMEOUT_MS } from "./contestFeed";
import { _resetServerClock, serverNow } from "./serverClock";

const ok = (data: unknown) => Promise.resolve({ data, error: null, status: 200 });

beforeEach(() => {
  calls.length = 0;
  _resetServerClock();
});
afterEach(() => vi.useRealTimers());

describe("parseFeedPage", () => {
  it("full body", () => {
    const p = parseFeedPage({
      server_now: "2026-11-01T10:00:00Z", view: "upcoming",
      items: [{ id: "a", short_code: "aaaa1111", title: "A" }, { id: "b" /* no code: skipped */ }],
      next_cursor: { at: "2026-11-02T00:00:00Z", id: "a" },
      counts: { upcoming: 3, past: 1, live: 2 }, subjects: [{ name: "Physics", count: 2 }, { bad: 1 }],
      next: { id: "a", short_code: "aaaa1111" }, scheduled: ["2026-11-03T10:00:00Z", 5],
    });
    expect(p.items.map((c) => c.id)).toEqual(["a"]);
    expect(p.nextCursor).toEqual({ at: "2026-11-02T00:00:00Z", id: "a" });
    expect(p.counts).toEqual({ upcoming: 3, past: 1, live: 2 });
    expect(p.subjects).toEqual([{ name: "Physics", count: 2 }]);
    expect(p.next?.id).toBe("a");
    expect(p.scheduled).toEqual(["2026-11-03T10:00:00Z"]);
  });
  it("partial / empty / garbage body never throws", () => {
    for (const body of [null, undefined, "x", 42, {}, { items: "nope", counts: null, next_cursor: { at: 1 } }]) {
      const p = parseFeedPage(body);
      expect(p.items).toEqual([]);
      expect(p.nextCursor).toBeNull();
      expect(p.counts).toEqual({ upcoming: 0, past: 0, live: 0 });
    }
  });
});

describe("classifyError", () => {
  it("missing RPC (29 not applied)", () => {
    expect((classifyError({ code: "PGRST202", message: "Could not find the function" }, 404, false) as FeedError).kind).toBe("missing");
  });
  it("stale auth", () => {
    expect((classifyError({ code: "PGRST301", message: "JWT expired" }, 401, false) as FeedError).kind).toBe("auth");
    expect((classifyError({ code: "42501", message: "sign in required" }, 400, false) as FeedError).kind).toBe("auth");
  });
  it("timeout wins over the abort it caused; a plain abort stays an AbortError", () => {
    expect((classifyError({ message: "AbortError: aborted" }, 0, true) as FeedError).kind).toBe("timeout");
    expect(classifyError({ message: "AbortError: aborted" }, 0, false).name).toBe("AbortError");
  });
  it("network", () => {
    expect((classifyError({ message: "TypeError: Failed to fetch" }, 0, false) as FeedError).kind).toBe("offline");
  });
  it("anything else → server", () => {
    expect((classifyError({ code: "XX000", message: "boom" }, 500, false) as FeedError).kind).toBe("server");
  });
});

describe("fetchFeedPage", () => {
  it("sends the filters and keyset cursor; syncs the server clock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    respond = () => ok({ server_now: "2026-11-01T10:02:00Z", items: [] });
    await fetchFeedPage({ view: "past", search: "phy", subject: "", cursor: { at: "t", id: "i" } });
    expect(calls[0]).toMatchObject({
      fn: "get_my_contests",
      args: { p_view: "past", p_search: "phy", p_subject: null, p_limit: 20, p_cursor_at: "t", p_cursor_id: "i" },
    });
    expect(serverNow() - Date.now()).toBe(120_000);
  });

  it("times out after 12 s with a 'timeout' error", async () => {
    vi.useFakeTimers();
    respond = (_fn, signal) => new Promise((resolve) => {
      signal.addEventListener("abort", () => resolve({ data: null, error: { message: "AbortError: The operation was aborted." }, status: 0 }));
    });
    const p = fetchFeedPage({ view: "upcoming", search: "", subject: "", cursor: null }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 10);
    const err = await p;
    expect(err).toBeInstanceOf(FeedError);
    expect(err.kind).toBe("timeout");
  });

  it("a superseded request (caller aborts) is cancelled, not reported as an error", async () => {
    respond = (_fn, signal) => new Promise((resolve) => {
      signal.addEventListener("abort", () => resolve({ data: null, error: { message: "AbortError: aborted" }, status: 0 }));
    });
    const ctl = new AbortController();
    const p = fetchFeedPage({ view: "upcoming", search: "ph", subject: "", cursor: null }, ctl.signal).catch((e) => e);
    ctl.abort();
    const err = await p;
    expect(err.name).toBe("AbortError");
    expect(calls[0].signal?.aborted).toBe(true);
  });
});

describe("registerForContest", () => {
  it("returns the server's state; unknown states are treated as not_found", async () => {
    respond = () => ok({ state: "already_registered", contest: { id: "c", short_code: "abcd1234" } });
    expect((await registerForContest("abcd1234")).state).toBe("already_registered");
    respond = () => ok({ state: "surprise" });
    expect((await registerForContest("abcd1234")).state).toBe("not_found");
  });
});
