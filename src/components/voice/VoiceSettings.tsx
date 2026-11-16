// Voice settings: speaker (female / male from the server catalog) and speed 0.9 / 1.0 / 1.1. Stored per user on
// this device. Radio groups, ≥ 44 px rows, plain words.
import { X } from "lucide-react";
import type { VoiceConfig } from "@/lib/agent/types";
import { PACES, type VoicePrefs } from "@/lib/voice/prefs";

const PACE_LABEL: Record<string, string> = { "0.9": "Dheere", "1": "Normal", "1.1": "Tez" };

export function VoiceSettings({ config, prefs, onChange, onClose }: {
  config: VoiceConfig; prefs: VoicePrefs; onChange: (p: Partial<VoicePrefs>) => void; onClose: () => void;
}) {
  const speaker = prefs.speaker ?? config.default_speaker;
  return (
    <div className="mb-2 rounded-lg border border-border bg-card p-3" role="group" aria-label="Awaaz ki settings" data-testid="voice-settings">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Awaaz ki settings</p>
        <button type="button" onClick={onClose} aria-label="Band karein / Close" className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <fieldset className="mt-2">
        <legend className="text-xs text-muted-foreground">Kaun si awaaz</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {config.speakers.map((sp) => (
            <label key={sp.id} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${speaker === sp.id ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:bg-muted"}`}>
              <input type="radio" name="voice-speaker" value={sp.id} checked={speaker === sp.id} onChange={() => onChange({ speaker: sp.id })} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              {sp.label} <span className="text-xs text-muted-foreground">({sp.gender === "female" ? "mahila" : "purush"})</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-3">
        <legend className="text-xs text-muted-foreground">Kitni tez bole</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {PACES.map((p) => (
            <label key={p} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${prefs.pace === p ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:bg-muted"}`}>
              <input type="radio" name="voice-pace" value={p} checked={prefs.pace === p} onChange={() => onChange({ pace: p })} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              {PACE_LABEL[String(p)]} <span className="text-xs text-muted-foreground">{p.toFixed(1)}×</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
