// src/hooks/useEnsureSessions.ts
// Call generate_daily_sessions RPC once on mount so today's class_sessions exist.
// Usage: const ready = useEnsureSessions(instituteId);
//        if (!ready) return <Loader />;
//        ... then query class_sessions normally

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useEnsureSessions(instituteId: string | null): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!instituteId) return;
    let cancelled = false;

    (async () => {
      try {
        const d = new Date(); // LOCAL date (toISOString() is UTC → wrong day in IST before 5:30am)
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        await supabase.rpc("generate_daily_sessions", {
          p_institute_id: instituteId,
          p_date: today,
        });
      } catch (e) {
        // Non-fatal: if RPC fails, existing sessions (if any) still show
        console.warn("generate_daily_sessions:", e);
      }
      if (!cancelled) setReady(true);
    })();

    return () => { cancelled = true; };
  }, [instituteId]);

  return ready;
}