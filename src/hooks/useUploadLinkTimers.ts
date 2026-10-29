// src/hooks/useUploadLinkTimers.ts — countdown + online state for the upload-link screens.

import { useEffect, useRef, useState } from "react";

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

/**
 * A progress number that moves smoothly toward `target` (requestAnimationFrame, eased) and never goes backwards
 * while `active` — no jumpy percentages when several uploads report at once.
 */
export function useSmoothProgress(target: number, active: boolean): number {
  const [shown, setShown] = useState(0);
  const ref = useRef({ shown: 0, target: 0, raf: 0 });
  useEffect(() => {
    const s = ref.current;
    s.target = active ? Math.max(s.target, target) : target;
    if (!active) { s.shown = target; setShown(target); return; }
    const step = () => {
      const diff = s.target - s.shown;
      s.shown = Math.abs(diff) < 0.3 ? s.target : s.shown + diff * 0.15;
      setShown(s.shown);
      s.raf = s.shown === s.target ? 0 : requestAnimationFrame(step);
    };
    if (!s.raf) s.raf = requestAnimationFrame(step);
  }, [target, active]);
  useEffect(() => () => cancelAnimationFrame(ref.current.raf), []);
  return shown;
}
