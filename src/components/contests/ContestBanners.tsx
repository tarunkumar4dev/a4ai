// Featured banner row: crimson = the contest that matters now (real data from get_my_contests.next), royal blue =
// join with a code (JoinCodeCard), golden = practice (students) / create (teachers). Solid colours, decorative
// geometry at the corners only (aria-hidden, low opacity, never behind body text). No images.
// Text contrast: white on #A92532 7.0:1, #FBE3E5 on #A92532 5.7:1, #1B1B1B on #E5A526 8.0:1, #4A3500 on #E5A526 5.4:1.
import { Link } from "react-router-dom";
import { ArrowRight, KeyRound } from "lucide-react";
import { actionView, formatWhen, nextBoundary, primaryAction, type FeedContest } from "@/lib/contestLifecycle";
import { serverNow } from "@/lib/serverClock";
import { Countdown, useOnPhaseChange, usePhase } from "./ContestBits";
import { BannerGeometry, EYEBROW } from "@/components/student/Banner";
import { cn } from "@/lib/utils";

/** One banner box for all three: same height everywhere (no layout shift), one visible at a time on phones. */
export const BANNER_BOX =
  "relative flex h-[228px] w-[88%] shrink-0 snap-start flex-col overflow-hidden rounded-xl p-5 sm:w-[62%] lg:w-[46%] xl:w-auto xl:shrink";

const ON_DARK_BTN = "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-white px-4 text-[13px] font-semibold text-[#1B1B1B] hover:bg-[#F5F6F8] outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#A92532]";
const NAVY_BTN = "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#14243A] px-4 text-[13px] font-semibold text-white hover:bg-[#0B1626] outline-none focus-visible:ring-2 focus-visible:ring-[#14243A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#E5A526]";

function FeaturedContent({ c, onZero }: { c: FeedContest; onZero: () => void }) {
  const phase = usePhase(c);
  useOnPhaseChange(phase, onZero);
  const view = actionView(primaryAction(c, phase), c);
  const b = nextBoundary(c, serverNow());
  const label = c.my_state === "in_progress" ? "Your attempt is open" : c.my_state === "owner" ? "Your contest"
    : phase === "live" ? "Live now" : phase === "scheduled" ? "Next contest" : "Contest";
  const meta = [
    c.scheduled_at ? formatWhen(c.scheduled_at) : null, c.duration_minutes ? `${c.duration_minutes} min` : null,
    c.total_questions ? `${c.total_questions} questions` : null,
  ].filter(Boolean).join(" · ");
  return (
    <div className="relative flex h-full flex-col">
      <span className={cn(EYEBROW, "bg-white/15 text-white")}>
        {phase === "live" && <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />}
        {label}
      </span>
      <h2 id="featured-title" className="mt-2.5 line-clamp-2 pr-6 font-halenoir text-[22px] font-extrabold leading-[1.15]" title={c.title}>{c.title}</h2>
      <p className="mt-1.5 truncate text-[13px] text-[#FBE3E5]">{meta || c.subject || "Open now"}</p>
      <div className="mt-auto flex items-end justify-between gap-3">
        <div className="min-w-0">
          {b ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#FBE3E5]">{b.label}</p>
              <Countdown at={b.at} className="mt-0.5 block font-halenoir text-[26px] font-extrabold leading-none" />
            </>
          ) : (
            <p className="text-[15px] font-bold">{phase === "live" ? "Open now" : phase === "paused" ? "Paused" : ""}</p>
          )}
        </div>
        {view.href ? (
          <Link to={view.href} className={ON_DARK_BTN}>{view.label} <ArrowRight size={14} aria-hidden /></Link>
        ) : (
          <span className="inline-flex h-10 shrink-0 items-center rounded-lg bg-white/15 px-4 text-[13px] font-semibold">{view.label}</span>
        )}
      </div>
    </div>
  );
}

export function FeaturedBanner({ next, loading, isStudent, onZero, onJoin }: {
  next: FeedContest | null; loading: boolean; isStudent: boolean; onZero: () => void; onJoin: () => void;
}) {
  return (
    <section aria-labelledby="featured-title" className={cn(BANNER_BOX, "bg-[#A92532] text-white")}>
      <BannerGeometry variant="crimson" />
      {loading ? (
        <div className="relative flex h-full flex-col" aria-hidden>
          <div className="h-6 w-28 rounded-md bg-white/15" />
          <div className="mt-3 h-6 w-4/5 rounded bg-white/15" />
          <div className="mt-2 h-4 w-1/2 rounded bg-white/10" />
          <div className="mt-auto flex items-end justify-between"><div className="h-8 w-32 rounded bg-white/15" /><div className="h-10 w-28 rounded-lg bg-white/20" /></div>
        </div>
      ) : next ? (
        <FeaturedContent c={next} onZero={onZero} />
      ) : (
        <div className="relative flex h-full flex-col">
          <span className={cn(EYEBROW, "bg-white/15 text-white")}>a4ai contests</span>
          <h2 id="featured-title" className="mt-2.5 font-halenoir text-[22px] font-extrabold leading-[1.15]">
            {isStudent ? "Your next contest shows up here" : "Run your first contest"}
          </h2>
          <p className="mt-1.5 max-w-[36ch] text-[13px] text-[#FBE3E5]">
            {isStudent ? "Register with your teacher's code and you'll get a live countdown to the start."
              : "Upload a question paper with its key. Students join with one link."}
          </p>
          <div className="mt-auto">
            {isStudent ? (
              <button type="button" onClick={onJoin} className={ON_DARK_BTN}><KeyRound size={14} aria-hidden /> Enter a code</button>
            ) : (
              <Link to="/dashboard/test-generator?tab=contest-pdf" className={ON_DARK_BTN}>Create from PDF <ArrowRight size={14} aria-hidden /></Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function PracticeCreateBanner({ isStudent }: { isStudent: boolean }) {
  return (
    <section aria-labelledby="third-title" className={cn(BANNER_BOX, "bg-[#E5A526] text-[#1B1B1B]")}>
      <BannerGeometry variant="gold" />
      <div className="relative flex h-full flex-col">
        <span className={cn(EYEBROW, "bg-[#1B1B1B]/10 text-[#1B1B1B]")}>{isStudent ? "Practice" : "For teachers"}</span>
        <h2 id="third-title" className="mt-2.5 font-halenoir text-[22px] font-extrabold leading-[1.15]">
          {isStudent ? "Warm up for the next one" : "Create a contest"}
        </h2>
        <p className="mt-1.5 max-w-[34ch] text-[13px] text-[#4A3500]">
          {isStudent ? "Chapter-wise practice between contests keeps you sharp." : "Turn a question paper PDF into a timed contest with one share link."}
        </p>
        <div className="mt-auto flex flex-wrap gap-2">
          {isStudent ? (
            <Link to="/practice" className={NAVY_BTN}>Open practice <ArrowRight size={14} aria-hidden /></Link>
          ) : (
            <>
              <Link to="/dashboard/test-generator?tab=contest-pdf" className={NAVY_BTN}>From PDF</Link>
              <Link to="/contests/mine" className="inline-flex h-10 items-center rounded-lg border border-[#1B1B1B]/40 px-4 text-[13px] font-semibold text-[#1B1B1B] hover:bg-[#1B1B1B]/[0.06] outline-none focus-visible:ring-2 focus-visible:ring-[#14243A]">
                My contests
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
