// `ui_action` block (contract 1.4). navigate → "<label> khol di" with a button to open it again (replay / if the
// user came back); highlight_confirm → one line pointing at the Approve/Confirm button (voice never approves).
import { ExternalLink, MousePointerClick } from "lucide-react";
import type { UiAction } from "@/lib/agent/types";

export function UiActionCard({ ev, onNavigate }: { ev: UiAction; onNavigate?: (routeKey: string, params: Record<string, string>) => void }) {
  if (ev.action === "highlight_confirm") {
    return (
      <p className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1.5 text-sm text-foreground" data-testid="ui-highlight-confirm">
        <MousePointerClick aria-hidden="true" className="h-4 w-4 text-primary" />Screen par <strong className="font-medium">Confirm</strong> dabaiye — voice se approve nahi hota.
      </p>
    );
  }
  const label = ev.label || ev.route_key || "page";
  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-sm" data-testid="ui-navigate" data-route-key={ev.route_key ?? undefined}>
      <span className="text-foreground">{label} khol di.</span>
      {ev.route_key && onNavigate ? (
        <button type="button" onClick={() => onNavigate(ev.route_key!, ev.params ?? {})}
          className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />Dobara kholo
        </button>
      ) : null}
    </div>
  );
}
