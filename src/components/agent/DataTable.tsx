import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Table } from "@/lib/agent/events";

export function DataTable({ ev }: { ev: Table }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm">{ev.title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-2">
        {/* the table scrolls inside its card — never the page */}
        <div className="max-w-full overflow-x-auto px-4">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                {ev.columns.map((c, i) => (
                  <th key={i} className="whitespace-nowrap py-2 pr-4 font-medium text-muted-foreground">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ev.rows.length === 0 ? (
                <tr><td colSpan={Math.max(1, ev.columns.length)} className="py-3 text-muted-foreground">No rows</td></tr>
              ) : ev.rows.map((r, ri) => (
                <tr key={ri} className="border-b last:border-0">
                  {ev.columns.map((_, ci) => (
                    <td key={ci} className="whitespace-nowrap py-2 pr-4">{r[ci] ?? "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
