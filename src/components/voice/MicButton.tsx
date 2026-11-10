// The mic. ≥ 56 px hit target, one-handed at 360 px (sits at the right of the composer / floats bottom-right).
// States: idle · listening (level meter, transform-only) · transcribing · thinking · speaking (tap = stop playback).
// Desktop: hold Space (outside a text box) to talk. Labels in Hindi + English, no technical words.
import { useEffect } from "react";
import { Loader2, Mic, Square, Volume2 } from "lucide-react";
import { SPACE_HOLD_MS, STATE_LABEL, type VoiceState } from "@/lib/voice/ptt";

const isTyping = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || t.getAttribute?.("role") === "combobox");
};

export function LevelMeter({ level }: { level: number }) {
  // 4 bars, scaleY only (no layout, no paint beyond the transform); respects prefers-reduced-motion via no transition
  const bars = [0.55, 1, 0.8, 0.65];
  return (
    <span aria-hidden="true" className="flex h-5 items-end gap-[3px]" data-testid="level-meter">
      {bars.map((k, i) => (
        <span key={i} className="block h-5 w-[3px] origin-bottom rounded-full bg-current motion-safe:transition-transform motion-safe:duration-75"
          style={{ transform: `scaleY(${Math.max(0.15, Math.min(1, level * 6 * k))})` }} />
      ))}
    </span>
  );
}

export function MicButton({ state, level, disabled, onTap, onHoldStart, onHoldEnd, meter = true, size = "md", className = "" }: {
  state: VoiceState; level: number; disabled?: boolean; onTap: () => void; onHoldStart?: () => void; onHoldEnd?: () => void;
  /** false on slow networks: no meter at all */ meter?: boolean; size?: "md" | "lg"; className?: string;
}) {
  // Space to talk (desktop): hold = talk, release = stop. Ignored while typing in a box.
  useEffect(() => {
    if (!onHoldStart || !onHoldEnd) return;
    let downAt = 0;
    let holding = false;
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (disabled) return;
      e.preventDefault();
      downAt = Date.now();
      holding = true;
      onHoldStart();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !holding) return;
      holding = false;
      e.preventDefault();
      if (Date.now() - downAt >= SPACE_HOLD_MS) onHoldEnd(); // a quick press = tap-to-start, keep listening
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [onHoldStart, onHoldEnd, disabled]);

  const label = STATE_LABEL[state];
  const aria = state === "listening" ? "Bolna band karein / Stop listening" : state === "speaking" ? "Awaaz rokein / Stop speaking" : "Bol kar poochhiye / Speak your question";
  const busy = state === "transcribing" || state === "thinking";
  const dim = size === "lg" ? "h-16 w-16" : "h-14 w-14";
  const tone = state === "listening" ? "bg-destructive text-destructive-foreground"
    : state === "speaking" ? "bg-secondary text-secondary-foreground"
    : busy ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90";
  return (
    <button type="button" onClick={onTap} disabled={disabled || busy} aria-label={aria} aria-pressed={state === "listening"}
      title={`${label.hi} · ${label.en}`} data-testid="mic-button" data-state={state}
      className={`grid ${dim} shrink-0 place-items-center rounded-full shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed ${tone} ${className}`}>
      {state === "listening" ? (meter ? <LevelMeter level={level} /> : <Square aria-hidden="true" className="h-5 w-5" fill="currentColor" />)
        : busy ? <Loader2 aria-hidden="true" className="h-6 w-6 motion-safe:animate-spin" />
        : state === "speaking" ? <Volume2 aria-hidden="true" className="h-6 w-6" />
        : <Mic aria-hidden="true" className="h-6 w-6" />}
    </button>
  );
}
