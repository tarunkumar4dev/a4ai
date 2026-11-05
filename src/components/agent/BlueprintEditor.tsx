import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Blueprint, BlueprintSection } from "@/lib/agent/events";

export const blueprintTotal = (s: BlueprintSection[]) =>
  Math.round(s.reduce((sum, x) => sum + (Number.isFinite(x.count) ? x.count : 0) * (Number.isFinite(x.marks_each) ? x.marks_each : 0), 0) * 100) / 100;

export function BlueprintEditor({ ev, onChange }: { ev: Blueprint; onChange?: (sections: BlueprintSection[]) => void }) {
  const [rows, setRows] = useState<BlueprintSection[]>(() => ev.sections.map((s) => ({ ...s })));
  const total = useMemo(() => blueprintTotal(rows), [rows]);
  const mismatch = Math.abs(total - ev.total_marks) > 0.001;

  const set = (i: number, key: "count" | "marks_each", raw: string) => {
    const n = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    const next = rows.map((r, ri) => (ri === i ? { ...r, [key]: key === "count" ? Math.floor(n) : n } : r));
    setRows(next);
    onChange?.(next);
  };

  return (
    <Card className="min-w-0">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm">Blueprint · Class {ev.class_grade} {ev.subject}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {ev.chapters.join(", ") || "—"} · {ev.duration_min} min
        </p>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        <div className="grid grid-cols-[3rem_1fr_4.5rem_4.5rem] gap-2 text-xs text-muted-foreground">
          <span>Sec</span><span>Type</span><span>Count</span><span>Marks</span>
        </div>
        {rows.map((r, i) => (
          <div key={`${r.section}-${i}`} className="grid grid-cols-[3rem_1fr_4.5rem_4.5rem] items-center gap-2 text-sm">
            <span className="font-medium">{r.section}</span>
            <span className="truncate">{r.qtype.replace(/_/g, " ")}</span>
            <Input aria-label={`Section ${r.section} count`} inputMode="numeric" type="number" min={0} step={1}
              value={r.count} onChange={(e) => set(i, "count", e.target.value)} className="h-9 px-2" />
            <Input aria-label={`Section ${r.section} marks each`} inputMode="decimal" type="number" min={0} step={0.5}
              value={r.marks_each} onChange={(e) => set(i, "marks_each", e.target.value)} className="h-9 px-2" />
          </div>
        ))}
        <p className={`pt-1 text-sm font-medium ${mismatch ? "text-red-600" : ""}`} aria-live="polite">
          Total {total} / {ev.total_marks}
          {mismatch ? " — total doesn't match" : ""}
        </p>
      </CardContent>
    </Card>
  );
}
