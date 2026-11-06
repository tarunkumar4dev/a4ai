// blueprint → editable plan of the paper (questions + marks per section), live total, destructive colour when
// the total ≠ the paper's target. "Looks good" sends "Blueprint theek hai, paper banao" (+ the edits, if any).
import { useMemo, useState } from "react";
import { CheckCircle2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Blueprint, BlueprintSection } from "@/lib/agent/events";
import { durationLabel, num } from "./format";

export const QTYPE_LABEL: Record<string, string> = {
  mcq: "MCQ", numeric: "Numerical", assertion_reason: "Assertion–Reason", short_answer: "Short answer",
  long_answer: "Long answer", case_study: "Case study", very_short: "Very short answer",
};
export const qtypeLabel = (q: string) => QTYPE_LABEL[q] ?? q.replace(/_/g, " ");

export const blueprintTotal = (s: BlueprintSection[]) =>
  Math.round(s.reduce((sum, x) => sum + (Number.isFinite(x.count) ? x.count : 0) * (Number.isFinite(x.marks_each) ? x.marks_each : 0), 0) * 100) / 100;

export const BLUEPRINT_OK = "Blueprint theek hai, paper banao";

/** The confirmation message: the fixed phrase, plus a compact list of edited sections. Pure. */
export function blueprintMessage(original: BlueprintSection[], edited: BlueprintSection[]): string {
  const changes = edited.filter((e, i) => e.count !== original[i]?.count || e.marks_each !== original[i]?.marks_each)
    .map((e) => `Section ${e.section} (${qtypeLabel(e.qtype)}): ${e.count} × ${num(e.marks_each)} marks`);
  return changes.length ? `${BLUEPRINT_OK}. Badlav: ${changes.join("; ")}` : BLUEPRINT_OK;
}

export function BlueprintCard({ ev, disabled, onConfirm }: { ev: Blueprint; disabled?: boolean; onConfirm: (message: string) => void }) {
  const [rows, setRows] = useState<BlueprintSection[]>(() => ev.sections.map((s) => ({ ...s })));
  const [sent, setSent] = useState(false);
  const total = useMemo(() => blueprintTotal(rows), [rows]);
  const ok = Math.abs(total - ev.total_marks) < 0.001;
  const questions = rows.reduce((n, r) => n + (r.count || 0), 0);

  const set = (i: number, key: "count" | "marks_each", raw: string) => {
    const n = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    setRows((rs) => rs.map((r, ri) => (ri === i ? { ...r, [key]: key === "count" ? Math.min(99, Math.floor(n)) : Math.min(100, n) } : r)));
  };
  const input = "h-11 w-full rounded-md border border-input bg-background px-2 text-center text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

  return (
    <section className="min-w-0 rounded-lg border border-border bg-card text-card-foreground" data-testid="blueprint">
      <header className="flex items-start gap-3 px-4 pb-3 pt-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><ListChecks aria-hidden="true" className="h-4 w-4" /></span>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold">Blueprint · Class {ev.class_grade} {ev.subject}</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ev.chapters.length ? ev.chapters.join(", ") : "—"} · {durationLabel(ev.duration_min)} · {questions} sawaal
          </p>
        </div>
      </header>

      <div className="border-t border-border">
        <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_3.75rem_3.75rem_2.75rem] items-center gap-2 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Sec</span><span>Type</span><span className="text-center">Qs</span><span className="text-center">Marks</span><span className="text-right">Total</span>
        </div>
        {rows.map((r, i) => (
          <div key={`${r.section}-${i}`} className="grid grid-cols-[2.25rem_minmax(0,1fr)_3.75rem_3.75rem_2.75rem] items-center gap-2 border-t border-border/60 px-4 py-1.5 text-sm">
            <span className="font-semibold">{r.section}</span>
            <span className="truncate text-muted-foreground" title={qtypeLabel(r.qtype)}>{qtypeLabel(r.qtype)}</span>
            <input aria-label={`Section ${r.section} questions`} type="number" inputMode="numeric" min={0} max={99} step={1}
              value={r.count} disabled={sent} onChange={(e) => set(i, "count", e.target.value)} className={input} />
            <input aria-label={`Section ${r.section} marks each`} type="number" inputMode="decimal" min={0} max={100} step={0.5}
              value={r.marks_each} disabled={sent} onChange={(e) => set(i, "marks_each", e.target.value)} className={input} />
            <span className="text-right font-medium tabular-nums">{num(r.count * r.marks_each)}</span>
          </div>
        ))}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
        <p data-testid="blueprint-total" className={`text-sm font-semibold tabular-nums ${ok ? "text-foreground" : "text-destructive dark:text-red-400"}`}>
          Total {num(total)} / {num(ev.total_marks)}
          {ok ? null : <span className="ml-1 font-normal">— paper total se match nahi</span>}
        </p>
        {sent ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />Paper ban raha hai</p>
        ) : (
          <Button type="button" className="h-11" disabled={!ok || disabled} onClick={() => { setSent(true); onConfirm(blueprintMessage(ev.sections, rows)); }}>
            Looks good — paper banao
          </Button>
        )}
      </footer>
    </section>
  );
}
