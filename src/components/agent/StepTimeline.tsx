// Activity timeline of one assistant turn, built from thinking_status tool.* / status.* events (chatState.applyStep).
// Running: open list, spinner → check + duration. Done: collapses to "3 steps · 4.2s" (click to expand).
// Not a live region — the single aria-live status line lives in the chat panel.
import { useState } from "react";
import { Check, ChevronRight, Loader2, MinusCircle, XCircle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { fmtMs, stepLabel, stepsSummary, type ChatTurn, type Step } from "@/lib/agent/chatState";

function StepRow({ s }: { s: Step }) {
  const icon = s.status === "running" ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin text-primary" />
    : s.status === "failed" ? <XCircle aria-hidden="true" className="h-3.5 w-3.5 text-destructive dark:text-red-400" />
    : s.status === "stopped" ? <MinusCircle aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
    : <Check aria-hidden="true" className="h-3.5 w-3.5 text-primary" />;
  const state = s.status === "running" ? "chal raha hai" : s.status === "failed" ? "fail hua" : s.status === "stopped" ? "ruk gaya" : "ho gaya";
  return (
    <li className="flex items-center gap-2 py-0.5" data-status={s.status}>
      <span className="grid h-4 w-4 place-items-center">{icon}</span>
      <span className={s.status === "running" ? "text-foreground" : "text-muted-foreground"}>{stepLabel(s.key, s.params)}</span>
      <span className="sr-only">({state})</span>
      {s.ms !== null && s.status !== "running" ? <span className="ml-auto pl-2 tabular-nums text-muted-foreground/80">{fmtMs(s.ms)}</span> : null}
    </li>
  );
}

export function StepTimeline({ turn }: { turn: ChatTurn }) {
  const steps = turn.steps ?? [];
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;
  const list = <ol className="space-y-0.5 border-l border-border pl-3 text-xs">{steps.map((s) => <StepRow key={s.id} s={s} />)}</ol>;

  if (!turn.done) return <div className="max-w-md" data-testid="steps">{list}</div>;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="max-w-md" data-testid="steps">
      <CollapsibleTrigger className="-ml-1.5 inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronRight aria-hidden="true" className={`h-3.5 w-3.5 ${open ? "rotate-90" : ""}`} />
        {stepsSummary(turn)}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1">{list}</CollapsibleContent>
    </Collapsible>
  );
}
