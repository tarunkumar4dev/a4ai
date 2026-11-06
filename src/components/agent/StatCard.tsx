// stat_card → StatCard; consecutive stat_cards → StatGrid (one shared source footer when they agree).
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { StatCard as StatCardEvent } from "@/lib/agent/events";
import { dash } from "./format";
import { SourceFooter } from "./SourceFooter";

function DeltaLine({ delta }: { delta: string }) {
  const sign = delta.trim()[0];
  const Icon = sign === "+" ? ArrowUpRight : sign === "-" || sign === "−" ? ArrowDownRight : Minus;
  return (
    <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
      <Icon aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />{delta}
    </p>
  );
}

export function StatCard({ ev, footer = true }: { ev: StatCardEvent; footer?: boolean }) {
  const hasValue = ev.value !== null && ev.value !== undefined && String(ev.value).trim() !== "";
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-border bg-card p-4 text-card-foreground" data-testid="stat-card">
      <p className="text-xs font-medium text-muted-foreground">{ev.title}</p>
      <p className="mt-1.5 flex items-baseline gap-1 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
        {dash(ev.value)}
        {hasValue && ev.unit ? <span className="text-base font-medium text-muted-foreground">{ev.unit}</span> : null}
      </p>
      {ev.period ? <p className="mt-0.5 text-xs text-muted-foreground">{ev.period}</p> : null}
      {ev.delta ? <div><DeltaLine delta={ev.delta} /></div> : null}
      {ev.subtitle ? <p className="mt-2 text-sm text-muted-foreground">{ev.subtitle}</p> : null}
      {footer ? <><span className="min-h-3 flex-1" /><SourceFooter source={ev.source} asOf={ev.as_of} className="border-t border-border pt-2" /></> : null}
    </div>
  );
}

export function StatGrid({ cards }: { cards: StatCardEvent[] }) {
  if (cards.length === 1) return <StatCard ev={cards[0]} />;
  const shared = cards.every((c) => c.source === cards[0].source && c.as_of === cards[0].as_of);
  return (
    <div className="space-y-2" data-testid="stat-grid">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 [@container(min-width:40rem)]:grid-cols-3">
        {cards.map((c, i) => (
          <div key={`${c.request_id}-${c.seq}-${i}`} className={`flex min-w-0 [&>*]:flex-1 ${i === 0 && cards.length % 2 === 1 ? "col-span-2 [@container(min-width:40rem)]:col-span-1" : ""}`}>
            <StatCard ev={c} footer={!shared} />
          </div>
        ))}
      </div>
      {shared ? <SourceFooter source={cards[0].source} asOf={cards[0].as_of} className="px-1" /> : null}
    </div>
  );
}
