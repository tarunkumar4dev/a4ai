// table → sortable table (sticky header, scrolls inside its card) on sm+, stacked cards on phones, "Copy CSV".
// null cells render "—"; sorting keeps nulls last in both directions.
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Copy, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Table } from "@/lib/agent/events";
import { dash } from "./format";
import { SourceFooter } from "./SourceFooter";

type Cell = string | null;
const PAGE = 50;

const asNumber = (v: Cell): number | null => {
  if (v === null) return null;
  const t = v.replace(/[,%\s₹]/g, "");
  return /^[-+]?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
};

/** Sorted copy of rows (pure — exported for tests). */
export function sortRows(rows: Cell[][], col: number, dir: "asc" | "desc"): Cell[][] {
  const m = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = a[col] ?? null, y = b[col] ?? null;
    if (x === null || x === "") return y === null || y === "" ? 0 : 1;
    if (y === null || y === "") return -1;
    const nx = asNumber(x), ny = asNumber(y);
    if (nx !== null && ny !== null) return (nx - ny) * m;
    return x.localeCompare(y, "en-IN", { numeric: true, sensitivity: "base" }) * m;
  });
}

/** RFC 4180 CSV (null → empty cell). Pure — exported for tests. */
export function toCsv(columns: string[], rows: Cell[][]): string {
  const esc = (v: Cell) => {
    const s = v ?? "";
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

export function DataTable({ ev }: { ev: Table }) {
  const [sort, setSort] = useState<{ col: number; dir: "asc" | "desc" } | null>(null);
  const [all, setAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const rows = useMemo(() => (sort ? sortRows(ev.rows, sort.col, sort.dir) : ev.rows), [ev.rows, sort]);
  const shown = all ? rows : rows.slice(0, PAGE);

  const toggle = (col: number) => setSort((s) => (s?.col !== col ? { col, dir: "asc" } : s.dir === "asc" ? { col, dir: "desc" } : null));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toCsv(ev.columns, rows));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy nahi ho paya — browser ne clipboard block kiya.");
    }
  };

  return (
    <section className="min-w-0 rounded-lg border border-border bg-card text-card-foreground" data-testid="data-table">
      <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
        <h4 className="min-w-0 text-sm font-semibold">
          {ev.title} <span className="font-normal text-muted-foreground">· {ev.rows.length}</span>
        </h4>
        {ev.rows.length ? (
          <Button type="button" variant="ghost" size="sm" onClick={copy} className="h-9 shrink-0 gap-1.5 px-2.5 text-xs text-muted-foreground">
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? "Copied" : "Copy CSV"}
          </Button>
        ) : null}
      </header>

      {ev.rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">
          <Inbox aria-hidden="true" className="h-5 w-5" />
          Koi record nahi mila — sab theek lag raha hai.
        </div>
      ) : (
        <>
          {/* sm+: real table, header sticks while the body scrolls inside the card */}
          <div className="hidden max-h-96 overflow-auto border-t border-border sm:block">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-[1] bg-card">
                <tr>
                  {ev.columns.map((c, i) => {
                    const active = sort?.col === i;
                    const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                    return (
                      <th key={`${c}-${i}`} scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                        className="border-b border-border p-0 font-medium text-muted-foreground">
                        <button type="button" onClick={() => toggle(i)}
                          className="flex min-h-10 w-full items-center gap-1 whitespace-nowrap px-4 py-2 text-left text-xs hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                          {c}<Icon aria-hidden="true" className={`h-3.5 w-3.5 ${active ? "text-foreground" : "opacity-50"}`} />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {shown.map((r, ri) => (
                  <tr key={ri} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                    {ev.columns.map((_, ci) => (
                      <td key={ci} className={`whitespace-nowrap px-4 py-2 ${asNumber(r[ci] ?? null) !== null ? "tabular-nums" : ""} ${r[ci] == null ? "text-muted-foreground" : ""}`}>{dash(r[ci])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* phones: one card per row */}
          <ul className="space-y-2 border-t border-border p-3 sm:hidden">
            {shown.map((r, ri) => (
              <li key={ri} className="rounded-md border border-border/80 bg-card px-3 py-2">
                <p className="text-sm font-medium">{dash(r[0])}</p>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                  {ev.columns.slice(1).map((c, ci) => (
                    <div key={`${c}-${ci}`} className="contents">
                      <dt className="text-muted-foreground">{c}</dt>
                      <dd className="text-right tabular-nums">{dash(r[ci + 1])}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>

          {!all && rows.length > PAGE ? (
            <div className="border-t border-border px-4 py-2">
              <Button type="button" variant="ghost" size="sm" className="h-9 text-xs" onClick={() => setAll(true)}>Sab {rows.length} dikhao</Button>
            </div>
          ) : null}
        </>
      )}
      <SourceFooter source={ev.source} asOf={ev.as_of} className="border-t border-border px-4 py-2" />
    </section>
  );
}
