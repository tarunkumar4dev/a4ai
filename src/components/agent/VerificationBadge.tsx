import type { VerificationSummary } from "@/lib/agent/events";

/** Always the split line — never a single flat "x/x verified". */
export function verificationLine(ev: VerificationSummary): string {
  return `Objective ${ev.objective_verified}/${ev.objective_total} verified · Rubric ${ev.rubric_checked}/${ev.rubric_total} checked · ${ev.manual_review.length} manual review`;
}

export function VerificationBadge({ ev }: { ev: VerificationSummary }) {
  const clean = ev.objective_verified === ev.objective_total && ev.rubric_checked === ev.rubric_total
    && ev.manual_review.length === 0 && ev.marks_sum_ok && ev.duplicates.length === 0;
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${clean ? "border-green-300 bg-green-50 text-green-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
      <p>{verificationLine(ev)}</p>
      {!ev.marks_sum_ok ? <p className="mt-1 text-red-700">Marks total doesn't match the paper total.</p> : null}
      {ev.duplicates.length > 0 ? <p className="mt-1">Possible duplicates: {ev.duplicates.join(", ")}</p> : null}
      {ev.manual_review.length > 0 ? <p className="mt-1">Check by hand: {ev.manual_review.join(", ")}</p> : null}
    </div>
  );
}
