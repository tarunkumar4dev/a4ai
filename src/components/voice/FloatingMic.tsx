// Floating mic on mobile dashboards (next to "Ask a4ai"): one tap opens the agent sheet and starts listening.
// Hidden on sm+ (the composer mic is there) and when voice is off for this user / institute.
import { useEffect, useState } from "react";
import { Mic } from "lucide-react";
import { voiceConfig } from "@/lib/voice/api";
import { recordingSupported } from "@/lib/voice/ptt";
import { requestVoiceStart } from "@/lib/voice/surface";

export default function FloatingMic({ uid, onOpen }: { uid: string | null; onOpen: () => void }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!uid || !recordingSupported()) { setOn(false); return; }
    const ac = new AbortController();
    voiceConfig(ac.signal).then((c) => setOn(c.enabled)).catch(() => setOn(false));
    return () => ac.abort();
  }, [uid]);
  if (!on) return null;
  return (
    <button type="button" onClick={() => { onOpen(); requestVoiceStart(); }} aria-label="Bol kar poochhiye / Speak your question" title="Bol kar poochhiye"
      data-testid="floating-mic"
      className="fixed bottom-20 right-[9.5rem] z-[105] grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:hidden">
      <Mic aria-hidden="true" className="h-6 w-6" />
    </button>
  );
}
