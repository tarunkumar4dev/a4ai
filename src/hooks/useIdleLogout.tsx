// src/hooks/useIdleLogout.ts
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

type Opts = {
  /** ms of inactivity before logout; default 12 min */
  timeoutMs?: number;
  /** warn user before logout (ms before) */
  warnBeforeMs?: number;
  onWarn?: () => void;
  onLogout?: () => void;
};

export function useIdleLogout({
  timeoutMs = 12 * 60 * 1000, // 12 min
  warnBeforeMs = 60 * 1000,   // 1 min warning
  onWarn,
  onLogout,
}: Opts = {}) {
  const lastActiveRef = useRef<number>(Date.now());
  const warnedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const markActive = () => {
      lastActiveRef.current = Date.now();
      warnedRef.current = false;
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart", "visibilitychange"];
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));

    const tick = async () => {
      const now = Date.now();
      const idleFor = now - lastActiveRef.current;

      if (!warnedRef.current && idleFor >= timeoutMs - warnBeforeMs) {
        warnedRef.current = true;
        onWarn?.();
      }

      if (idleFor >= timeoutMs) {
        try {
          await supabase.auth.signOut();
        } finally {
          onLogout?.();
        }
        return; // stop after logout
      }

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      events.forEach((e) => window.removeEventListener(e, markActive));
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [timeoutMs, warnBeforeMs, onWarn, onLogout]);
}
