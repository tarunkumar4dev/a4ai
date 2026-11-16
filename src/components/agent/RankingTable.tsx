// section_comparison → the backend's `table` (source tool:section_comparison, columns # · Class · % · Classes held|Tests
// · Marked|Graded; rank null = no data) as a ranking: rank badge (1 highlighted), value, the two counts, a
// "Top / Sabse kam" summary, and a button per class to ask about it. The bar chart is the separate `chart` event
// the backend sends right after (rendered by AgentChart, nulls are gaps).
import { ChevronRight, Trophy } from "lucide-react";
import type { Table } from "@/lib/agent/types";
import { dash } from "./format";
import { SourceFooter } from "./SourceFooter";

export interface RankRow { rank: number | null; name: string; pct: number | null; held: string | null; marked: string | null }

/** Table rows → ranking rows, best first, no-data rows last (the backend already ranks; we keep its order). Pure. */
export function rankingRows(ev: Table): RankRow[] {
  const num = (v: string | null) => (v === null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  const rows = ev.rows.map((r) => ({ rank: num(r[0] ?? null), name: r[1] ?? "—", pct: num(r[2] ?? null), held: r[3] ?? null, marked: r[4] ?? null }));
  return [...rows.filter((r) => r.rank !== null).sort((a, b) => a.rank! - b.rank!), ...rows.filter((r) => r.rank === null)];
}

export function RankingTable({ ev, disabled, onSend }: { ev: Table; disabled?: boolean; onSend: (text: string) => void }) {
  const rows = rankingRows(ev);
  const ranked = rows.filter((r) => r.rank !== null && r.pct !== null);
  const best = ranked[0], worst = ranked.length > 1 ? ranked[ranked.length - 1] : undefined;
  const [, , , heldLabel = "Classes held", markedLabel = "Marked"] = ev.columns;
  const metric = (ev.title.split(" by ")[0] || "%").trim();
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card text-card-foreground" data-testid="ranking">
      <header className="p-4 pb-2">
        <h4 className="text-sm font-semibold text-foreground">{ev.title}</h4>
        {best ? (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Trophy aria-hidden="true" className="h-3.5 w-3.5 text-primary" />Top: <strong className="font-semibold text-foreground">{best.name}</strong> {best.pct}%</span>
            {worst ? <span>Sabse kam: <strong className="font-semibold text-foreground">{worst.name}</strong> {worst.pct}%</span> : null}
          </p>
        ) : null}
      </header>
      <table className="w-full border-t border-border text-sm" data-testid="ranking-table">
        <caption className="sr-only">{ev.title}: rank, class, {metric}, {heldLabel}, {markedLabel}</caption>
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="w-10 px-4 py-2 font-medium">#</th>
            <th scope="col" className="px-2 py-2 font-medium">Class</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">%</th>
            <th scope="col" className="hidden px-2 py-2 text-right font-medium min-[420px]:table-cell">{heldLabel}</th>
            <th scope="col" className="hidden px-2 py-2 text-right font-medium sm:table-cell">{markedLabel}</th>
            <th scope="col" className="w-10 px-2 py-2"><span className="sr-only">Poochho</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.name}-${i}`} className="border-t border-border">
              <td className="px-4 py-2 tabular-nums">
                {r.rank === 1 ? <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">1</span>
                  : <span className="inline-grid h-6 w-6 place-items-center text-xs font-medium text-muted-foreground">{r.rank ?? "—"}</span>}
              </td>
              <td className="px-2 py-2">
                <span className="block font-medium text-foreground">{r.name}</span>
                {r.rank === null ? <span className="block text-xs text-muted-foreground">Data nahi hai</span> : null}
              </td>
              <td className="px-2 py-2 text-right font-semibold tabular-nums text-foreground">{r.pct === null ? "—" : `${r.pct}%`}</td>
              <td className="hidden px-2 py-2 text-right tabular-nums text-muted-foreground min-[420px]:table-cell">{dash(r.held)}</td>
              <td className="hidden px-2 py-2 text-right tabular-nums text-muted-foreground sm:table-cell">{dash(r.marked)}</td>
              <td className="px-1 py-1">
                <button type="button" disabled={disabled} onClick={() => onSend(`${r.name} ki is mahine ki attendance`)} aria-label={`${r.name} ke baare me poochho`}
                  className="grid h-11 w-10 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <SourceFooter source={ev.source} asOf={ev.as_of} className="border-t border-border px-4 py-2" />
    </section>
  );
}
