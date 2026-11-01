import { useEffect, useState } from "react";
import { connectionInfo, isSlowConnection, measureQuality, type NetQuality } from "@/lib/networkStatus";

const RECHECK_OFFLINE_MS = 5000;
const RECHECK_SLOW_MS = 20000;
const MIN_GAP_ON_FOCUS_MS = 30000;

function initialQuality(): NetQuality {
  if (typeof navigator === "undefined") return "online";
  if (!navigator.onLine) return "offline";
  return isSlowConnection(connectionInfo()) ? "slow" : "online";
}

/** "online" | "slow" | "offline". Re-checks on its own only while offline or slow, and never in a hidden tab. */
export function useNetworkStatus(): NetQuality {
  const [quality, setQuality] = useState<NetQuality>(initialQuality);

  useEffect(() => {
    let alive = true;
    let running = false;
    let lastCheck = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (q: NetQuality) => {
      clearTimeout(timer);
      if (q === "offline") timer = setTimeout(check, RECHECK_OFFLINE_MS);
      else if (q === "slow") timer = setTimeout(check, RECHECK_SLOW_MS);
    };

    async function check() {
      // a hidden tab waits; visibilitychange checks again when it comes back
      if (running || document.hidden) return;
      running = true;
      lastCheck = Date.now();
      const q = await measureQuality();
      running = false;
      if (!alive) return;
      setQuality(q);
      schedule(q);
    }

    const onOffline = () => {
      setQuality("offline");
      schedule("offline");
    };
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastCheck > MIN_GAP_ON_FOCUS_MS) check();
    };

    window.addEventListener("online", check);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    const conn = connectionInfo();
    conn?.addEventListener("change", check);

    // a page that opens offline / slow keeps re-checking until it recovers
    const start = initialQuality();
    if (start !== "online") schedule(start);

    return () => {
      alive = false;
      clearTimeout(timer);
      window.removeEventListener("online", check);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      conn?.removeEventListener("change", check);
    };
  }, []);

  return quality;
}
