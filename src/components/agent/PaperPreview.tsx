// paper_preview → a CBSE-style question paper: header (class / subject / time / max marks), sections A–E with a
// one-line description, marks right-aligned, case-study box, collapsible answer key. Every question has a menu
// (Replace / Easier / Harder / Change marks) that talks back to the agent. Math: AgentMath (KaTeX trust:false + DOMPurify).
import { useState } from "react";
import { AlertTriangle, ChevronDown, KeyRound, MoreVertical, Replace, TrendingDown, TrendingUp, XCircle, Hash } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PaperPreview as PaperPreviewEvent, PreviewQuestion } from "@/lib/agent/events";
import { AgentMath } from "./AgentMath";
import { qtypeLabel } from "./BlueprintCard";
import { durationLabel, num } from "./format";

export interface PaperContext { class_grade?: number; subject?: string }
export type QuestionAction = "replace" | "easier" | "harder" | "marks";

/** The chat message for a per-question action ("Q5 (q5) replace karo"). Pure — exported for tests. */
export function questionActionMessage(n: number, id: string, action: QuestionAction): string {
  const ref = `Q${n} (${id})`;
  switch (action) {
    case "replace": return `${ref} replace karo`;
    case "easier": return `${ref} easier karo`;
    case "harder": return `${ref} harder karo`;
    case "marks": return `${ref} ke marks change karo: `;
  }
}

function sectionLine(qs: PreviewQuestion[]): string {
  const marks = Array.from(new Set(qs.map((q) => q.marks)));
  const types = Array.from(new Set(qs.map((q) => qtypeLabel(q.qtype))));
  const each = marks.length === 1 ? ` of ${num(marks[0])} mark${marks[0] === 1 ? "" : "s"} each` : "";
  return `${qs.length} question${qs.length === 1 ? "" : "s"}${each} · ${types.join(", ")}`;
}

function StatusMark({ status }: { status: PreviewQuestion["status"] }) {
  if (status === "manual_review") {
    return <span title="Manual review chahiye" className="inline-flex text-amber-700 dark:text-amber-300"><AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" /><span className="sr-only">Manual review</span></span>;
  }
  if (status === "failed") {
    return <span title="Check fail hua" className="inline-flex text-destructive dark:text-red-400"><XCircle aria-hidden="true" className="h-3.5 w-3.5" /><span className="sr-only">Failed check</span></span>;
  }
  return null;
}

function Options({ options }: { options: string[] }) {
  return (
    <ol className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
      {options.map((o, i) => (
        <li key={i} className="flex min-w-0 gap-1.5 break-words">
          <span className="shrink-0 text-muted-foreground">({String.fromCharCode(97 + i)})</span><AgentMath text={o} />
        </li>
      ))}
    </ol>
  );
}

function QuestionMenu({ n, q, disabled, onAction }: { n: number; q: PreviewQuestion; disabled?: boolean; onAction: (a: QuestionAction) => void }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={disabled} aria-label={`Q${n} options`}
          className="-my-2 -mr-3 grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
          <MoreVertical aria-hidden="true" className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[240] w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Q{n} · {num(q.marks)} marks</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-10 gap-2" onSelect={() => onAction("replace")}><Replace aria-hidden="true" className="h-4 w-4" />Replace</DropdownMenuItem>
        <DropdownMenuItem className="min-h-10 gap-2" onSelect={() => onAction("easier")}><TrendingDown aria-hidden="true" className="h-4 w-4" />Easier</DropdownMenuItem>
        <DropdownMenuItem className="min-h-10 gap-2" onSelect={() => onAction("harder")}><TrendingUp aria-hidden="true" className="h-4 w-4" />Harder</DropdownMenuItem>
        <DropdownMenuItem className="min-h-10 gap-2" onSelect={() => onAction("marks")}><Hash aria-hidden="true" className="h-4 w-4" />Change marks</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PaperPreview({ ev, ctx, disabled, onSend, onPrefill }: {
  ev: PaperPreviewEvent; ctx?: PaperContext; disabled?: boolean;
  onSend: (text: string) => void; onPrefill: (text: string) => void;
}) {
  const [keyOpen, setKeyOpen] = useState(false);
  const sections: { name: string; qs: { q: PreviewQuestion; n: number }[] }[] = [];
  ev.questions.forEach((q, i) => {
    const last = sections[sections.length - 1];
    if (last && last.name === q.section) last.qs.push({ q, n: i + 1 });
    else sections.push({ name: q.section, qs: [{ q, n: i + 1 }] });
  });
  const act = (n: number, q: PreviewQuestion, a: QuestionAction) => {
    const msg = questionActionMessage(n, q.id, a);
    if (a === "marks") onPrefill(msg); else onSend(msg);
  };
  const classLine = [ctx?.class_grade ? `Class ${ctx.class_grade}` : null, ctx?.subject ?? null].filter(Boolean).join(" · ");

  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-border bg-card text-card-foreground" data-testid="paper-preview">
      <header className="border-b border-border px-4 pb-4 pt-3 text-center sm:px-6">
        <p className="text-left"><span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Draft · abhi final nahi</span></p>
        <h4 className="mt-2 text-base font-semibold uppercase tracking-wide">{ev.title}</h4>
        {classLine ? <p className="mt-0.5 text-sm text-muted-foreground">{classLine}</p> : null}
        <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs font-medium sm:text-sm">
          <span>Time: {durationLabel(ev.duration_min)}</span>
          <span>Max. Marks: {num(ev.total_marks)}</span>
        </div>
      </header>

      {ev.questions.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">Is paper me abhi koi sawaal nahi hai.</p>
      ) : sections.map((s) => (
        <section key={s.name} className="px-4 pb-2 sm:px-6" aria-label={`Section ${s.name}`}>
          <div className="pb-2 pt-4 text-center">
            <p className="text-sm font-semibold tracking-wide">SECTION {s.name}</p>
            <p className="text-xs text-muted-foreground">{sectionLine(s.qs.map((x) => x.q))}</p>
          </div>
          <ol className="divide-y divide-border/60">
            {s.qs.map(({ q, n }) => {
              const sub = Array.isArray(q.sub_questions) ? q.sub_questions : [];
              const isCase = q.qtype === "case_study";
              return (
                <li key={q.id} className="py-3 text-sm leading-relaxed" data-qid={q.id}>
                  <div className="flex items-start gap-2">
                    <span className="w-7 shrink-0 font-semibold tabular-nums">{n}.</span>
                    <div className="min-w-0 flex-1">
                      {isCase ? (
                        <div className="rounded-md border border-border bg-muted/40 p-3">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Case study</p>
                          <AgentMath text={q.text} className="block break-words" />
                        </div>
                      ) : <AgentMath text={q.text} className="block break-words" />}
                      {q.options?.length ? <Options options={q.options} /> : null}
                      {sub.length ? (
                        <ol className="mt-2 space-y-1">
                          {sub.map((p, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="w-7 shrink-0 text-muted-foreground">({["i", "ii", "iii", "iv", "v", "vi"][i] ?? i + 1})</span>
                              <AgentMath text={String(p.text ?? "")} className="min-w-0 flex-1 break-words" />
                              {p.marks !== undefined && p.marks !== null ? <span className="shrink-0 tabular-nums text-muted-foreground">{String(p.marks)}</span> : null}
                            </li>
                          ))}
                        </ol>
                      ) : null}
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5 pl-2">
                      <StatusMark status={q.status} />
                      <span className="min-w-[1.5rem] text-right font-medium tabular-nums" aria-label={`${num(q.marks)} marks`}>{num(q.marks)}</span>
                      <QuestionMenu n={n} q={q} disabled={disabled} onAction={(a) => act(n, q, a)} />
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      <Collapsible open={keyOpen} onOpenChange={setKeyOpen} className="border-t border-border">
        <CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2 text-sm font-medium hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6">
          <span className="inline-flex items-center gap-2"><KeyRound aria-hidden="true" className="h-4 w-4 text-muted-foreground" />Answer key &amp; marking scheme</span>
          <ChevronDown aria-hidden="true" className={`h-4 w-4 text-muted-foreground ${keyOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ol className="space-y-3 px-4 pb-4 text-sm sm:px-6">
            {ev.questions.map((q, i) => (
              <li key={q.id} className="flex gap-2">
                <span className="w-7 shrink-0 font-semibold tabular-nums">{i + 1}.</span>
                <div className="min-w-0 flex-1 break-words">
                  {q.answer ? <AgentMath text={q.answer} /> : <span className="text-muted-foreground">—</span>}
                  {q.marking_scheme?.length ? (
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                      {q.marking_scheme.map((m, mi) => <li key={mi}><AgentMath text={m} /></li>)}
                    </ul>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </CollapsibleContent>
      </Collapsible>
    </article>
  );
}
