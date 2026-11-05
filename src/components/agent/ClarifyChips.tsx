import { Button } from "@/components/ui/button";
import type { Clarify } from "@/lib/agent/events";

export function ClarifyChips({ ev, onPick, disabled }: { ev: Clarify; onPick: (value: string) => void; disabled?: boolean }) {
  return (
    <div className="space-y-2">
      <p className="text-sm">{ev.question}</p>
      <div className="flex flex-wrap gap-2">
        {ev.chips.map((c) => (
          <Button key={c.value} type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onPick(c.value)}>
            {c.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
