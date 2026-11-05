// Event-block -> component mapping for the "Ask a4ai" panel. Theme tokens only (dark mode works).
// All buttons are real <button>s. Paper text goes through AgentMath (KaTeX trust:false + DOMPurify).
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Block } from "@/lib/agent/chatState";
import { isAgentPdfPath } from "@/lib/agent/client";
import type { BlueprintSection, PreviewQuestion } from "@/lib/agent/events";
import { AgentMath } from "./AgentMath";
import { blueprintTotal } from "./BlueprintEditor";
import { verificationLine } from "./VerificationBadge";

export interface BlockHandlers {
  busy: boolean;
  onAnswer: (blockId: string, value: string) => void;
  onApprove: (blockId: string) => void;
  onCancel: (blockId: string) => void;
  onRetry: (text: string) => void;
  onDownload: (blockId: string) => void;
}

const card = "rounded-lg border border-border bg-card p-3 text-card-foreground";
const dash = (v: string | null | undefined) => (v === null || v === undefined || v === "" ? "—" : v);

function asOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " IST";
}

function Source({ source, as_of }: { source: string; as_of: string }) {
  return <p className="mt-2 text-[11px] text-muted-foreground">{source.replace(/^tool:/, "")} · as of {asOf(as_of)}</p>;
}

/** **bold** only; everything else is plain text (React escapes it). */
function RichText({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
      {text.split(/(\*\*[^*\n]+\*\*)/g).map((p, i) =>
        p.startsWith("**") && p.endsWith("**") && p.length > 4 ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>)}
    </p>
  );
}

function SimpleTable({ title, columns, rows, meta }: { title: string; columns: string[]; rows: (string | null)[][]; meta: JSX.Element }) {
  return (
    <div className={card}>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="max-w-full overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-border">{columns.map((c) => <th key={c} scope="col" className="whitespace-nowrap px-2 py-1 font-medium text-muted-foreground">{c}</th>)}</tr></thead>
          <tbody>{rows.length === 0
            ? <tr><td colSpan={Math.max(columns.length, 1)} className="px-2 py-2 text-muted-foreground">No rows.</td></tr>
            : rows.map((r, i) => <tr key={i} className="border-b border-border/60 last:border-0">{r.map((c, j) => <td key={j} className="whitespace-nowrap px-2 py-1">{dash(c)}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
      {meta}
    </div>
  );
}

function BlueprintBlock({ block }: { block: Extract<Block, { kind: "blueprint" }> }) {
  const ev = block.ev;
  const [sections, setSections] = useState<BlueprintSection[]>(ev.sections);
  const total = blueprintTotal(sections);
  const ok = total === ev.total_marks;
  const set = (i: number, k: "count" | "marks_each", v: string) => {
    const n = Math.max(0, Number(v) || 0);
    setSections((s) => s.map((x, j) => (j === i ? { ...x, [k]: n } : x)));
  };
  return (
    <div className={card}>
      <p className="text-sm font-medium">Blueprint · Class {ev.class_grade} {ev.subject}</p>
      <p className="text-xs text-muted-foreground">{ev.chapters.join(", ")} · {ev.duration_min} min</p>
      <div className="mt-2 max-w-full overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><th className="px-1 py-1 font-medium">Sec</th><th className="px-1 py-1 font-medium">Type</th><th className="px-1 py-1 font-medium">Qs</th><th className="px-1 py-1 font-medium">Marks each</th><th className="px-1 py-1 text-right font-medium">Marks</th></tr></thead>
          <tbody>{sections.map((s, i) => (
            <tr key={`${s.section}-${s.qtype}-${i}`} className="border-t border-border/60">
              <td className="px-1 py-1">{s.section}</td>
              <td className="px-1 py-1 whitespace-nowrap">{s.qtype.replace(/_/g, " ")}</td>
              <td className="px-1 py-1"><input aria-label={`Questions in ${s.section} ${s.qtype}`} type="number" min={0} step={1} value={s.count} onChange={(e) => set(i, "count", e.target.value)} className="w-14 rounded border border-input bg-background px-1 py-0.5" /></td>
              <td className="px-1 py-1"><input aria-label={`Marks each in ${s.section} ${s.qtype}`} type="number" min={0} step={0.5} value={s.marks_each} onChange={(e) => set(i, "marks_each", e.target.value)} className="w-16 rounded border border-input bg-background px-1 py-0.5" /></td>
              <td className="px-1 py-1 text-right tabular-nums">{s.count * s.marks_each}</td>
            </tr>))}
          </tbody>
        </table>
      </div>
      <p className={`mt-2 text-sm font-medium ${ok ? "text-foreground" : "text-destructive"}`} data-testid="blueprint-total">
        Total {total} / {ev.total_marks}{ok ? "" : " — doesn't match the paper total"}
      </p>
    </div>
  );
}

const STATUS_BADGE: Record<PreviewQuestion["status"], { label: string; cls: string }> = {
  verified: { label: "verified", cls: "bg-secondary text-secondary-foreground" },
  rubric_ok: { label: "rubric checked", cls: "bg-secondary text-secondary-foreground" },
  manual_review: { label: "manual review", cls: "border border-amber-500/60 text-amber-700 dark:text-amber-300" },
  failed: { label: "failed", cls: "bg-destructive/10 text-destructive" },
};

function PaperBlock({ block }: { block: Extract<Block, { kind: "paper_preview" }> }) {
  const ev = block.ev;
  let lastSection = "";
  return (
    <div className={card}>
      <p className="text-sm font-semibold">{ev.title}</p>
      <p className="text-xs text-muted-foreground">Max marks {ev.total_marks} · {ev.duration_min} min · draft (not approved)</p>
      <ol className="mt-2 space-y-3">
        {ev.questions.map((q, n) => {
          const head = q.section !== lastSection ? (lastSection = q.section) : null;
          const badge = STATUS_BADGE[q.status] ?? STATUS_BADGE.manual_review;
          return (
            <li key={q.id} className="text-sm">
              {head ? <p className="mb-1 mt-2 rounded bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">Section {head}</p> : null}
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">Q{n + 1}.</span>
                <span className="text-xs text-muted-foreground">[{q.marks}]</span>
                <span className={`rounded px-1.5 py-0.5 text-[11px] ${badge.cls}`}>{badge.label}</span>
              </div>
              <AgentMath text={q.text} className="block break-words" />
              {q.options?.length ? (
                <ol className="mt-1 grid grid-cols-1 gap-x-4 gap-y-0.5 pl-4 sm:grid-cols-2">
                  {q.options.map((o, i) => <li key={i} className="break-words">({String.fromCharCode(97 + i)}) <AgentMath text={o} /></li>)}
                </ol>
              ) : null}
              {Array.isArray(q.sub_questions) && q.sub_questions.length ? (
                <ol className="mt-1 list-[lower-roman] pl-6">
                  {q.sub_questions.map((p, i) => <li key={i} className="break-words"><AgentMath text={String(p.text ?? "")} /> <span className="text-xs text-muted-foreground">[{String(p.marks ?? "")}]</span></li>)}
                </ol>
              ) : null}
            </li>
          );
        })}
      </ol>
      <details className="mt-3 rounded border border-border p-2">
        <summary className="cursor-pointer text-sm font-medium">Answer key &amp; marking scheme</summary>
        <ol className="mt-2 space-y-2 text-sm">
          {ev.questions.map((q, n) => (
            <li key={q.id}>
              <span className="font-medium">Q{n + 1}:</span> {q.answer ? <AgentMath text={q.answer} /> : <span className="text-muted-foreground">—</span>}
              {q.marking_scheme?.length ? <ul className="list-disc pl-5 text-muted-foreground">{q.marking_scheme.map((m, i) => <li key={i}><AgentMath text={m} /></li>)}</ul> : null}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

function ApprovalBlock({ block, h }: { block: Extract<Block, { kind: "approval" }>; h: BlockHandlers }) {
  const { ev, state, result, error } = block;
  const path = result?.download_path;
  const canDownload = state === "approved" && isAgentPdfPath(path);
  return (
    <div className={`${card} border-primary/40`}>
      <p className="text-sm font-medium">Needs your approval</p>
      <p className="text-sm">{ev.summary}</p>
      <p className="text-xs text-muted-foreground">Expires {asOf(ev.expires_at)} · nothing changes until you approve</p>
      {error ? <p role="alert" className="mt-2 text-sm text-destructive">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {state === "pending" || state === "failed" || state === "approving" ? (
          <>
            <Button type="button" size="sm" disabled={state === "approving"} onClick={() => h.onApprove(block.id)}>
              {state === "approving" ? "Approving…" : state === "failed" ? "Approve again" : "Approve"}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={state === "approving"} onClick={() => h.onCancel(block.id)}>Cancel</Button>
          </>
        ) : null}
        {state === "approved" ? <p className="text-sm font-medium">Approved{result?.replayed ? " (already done earlier)" : ""}</p> : null}
        {canDownload ? <Button type="button" size="sm" variant="secondary" onClick={() => h.onDownload(block.id)}>Download PDF</Button> : null}
        {state === "cancelled" ? <p className="text-sm text-muted-foreground">Cancelled — nothing was changed. The request expires on its own.</p> : null}
      </div>
    </div>
  );
}

export function AgentEventBlock({ block, h }: { block: Block; h: BlockHandlers }) {
  switch (block.kind) {
    case "text":
      return <RichText text={block.text} />;
    case "stat_card": {
      const ev = block.ev;
      return (
        <div className={card}>
          <p className="text-xs text-muted-foreground">{ev.title}</p>
          <p className="text-2xl font-semibold tabular-nums">{dash(ev.value)}{ev.value !== null && ev.unit ? <span className="ml-0.5 text-base">{ev.unit}</span> : null}</p>
          {ev.subtitle ? <p className="text-xs text-muted-foreground">{ev.subtitle}</p> : null}
          <Source source={ev.source} as_of={ev.as_of} />
        </div>
      );
    }
    case "table":
      return <SimpleTable title={block.ev.title} columns={block.ev.columns} rows={block.ev.rows} meta={<Source source={block.ev.source} as_of={block.ev.as_of} />} />;
    case "chart": {
      const ev = block.ev;
      const labels = Array.from(new Set(ev.series.flatMap((s) => s.points.map((p) => p[0]))));
      const rows = labels.map((l) => [l, ...ev.series.map((s) => {
        const v = s.points.find((p) => p[0] === l)?.[1];
        return v === null || v === undefined ? null : String(v);
      })]);
      return <SimpleTable title={ev.title} columns={["", ...ev.series.map((s) => s.name)]} rows={rows} meta={<Source source={ev.source} as_of={ev.as_of} />} />;
    }
    case "clarify":
      return (
        <div className={card}>
          <p className="text-sm">{block.ev.question}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {block.ev.chips.map((c) => (
              <button key={c.value} type="button" aria-pressed={block.answered === c.value}
                disabled={block.answered !== null || h.busy} onClick={() => h.onAnswer(block.id, c.value)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-60 aria-pressed:border-primary aria-pressed:text-primary">
                {c.label}
              </button>
            ))}
          </div>
        </div>
      );
    case "blueprint":
      return <BlueprintBlock block={block} />;
    case "paper_preview":
      return <PaperBlock block={block} />;
    case "verification": {
      const ev = block.ev;
      return (
        <div className={card} data-testid="verification">
          <p className="text-sm font-medium">{verificationLine(ev)}</p>
          <p className={`text-xs ${ev.marks_sum_ok ? "text-muted-foreground" : "text-destructive"}`}>
            {ev.marks_sum_ok ? "Marks add up to the paper total." : "Marks don't add up to the paper total."}
            {ev.rounds ? ` · ${ev.rounds} check round${ev.rounds === 1 ? "" : "s"}` : ""}
          </p>
          {ev.manual_review.length ? <p className="text-xs">Check by hand: {ev.manual_review.join(", ")}</p> : null}
          {ev.duplicates.length ? <p className="text-xs text-destructive">Possible duplicates: {ev.duplicates.join(", ")}</p> : null}
        </div>
      );
    }
    case "approval":
      return <ApprovalBlock block={block} h={h} />;
    case "error":
      return (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="text-destructive">{block.message}</p>
          {block.retryText ? (
            <Button type="button" size="sm" variant="outline" className="mt-2" disabled={h.busy} onClick={() => h.onRetry(block.retryText!)}>Retry</Button>
          ) : null}
        </div>
      );
    default:
      return null;
  }
}
