// clarify → question + up to 5 chips (<button>s, 44px tall). After a pick, the chosen chip stays marked.
import { Check, HelpCircle } from "lucide-react";
import type { Clarify } from "@/lib/agent/events";

export function ClarifyChips({ ev, answered, disabled, onPick }: {
  ev: Clarify; answered: string | null; disabled?: boolean; onPick: (value: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-card-foreground" data-testid="clarify">
      <p className="flex items-start gap-2 text-sm font-medium">
        <HelpCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{ev.question}
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={ev.question}>
        {ev.chips.map((c) => {
          const picked = answered === c.value;
          return (
            <button key={c.value} type="button" aria-pressed={picked} disabled={answered !== null || disabled}
              onClick={() => onPick(c.value)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-background px-4 text-sm text-foreground hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60 aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary aria-pressed:opacity-100">
              {picked ? <Check aria-hidden="true" className="h-4 w-4" /> : null}{c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
