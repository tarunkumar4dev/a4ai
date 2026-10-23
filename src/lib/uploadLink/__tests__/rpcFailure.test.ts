import { afterEach, describe, expect, it, vi } from "vitest";
import { RpcError, anonRpc } from "@/lib/uploadLink/anonRpc";
import { SERVER_ERROR, createSubmission, rpcFailure } from "@/lib/uploadFlow";

afterEach(() => vi.restoreAllMocks());

describe("RPC errors on the student link", () => {
  it("a server error (HTTP 400) shows the generic text and logs status + code, not the server message", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = rpcFailure("create_submission", new RpcError('{"code":"23514","message":"row (secret)"}', 400, "23514"), "offline");
    expect(err.message).toBe(SERVER_ERROR);
    expect(log).toHaveBeenCalledWith("[upload-link] create_submission failed: HTTP 400 code 23514");
    expect(String(log.mock.calls[0][0])).not.toContain("secret");
  });

  it("no response at all keeps the offline text", () => {
    expect(rpcFailure("create_submission", new RpcError("network", 0), "offline").message).toBe("offline");
  });

  it("anonRpc reads the PostgREST code; createSubmission turns it into the generic text", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response('{"code":"23514","message":"violates check constraint"}', { status: 400 }));
    await expect(anonRpc("create_submission", {})).rejects.toMatchObject({ status: 400, code: "23514" });
    await expect(createSubmission("ABC123", "a", "k".repeat(16), [])).rejects.toThrow(SERVER_ERROR);
  });

  it("a network failure on Submit still says it's safe to tap again", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(createSubmission("ABC123", "a", "k".repeat(16), [])).rejects.toThrow(/Tap Submit again/);
  });
});
