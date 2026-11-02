// Sidebar sections under the calendar: latest results (real leaderboard of your most recent finished contest,
// loaded only once the card is on screen), coins (only a balance read from the database), fair play.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Award, ShieldCheck, Trophy } from "lucide-react";
import { useContestBoard, useContestFeed } from "@/lib/contestFeed";
import { avatarColour, displayName, initials, leaderboardHref, rankRows } from "@/lib/leaderboard";
import { FOCUS_RING } from "./ContestBits";
import { cn } from "@/lib/utils";

/** true once the element has come within 200 px of the viewport (then stays true). */
function useSeen<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen || !ref.current) return;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) setSeen(true); }, { rootMargin: "200px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen] as const;
}

const MEDAL = ["bg-[#E5A526] text-[#1B1B1B]", "bg-[#D5D9DF] text-[#1B1B1B]", "bg-[#EBCBAF] text-[#1B1B1B]"];

export function LatestResults({ uid, isStudent }: { uid: string | null; isStudent: boolean }) {
  const [ref, seen] = useSeen<HTMLElement>();
  // same key as the Past tab's first page → shared cache, no extra request after visiting that tab
  const past = useContestFeed(uid, "past", "", "", seen);
  const pick = past.data?.pages[0]?.items.find((c) =>
    c.my_state === "owner" ? c.attempts > 0 : c.my_state === "submitted" && !c.results_pending) ?? null;
  const board = useContestBoard(uid, pick?.id ?? null, seen);
  const rows = board.data && !board.data.results_pending ? rankRows(board.data.attempts) : [];
  const top = rows.slice(0, 3);
  const me = rows.find((r) => r.is_me);
  const loading = !seen || past.isPending || (!!pick && board.isPending);

  return (
    <section ref={ref} aria-labelledby="results-title" className="rounded-xl border border-[#E5E7EB] bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#FBF4F5] text-[#A92532]"><Trophy size={16} aria-hidden /></span>
        <div className="min-w-0">
          <h2 id="results-title" className="font-halenoir text-[15px] font-bold text-[#1B1B1B]">Latest results</h2>
          {pick && <p className="truncate text-[12px] text-[#5D6570]" title={pick.title}>{pick.title}</p>}
        </div>
      </div>
      {loading ? (
        <ul aria-hidden className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => <li key={i} className="h-9 rounded-lg bg-[#F5F6F8]" />)}
        </ul>
      ) : !pick || board.isError || !top.length ? (
        <p className="mt-3 rounded-lg bg-[#F5F6F8] px-3 py-3 text-[12.5px] leading-relaxed text-[#5D6570]">
          {board.isError ? "Results couldn't load right now."
            : isStudent ? "Finish a contest and its top scorers show up here." : "Top scorers of your contests show up here once students submit."}
        </p>
      ) : (
        <>
          <ol className="mt-3 space-y-1">
            {top.map((r, i) => (
              <li key={r.attempt_id} className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5", r.is_me && "bg-[#EAF1FB]")}>
                <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums", MEDAL[i] ?? "bg-[#F1F2F4]")}>{r.rank}</span>
                <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: avatarColour(displayName(r)) }}>
                  {initials(r.student_name)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#1B1B1B]">{displayName(r)}{r.is_me ? " (you)" : ""}</span>
                <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-[#1B1B1B]">{r.score}<span className="font-normal text-[#5D6570]">/{r.total_marks}</span></span>
              </li>
            ))}
          </ol>
          {me && !top.includes(me) && (
            <p className="mt-2 rounded-lg bg-[#EAF1FB] px-3 py-2 text-[12.5px] text-[#1D4F99]">
              You: <b className="tabular-nums">#{me.rank}</b> of {board.data?.total_participants ?? rows.length} · <span className="tabular-nums">{me.score}/{me.total_marks}</span>
            </p>
          )}
          <Link to={leaderboardHref(pick.short_code, pick.id)} className={cn("mt-2 inline-flex h-9 items-center gap-1 rounded-lg text-[13px] font-semibold text-[#A92532] hover:underline", FOCUS_RING)}>
            Full leaderboard <ArrowRight size={14} aria-hidden />
          </Link>
        </>
      )}
    </section>
  );
}

export function CoinsCard({ balance }: { balance: number }) {
  return (
    <section className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#FFF8E8] text-[#7A5200]"><Award size={18} aria-hidden /></span>
        <div>
          <p className="text-[12px] text-[#5D6570]">Your coins</p>
          <p className="font-halenoir text-[17px] font-extrabold tabular-nums text-[#1B1B1B]">{balance.toLocaleString("en-IN")}</p>
        </div>
      </div>
      <Link to="/rewards" className={cn("inline-flex h-9 items-center rounded-lg px-2 text-[13px] font-semibold text-[#A92532] hover:underline", FOCUS_RING)}>History</Link>
    </section>
  );
}

export function FairPlay() {
  return (
    <section className="flex gap-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
      <ShieldCheck size={18} aria-hidden className="mt-0.5 shrink-0 text-[#0E6B43]" />
      <div>
        <h2 className="text-[13px] font-semibold text-[#1B1B1B]">Fair play</h2>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#5D6570]">
          Contests are timed. Your answers save as you go, and tab switches are counted when your teacher turns that on.
        </p>
      </div>
    </section>
  );
}
