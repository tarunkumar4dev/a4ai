// One chat turn. User → right bubble. Assistant → agent mark, step timeline, blocks (consecutive stat cards
// grouped into a grid), skeletons until the first block arrives, then Copy / 👍 / 👎 (local only) + time.
import { memo, useState } from "react";
import { Check, Copy, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { turnText, type Block, type ChatTurn, type Feedback } from "@/lib/agent/chatState";
import type { StatCard as StatCardEvent } from "@/lib/agent/events";
import { AgentEventBlock, type BlockContext, type BlockHandlers } from "./AgentEventBlock";
import { StatGrid } from "./StatCard";
import { StepTimeline } from "./StepTimeline";
import { timeLabel } from "./format";

type Group = { kind: "stats"; id: string; cards: StatCardEvent[] } | { kind: "block"; id: string; block: Block };

/** Consecutive stat_card blocks become one grid. Pure — exported for tests. */
export function groupBlocks(blocks: Block[]): Group[] {
  const out: Group[] = [];
  for (const b of blocks) {
    const last = out[out.length - 1];
    if (b.kind === "stat_card") {
      if (last?.kind === "stats") last.cards.push(b.ev);
      else out.push({ kind: "stats", id: b.id, cards: [b.ev] });
    } else out.push({ kind: "block", id: b.id, block: b });
  }
  return out;
}

/** Per block: the paper header (latest blueprint before it) and failed ids (latest paper before it). Pure. */
export function buildContexts(turns: ChatTurn[]): Map<string, BlockContext> {
  const map = new Map<string, BlockContext>();
  let paper: BlockContext["paper"];
  let failed: string[] = [];
  for (const t of turns) for (const b of t.blocks) {
    if (b.kind === "blueprint") paper = { class_grade: b.ev.class_grade, subject: b.ev.subject };
    if (b.kind === "paper_preview") {
      map.set(b.id, { paper });
      failed = b.ev.questions.filter((q) => q.status === "failed").map((q) => q.id);
    }
    if (b.kind === "verification") map.set(b.id, { failedIds: failed });
  }
  return map;
}

export function AgentMark({ className = "", title }: { className?: string; title?: string }) {
  return (
    <span aria-hidden="true" title={title} className={`grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground ${className}`}>
      <Sparkles className="h-3.5 w-3.5" />
    </span>
  );
}

function Actions({ turn, onFeedback }: { turn: ChatTurn; onFeedback: (v: Feedback) => void }) {
  const [copied, setCopied] = useState(false);
  const text = turnText(turn);
  const btn = "grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:text-primary";
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  return (
    <div className="-ml-2 flex items-center gap-0.5">
      {text ? (
        <button type="button" className={btn} onClick={copy} aria-label={copied ? "Copied" : "Copy answer"} title={copied ? "Copied" : "Copy"}>
          {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
        </button>
      ) : null}
      <button type="button" className={btn} aria-pressed={turn.feedback === "up"} aria-label="Helpful" title="Helpful"
        onClick={() => onFeedback(turn.feedback === "up" ? null : "up")}>
        <ThumbsUp aria-hidden="true" className="h-4 w-4" fill={turn.feedback === "up" ? "currentColor" : "none"} />
      </button>
      <button type="button" className={btn} aria-pressed={turn.feedback === "down"} aria-label="Not helpful" title="Not helpful"
        onClick={() => onFeedback(turn.feedback === "down" ? null : "down")}>
        <ThumbsDown aria-hidden="true" className="h-4 w-4" fill={turn.feedback === "down" ? "currentColor" : "none"} />
      </button>
      <time className="ml-1 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" dateTime={new Date(turn.at || Date.now()).toISOString()}>
        {timeLabel(turn.at)}
      </time>
    </div>
  );
}

export const AgentMessage = memo(function AgentMessage({ turn, h, ctx, onFeedback }: {
  turn: ChatTurn; h: BlockHandlers; ctx: Map<string, BlockContext>; onFeedback: (turnId: string, v: Feedback) => void;
}) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end" data-testid="msg-user">
        <p title={timeLabel(turn.at)}
          className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] leading-relaxed text-primary-foreground">
          {turn.text}
        </p>
      </div>
    );
  }
  const waiting = !turn.done && turn.blocks.length === 0;
  const groups = groupBlocks(turn.blocks);
  return (
    <div className="group flex gap-3" data-testid="msg-assistant">
      <AgentMark className="mt-0.5" title={timeLabel(turn.at)} />
      <div className="min-w-0 flex-1 space-y-3">
        <StepTimeline turn={turn} />
        {groups.map((g) => (g.kind === "stats"
          ? <StatGrid key={g.id} cards={g.cards} />
          : <AgentEventBlock key={g.id} block={g.block} h={h} ctx={ctx.get(g.id)} />))}
        {waiting ? (
          <div className="space-y-2" data-testid="msg-skeleton">
            {!(turn.steps ?? []).length ? <p className="text-sm text-muted-foreground">Soch raha hoon…</p> : null}
            <div aria-hidden="true" className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <div className="grid grid-cols-2 gap-2"><Skeleton className="h-24 rounded-lg" /><Skeleton className="h-24 rounded-lg" /></div>
            </div>
          </div>
        ) : null}
        {turn.done && turn.blocks.length > 0 ? <Actions turn={turn} onFeedback={(v) => onFeedback(turn.id, v)} /> : null}
      </div>
    </div>
  );
});
