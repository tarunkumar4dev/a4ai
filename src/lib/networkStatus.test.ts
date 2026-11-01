import { afterEach, describe, expect, it, vi } from "vitest";
import { isSlowConnection, measureQuality } from "./networkStatus";

function setOnline(value: boolean) {
  vi.stubGlobal("navigator", { onLine: value });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("isSlowConnection", () => {
  it("flags 2g, high rtt and very low downlink", () => {
    expect(isSlowConnection({ effectiveType: "slow-2g" })).toBe(true);
    expect(isSlowConnection({ effectiveType: "2g" })).toBe(true);
    expect(isSlowConnection({ effectiveType: "4g", rtt: 1500 })).toBe(true);
    expect(isSlowConnection({ effectiveType: "4g", downlink: 0.1 })).toBe(true);
  });

  it("ignores missing info and Chrome's 0 = no estimate", () => {
    expect(isSlowConnection(null)).toBe(false);
    expect(isSlowConnection({ effectiveType: "4g", rtt: 0, downlink: 0 })).toBe(false);
    expect(isSlowConnection({ effectiveType: "3g", rtt: 300, downlink: 1.5 })).toBe(false);
  });
});

describe("measureQuality", () => {
  it("is offline without probing when the browser says so", async () => {
    setOnline(false);
    const probe = vi.fn();
    expect(await measureQuality(probe)).toBe("offline");
    expect(probe).not.toHaveBeenCalled();
  });

  it("retries one failed probe before calling it offline", async () => {
    vi.useFakeTimers();
    setOnline(true);
    const probe = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(120);
    const result = measureQuality(probe);
    await vi.advanceTimersByTimeAsync(1500);
    expect(await result).toBe("online");

    const dead = vi.fn().mockResolvedValue(null);
    const result2 = measureQuality(dead);
    await vi.advanceTimersByTimeAsync(1500);
    expect(await result2).toBe("offline");
  });

  it("needs two slow probes for slow", async () => {
    setOnline(true);
    expect(await measureQuality(vi.fn().mockResolvedValueOnce(3000).mockResolvedValueOnce(200))).toBe("online");
    expect(await measureQuality(vi.fn().mockResolvedValue(3000))).toBe("slow");
  });
});
