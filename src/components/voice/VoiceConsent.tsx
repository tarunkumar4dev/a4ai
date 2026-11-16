// First mic use: one line (Hindi + English) on what happens to the audio, "Theek hai", and three example phrases.
// The acceptance timestamp is kept in the per-user voice prefs on this device (lib/voice/prefs.ts).
import { Mic } from "lucide-react";

export const EXAMPLES = [
  "10A ki aaj ki attendance kya hai?",
  "Sharma ma'am ki is mahine ki attendance",
  "Attendance page kholo",
];

export function VoiceConsent({ onAccept, onExample }: { onAccept: () => void; onExample: (text: string) => void }) {
  return (
    <div className="mb-2 rounded-lg border border-primary/40 bg-primary/5 p-3" role="region" aria-label="Voice ke baare mein" data-testid="voice-consent">
      <p className="flex items-start gap-2 text-sm text-foreground">
        <Mic aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          Aapki awaaz sirf likhne (transcription) ke liye bheji jaati hai, kahin save nahi hoti.
          <span className="block text-muted-foreground">Your voice is sent only to be turned into text; the audio is not stored.</span>
        </span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onAccept} data-testid="voice-consent-ok"
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          Theek hai
        </button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Aise poochh sakte hain:</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {EXAMPLES.map((t) => (
          <button key={t} type="button" onClick={() => onExample(t)} data-testid="voice-example"
            className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-3.5 text-sm text-foreground hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
