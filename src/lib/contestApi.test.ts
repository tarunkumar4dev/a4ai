import { describe, expect, it, vi } from "vitest";
import { ContestApiError, contestApi, detailMessage, errorFromResponse, formatIst, notStartedTiming, startErrorMessage } from "./contestApi";

const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("backend error text", () => {
  it("reads string, object and 422-list details", () => {
    expect(detailMessage({ detail: "Contest not found" })).toBe("Contest not found");
    expect(detailMessage({ detail: { code: "X", message: "Nope" } })).toBe("Nope");
    expect(detailMessage({ detail: [{ loc: ["body", "duration_minutes"], msg: "must be ≤ 180" }] })).toBe("must be ≤ 180 (duration_minutes)");
    expect(detailMessage({})).toBeNull();
  });
  it("keeps the code and extra fields of an object detail", async () => {
    const e = await errorFromResponse(res(403, { detail: { code: "CONTEST_NOT_STARTED", message: "Not yet", scheduled_at: "2026-10-25T04:30:00Z" } }), "x");
    expect(e).toBeInstanceOf(ContestApiError);
    expect([e.status, e.code, e.message]).toEqual([403, "CONTEST_NOT_STARTED", "Not yet"]);
    expect(startErrorMessage(e)).toBe(`This contest opens on ${formatIst("2026-10-25T04:30:00Z")}. Please come back then.`);
  });
  it("CONTEST_NOT_STARTED, top-level shape: {code, scheduled_at, detail: <string>}", async () => {
    const e = await errorFromResponse(res(403, { code: "CONTEST_NOT_STARTED", scheduled_at: "2026-10-25T04:30:00+00:00", detail: "Contest starts later" }), "x");
    expect([e.status, e.code, e.message]).toEqual([403, "CONTEST_NOT_STARTED", "Contest starts later"]);
    expect(startErrorMessage(e)).toMatch(/^This contest opens on 25 Oct 2026, 10:00 am IST\./i);
  });
  it("top-level scheduled_at wins over detail.scheduled_at; other key names are a fallback", async () => {
    const both = await errorFromResponse(res(403, { code: "CONTEST_NOT_STARTED", scheduled_at: "2026-10-25T04:30:00Z", detail: { scheduled_at: "2026-12-01T00:00:00Z" } }), "x");
    expect(startErrorMessage(both)).toMatch(/25 Oct 2026/);
    const alt = await errorFromResponse(res(403, { detail: { code: "CONTEST_NOT_STARTED", starts_at: "2026-10-25T04:30:00Z" } }), "x");
    expect(startErrorMessage(alt)).toMatch(/25 Oct 2026, 10:00 am IST/i);
    const none = await errorFromResponse(res(403, { code: "CONTEST_NOT_STARTED", detail: "Not yet" }), "x");
    expect(startErrorMessage(none)).toBe("This contest hasn't started yet. Please come back later.");
  });
  it("a timestamp without an offset is UTC", () => {
    expect(formatIst("2026-10-25T04:30:00")).toBe(formatIst("2026-10-25T04:30:00Z"));
    expect(formatIst("2026-10-25 04:30")).toBe(formatIst("2026-10-25T04:30:00Z"));
    expect(formatIst("2026-10-25T10:00:00+05:30")).toBe(formatIst("2026-10-25T04:30:00Z"));
  });
  it("formats in IST", () => {
    expect(formatIst("2026-10-25T04:30:00Z")).toMatch(/25 Oct 2026.*10:00.*IST/i);
  });
  it("falls back to status when the body is not JSON", async () => {
    const e = await errorFromResponse(new Response("oops", { status: 502 }), "Failed to start contest");
    expect(e.message).toBe("Failed to start contest (502)");
    expect(startErrorMessage(e)).toBe("Failed to start contest (502)");
  });
});

describe("not started: when to look again (server time, not the phone clock)", () => {
  const notStarted = (body: Record<string, unknown>) => errorFromResponse(res(403, body), "x");

  it("opens at receivedAt + (scheduled_at − server_now), even if the phone clock is 10 min wrong", async () => {
    const e = await notStarted({ code: "CONTEST_NOT_STARTED", scheduled_at: "2026-10-25T06:06:00Z", server_now: "2026-10-25T06:05:00Z", detail: "Not yet" });
    const phoneNow = Date.parse("2026-10-25T06:15:00Z");          // phone is 10 min fast
    const t = notStartedTiming(e, phoneNow);
    expect(t.opensAt).toBe(phoneNow + 60_000);                    // still 1 minute away
    expect(t.nextCheckMs).toBe(15_000);                           // 15 s poll is sooner
  });
  it("re-checks right after it opens when that is sooner than 15 s", async () => {
    const e = await notStarted({ code: "CONTEST_NOT_STARTED", scheduled_at: "2026-10-25T06:06:00Z", server_now: "2026-10-25T06:05:55Z" });
    expect(notStartedTiming(e, 1_000_000).nextCheckMs).toBe(5_300);
  });
  it("detail-object shape works too; no server_now → only the 15 s poll", async () => {
    const e1 = await notStarted({ detail: { code: "CONTEST_NOT_STARTED", scheduled_at: "2026-10-25T06:06:00Z", server_now: "2026-10-25T06:06:10Z" } });
    expect(notStartedTiming(e1, 0).nextCheckMs).toBe(500);       // already open by the server's clock
    const e2 = await notStarted({ code: "CONTEST_NOT_STARTED", scheduled_at: "2026-10-25T06:06:00Z" });
    expect(notStartedTiming(e2, 0)).toEqual({ opensAt: null, nextCheckMs: 15_000 });
  });
  it("/info is never served from the browser cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, { title: "x" }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      await contestApi.getContestInfo("abc");
      expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
