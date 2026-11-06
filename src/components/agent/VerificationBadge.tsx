// verification_summary → "Objective x/y · Rubric x/y · Manual review n" + a Details popover listing the question
// ids to check by hand / that failed. NEVER one flat "N/N verified": objective answers are machine-checked,
// long answers only get a rubric check, and the split has to stay visible.
import { AlertTriangle, ShieldCheck, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { VerificationSummary } from "@/lib/agent/events";

/** Always the split line. Pure — exported for tests. */
export function verificationLine(ev: VerificationSummary): string {
  return `Objective ${ev.objective_verified}/${ev.objective_total} · Rubric ${ev.rubric_checked}/${ev.rubric_total} · Manual review ${ev.manual_review.length}`;
}

export function isClean(ev: VerificationSummary): boolean {
  return ev.objective_verified === ev.objective_total && ev.rubric_checked === ev.rubric_total
    && ev.manual_review.length === 0 && ev.marks_sum_ok && ev.duplicates.length === 0;
}

function IdList({ title, ids }: { title: string; ids: string[] }) {
  if (!ids.length) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="mt-1 flex flex-wrap gap-1">
        {ids.map((id) => <li key={id} className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">{id}</li>)}
      </ul>
    </div>
  );
}

export function VerificationBadge({ ev, failedIds = [] }: { ev: VerificationSummary; failedIds?: string[] }) {
  const clean = isClean(ev);
  const hasDetails = ev.manual_review.length > 0 || failedIds.length > 0 || ev.duplicates.length > 0 || !ev.marks_sum_ok;
  const tone = clean
    ? "border-emerald-600/30 bg-emerald-50 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-200"
    : "border-amber-600/30 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-200";
  const Icon = clean ? ShieldCheck : AlertTriangle;

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-4 py-3 text-sm ${tone}`} data-testid="verification">
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1 font-medium tabular-nums">{verificationLine(ev)}</p>
      {ev.rounds ? <span className="text-xs opacity-80">{ev.rounds} round{ev.rounds === 1 ? "" : "s"}</span> : null}
      {hasDetails ? (
        <Popover>
          <PopoverTrigger className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border bg-background/80 px-2.5 text-xs font-medium text-foreground hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Details<ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
          </PopoverTrigger>
          <PopoverContent align="end" className="z-[240] w-72 space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">Objective sawaal machine se check hue; long answers sirf rubric se. Ye dekh lijiye:</p>
            <IdList title="Manual review" ids={ev.manual_review} />
            <IdList title="Check fail hua" ids={failedIds} />
            <IdList title="Duplicate ho sakte hain" ids={ev.duplicates} />
            {!ev.marks_sum_ok ? <p className="text-xs font-medium text-destructive dark:text-red-400">Marks ka total paper total se match nahi karta.</p> : null}
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
