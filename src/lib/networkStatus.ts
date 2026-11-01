// Connection quality for the banner (src/components/NetworkBanner.tsx).
// Healthy pages send nothing extra: the browser's online/offline events and the Network Information API
// (Chromium + the Android WebView wrapper) are free. A tiny HEAD probe to our own origin only runs to
// confirm a change, and keeps re-checking only while the connection is offline or slow.

export type NetQuality = "online" | "slow" | "offline";

type ConnectionInfo = { effectiveType?: string; rtt?: number; downlink?: number };
type NetworkConnection = ConnectionInfo & EventTarget;

export const SLOW_RTT_MS = 1200; // Network Information API round-trip estimate
export const SLOW_DOWNLINK_MBPS = 0.25;
export const SLOW_PROBE_MS = 2500; // our own probe, best of two

/** Network Information API; null on Safari / Firefox. */
export function connectionInfo(): NetworkConnection | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { connection?: NetworkConnection }).connection ?? null;
}

export function isSlowConnection(c: ConnectionInfo | null | undefined): boolean {
  if (!c) return false;
  if (c.effectiveType === "slow-2g" || c.effectiveType === "2g") return true;
  // Chrome reports 0 when it has no estimate yet
  if (typeof c.rtt === "number" && c.rtt >= SLOW_RTT_MS) return true;
  if (typeof c.downlink === "number" && c.downlink > 0 && c.downlink < SLOW_DOWNLINK_MBPS) return true;
  return false;
}

/** One uncached HEAD of the favicon. Round trip in ms, or null when nothing came back. */
export async function probe(timeoutMs = 8000): Promise<number | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = performance.now();
  try {
    // any HTTP answer, even an error status, means the network works
    await fetch(`/ICON.ico?net=${Date.now()}`, { method: "HEAD", cache: "no-store", signal: ctrl.signal });
    return performance.now() - start;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Probe-backed reading. A single failed or slow probe is retried, so one hiccup doesn't flash the banner. */
export async function measureQuality(probeFn: () => Promise<number | null> = probe): Promise<NetQuality> {
  if (!navigator.onLine) return "offline";
  let ms = await probeFn();
  if (ms === null) {
    await sleep(1500);
    if (!navigator.onLine) return "offline";
    ms = await probeFn();
    if (ms === null) return "offline";
  }
  if (ms >= SLOW_PROBE_MS) {
    const again = await probeFn();
    if (again !== null) ms = Math.min(ms, again);
  }
  return ms >= SLOW_PROBE_MS || isSlowConnection(connectionInfo()) ? "slow" : "online";
}
