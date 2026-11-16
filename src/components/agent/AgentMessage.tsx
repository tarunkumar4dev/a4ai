// One chat turn. User → right bubble with Edit (edit and resend: replaces it and everything after).
// Assistant → agent mark, step timeline, blocks (consecutive stat cards grouped into a grid), skeletons until the
// first block arrives, a "stopped" mark for a partial answer, then Copy · Regenerate · 👍 · 👎 (with an optional note)
// + time. Feedback goes to POST /agent/feedback (store), the rest is local.
import { memo, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, Copy, MinusCircle, Pencil, RotateCcw, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { turnText, type Block, type ChatTurn, type Feedback } from "@/lib/agent/chatState";
import type { StatCard as StatCardEvent } from "@/lib/agent/types";
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

const actBtn = "grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 aria-pressed:text-primary";

function DownVote({ turn, onFeedback }: { turn: ChatTurn; onFeedback: (v: Feedback, note?: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(turn.feedbackNote ?? "");
  const pressed = turn.feedback === "down";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={actBtn} aria-pressed={pressed} aria-label="Not helpful" title="Not helpful"
          onClick={(e) => {
            if (pressed) { e.preventDefault(); onFeedback(null); return; }
            onFeedback("down");
          }}>
          <ThumbsDown aria-hidden="true" className="h-4 w-4" fill={pressed ? "currentColor" : "none"} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="z-[240] w-[min(20rem,calc(100vw-2rem))] p-3" data-testid="feedback-note">
        <form onSubmit={(e) => { e.preventDefault(); onFeedback("down", note.trim() || null); setOpen(false); }}>
          <label htmlFor={`fb-${turn.id}`} className="text-sm font-medium text-foreground">Kya galat tha? <span className="font-normal text-muted-foreground">(optional)</span></label>
          <textarea id={`fb-${turn.id}`} value={note} maxLength={500} rows={3} onChange={(e) => setNote(e.target.value)} autoFocus
            placeholder="Jaise: galat section ka data, number match nahi hua…"
            className="mt-2 w-full resize-none rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Skip</button>
            <button type="submit" className="h-10 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Send</button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function Actions({ turn, busy, isLast, onFeedback, onRegenerate }: {
  turn: ChatTurn; busy: boolean; isLast: boolean; onFeedback: (v: Feedback, note?: string | null) => void; onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = turnText(turn);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  return (
    <div className="-ml-2 flex items-center gap-0.5" data-testid="msg-actions">
      {text ? (
        <button type="button" className={actBtn} onClick={copy} aria-label={copied ? "Copied" : "Copy answer"} title={copied ? "Copied" : "Copy"}>
          {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
        </button>
      ) : null}
      <button type="button" className={actBtn} disabled={busy} onClick={onRegenerate} aria-label="Regenerate"
        title={isLast ? "Regenerate" : "Regenerate (iske baad ki baatein hat jayengi)"}>
        <RotateCcw aria-hidden="true" className="h-4 w-4" />
      </button>
      <button type="button" className={actBtn} aria-pressed={turn.feedback === "up"} aria-label="Helpful" title="Helpful"
        onClick={() => onFeedback(turn.feedback === "up" ? null : "up")}>
        <ThumbsUp aria-hidden="true" className="h-4 w-4" fill={turn.feedback === "up" ? "currentColor" : "none"} />
      </button>
      <DownVote turn={turn} onFeedback={onFeedback} />
      <time className="ml-1 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" dateTime={new Date(turn.at || Date.now()).toISOString()}>
        {timeLabel(turn.at)}
      </time>
    </div>
  );
}

function UserMessage({ turn, busy, onEdit }: { turn: ChatTurn; busy: boolean; onEdit: (text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(turn.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  const editBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!editing) return;
    const el = ref.current;
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 200)}px`; }
  }, [editing]);
  const cancel = () => { setEditing(false); setText(turn.text); requestAnimationFrame(() => editBtn.current?.focus()); };
  const submit = () => { const t = text.trim(); if (!t || busy) return; setEditing(false); if (t !== turn.text) onEdit(t); };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
  };

  if (editing) {
    return (
      <div className="flex justify-end" data-testid="msg-user-edit" data-agent-esc-layer="">
        <form className="w-full max-w-[85%] rounded-2xl border border-input bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/30" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label htmlFor={`edit-${turn.id}`} className="sr-only">Sawaal badlo</label>
          <textarea id={`edit-${turn.id}`} ref={ref} value={text} maxLength={4000} onChange={(e) => { setText(e.target.value); e.currentTarget.style.height = "auto"; e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 200)}px`; }}
            onKeyDown={onKey} rows={1} className="w-full resize-none bg-transparent px-2 py-1.5 text-[15px] leading-6 text-foreground focus:outline-none" />
          <div className="flex items-center justify-end gap-2 pt-1">
            <span className="mr-auto px-2 text-[11px] text-muted-foreground">Iske baad ki baatein hat jayengi</span>
            <button type="button" onClick={cancel} className="h-10 rounded-md px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Cancel</button>
            <button type="submit" disabled={!text.trim() || busy} className="h-10 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">Send</button>
          </div>
        </form>
      </div>
    );
  }
  return (
    <div className="group flex items-start justify-end gap-1" data-testid="msg-user">
      <button ref={editBtn} type="button" onClick={() => { setText(turn.text); setEditing(true); }} disabled={busy} aria-label="Edit message" title="Edit and resend"
        className={`${actBtn} mt-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100`} data-testid="msg-edit">
        <Pencil aria-hidden="true" className="h-4 w-4" />
      </button>
      <p title={timeLabel(turn.at)} data-testid="msg-user-text"
        className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] leading-relaxed text-primary-foreground">
        {turn.text}
      </p>
    </div>
  );
}

export const AgentMessage = memo(function AgentMessage({ turn, h, ctx, isLast = false, onFeedback, onRegenerate, onEdit }: {
  turn: ChatTurn; h: BlockHandlers; ctx: Map<string, BlockContext>; isLast?: boolean;
  onFeedback: (turnId: string, v: Feedback, note?: string | null) => void;
  onRegenerate?: (turnId: string) => void; onEdit?: (turnId: string, text: string) => void;
}) {
  if (turn.role === "user") return <UserMessage turn={turn} busy={h.busy} onEdit={(t) => onEdit?.(turn.id, t)} />;
  const waiting = !turn.done && turn.blocks.length === 0;
  const groups = groupBlocks(turn.blocks);
  return (
    <div className="group flex gap-3" data-testid="msg-assistant" data-stopped={turn.stopped ? "" : undefined}>
      <AgentMark className="mt-0.5 hidden sm:grid" title={timeLabel(turn.at)} />
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
        {turn.stopped ? (
          <p className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground" data-testid="msg-stopped">
            <MinusCircle aria-hidden="true" className="h-3.5 w-3.5" />Aapne rok diya — jawab adhoora hai
          </p>
        ) : null}
        {turn.done && (turn.blocks.length > 0 || turn.stopped) ? (
          <Actions turn={turn} busy={h.busy} isLast={isLast} onFeedback={(v, note) => onFeedback(turn.id, v, note)} onRegenerate={() => onRegenerate?.(turn.id)} />
        ) : null}
      </div>
    </div>
  );
});
