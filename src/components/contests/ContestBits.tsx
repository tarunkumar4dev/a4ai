// Small shared pieces of the /contests page. Colours checked for WCAG 2.2 AA (text ≥ 4.5:1 on its background).
import { useCallback, useEffect, useRef } from "react";
import { useServerNow } from "@/lib/serverClock";
import { formatCountdown, phaseAt, type FeedContest, type Phase } from "@/lib/contestLifecycle";
import { cn } from "@/lib/utils";

/** Re-renders the caller only when the phase flips (not every second). */
export function usePhase(c: Pick<FeedContest, "scheduled_at" | "expires_at" | "status">): Phase {
  const select = useCallback((now: number) => phaseAt(c, now), [c.scheduled_at, c.expires_at, c.status]); // eslint-disable-line react-hooks/exhaustive-deps
  return useServerNow(select);
}

/**
 * Calls onChange when the phase flips while mounted (a countdown reached 0: scheduled → live, live → ended), so the
 * page asks the server again. On the phase, not inside Countdown: the flip unmounts the countdown in the same render.
 */
export function useOnPhaseChange(phase: Phase, onChange: () => void) {
  const prev = useRef(phase);
  useEffect(() => {
    if (prev.current === phase) return;
    prev.current = phase;
    onChange();
  }, [phase, onChange]);
}

/** Ticks on the shared clock (one timer for the whole page). */
export function Countdown({ at, className }: { at: number; className?: string }) {
  const select = useCallback((now: number) => Math.max(0, Math.ceil((at - now) / 1000)), [at]);
  const secs = useServerNow(select);
  // role=timer is not announced every second (implicit aria-live off)
  return (
    <span role="timer" className={cn("tabular-nums whitespace-nowrap", className)}>
      {formatCountdown(secs * 1000)}
    </span>
  );
}

type Badge = { label: string; cls: string; dot: string };
// text on tint: #0E6B43 / #1D4F99 / #5D6570 / #14243A all ≥ 5.4:1
const PHASE_BADGE: Record<Phase, Badge> = {
  live: { label: "Live", cls: "bg-[#E7F6EE] text-[#0E6B43]", dot: "bg-[#168B59]" },
  scheduled: { label: "Upcoming", cls: "bg-[#EAF1FB] text-[#1D4F99]", dot: "bg-[#246BCE]" },
  ended: { label: "Ended", cls: "bg-[#F1F2F4] text-[#5D6570]", dot: "bg-[#9CA3AF]" },
  paused: { label: "Paused", cls: "bg-[#F1F2F4] text-[#5D6570]", dot: "bg-[#9CA3AF]" },
};
const DONE: Badge = { label: "Done", cls: "bg-[#EEF0F4] text-[#14243A]", dot: "bg-[#14243A]" };

/** done: the viewer already submitted (shown instead of the contest's phase, which may still be "Live"). */
export function PhasePill({ phase, done, className }: { phase: Phase; done?: boolean; className?: string }) {
  const p = done ? DONE : PHASE_BADGE[phase];
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-[11.5px] font-semibold", p.cls, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", p.dot)} aria-hidden />
      {p.label}
    </span>
  );
}

export { BTN, FOCUS_RING } from "@/components/student/ui";
