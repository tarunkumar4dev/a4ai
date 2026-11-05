import { Card, CardContent } from "@/components/ui/card";
import type { StatCard as StatCardEvent } from "@/lib/agent/events";

export function StatCard({ ev }: { ev: StatCardEvent }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{ev.title}</p>
        <p className="mt-1 text-2xl font-semibold">
          {ev.value ?? "—"}
          {ev.value != null && ev.unit ? <span className="ml-1 text-sm font-normal text-muted-foreground">{ev.unit}</span> : null}
        </p>
        {ev.subtitle ? <p className="mt-1 text-xs text-muted-foreground">{ev.subtitle}</p> : null}
      </CardContent>
    </Card>
  );
}
