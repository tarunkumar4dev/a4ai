// Voice dock: the transcript strip, consent, settings (above the composer) and the mic button (beside the
// composer input). The mic is rendered in a separate container so the parent can lay it beside the text box.
import { useEffect, useState } from "react";
import { Check, Mic, MicOff, Pencil, RefreshCw, Settings2, Volume2, VolumeX, WifiOff } from "lucide-react";
import { useVoice } from "@/lib/voice/useVoice";
import { STATE_LABEL } from "@/lib/voice/ptt";
import { MicButton } from "./MicButton";
import { VoiceConsent } from "./VoiceConsent";
import { VoiceSettings } from "./VoiceSettings";

const btn = "inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const primary = "inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function Countdown({ sendAt, onEdit, onSend }: { sendAt: number; onEdit: () => void; onSend: () => void }) {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 100); return () => clearInterval(id); }, []);
  const left = Math.max(0, sendAt - Date.now());
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{left > 0 ? "Bhej raha hoon…" : "Bhej diya"}</span>
      <button type="button" className={btn} onClick={onEdit} data-testid="voice-edit"><Pencil aria-hidden="true" className="h-4 w-4" />Edit</button>
      <button type="button" className={primary} onClick={onSend} data-testid="voice-send-now"><Check aria-hidden="true" className="h-4 w-4" />Bhejo</button>
    </div>
  );
}

export default function VoiceDock({ uid, compact, offline }: { uid: string | null; compact?: boolean; offline?: boolean }) {
  const v = useVoice(uid);
  const [settings, setSettings] = useState(false);
  if (!v.config?.enabled) return null;
  const s = v.session;
  const label = STATE_LABEL[s.state];

  const strip = (() => {
    if (!v.supported) return <p className="text-sm text-foreground"><MicOff aria-hidden="true" className="mr-1 inline h-4 w-4" />Is browser mein mic nahi chalta. Chrome ya Safari use karein, ya likh kar poochhiye.</p>;
    const n = s.notice;
    if (n?.kind === "denied") return <p className="text-sm text-foreground"><MicOff aria-hidden="true" className="mr-1 inline h-4 w-4" />Mic ki permission nahi mili. Browser settings mein mic allow karein, ya likh kar poochhiye.</p>;
    if (n?.kind === "unsupported") return <p className="text-sm text-foreground">Is browser mein recording nahi ho sakti. Likh kar poochhiye.</p>;
    if (n?.kind === "repeat") return <p className="text-sm font-medium text-foreground">Dobara boliye. <span className="font-normal text-muted-foreground">Mic ke paas, thoda dheere.</span></p>;
    if (n?.kind === "limit") return <p className="text-sm text-foreground">{n.message}</p>;
    if (n?.kind === "down") return <p className="text-sm text-foreground">{n.message}</p>;
    if (n?.kind === "network") return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-foreground"><WifiOff aria-hidden="true" className="mr-1 inline h-4 w-4" />Connection toot gaya. {n.text ? <q className="text-muted-foreground">{n.text}</q> : null}</span>
        {n.text ? <button type="button" className={primary} onClick={v.retry}><RefreshCw aria-hidden="true" className="h-4 w-4" />Dobara bhejo</button> : null}
        <button type="button" className={btn} onClick={v.typeInstead}><Pencil aria-hidden="true" className="h-4 w-4" />Likh kar poochhein</button>
      </div>
    );
    if (n?.kind === "confirm") return (
      <div className="space-y-2">
        <p className="text-sm text-foreground">Maine suna: <q className="font-medium">{n.text}</q> — Sahi hai?</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primary} onClick={v.confirmSend} data-testid="voice-confirm"><Check aria-hidden="true" className="h-4 w-4" />Haan, sahi hai</button>
          <button type="button" className={btn} onClick={v.edit}><Pencil aria-hidden="true" className="h-4 w-4" />Edit</button>
          <button type="button" className={btn} onClick={v.tap}><Mic aria-hidden="true" className="h-4 w-4" />Dobara bolo</button>
        </div>
      </div>
    );
    if (n?.kind === "pick") return (
      <div className="space-y-2">
        <p className="text-sm text-foreground"><q>{n.text}</q> — {n.question}</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label={n.question}>
          {n.chips.map((c) => (
            <button key={c.value} type="button" onClick={() => v.pick(c.value)} className={`${btn} ${c.hint ? "flex-col items-start gap-0 py-1.5 text-left" : ""}`}>
              <span>{c.label}</span>{c.hint ? <span className="text-xs font-normal text-muted-foreground">{c.hint}</span> : null}
            </button>
          ))}
          <button type="button" className={btn} onClick={v.edit}><Pencil aria-hidden="true" className="h-4 w-4" />Edit</button>
        </div>
      </div>
    );
    if (n?.kind === "auto") return (
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground" data-testid="voice-transcript">{n.text}</p>
        <Countdown sendAt={n.sendAt} onEdit={v.edit} onSend={v.confirmSend} />
      </div>
    );
    if (s.state === "speaking" && v.speech) return <p className="text-sm text-foreground"><Volume2 aria-hidden="true" className="mr-1 inline h-4 w-4 text-primary" />{v.speech}</p>;
    return null; // plain state text lives in the mic row below (one place, not two)
  })();

  return (
    <div className={`mx-auto max-w-3xl ${compact ? "px-3" : "px-3 sm:px-6"}`} data-testid="voice-dock" data-voice-state={s.state}>
      {v.needsConsent ? <VoiceConsent onAccept={v.acceptConsent} onExample={(t) => { v.acceptConsent(); void Promise.resolve().then(() => v.pick(t)); }} /> : null}
      {strip ? <div className="mb-2 rounded-lg border border-border bg-muted/40 px-3 py-2">{strip}</div> : null}
      {/* the ONE aria-live region of the voice layer: transcript, prompts, and the caption of what is being read out */}
      <p aria-live="polite" aria-atomic="true" className="sr-only" data-testid="voice-live">{v.liveText}</p>
      {settings && v.config ? <VoiceSettings config={v.config} prefs={v.prefs} onChange={v.setPrefs} onClose={() => setSettings(false)} /> : null}
      {/* one compact row: state text · mute · settings · mic (right edge = thumb side, 56 px) */}
      <div className="mb-2 flex items-center gap-1" data-testid="voice-mic-slot">
        <p className={`min-w-0 flex-1 truncate text-sm font-medium ${s.state === "listening" ? "text-destructive dark:text-red-400" : "text-muted-foreground"}`} data-testid="voice-state-label">
          {label.hi}
        </p>
        <button type="button" onClick={() => v.setPrefs({ muted: !v.prefs.muted })} aria-pressed={v.prefs.muted}
          aria-label={v.prefs.muted ? "Awaaz on karein / Unmute replies" : "Awaaz band karein / Mute replies"} title={v.prefs.muted ? "Awaaz on" : "Awaaz band"}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-lg text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="voice-mute">
          {v.prefs.muted ? <VolumeX aria-hidden="true" className="h-5 w-5" /> : <Volume2 aria-hidden="true" className="h-5 w-5" />}
        </button>
        <button type="button" onClick={() => setSettings((x) => !x)} aria-expanded={settings} aria-label="Awaaz ki settings / Voice settings" title="Voice settings"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-lg text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="voice-settings-toggle">
          <Settings2 aria-hidden="true" className="h-5 w-5" />
        </button>
        <MicButton state={s.state} level={s.level} meter={!v.lite} className="ml-1"
          disabled={offline || (v.busy && s.state === "idle") || v.needsConsent}
          onTap={v.tap} onHoldStart={v.holdStart} onHoldEnd={v.holdEnd} />
      </div>
    </div>
  );
}
