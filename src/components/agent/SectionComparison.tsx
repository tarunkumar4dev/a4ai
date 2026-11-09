// section_comparison → a ranking table (rank, section, value, students; ties share a rank, no data ranks last
// as "—") plus the same numbers as a bar chart (the shared lazy recharts chart, nulls are gaps — never 0).
// Tapping a section asks about it.
import { ChevronRight, Trophy } from "lucide-react";
import type { Chart, ComparisonRow, SectionComparison as SectionComparisonEvent } from "@/lib/agent/types";
import { dash, num } from "./format";
import { LazyChart } from "./lazyBlocks";
import { SourceFooter } from "./SourceFooter";

export interface RankedRow extends ComparisonRow { rank: number | null }

/** Best first (higher_is_better default), equal values share a rank (1, 1, 3), no value → rank null, last. Pure. */
export function rankRows(rows: ComparisonRow[], higherIsBetter = true): RankedRow[] {
  const withValue = rows.filter((r) => typeof r.value === "number").sort((a, b) => (higherIsBetter ? b.value! - a.value! : a.value! - b.value!));
  const out: RankedRow[] = [];
  withValue.forEach((r, i) => {
    const prev = out[i - 1];
    out.push({ ...r, rank: prev && prev.value === r.value ? prev.rank : i + 1 });
  });
  return [...out, ...rows.filter((r) => typeof r.value !== "number").map((r) => ({ ...r, rank: null }))];
}

/** The chart event for the bars (ranked order). Pure. */
export function comparisonChart(ev: SectionComparisonEvent, ranked: RankedRow[]): Chart {
  return {
    type: "chart", seq: ev.seq, request_id: ev.request_id, source: ev.source, as_of: ev.as_of, kind: "bar",
    title: `${ev.metric} by section`, y_unit: ev.unit ?? null,
    series: [{ name: ev.metric, points: ranked.map((r) => [r.name, r.value]) }],
  };
}

export function SectionComparison({ ev, disabled, onSend }: { ev: SectionComparisonEvent; disabled?: boolean; onSend: (text: string) => void }) {
  const ranked = rankRows(ev.rows, ev.higher_is_better !== false);
  const unit = ev.unit ?? "";
  const withData = ranked.filter((r) => r.rank !== null);
  const best = withData[0], worst = withData.length > 1 ? withData[withData.length - 1] : undefined;
  return (
    <div className="min-w-0 space-y-3" data-testid="section-comparison">
      <section className="min-w-0 rounded-lg border border-border bg-card text-card-foreground">
        <header className="p-4 pb-2">
          <h4 className="text-sm font-semibold text-foreground">{ev.title}</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">{[ev.metric, ev.period].filter(Boolean).join(" · ")}</p>
          {best ? (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Trophy aria-hidden="true" className="h-3.5 w-3.5 text-primary" />Top: <strong className="font-semibold text-foreground">{best.name}</strong> {num(best.value!)}{unit}</span>
              {worst ? <span>Sabse kam: <strong className="font-semibold text-foreground">{worst.name}</strong> {num(worst.value!)}{unit}</span> : null}
            </p>
          ) : null}
        </header>
        <table className="w-full border-t border-border text-sm" data-testid="ranking-table">
          <caption className="sr-only">{ev.title}: rank, section, {ev.metric}, students</caption>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="w-10 px-4 py-2 font-medium">#</th>
              <th scope="col" className="px-2 py-2 font-medium">Section</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">{ev.metric}</th>
              <th scope="col" className="hidden px-2 py-2 text-right font-medium min-[420px]:table-cell">Students</th>
              <th scope="col" className="w-10 px-2 py-2"><span className="sr-only">Poochho</span></th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => (
              <tr key={r.id ?? r.name} className="border-t border-border">
                <td className="px-4 py-2 tabular-nums">
                  {r.rank === 1 ? <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">1</span>
                    : <span className="inline-grid h-6 w-6 place-items-center text-xs font-medium text-muted-foreground">{r.rank ?? "—"}</span>}
                </td>
                <td className="px-2 py-2">
                  <span className="block font-medium text-foreground">{r.name}</span>
                  {r.detail ? <span className="block text-xs text-muted-foreground">{r.detail}</span> : null}
                </td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums text-foreground">{r.value === null ? "—" : `${num(r.value)}${unit}`}</td>
                <td className="hidden px-2 py-2 text-right tabular-nums text-muted-foreground min-[420px]:table-cell">{dash(r.students)}</td>
                <td className="px-1 py-1">
                  <button type="button" disabled={disabled} onClick={() => onSend(`${r.name} ki attendance`)} aria-label={`${r.name} ke baare me poochho`}
                    className="grid h-11 w-10 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ev.as_of ? <SourceFooter source={ev.source} asOf={ev.as_of} className="border-t border-border px-4 py-2" /> : null}
      </section>
      {withData.length ? <LazyChart ev={comparisonChart(ev, ranked)} /> : null}
    </div>
  );
}
