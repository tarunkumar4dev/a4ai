// my_scope → what the caller can see: "2 batches · 44 students", department chips, and one row per batch with its
// student count and why it's in scope. Tapping a batch asks about it ("<name> ki attendance"); the ✎ button puts
// that question in the box instead, to change it before sending.
import { useState } from "react";
import { ChevronRight, Pencil, Users } from "lucide-react";
import type { MyScope } from "@/lib/agent/types";
import { dash } from "./format";
import { roleLabel, scopeSummary } from "./roles";
import { SourceFooter } from "./SourceFooter";

const VIA_LABEL: Record<string, string> = { teacher: "Teacher", proctor: "Proctor", hod: "HOD", admin: "Admin" };
const SHOW = 8;

export const scopeQuestion = (name: string) => `${name} ki attendance`;

export function ScopeCard({ ev, disabled, onSend, onPrefill }: {
  ev: MyScope; disabled?: boolean; onSend: (text: string) => void; onPrefill: (text: string) => void;
}) {
  const [all, setAll] = useState(false);
  const summary = scopeSummary(ev) ?? "Abhi koi batch assign nahi hai";
  const shown = all ? ev.batches : ev.batches.slice(0, SHOW);
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card text-card-foreground" data-testid="scope-card" aria-label={ev.title ?? "Aapka scope"}>
      <header className="flex items-start gap-3 p-4 pb-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Users aria-hidden="true" className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{ev.title ?? "Aap ye dekh sakte hain"} · {roleLabel(ev.role, null)}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-foreground" data-testid="scope-total">{summary}</p>
          {ev.departments?.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {ev.departments.map((d) => <span key={d} className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground">{d}</span>)}
            </div>
          ) : null}
        </div>
      </header>
      {ev.batches.length ? (
        <ul className="border-t border-border" aria-label="Batches">
          {shown.map((b) => (
            <li key={b.batch_id} className="flex items-center border-b border-border last:border-b-0">
              <button type="button" disabled={disabled} onClick={() => onSend(scopeQuestion(b.name))} data-testid="scope-batch"
                aria-label={`${b.name}: ${dash(b.students)} students — iski attendance poochho`}
                className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-4 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{b.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[b.kind, b.department, b.via ? VIA_LABEL[b.via] ?? b.via : null].filter(Boolean).join(" · ") || "Batch"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold tabular-nums text-foreground">{dash(b.students)}</span>
                  <span className="block text-[11px] text-muted-foreground">students</span>
                </span>
                <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
              <button type="button" disabled={disabled} onClick={() => onPrefill(scopeQuestion(b.name))} aria-label={`${b.name} ka sawaal box me likho`} title="Box me likho"
                className="mr-1 grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">
                <Pencil aria-hidden="true" className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">HOD se batch assign karwaiye, phir yahan dikhega.</p>
      )}
      {ev.batches.length > SHOW ? (
        <button type="button" onClick={() => setAll((v) => !v)} className="h-11 w-full border-t border-border text-sm font-medium text-primary hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          {all ? "Kam dikhao" : `Sab ${ev.batches.length} dikhao`}
        </button>
      ) : null}
      {ev.as_of ? <SourceFooter source={ev.source} asOf={ev.as_of} className="border-t border-border px-4 py-2" /> : null}
    </section>
  );
}
