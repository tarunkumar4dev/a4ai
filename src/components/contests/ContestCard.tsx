// One contest as a compact card (study-plan style): subject tile + title + status, a 3-cell fact strip
// (when · duration · questions or attempts), then countdown / score and the one action from contestLifecycle.
import { memo } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock3, Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  actionView, contestShareUrl, formatWhen, nextBoundary, primaryAction, type FeedContest, type Phase,
} from "@/lib/contestLifecycle";
import { serverNow } from "@/lib/serverClock";
import { BTN, Countdown, PhasePill, useOnPhaseChange, usePhase } from "./ContestBits";
import { SubjectTile } from "@/components/student/subjectStyle";
import { cn } from "@/lib/utils";

async function copyLink(c: FeedContest) {
  const url = contestShareUrl(c);
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Contest link copied");
  } catch {
    toast.message("Copy this link", { description: url });
  }
}

export function ActionButton({ c, phase, className }: { c: FeedContest; phase: Phase; className?: string }) {
  const a = primaryAction(c, phase);
  const v = actionView(a, c);
  const cls = cn(
    "inline-flex h-10 min-w-[108px] items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold whitespace-nowrap",
    BTN[v.tone], className,
  );
  if (v.href) return <Link to={v.href} className={cls} aria-label={`${v.label}: ${c.title}`}>{v.label}</Link>;
  return (
    <span className={cls} aria-disabled="true">
      {a.kind === "registered" && <CheckCircle2 size={15} aria-hidden />}
      {a.kind === "result_pending" && <Clock3 size={15} aria-hidden />}
      {v.label}
    </span>
  );
}

/** "Sun, 3 Nov · 7:30 pm" */
const shortWhen = (iso: string | null) => formatWhen(iso).replace(/, (\d{1,2}:\d\d)/, " · $1");

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#5D6570]">{label}</dt>
      <dd className="mt-0.5 truncate text-[12.5px] font-semibold tabular-nums text-[#1B1B1B]" title={value}>{value}</dd>
    </div>
  );
}

function Footer({ c, phase }: { c: FeedContest; phase: Phase }) {
  if (c.my_state === "submitted") {
    if (c.results_pending) return <span className="text-[#7A5200]">Teacher will publish results</span>;
    if (c.my_score == null) return <span className="text-[#5D6570]">Submitted {formatWhen(c.my_submitted_at)}</span>;
    return (
      <span className="tabular-nums">
        <span className="text-[17px] font-bold text-[#1B1B1B]">{c.my_score}</span>
        {c.total_marks ? <span className="text-[#5D6570]">/{c.total_marks}</span> : null}
        {c.my_percentage != null && <span className="ml-1.5 font-semibold text-[#0E6B43]">{Math.round(c.my_percentage)}%</span>}
      </span>
    );
  }
  const b = nextBoundary(c, serverNow());
  if (b) {
    return (
      <span>
        <span className="text-[#5D6570]">{b.label} </span>
        <Countdown at={b.at} className="text-[15px] font-bold text-[#1B1B1B]" />
      </span>
    );
  }
  if (c.my_state === "owner") return <span className="text-[#5D6570]">{phase === "live" ? "Open, no end time" : phase === "ended" ? "Ended" : "Paused"}</span>;
  if (phase === "ended") return <span className="text-[#5D6570]">Ended {formatWhen(c.expires_at)}</span>;
  if (phase === "paused") return <span className="text-[#5D6570]">Paused by the teacher</span>;
  if (c.my_state === "in_progress") return <span className="inline-flex items-center gap-1.5 font-semibold text-[#7A5200]"><span className="h-1.5 w-1.5 rounded-full bg-[#E5A526]" aria-hidden />Attempt in progress</span>;
  if (c.my_state === "registered") return <span className="font-semibold text-[#1D4F99]">You're registered</span>;
  return <span className="font-semibold text-[#0E6B43]">Open now</span>;
}

export const ContestCard = memo(function ContestCard({ c, onZero }: { c: FeedContest; onZero: () => void }) {
  const phase = usePhase(c);
  useOnPhaseChange(phase, onZero);
  const sub = [c.subject, c.class_grade ? `Class ${c.class_grade}` : null].filter(Boolean).join(" · ");
  const when = c.scheduled_at ? shortWhen(c.scheduled_at)
    : phase === "ended" ? `Ended ${formatWhen(c.expires_at).split(",").slice(0, 2).join(",")}` : "Open now";
  return (
    <article className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-4 transition-[border-color,box-shadow] hover:border-[#CBD0D7] hover:shadow-[0_2px_10px_rgba(20,36,58,0.06)]">
      <div className="flex items-start gap-3">
        <SubjectTile subject={c.subject} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-halenoir text-[15px] font-bold leading-snug text-[#1B1B1B]" title={c.title}>{c.title}</h3>
          <p className="mt-0.5 truncate text-[12.5px] text-[#5D6570]">{sub || "Contest"}</p>
        </div>
        <PhasePill phase={phase} done={c.my_state === "submitted"} />
      </div>
      <dl className="mt-3 grid grid-cols-[1.6fr_1fr_1fr] gap-3 rounded-lg bg-[#F5F6F8] px-3 py-2.5">
        <Fact label={c.scheduled_at ? "Starts" : "When"} value={when} />
        <Fact label="Duration" value={c.duration_minutes ? `${c.duration_minutes} min` : "—"} />
        {c.my_state === "owner"
          ? <Fact label="Attempts" value={String(c.attempts)} />
          : <Fact label="Questions" value={c.total_questions ? String(c.total_questions) : "—"} />}
      </dl>
      <div className="mt-3 flex min-h-[40px] items-center justify-between gap-2">
        <div className="min-w-0 text-[12.5px]"><Footer c={c} phase={phase} /></div>
        <div className="flex shrink-0 items-center gap-1.5">
          {c.my_state === "owner" && phase !== "ended" && (
            <button type="button" onClick={() => copyLink(c)} aria-label={`Copy link for ${c.title}`} title="Copy contest link"
              className={cn("inline-flex h-10 w-10 items-center justify-center rounded-lg", BTN.secondary)}>
              <Link2 size={16} aria-hidden />
            </button>
          )}
          <ActionButton c={c} phase={phase} />
        </div>
      </div>
    </article>
  );
});

/** Same box as a card, so nothing jumps when the data arrives. */
export function ContestCardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-[10px] bg-[#EEF0F3]" />
        <div className="flex-1 space-y-2 pt-1"><div className="h-3.5 w-3/4 rounded bg-[#EEF0F3]" /><div className="h-3 w-1/3 rounded bg-[#EEF0F3]" /></div>
        <div className="h-6 w-16 rounded-md bg-[#EEF0F3]" />
      </div>
      <div className="mt-3 h-[52px] rounded-lg bg-[#F5F6F8]" />
      <div className="mt-3 flex h-10 items-center justify-between"><div className="h-3.5 w-28 rounded bg-[#EEF0F3]" /><div className="h-10 w-[108px] rounded-lg bg-[#EEF0F3]" /></div>
    </div>
  );
}
