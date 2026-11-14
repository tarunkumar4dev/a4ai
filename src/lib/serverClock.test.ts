// Shared countdown clock: one timer for any number of countdowns, server-corrected, paused while hidden.
import React, { useCallback } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _listenerCount, _resetServerClock, _timerRunning, serverNow, syncServerClock, useServerNow,
} from "./serverClock";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let renders = 0;
function Secs({ at }: { at: number }) {
  const s = useServerNow(useCallback((n: number) => Math.max(0, Math.ceil((at - n) / 1000)), [at]));
  return React.createElement("span", null, String(s));
}
function Phase({ at }: { at: number }) {
  renders++;
  const p = useServerNow(useCallback((n: number) => (n < at ? "before" : "after"), [at]));
  return React.createElement("b", null, p);
}

let host: HTMLDivElement;
let root: Root;
let hidden = false;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00.000Z"));
  _resetServerClock();
  renders = 0;
  hidden = false;
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hidden ? "hidden" : "visible") });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("serverClock", () => {
  it("applies the server offset from the middle of the round trip", () => {
    const sent = Date.now();
    vi.advanceTimersByTime(400); // 400 ms round trip
    // server says 10:05:00.200 at the midpoint (device 10:00:00.200) → +5 min
    syncServerClock("2026-11-01T10:05:00.200Z", sent);
    expect(serverNow() - Date.now()).toBe(300_000);
  });

  it("ignores a missing or broken server time", () => {
    syncServerClock(null, Date.now());
    syncServerClock("not a date", Date.now());
    expect(serverNow()).toBe(Date.now());
  });

  it("many countdowns share ONE timer and tick together", () => {
    const at = Date.now() + 5000;
    act(() => root.render(React.createElement("div", null,
      ...Array.from({ length: 50 }, (_, i) => React.createElement(Secs, { key: i, at })))));
    expect(_listenerCount()).toBe(50);
    expect(vi.getTimerCount()).toBe(1);
    expect(host.textContent).toBe("5".repeat(50));
    act(() => { vi.advanceTimersByTime(1010); });
    expect(host.textContent).toBe("4".repeat(50));
    act(() => root.render(React.createElement("div")));
    expect(_listenerCount()).toBe(0);
    expect(_timerRunning()).toBe(false);
  });

  it("a phase selector re-renders only when the phase flips, not every second", () => {
    const at = Date.now() + 3000;
    act(() => root.render(React.createElement(Phase, { at })));
    const start = renders;
    act(() => { vi.advanceTimersByTime(2010); });
    expect(renders).toBe(start);
    expect(host.textContent).toBe("before");
    act(() => { vi.advanceTimersByTime(1000); });
    expect(host.textContent).toBe("after");
    expect(renders).toBe(start + 1);
  });

  it("stops while the tab is hidden and jumps to the right time when it comes back", () => {
    const at = Date.now() + 60_000;
    act(() => root.render(React.createElement(Secs, { at })));
    expect(host.textContent).toBe("60");
    hidden = true;
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(_timerRunning()).toBe(false);
    vi.setSystemTime(Date.now() + 30_000); // 30 s in the background, no ticks
    expect(host.textContent).toBe("60");
    hidden = false;
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(host.textContent).toBe("30");
    expect(_timerRunning()).toBe(true);
  });

  it("a new server time moves every countdown at once (data refresh)", () => {
    const at = Date.now() + 60_000;
    act(() => root.render(React.createElement(Secs, { at })));
    act(() => syncServerClock(new Date(Date.now() + 20_000).toISOString(), Date.now()));
    expect(host.textContent).toBe("40");
  });
});
