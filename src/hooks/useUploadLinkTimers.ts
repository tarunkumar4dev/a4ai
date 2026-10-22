// src/hooks/useUploadLinkTimers.ts — countdown + online state for the upload-link screens.

import { useEffect, useState } from "react";

/** Ticks every second until `until` (epoch ms); calls onDone once when it reaches 0. */
export function useCountdown(until: number | null, onDone?: () => void): number {
  const [left, setLeft] = useState(() => (until ? Math.max(0, until - Date.now()) : 0));
  useEffect(() => {
    if (!until) { setLeft(0); return; }
    let fired = false;
    const tick = () => {
      const l = Math.max(0, until - Date.now());
      setLeft(l);
      if (l === 0 && !fired) { fired = true; onDone?.(); }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [until]);
  return left;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}
