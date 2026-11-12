// The small "?" popover in the agent header that lists the keyboard shortcuts (./shortcuts).
import { Keyboard } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SHORTCUTS } from "./shortcuts";

export function ShortcutsHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Keyboard shortcuts" title="Keyboard shortcuts" data-testid="shortcuts-help"
          className="hidden h-11 w-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid">
          <Keyboard aria-hidden="true" className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="z-[240] w-80 p-0">
        <p className="border-b border-border px-4 py-2.5 text-sm font-semibold">Keyboard shortcuts</p>
        <dl className="divide-y divide-border text-sm">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between gap-3 px-4 py-2">
              <dt className="text-muted-foreground">{s.label}</dt>
              <dd className="shrink-0"><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[11px] font-medium text-foreground">{s.keys}</kbd></dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
