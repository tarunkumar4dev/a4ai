import { describe, expect, it } from "vitest";
import { ContestApiError, detailMessage, errorFromResponse, formatIst, startErrorMessage } from "./contestApi";

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
