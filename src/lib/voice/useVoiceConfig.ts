// GET /agent/voice/config for the mic UI. Fetched when the panel mounts and again:
//   - whenever `kick` changes (the voice dock passes "agent reachable", so a backend that was down at mount and
//     comes back also brings the mic back), and
//   - when the tab gets focus or becomes visible while voice is not on (the backend may have been restarted with
//     voice switched on). Once voice is on, focus does not refetch; the server still enforces the switch per request.
// Without these retries one failed fetch at mount hid the mic until a full page reload.
import { useEffect, useState } from "react";
import type { VoiceConfig } from "@/lib/agent/types";
import { voiceConfig } from "./api";

export function useVoiceConfig(uid: string | null, kick: unknown = null, fetchConfig = voiceConfig): VoiceConfig | null {
  const [config, setConfig] = useState<VoiceConfig | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!uid) { setConfig(null); return; }
    const ac = new AbortController();
    fetchConfig(ac.signal).then((c) => { if (!ac.signal.aborted) setConfig(c); })
      .catch(() => { if (!ac.signal.aborted) setConfig(null); });
    return () => ac.abort();
  }, [uid, kick, tick, fetchConfig]);

  const on = !!config?.enabled;
  useEffect(() => {
    if (!uid || on) return;
    const again = () => { if (document.visibilityState !== "hidden") setTick((n) => n + 1); };
    window.addEventListener("focus", again);
    document.addEventListener("visibilitychange", again);
    return () => { window.removeEventListener("focus", again); document.removeEventListener("visibilitychange", again); };
  }, [uid, on]);

  return config;
}
