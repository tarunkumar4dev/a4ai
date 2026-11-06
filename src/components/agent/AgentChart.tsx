// chart → recharts (line for trends, bar otherwise). A null point is a gap, never 0. Colours = theme tokens.
// Screen readers get the same numbers as a visually hidden table.
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { Chart } from "@/lib/agent/events";
import { dash } from "./format";
import { SourceFooter } from "./SourceFooter";

const SERIES_COLORS = ["hsl(var(--primary))", "hsl(var(--foreground) / 0.55)", "hsl(var(--muted-foreground) / 0.7)", "hsl(var(--primary) / 0.45)"];

/** Rows keyed by x label: { x, s0, s1, … } with null kept as null (gap). Pure — exported for tests. */
export function chartRows(ev: Chart): Record<string, string | number | null>[] {
  const labels: string[] = [];
  for (const s of ev.series) for (const [x] of s.points) if (!labels.includes(x)) labels.push(x);
  return labels.map((x) => {
    const row: Record<string, string | number | null> = { x };
    ev.series.forEach((s, i) => {
      const p = s.points.find((pt) => pt[0] === x);
      row[`s${i}`] = p && typeof p[1] === "number" && Number.isFinite(p[1]) ? p[1] : null;
    });
    return row;
  });
}

export function AgentChart({ ev }: { ev: Chart }) {
  const rows = chartRows(ev);
  const hasData = rows.some((r) => ev.series.some((_, i) => r[`s${i}`] !== null));
  const config: ChartConfig = Object.fromEntries(ev.series.map((s, i) => [`s${i}`, { label: s.name, color: SERIES_COLORS[i % SERIES_COLORS.length] }]));
  const unit = ev.y_unit ?? "";
  const axis = { stroke: "hsl(var(--muted-foreground))", fontSize: 11, tickLine: false, axisLine: false } as const;

  return (
    <figure className="min-w-0 rounded-lg border border-border bg-card p-4 text-card-foreground" data-testid="agent-chart">
      <figcaption className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold">{ev.title}</span>
        {unit ? <span className="shrink-0 text-xs text-muted-foreground">{unit}</span> : null}
      </figcaption>
      {!hasData ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
          <BarChart3 aria-hidden="true" className="h-5 w-5" />
          Is period ka koi data nahi mila.
        </div>
      ) : (
        <>
          <ChartContainer config={config} className="mt-3 aspect-auto h-52 w-full" aria-hidden="true">
            {ev.kind === "line" ? (
              <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="x" {...axis} tickMargin={8} minTickGap={16} />
                <YAxis {...axis} width={40} tickFormatter={(v) => `${v}${unit === "%" ? "%" : ""}`} />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                {ev.series.map((s, i) => (
                  <Line key={s.name} dataKey={`s${i}`} name={s.name} type="monotone" stroke={`var(--color-s${i})`} strokeWidth={2}
                    strokeDasharray={i === 1 ? "5 4" : undefined} dot={{ r: 2.5 }} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
                ))}
              </LineChart>
            ) : (
              <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="x" {...axis} tickMargin={8} minTickGap={8} />
                <YAxis {...axis} width={40} />
                <ChartTooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltipContent />} />
                {ev.series.map((s, i) => (
                  <Bar key={s.name} dataKey={`s${i}`} name={s.name} fill={`var(--color-s${i})`} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                ))}
              </BarChart>
            )}
          </ChartContainer>
          {ev.series.length > 1 ? (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {ev.series.map((s, i) => (
                <li key={s.name} className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-0.5 w-4 rounded" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />{s.name}
                </li>
              ))}
            </ul>
          ) : null}
          <table className="sr-only">
            <caption>{ev.title}</caption>
            <thead><tr><th scope="col">Period</th>{ev.series.map((s) => <th key={s.name} scope="col">{s.name}</th>)}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={String(r.x)}><th scope="row">{String(r.x)}</th>{ev.series.map((s, i) => <td key={s.name}>{dash(r[`s${i}`] as number | null)}{r[`s${i}`] !== null && unit ? unit : ""}</td>)}</tr>
            ))}</tbody>
          </table>
        </>
      )}
      <SourceFooter source={ev.source} asOf={ev.as_of} className="mt-3 border-t border-border pt-2" />
    </figure>
  );
}
