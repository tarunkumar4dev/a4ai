// /contests — contest home in the LeetCode layout: top nav, featured banner row, Live / Starting soon / Completed
// sections of contest cards, right sidebar (calendar, latest results, coins). Real data only (get_my_contests,
// 29_contest_feed.sql: contests you own, registered for or attempted). No animations (lite mode); one sticky
// element (the nav). Data / timing logic lives in lib/contestFeed, lib/contestLifecycle and lib/serverClock.
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, KeyRound, RefreshCw, Search, SlidersHorizontal, Trophy, X } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useAccess } from "@/context/AccessProvider";
import { useCoins } from "@/context/CoinContext";
import { supabase } from "@/lib/supabaseClient";
import { resolveHomeRoute } from "@/lib/homeRoute";
import { serverNow } from "@/lib/serverClock";
import { phaseAt, startsAt, type FeedContest } from "@/lib/contestLifecycle";
import {
  FeedError, FEED_ERROR_TEXT, contestKeys, reportContestError, useContestFeed, useContestsChangedListener, type FeedView,
} from "@/lib/contestFeed";
import { FOCUS_RING } from "@/components/contests/ContestBits";
import { ContestCard, ContestCardSkeleton } from "@/components/contests/ContestCard";
import { FeaturedBanner, PracticeCreateBanner } from "@/components/contests/ContestBanners";
import { JOIN_INPUT_ID, JoinCodeCard } from "@/components/contests/JoinCodeCard";
import { StudentNav } from "@/components/student/StudentNav";
import { EmptyState as Notice } from "@/components/student/Parts";
import { ContestCalendar } from "@/components/contests/ContestCalendar";
import { CoinsCard, FairPlay, LatestResults } from "@/components/contests/ContestSidebar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Scroll the code box into view (it may be off screen in the phone banner row) and focus it. */
function focusJoin() {
  const el = document.getElementById(JOIN_INPUT_ID) as HTMLInputElement | null;
  el?.scrollIntoView({ block: "nearest", inline: "center" });
  el?.focus({ preventScroll: true });
}

/* ─────────────── list pieces ─────────────── */

function Tabs({ view, setView, counts }: { view: FeedView; setView: (v: FeedView) => void; counts?: { upcoming: number; past: number } }) {
  const tabs: { id: FeedView; label: string; n?: number }[] = [
    { id: "upcoming", label: "Live & upcoming", n: counts?.upcoming },
    { id: "past", label: "Past", n: counts?.past },
  ];
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = view === "upcoming" ? "past" : "upcoming";
    setView(next);
    document.getElementById(`tab-${next}`)?.focus();
  };
  return (
    <div role="tablist" aria-label="Contests" className="flex gap-4 min-[380px]:gap-6" onKeyDown={onKey}>
      {tabs.map((t) => {
        const on = t.id === view;
        return (
          <button key={t.id} id={`tab-${t.id}`} role="tab" type="button" aria-selected={on} aria-controls="contest-list"
            tabIndex={on ? 0 : -1} onClick={() => setView(t.id)}
            className={cn("relative -mb-px inline-flex h-12 items-center gap-2 whitespace-nowrap border-b-2 text-[15px] font-semibold",
              on ? "border-[#A92532] text-[#1B1B1B]" : "border-transparent text-[#5D6570] hover:text-[#1B1B1B]", FOCUS_RING)}>
            {t.label}
            {t.n != null && (
              <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-semibold tabular-nums", on ? "bg-[#FBF4F5] text-[#A92532]" : "bg-[#F1F2F4] text-[#5D6570]")}>{t.n}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function SubjectChips({ subjects, subject, setSubject, className, wrap }: {
  subjects: { name: string; count: number }[]; subject: string; setSubject: (s: string) => void; className?: string; wrap?: boolean;
}) {
  if (!subjects.length) return null;
  const chip = (on: boolean) => cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium",
    on ? "border-[#14243A] bg-[#14243A] text-white" : "border-[#E5E7EB] bg-white text-[#1B1B1B] hover:border-[#9CA3AF]", FOCUS_RING);
  return (
    <div role="group" aria-label="Filter by subject" className={cn("flex gap-2", wrap ? "flex-wrap" : "overflow-x-auto [scrollbar-width:none]", className)}>
      <button type="button" aria-pressed={!subject} className={chip(!subject)} onClick={() => setSubject("")}>All subjects</button>
      {subjects.map((s) => {
        const on = subject.toLowerCase() === s.name.toLowerCase();
        return (
          <button key={s.name} type="button" aria-pressed={on} className={chip(on)} onClick={() => setSubject(on ? "" : s.name)}>
            {s.name}
            <span className={cn("text-[12px] tabular-nums", on ? "text-white/80" : "text-[#5D6570]")}>{s.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function Section({ title, count, tone, children }: { title: string; count?: number; tone: "live" | "soon" | "done"; children: ReactNode }) {
  const dot = tone === "live" ? "bg-[#168B59]" : tone === "soon" ? "bg-[#246BCE]" : "bg-[#14243A]";
  return (
    <section aria-label={title} className="mt-5 first:mt-4">
      <div className="mb-3 flex items-center gap-3">
        <span className={cn("h-2 w-2 rounded-full", dot)} aria-hidden />
        <h2 className="font-halenoir text-[17px] font-bold text-[#1B1B1B]">{title}</h2>
        {count != null && <span className="text-[13px] font-medium tabular-nums text-[#5D6570]">{count}</span>}
        <span className="h-px flex-1 bg-[#E5E7EB]" aria-hidden />
      </div>
      <ul className="grid gap-3 md:grid-cols-2">{children}</ul>
    </section>
  );
}

const DARK_BTN = cn("inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#14243A] px-4 text-[13px] font-semibold text-white hover:bg-[#0B1626]", FOCUS_RING);

/* ─────────────── page ─────────────── */

export default function ContestLandingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { user, role } = useAuth();
  const { access } = useAccess();
  const { balance } = useCoins();
  const uid = user?.id ?? null;
  const isStudent = (role || "").toLowerCase().trim() === "student";
  const home = resolveHomeRoute(access, role);
  const name = (user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "").trim();

  const [view, setView] = useState<FeedView>("upcoming");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim().slice(0, 80), 300);
  const [subject, setSubject] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  useContestsChangedListener(uid);
  const feed = useContestFeed(uid, view, search, subject);
  const first = feed.data?.pages[0];
  const items = useMemo(() => {
    const seen = new Set<string>();
    return (feed.data?.pages ?? []).flatMap((p) => p.items).filter((c) => !seen.has(c.id) && !!seen.add(c.id));
  }, [feed.data]);

  useEffect(() => {
    if (feed.error) reportContestError("feed", feed.error);
  }, [feed.error]);

  // "Enter contest code" from the student dashboard / old /contests/join links → focus the code box once
  useEffect(() => {
    if (params.get("join") !== "1") return;
    focusJoin();
    params.delete("join");
    setParams(params, { replace: true });
  }, [params, setParams]);

  // A countdown reached 0: ask the server again (≤ once per 5 s, however many cards flip at once). The button
  // already flipped on the shared clock; the refetch only re-syncs, so it waits 0–3 s at random — everyone
  // waiting for the same contest hits 0 in the same server second, and must not refetch in that second.
  const lastZero = useRef(0);
  const onZero = useCallback(() => {
    if (!uid || Date.now() - lastZero.current < 5000) return;
    lastZero.current = Date.now();
    setTimeout(() => qc.invalidateQueries({ queryKey: contestKeys.all(uid) }), Math.random() * 3000);
  }, [qc, uid]);

  const clearFilters = () => { setSearchInput(""); setSubject(""); };
  const switchView = (v: FeedView) => { setView(v); setSubject(""); };
  const errorKind = feed.error instanceof FeedError ? feed.error.kind : feed.error ? "server" : null;
  const firstLoad = feed.isPending && !!uid;
  const total = subject ? first?.subjects.find((s) => s.name.toLowerCase() === subject.toLowerCase())?.count : first?.counts[view];
  const activeFilters = (search ? 1 : 0) + (subject ? 1 : 0);

  // Upcoming view is sorted by start time, so every live contest comes before every scheduled one — the two
  // sections follow the server's page order exactly.
  const now = serverNow();
  const live = view === "upcoming" ? items.filter((c) => phaseAt(c, now) !== "scheduled") : [];
  const soon = view === "upcoming" ? items.filter((c) => phaseAt(c, now) === "scheduled") : [];
  const next = first?.next ?? null;
  const upNext = soon.find((c) => c.id !== next?.id && startsAt(c) != null) ?? null;

  const signInAgain = async () => {
    await supabase.auth.signOut().catch(() => undefined);
    navigate("/login", { replace: true });
  };

  const joinCta = isStudent
    ? <button type="button" onClick={focusJoin} className={DARK_BTN}><KeyRound size={14} aria-hidden /> Enter a code</button>
    : <Link to="/dashboard/test-generator?tab=contest-pdf" className={DARK_BTN}>Create from PDF</Link>;
  const card = (c: FeedContest) => <li key={c.id} className="list-none"><ContestCard c={c} onZero={onZero} /></li>;

  return (
    <div className="min-h-screen bg-white text-[#1B1B1B]">
      <Helmet><title>Contests · a4ai</title></Helmet>
      <StudentNav home={home} isStudent={isStudent} name={name} email={user?.email ?? null} balance={balance} />

      <main className="mx-auto max-w-[1280px] px-4 pb-[calc(3rem+env(safe-area-inset-bottom))] pt-5 lg:px-6 lg:pt-7">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <div>
                <h1 className="font-halenoir text-[26px] font-extrabold leading-tight tracking-tight md:text-[30px]">Contests</h1>
                <p className="mt-0.5 text-[13.5px] text-[#5D6570]">
                  {isStudent ? "Your teachers' contests, live countdowns and where you rank." : "Your contests, who's taking them and how they did."}
                </p>
              </div>
              {first && !search && !subject && first.counts.upcoming + first.counts.past > 0 && (
                <ul aria-label="Summary" className="flex gap-2 text-[12.5px] font-semibold">
                  <li className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#E5E7EB] px-3 text-[#0E6B43]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#168B59]" aria-hidden /><span className="tabular-nums">{first.counts.live}</span> live
                  </li>
                  <li className="inline-flex h-8 items-center gap-1 rounded-full border border-[#E5E7EB] px-3 text-[#1D4F99]">
                    <span className="tabular-nums">{Math.max(0, first.counts.upcoming - first.counts.live)}</span> upcoming
                  </li>
                  <li className="inline-flex h-8 items-center gap-1 rounded-full border border-[#E5E7EB] px-3 text-[#5D6570]">
                    <span className="tabular-nums">{first.counts.past}</span> past
                  </li>
                </ul>
              )}
            </div>

            {/* featured: swipe row (one at a time on phones, no autoplay) → three columns from xl */}
            <div className="-mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:-mx-6 lg:scroll-px-6 lg:px-6 xl:mx-0 xl:grid xl:grid-cols-3 xl:gap-4 xl:overflow-visible xl:px-0 xl:pb-0">
              <FeaturedBanner next={next} loading={firstLoad} isStudent={isStudent} onZero={onZero} onJoin={focusJoin} />
              <JoinCodeCard uid={uid} onZero={onZero} />
              <PracticeCreateBanner isStudent={isStudent} />
            </div>

            {/* category navigation */}
            <div className="mt-8 flex items-end justify-between gap-3 border-b border-[#E5E7EB]">
              <Tabs view={view} setView={switchView} counts={first?.counts} />
              <div className="flex items-center gap-2 pb-2">
                {feed.isFetching && !firstLoad && (
                  <span className="hidden items-center gap-1 text-[12px] text-[#5D6570] lg:inline-flex" role="status">
                    <RefreshCw size={12} aria-hidden /> Updating
                  </span>
                )}
                <div className="relative hidden md:block">
                  <label htmlFor="contest-search" className="sr-only">Search your contests</label>
                  <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5D6570]" />
                  <input id="contest-search" type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search title, subject or code" maxLength={80}
                    className="h-9 w-60 rounded-lg border border-[#E5E7EB] bg-[#F5F6F8] pl-9 pr-3 text-[13.5px] text-[#1B1B1B] placeholder:text-[#6B7280] outline-none focus:border-[#246BCE] focus:bg-white focus:ring-2 focus:ring-[#246BCE]/20" />
                </div>
                <button type="button" onClick={() => setSheetOpen(true)}
                  className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#D5D9DF] px-3 text-[13px] font-semibold text-[#1B1B1B] md:hidden", FOCUS_RING)}>
                  <SlidersHorizontal size={15} aria-hidden /> <span className="sr-only min-[380px]:not-sr-only">Filters</span>
                  {activeFilters > 0 && <span className="rounded-full bg-[#14243A] px-1.5 text-[11px] text-white">{activeFilters}</span>}
                </button>
              </div>
            </div>
            <SubjectChips subjects={first?.subjects ?? []} subject={subject} setSubject={setSubject} className="-mx-4 mt-3 px-4 md:mx-0 md:px-0" />

            <div id="contest-list" role="tabpanel" aria-labelledby={`tab-${view}`} aria-busy={feed.isFetching}>
              {errorKind && items.length === 0 ? (
                errorKind === "missing" ? (
                  <Notice className="mt-4" icon={<CalendarClock size={26} aria-hidden />} title="Your contest list is almost ready"
                    body="The list switches on with the next server update. You can already join a contest with its code." action={joinCta} />
                ) : (
                  <div role="alert">
                    <Notice className="mt-4" icon={<RefreshCw size={24} aria-hidden />} title={FEED_ERROR_TEXT[errorKind]}
                      action={errorKind === "auth"
                        ? <button type="button" onClick={signInAgain} className={DARK_BTN}>Sign in again</button>
                        : <button type="button" onClick={() => feed.refetch()} className={DARK_BTN}><RefreshCw size={14} aria-hidden /> Try again</button>} />
                  </div>
                )
              ) : firstLoad ? (
                <ul aria-hidden className="mt-4 grid gap-3 md:grid-cols-2">
                  {[0, 1, 2, 3].map((i) => <li key={i} className="list-none"><ContestCardSkeleton /></li>)}
                </ul>
              ) : items.length === 0 ? (
                search || subject ? (
                  <Notice className="mt-4" icon={<Search size={24} aria-hidden />} title={`No contests match${search ? ` "${search}"` : ""}${subject ? ` in ${subject}` : ""}`}
                    action={<button type="button" onClick={clearFilters} className={DARK_BTN}>Clear filters</button>} />
                ) : (
                  <Notice className="mt-4" icon={<Trophy size={26} aria-hidden />}
                    title={view === "upcoming" ? "No live or upcoming contests" : "No past contests yet"}
                    body={isStudent
                      ? view === "upcoming" ? "Got a code or link from your teacher? Enter it and the contest appears here with a countdown." : "Contests you finish show up here with your score."
                      : view === "upcoming" ? "Create a contest from a question paper PDF and share its link with your class." : "Contests that have ended show up here."}
                    action={view === "upcoming" ? joinCta : undefined} />
                )
              ) : (
                <div className={cn(feed.isPlaceholderData && "opacity-60")}>
                  {errorKind && (
                    <p role="status" className="mt-4 rounded-lg border border-[#F2D9A2] bg-[#FFF8E8] px-4 py-2 text-[12.5px] text-[#7A5200]">
                      Couldn't refresh — showing the last loaded list.{" "}
                      <button type="button" onClick={() => feed.refetch()} className="font-semibold underline underline-offset-2">Try again</button>
                    </p>
                  )}
                  {view === "upcoming" ? (
                    <>
                      {live.length > 0 && <Section title="Live now" count={subject || search ? undefined : first?.counts.live} tone="live">{live.map(card)}</Section>}
                      {soon.length > 0 && <Section title="Starting soon" tone="soon">{soon.map(card)}</Section>}
                    </>
                  ) : (
                    <Section title="Completed & closed" tone="done">{items.map(card)}</Section>
                  )}
                  <div className="mt-5 flex items-center justify-between gap-3 text-[12.5px] text-[#5D6570]">
                    <span className="tabular-nums">Showing {items.length}{total != null && total >= items.length ? ` of ${total}` : ""}</span>
                    {feed.hasNextPage && (
                      <button type="button" onClick={() => feed.fetchNextPage()} disabled={feed.isFetchingNextPage}
                        className={cn("inline-flex h-10 items-center rounded-lg border border-[#D5D9DF] px-5 text-[13px] font-semibold text-[#1B1B1B] hover:border-[#9CA3AF] disabled:opacity-60", FOCUS_RING)}>
                        {feed.isFetchingNextPage ? "Loading…" : "Load more"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* sidebar on desktop; under the list on phones and tablets */}
          <aside aria-label="Calendar and results" className="mt-10 space-y-4 lg:mt-0">
            <ContestCalendar scheduled={first?.scheduled ?? []} contests={items} upNext={upNext} />
            <LatestResults uid={uid} isStudent={isStudent} />
            {balance != null && <CoinsCard balance={balance} />}
            <FairPlay />
          </aside>
        </div>
      </main>

      {/* phone filters: one bottom sheet instead of sticky filter bars */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
          <SheetHeader className="text-left">
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Search and narrow your contests.</SheetDescription>
          </SheetHeader>
          <label htmlFor="contest-search-m" className="mt-4 block text-[13px] font-semibold text-[#1B1B1B]">Search</label>
          <div className="relative mt-1.5">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5D6570]" />
            <input id="contest-search-m" type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Title, subject or code" maxLength={80}
              className="h-11 w-full rounded-lg border border-[#D5D9DF] bg-white pl-9 pr-10 text-[15px] text-[#1B1B1B] outline-none focus:border-[#246BCE] focus:ring-2 focus:ring-[#246BCE]/20" />
            {searchInput && (
              <button type="button" aria-label="Clear search" onClick={() => setSearchInput("")}
                className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center text-[#5D6570]"><X size={16} aria-hidden /></button>
            )}
          </div>
          {(first?.subjects.length ?? 0) > 0 && (
            <>
              <p className="mt-4 text-[13px] font-semibold text-[#1B1B1B]">Subject</p>
              <SubjectChips subjects={first!.subjects} subject={subject} setSubject={setSubject} className="mt-2" wrap />
            </>
          )}
          <div className="mt-6 flex gap-2">
            <button type="button" onClick={clearFilters} className="h-11 flex-1 rounded-lg border border-[#D5D9DF] text-[14px] font-semibold text-[#1B1B1B]">Clear</button>
            <button type="button" onClick={() => setSheetOpen(false)} className="h-11 flex-[2] rounded-lg bg-[#14243A] text-[14px] font-semibold text-white">
              {total != null ? `Show ${total} contest${total === 1 ? "" : "s"}` : "Show contests"}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
