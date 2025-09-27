// src/hooks/useIdleLogout.ts
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

type Opts = {
  timeoutMs?: number;     // total idle window (default 15 min)
  warnBeforeMs?: number;  // warn X ms before logout
  onWarn?: () => void;
  onLogout?: () => void;
  storageKey?: string;    // localStorage key to persist last activity
};

export function useIdleLogout({
  timeoutMs = 15 * 60 * 1000,
  warnBeforeMs = 60 * 1000,
  onWarn,
  onLogout,
  storageKey = "a4ai:lastActive",
}: Opts = {}) {
  const warnTimer = useRef<number | null>(null);
  const logoutTimer = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const lastActiveRef = useRef<number>(Date.now());
  const warnedRef = useRef(false);

  const clearTimers = () => {
    if (warnTimer.current) window.clearTimeout(warnTimer.current);
    if (logoutTimer.current) window.clearTimeout(logoutTimer.current);
    warnTimer.current = logoutTimer.current = null;
  };

  const doLogout = async () => {
    clearTimers();
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    try {
      await supabase.auth.signOut();
    } finally {
      onLogout?.();
    }
  };

  const scheduleTimers = () => {
    clearTimers();
    const now = Date.now();
    const since = now - lastActiveRef.current;
    const left = Math.max(timeoutMs - since, 0);

    if (left <= 0) {
      void doLogout();
      return;
    }

    // schedule warn
    if (!warnedRef.current) {
      if (left <= warnBeforeMs) {
        warnedRef.current = true;
        onWarn?.();
      } else {
        warnTimer.current = window.setTimeout(() => {
          warnedRef.current = true;
          onWarn?.();
        }, left - warnBeforeMs);
      }
    }

    // schedule logout
    logoutTimer.current = window.setTimeout(() => {
      void doLogout();
    }, left);
  };

  const persist = () => {
    try {
      localStorage.setItem(storageKey, String(lastActiveRef.current));
    } catch {}
  };

  const markActive = () => {
    lastActiveRef.current = Date.now();
    warnedRef.current = false;
    persist();
    scheduleTimers();
  };

  useEffect(() => {
    // bootstrap lastActive from storage if present
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const t = Number(cached);
        if (!Number.isNaN(t)) lastActiveRef.current = t;
      } else {
        persist();
      }
    } catch {}

    // activity listeners
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));

    // visibility handling:
    // when tab becomes visible again, evaluate elapsed time immediately
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        const since = Date.now() - lastActiveRef.current;
        if (since >= timeoutMs) {
          void doLogout();
        } else {
          scheduleTimers();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // low-frequency fallback (handles heavy throttling)
    intervalRef.current = window.setInterval(() => {
      const since = Date.now() - lastActiveRef.current;
      if (since >= timeoutMs) void doLogout();
    }, 30_000); // 30s tick (may throttle in bg; visible check covers remaining)

    scheduleTimers();

    return () => {
      events.forEach((e) => window.removeEventListener(e, markActive));
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimers();
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutMs, warnBeforeMs, storageKey]);
}
