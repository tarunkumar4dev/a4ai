// The mic must come back without a page reload when the voice config was unreachable (or off) at mount.
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VoiceConfig } from "@/lib/agent/types";
import { useVoiceConfig } from "./useVoiceConfig";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const cfg = (enabled: boolean) => ({ enabled, consent_version: "v1" }) as unknown as VoiceConfig;
let seen: (VoiceConfig | null)[] = [];
function Probe({ uid, kick, fetchConfig }: { uid: string | null; kick?: unknown; fetchConfig: (s?: AbortSignal) => Promise<VoiceConfig> }) {
  seen.push(useVoiceConfig(uid, kick, fetchConfig));
  return null;
}
const last = () => seen[seen.length - 1];
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  seen = [];
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe("useVoiceConfig", () => {
  it("a failed fetch at mount is retried when the tab gets focus", async () => {
    const fetchConfig = vi.fn().mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValue(cfg(true));
    act(() => root.render(React.createElement(Probe, { uid: "u1", fetchConfig })));
    await flush();
    expect(last()).toBeNull();
    act(() => { window.dispatchEvent(new Event("focus")); });
    await flush();
    expect(fetchConfig).toHaveBeenCalledTimes(2);
    expect(last()?.enabled).toBe(true);
  });

  it("voice switched on later: visibilitychange refetches; once on, focus does not refetch", async () => {
    const fetchConfig = vi.fn().mockResolvedValueOnce(cfg(false)).mockResolvedValue(cfg(true));
    act(() => root.render(React.createElement(Probe, { uid: "u1", fetchConfig })));
    await flush();
    expect(last()?.enabled).toBe(false);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await flush();
    expect(last()?.enabled).toBe(true);
    act(() => { window.dispatchEvent(new Event("focus")); });
    await flush();
    expect(fetchConfig).toHaveBeenCalledTimes(2);
  });

  it("a changed kick (agent reachable again) refetches; no uid means no fetch", async () => {
    const fetchConfig = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue(cfg(true));
    act(() => root.render(React.createElement(Probe, { uid: "u1", kick: false, fetchConfig })));
    await flush();
    expect(last()).toBeNull();
    act(() => root.render(React.createElement(Probe, { uid: "u1", kick: true, fetchConfig })));
    await flush();
    expect(last()?.enabled).toBe(true);
    const none = vi.fn();
    act(() => root.render(React.createElement(Probe, { uid: null, fetchConfig: none })));
    await flush();
    expect(none).not.toHaveBeenCalled();
    expect(last()).toBeNull();
  });
});
