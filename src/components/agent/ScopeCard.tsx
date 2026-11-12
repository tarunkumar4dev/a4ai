// my_scope → the backend's `table` "Meri classes · N" (source tool:my_scope, columns Batch · Students · Role ·
// Subjects) shown as a scope card: "3 batches · 59 students", one row per batch with its student count, role and
// subjects. Tapping a batch asks about it (the backend's own entity phrasing); ✎ puts that question in the box.
import { useState } from "react";
import { ChevronRight, Pencil, Users } from "lucide-react";
import type { Table } from "@/lib/agent/types";
import { dash } from "./format";
import { SourceFooter } from "./SourceFooter";

const SHOW = 8;
const ROLE_LABEL: Record<string, string> = { teacher: "Teacher", proctor: "Proctor", hod: "HOD", admin: "Admin", subject_teacher: "Teacher" };

export const scopeQuestion = (name: string) => `${name} ki is mahine ki attendance`;

export interface ScopeRow { name: string; students: number | null; role: string | null; subjects: string | null }

/** Table rows → batches (column order from the header, so a reordered table still reads right). Pure. */
export function scopeRows(ev: Table): ScopeRow[] {
  const col = (name: string) => ev.columns.findIndex((c) => c.toLowerCase() === name);
  const [b, s, r, sub] = [col("batch"), col("students"), col("role"), col("subjects")];
  return ev.rows.map((row) => {
    const n = s >= 0 ? Number(row[s]) : NaN;
    return {
      name: (b >= 0 ? row[b] : row[0]) ?? "—",
      students: s >= 0 && row[s] !== null && Number.isFinite(n) ? n : null,
      role: r >= 0 ? row[r] : null,
      subjects: sub >= 0 ? row[sub] : null,
    };
  }).filter((x) => x.name !== "—");
}

/** "3 batches · 59 students" (students only when every row has a count). Pure. */
export function scopeTotal(rows: ScopeRow[]): string {
  if (!rows.length) return "Abhi koi batch assign nahi hai";
  const parts = [`${rows.length} batch${rows.length === 1 ? "" : "es"}`];
  if (rows.every((x) => x.students !== null)) {
    const n = rows.reduce((a, x) => a + (x.students ?? 0), 0);
    parts.push(`${n} student${n === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}

export function ScopeCard({ ev, disabled, onSend, onPrefill }: {
  ev: Table; disabled?: boolean; onSend: (text: string) => void; onPrefill: (text: string) => void;
}) {
  const [all, setAll] = useState(false);
  const rows = scopeRows(ev);
  const shown = all ? rows : rows.slice(0, SHOW);
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card text-card-foreground" data-testid="scope-card" aria-label="Aapka scope">
      <header className="flex items-start gap-3 p-4 pb-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Users aria-hidden="true" className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">Aap ye dekh sakte hain</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-foreground" data-testid="scope-total">{scopeTotal(rows)}</p>
        </div>
      </header>
      {rows.length ? (
        <ul className="border-t border-border" aria-label="Batches">
          {shown.map((b, i) => (
            <li key={`${b.name}-${i}`} className="flex items-center border-b border-border last:border-b-0">
              <button type="button" disabled={disabled} onClick={() => onSend(scopeQuestion(b.name))} data-testid="scope-batch"
                aria-label={`${b.name}: ${dash(b.students)} students — iski attendance poochho`}
                className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-4 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{b.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[b.role ? ROLE_LABEL[b.role] ?? b.role : null, b.subjects].filter(Boolean).join(" · ") || "Batch"}
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
      {rows.length > SHOW ? (
        <button type="button" onClick={() => setAll((v) => !v)} className="h-11 w-full border-t border-border text-sm font-medium text-primary hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          {all ? "Kam dikhao" : `Sab ${rows.length} dikhao`}
        </button>
      ) : null}
      <SourceFooter source={ev.source} asOf={ev.as_of} className="border-t border-border px-4 py-2" />
    </section>
  );
}
