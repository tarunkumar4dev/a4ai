// Sidebar calendar: today highlighted, a dot on days with one of your scheduled contests; those days are buttons
// that list the contests loaded for that day. "Today" comes from the server clock; days are the device's days.
// Bottom strip: the next scheduled contest with its countdown.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { serverNow } from "@/lib/serverClock";
import { actionView, contestPath, formatWhen, primaryAction, phaseAt, startsAt, type FeedContest } from "@/lib/contestLifecycle";
import { Countdown, FOCUS_RING } from "./ContestBits";
import { cn } from "@/lib/utils";

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const WEEK = ["S", "M", "T", "W", "T", "F", "S"];
const WEEK_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const time = (iso: string | null) => formatWhen(iso).split(", ").pop() ?? "";

export function ContestCalendar({ scheduled, contests, upNext, className }: {
  scheduled: string[]; contests: FeedContest[]; upNext: FeedContest | null; className?: string;
}) {
  const today = new Date(serverNow());
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [picked, setPicked] = useState<string | null>(null);
  const marked = useMemo(() => {
    const m = new Map<string, number>();
    for (const iso of scheduled) {
      const t = Date.parse(iso);
      if (Number.isFinite(t)) m.set(dayKey(new Date(t)), (m.get(dayKey(new Date(t))) ?? 0) + 1);
    }
    return m;
  }, [scheduled]);

  const first = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: first }, () => null),
    ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  const title = month.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const shift = (n: number) => { setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1)); setPicked(null); };
  const pickedList = picked
    ? contests.filter((c) => { const t = startsAt(c); return t != null && dayKey(new Date(t)) === picked; })
    : [];
  const pickedCount = picked ? marked.get(picked) ?? 0 : 0;
  const pickedDate = picked ? cells.find((d) => d && dayKey(d) === picked) : null;

  return (
    <section aria-labelledby="cal-title" className={cn("rounded-xl border border-[#E5E7EB] bg-white", className)}>
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5D6570]">Day {today.getDate()}</p>
            <h2 id="cal-title" className="font-halenoir text-[15px] font-bold text-[#1B1B1B]">{title}</h2>
          </div>
          <div className="flex gap-1">
            <button type="button" onClick={() => shift(-1)} aria-label="Previous month"
              className={cn("grid h-9 w-9 place-items-center rounded-lg text-[#1B1B1B] hover:bg-[#F5F6F8]", FOCUS_RING)}><ChevronLeft size={16} aria-hidden /></button>
            <button type="button" onClick={() => shift(1)} aria-label="Next month"
              className={cn("grid h-9 w-9 place-items-center rounded-lg text-[#1B1B1B] hover:bg-[#F5F6F8]", FOCUS_RING)}><ChevronRight size={16} aria-hidden /></button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-7 text-center">
          {WEEK.map((w, i) => <abbr key={i} title={WEEK_FULL[i]} className="pb-1 text-[11px] font-semibold text-[#5D6570] no-underline">{w}</abbr>)}
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />;
            const k = dayKey(d);
            const isToday = k === dayKey(today);
            const n = marked.get(k) ?? 0;
            const face = cn("relative mx-auto grid h-9 w-9 place-items-center rounded-full text-[13px] tabular-nums",
              isToday ? "bg-[#0E6B43] font-bold text-white" : picked === k ? "bg-[#14243A] font-semibold text-white" : "text-[#1B1B1B]");
            const dot = n > 0 && <span aria-hidden className={cn("absolute bottom-1 h-1 w-1 rounded-full", isToday || picked === k ? "bg-white" : "bg-[#A92532]")} />;
            return n > 0 ? (
              <button key={k} type="button" onClick={() => setPicked(picked === k ? null : k)} aria-pressed={picked === k}
                aria-label={`${d.getDate()} ${title}, ${n} contest${n > 1 ? "s" : ""}`} aria-current={isToday ? "date" : undefined}
                className={cn(face, "font-semibold hover:ring-2 hover:ring-[#A92532]/30", FOCUS_RING)}>
                {d.getDate()}{dot}
              </button>
            ) : (
              <span key={k} aria-current={isToday ? "date" : undefined} className={face}>{d.getDate()}</span>
            );
          })}
        </div>
      </div>
      {picked && (
        <div className="border-t border-[#E5E7EB] px-4 py-3" aria-live="polite">
          <p className="text-[12px] font-semibold text-[#5D6570]">
            {pickedDate?.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · {pickedCount} contest{pickedCount === 1 ? "" : "s"}
          </p>
          {pickedList.length ? (
            <ul className="mt-2 space-y-1.5">
              {pickedList.map((c) => {
                const v = actionView(primaryAction(c, phaseAt(c, serverNow())), c);
                return (
                  <li key={c.id}>
                    <Link to={v.href ?? contestPath(c)} className={cn("flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-[#F5F6F8]", FOCUS_RING)}>
                      <span className="truncate text-[13px] font-semibold text-[#1B1B1B]">{c.title}</span>
                      <span className="shrink-0 text-[12px] tabular-nums text-[#5D6570]">{time(c.scheduled_at)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-1 text-[12.5px] text-[#5D6570]">Switch to the tab it's in to see it in the list.</p>
          )}
        </div>
      )}
      {upNext && (
        <Link to={contestPath(upNext)} className={cn("flex items-center justify-between gap-3 rounded-b-xl border-t border-[#E5E7EB] bg-[#FBF4F5] px-4 py-3 hover:bg-[#F7E9EB]", FOCUS_RING)}>
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A92532]">Next scheduled</span>
            <span className="block truncate text-[13px] font-semibold text-[#1B1B1B]">{upNext.title}</span>
          </span>
          <Countdown at={startsAt(upNext) ?? serverNow()} className="shrink-0 text-[13px] font-bold text-[#1B1B1B]" />
        </Link>
      )}
    </section>
  );
}
