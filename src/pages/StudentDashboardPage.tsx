// /student/dashboard — the student's home. Real data only:
//   contests → get_my_contests (same cache as /contests), coins → CoinContext (real balance or "—"),
//   practice → this device's marks (always labelled), profile → profiles.full_name / school_name.
// No streak or study time (no data for them), no sample numbers, no "free coins" popup (it credited nothing).
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight, Award, BookOpen, CalendarClock, CheckCircle2, Circle, History, KeyRound, Languages, Layers, ListChecks,
  RotateCcw, Settings, Target, Trophy, UserRound,
} from "lucide-react";
import { useCoins } from "@/context/CoinContext";
import { contestKeys, useContestFeed, useContestsChangedListener, FeedError } from "@/lib/contestFeed";
import { contestPath, phaseAt, startsAt, type FeedContest } from "@/lib/contestLifecycle";
import { leaderboardHref } from "@/lib/leaderboard";
import { serverNow } from "@/lib/serverClock";
import { practiceSessionHref } from "@/lib/practiceApi";
import { localDay, summarize, usePracticeProgress } from "@/lib/practiceProgress";
import { buildActivity, contestStats, subjectPerformance, useStudentProfile, type CoinTx } from "@/lib/studentData";
import { HeroBanner, EYEBROW, ON_DARK_BTN } from "@/components/student/Banner";
import { EmptyState, SectionHeader, SideCard, StatTile, StudentLayout, useStudentShell } from "@/components/student/Parts";
import { SubjectTile } from "@/components/student/subjectStyle";
import { BTN_PRIMARY_MD, BTN_SECONDARY_MD, FOCUS_RING } from "@/components/student/ui";
import { ContestCard } from "@/components/contests/ContestCard";
import { ContestCalendar } from "@/components/contests/ContestCalendar";
import StaticSarthi from "@/components/chat/StaticSarthi";
import { cn } from "@/lib/utils";

const T = {
  en: {
    morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", ready: "Ready to make today's progress?",
    cont: "Continue learning", join: "Join a contest", overview: "Your progress", upcoming: "Upcoming contests", finished: "Contests finished",
    avg: "Average score", today: "Practised today", coins: "Coins", continueTitle: "Pick up where you left off", plan: "Today's plan",
    subjects: "Subject performance", activity: "Recent activity", allContests: "All contests", lang: "हिंदी",
    noActivity: "Nothing yet — your contest results, practice and coin changes will show up here.",
  },
  hi: {
    morning: "सुप्रभात", afternoon: "नमस्ते", evening: "शुभ संध्या", ready: "आज थोड़ा आगे बढ़ें?",
    cont: "पढ़ाई जारी रखें", join: "प्रतियोगिता में शामिल हों", overview: "आपकी प्रगति", upcoming: "आने वाली प्रतियोगिताएं", finished: "पूरी की गई प्रतियोगिताएं",
    avg: "औसत स्कोर", today: "आज का अभ्यास", coins: "कॉइन", continueTitle: "जहाँ छोड़ा था वहीं से", plan: "आज की योजना",
    subjects: "विषय अनुसार प्रदर्शन", activity: "हाल की गतिविधि", allContests: "सभी प्रतियोगिताएं", lang: "English",
    noActivity: "अभी कुछ नहीं — आपके परिणाम, अभ्यास और कॉइन यहाँ दिखेंगे।",
  },
};
type Lang = keyof typeof T;
const DAILY_GOAL = 10;

function greeting(t: (typeof T)["en"], h = new Date().getHours()) {
  return h < 12 ? t.morning : h < 17 ? t.afternoon : t.evening;
}

function PlanItem({ done, title, detail, action }: { done: boolean; title: string; detail: string; action?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      {done ? <CheckCircle2 size={20} aria-hidden className="shrink-0 text-[#168B59]" /> : <Circle size={20} aria-hidden className="shrink-0 text-[#9CA3AF]" />}
      <div className="min-w-0 flex-1">
        <p className={cn("text-[14px] font-semibold", done ? "text-[#5D6570] line-through decoration-[#9CA3AF]" : "text-[#1B1B1B]")}>{title}</p>
        <p className="text-[12.5px] text-[#5D6570]">{detail}</p>
      </div>
      {action}
      <span className="sr-only">{done ? "Done" : "Not done yet"}</span>
    </li>
  );
}

export default function StudentDashboardPage() {
  const qc = useQueryClient();
  const { uid, firstName, name, email } = useStudentShell();
  const [lang, setLang] = useState<Lang>("en");
  const t = T[lang];
  const { balance, transactions } = useCoins();
  const profile = useStudentProfile(uid);
  const store = usePracticeProgress(uid);
  const practice = useMemo(() => summarize(store), [store]);
  useContestsChangedListener(uid);
  const upcoming = useContestFeed(uid, "upcoming", "", "");
  const past = useContestFeed(uid, "past", "", "");
  const contestsMissing = [upcoming.error, past.error].some((e) => e instanceof FeedError && e.kind === "missing");

  const up = upcoming.data?.pages[0];
  const upItems = up?.items ?? [];
  const pastItems = past.data?.pages[0]?.items ?? [];
  const stats = contestStats(pastItems);
  const inProgress = upItems.find((c) => c.my_state === "in_progress") ?? null;
  const last = store.last;
  const now = serverNow();
  const todayKey = localDay(now);
  const todayContest = upItems.find((c) => c.my_state !== "owner" && (phaseAt(c, now) === "live" ||
    (startsAt(c) != null && localDay(startsAt(c)!) === todayKey))) ?? null;
  const nextUp = upItems.filter((c) => c.id !== inProgress?.id).slice(0, 2);
  const subjects = subjectPerformance(pastItems, practice).slice(0, 6);
  const txs: CoinTx[] = transactions.map((x) => ({ id: x.id, type: x.type, amount: x.amount, description: x.description, createdAt: x.createdAt }));
  const activity = buildActivity(pastItems, txs, practice, (c: FeedContest) => leaderboardHref(c.short_code, c.id));
  const displayName = (profile.data?.full_name || "").split(/\s+/)[0] || firstName;

  const onZero = useCallback(() => {
    if (uid) setTimeout(() => qc.invalidateQueries({ queryKey: contestKeys.all(uid) }), Math.random() * 3000);
  }, [qc, uid]);

  const primary = inProgress
    ? { href: contestPath(inProgress), label: `${t.cont}: ${inProgress.title}` }
    : last
      ? { href: practiceSessionHref({ c: last.c, s: last.s, ch: last.ch, type: last.type, page: last.page, q: last.q }), label: `${t.cont}: ${last.ch}` }
      : { href: "/practice", label: t.cont };

  const sidebar = (
    <>
      <SideCard title="Your profile" icon={<UserRound size={16} aria-hidden />} labelledBy="profile-title">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#14243A] font-halenoir text-[16px] font-extrabold text-white">
            {(name[0] || email?.[0] || "?").toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-[#1B1B1B]">{profile.data?.full_name || name || "Student"}</p>
            {email && <p className="truncate text-[12px] text-[#5D6570]">{email}</p>}
          </div>
        </div>
        <dl className="mt-3 space-y-1.5 text-[12.5px]">
          <div className="flex justify-between gap-2"><dt className="text-[#5D6570]">School</dt><dd className="truncate text-right font-medium text-[#1B1B1B]">{profile.data?.school_name || "Not added"}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-[#5D6570]">Practice class</dt><dd className="font-medium text-[#1B1B1B]">{store.cls ? `Class ${store.cls}` : "Not chosen"}</dd></div>
        </dl>
        <Link to="/settings" className={cn("mt-3 inline-flex h-9 items-center text-[13px] font-semibold text-[#A92532] hover:underline", FOCUS_RING)}>Edit in settings</Link>
      </SideCard>
      <ContestCalendar scheduled={up?.scheduled ?? []} contests={upItems} upNext={upItems.find((c) => phaseAt(c, now) === "scheduled") ?? null} />
      <SideCard title="Rewards" icon={<Award size={16} aria-hidden />} labelledBy="rewards-side">
        <p className="font-halenoir text-[22px] font-extrabold tabular-nums text-[#1B1B1B]">{balance != null ? balance.toLocaleString("en-IN") : "—"}<span className="ml-1.5 text-[13px] font-semibold text-[#5D6570]">coins</span></p>
        <Link to="/rewards" className={cn("mt-1 inline-flex h-9 items-center gap-1 text-[13px] font-semibold text-[#A92532] hover:underline", FOCUS_RING)}>History & milestones <ArrowRight size={14} aria-hidden /></Link>
      </SideCard>
      <SideCard title="More tools" labelledBy="tools-title">
        <ul className="grid gap-1">
          {[
            { to: "/notes", label: "My notes", Icon: BookOpen },
            { to: "/dashboard/flashcards", label: "Flashcards", Icon: Layers },
            { to: "/student", label: "School portal (code from school)", Icon: KeyRound },
            { to: "/settings", label: "Settings", Icon: Settings },
          ].map(({ to, label, Icon }) => (
            <li key={to}>
              <Link to={to} className={cn("flex h-11 items-center gap-3 rounded-lg px-2 text-[13.5px] font-medium text-[#1B1B1B] hover:bg-[#F5F6F8]", FOCUS_RING)}>
                <Icon size={16} aria-hidden className="text-[#5D6570]" /> {label}
              </Link>
            </li>
          ))}
        </ul>
      </SideCard>
    </>
  );

  return (
    <StudentLayout title="Dashboard" sidebar={sidebar}>
      <HeroBanner tone="crimson" labelledBy="hello-title"
        aside={(
          <div className="flex flex-wrap gap-2">
            <Link to={primary.href} className={cn(ON_DARK_BTN, "max-w-full sm:max-w-[300px]")}><span className="truncate">{primary.label}</span> <ArrowRight size={14} aria-hidden /></Link>
            <Link to="/contests?join=1" className="inline-flex h-10 items-center rounded-lg border border-white/60 px-4 text-[13px] font-semibold text-white hover:bg-white/10 outline-none focus-visible:ring-2 focus-visible:ring-white">{t.join}</Link>
          </div>
        )}>
        <div className="flex items-center gap-2">
          <span className={cn(EYEBROW, "bg-white/15 text-white")}>{new Date().toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { weekday: "long", day: "numeric", month: "long" })}</span>
          <button type="button" onClick={() => setLang((l) => (l === "en" ? "hi" : "en"))} aria-label={lang === "en" ? "हिंदी में देखें" : "Show in English"}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-white/40 px-2 text-[12px] font-semibold text-white hover:bg-white/10 outline-none focus-visible:ring-2 focus-visible:ring-white">
            <Languages size={13} aria-hidden /> {t.lang}
          </button>
        </div>
        <h1 id="hello-title" className="mt-2.5 font-halenoir text-[26px] font-extrabold leading-tight md:text-[32px]">
          {greeting(t)}{displayName ? `, ${displayName}` : ""}!
        </h1>
        <p className="mt-1 text-[14px] text-[#FBE3E5]">{t.ready}{profile.data?.school_name ? ` · ${profile.data.school_name}` : ""}</p>
      </HeroBanner>

      <section aria-labelledby="overview-title" className="mt-7">
        <SectionHeader id="overview-title" title={t.overview} dot="#14243A" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <StatTile label={t.upcoming} value={contestsMissing ? null : up ? up.counts.upcoming : null} accent="#246BCE" />
          <StatTile label={t.finished} value={contestsMissing ? null : past.data ? stats.finished : null} accent="#14243A"
            hint={past.data?.pages[0]?.nextCursor ? "in your last 20 results" : undefined} />
          <StatTile label={t.avg} value={stats.average != null ? `${stats.average}%` : null} accent="#168B59"
            hint={stats.scored ? `over ${stats.scored} scored contest${stats.scored === 1 ? "" : "s"}` : "no scored contests yet"} />
          <StatTile label={t.today} value={practice.today} accent="#E5A526" hint={`questions · this device`} />
          <StatTile label={t.coins} value={balance != null ? balance.toLocaleString("en-IN") : null} accent="#A92532" />
        </div>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section aria-labelledby="continue-title">
          <SectionHeader id="continue-title" title={t.continueTitle} dot="#A92532" />
          {inProgress || last ? (
            <ul className="grid grid-cols-1 gap-3">
              {inProgress && <li className="list-none"><ContestCard c={inProgress} onZero={onZero} /></li>}
              {last && (
                <li className="list-none">
                  <article className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4">
                    <SubjectTile subject={last.s} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-halenoir text-[15px] font-bold text-[#1B1B1B]">{last.ch}</h3>
                      <p className="text-[12.5px] text-[#5D6570]">Practice · Class {last.c} · {last.s} · set {last.page + 1}</p>
                    </div>
                    <Link to={practiceSessionHref({ c: last.c, s: last.s, ch: last.ch, type: last.type, page: last.page, q: last.q })} className={BTN_PRIMARY_MD}>
                      <RotateCcw size={14} aria-hidden /> Resume
                    </Link>
                  </article>
                </li>
              )}
            </ul>
          ) : (
            <EmptyState icon={<Target size={24} aria-hidden />} title="Nothing in progress" body="Start a chapter in Practice or join a contest with your teacher's code."
              action={<div className="flex flex-wrap justify-center gap-2"><Link to="/practice" className={BTN_PRIMARY_MD}>Open practice</Link><Link to="/contests?join=1" className={BTN_SECONDARY_MD}>Enter a code</Link></div>} />
          )}
        </section>

        <section aria-labelledby="plan-title">
          <SectionHeader id="plan-title" title={t.plan} dot="#168B59" />
          <ul className="divide-y divide-[#E5E7EB] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
            <PlanItem done={practice.today >= DAILY_GOAL} title={`Practise ${DAILY_GOAL} questions`}
              detail={`${Math.min(practice.today, DAILY_GOAL)} of ${DAILY_GOAL} marked today on this device`}
              action={practice.today < DAILY_GOAL ? <Link to={last ? practiceSessionHref({ c: last.c, s: last.s, ch: last.ch, type: last.type, page: last.page, q: last.q }) : "/practice"} className={BTN_SECONDARY_MD}>Practise</Link> : undefined} />
            {todayContest ? (
              <PlanItem done={false} title={phaseAt(todayContest, now) === "live" ? `Contest live: ${todayContest.title}` : `Contest today: ${todayContest.title}`}
                detail={todayContest.scheduled_at ? new Date(Date.parse(todayContest.scheduled_at)).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "Open now"}
                action={<Link to="/contests" className={BTN_SECONDARY_MD}>Open</Link>} />
            ) : (
              <PlanItem done={false} title="No contest today" detail="Registered contests show up here on the day they run." />
            )}
            {practice.review > 0 && (
              <PlanItem done={false} title={`${practice.review} question${practice.review === 1 ? "" : "s"} marked to review`} detail="Go back to them in Practice"
                action={<Link to="/practice" className={BTN_SECONDARY_MD}>Review</Link>} />
            )}
          </ul>
        </section>
      </div>

      <section aria-labelledby="upcoming-title" className="mt-8">
        <SectionHeader id="upcoming-title" title={t.upcoming} dot="#246BCE"
          action={<Link to="/contests" className={cn("inline-flex h-9 items-center gap-1 text-[13px] font-semibold text-[#A92532] hover:underline", FOCUS_RING)}>{t.allContests} <ArrowRight size={14} aria-hidden /></Link>} />
        {contestsMissing ? (
          <EmptyState icon={<CalendarClock size={24} aria-hidden />} title="Your contests will show up here soon" body="The contest list switches on with the next server update. You can already join with a code." action={<Link to="/contests?join=1" className={BTN_PRIMARY_MD}>Enter a code</Link>} />
        ) : upcoming.isPending ? (
          <ul aria-hidden className="grid gap-3 md:grid-cols-2">{[0, 1].map((i) => <li key={i} className="h-[196px] list-none rounded-xl border border-[#E5E7EB] bg-white" />)}</ul>
        ) : nextUp.length ? (
          <ul className="grid gap-3 md:grid-cols-2">{nextUp.map((c) => <li key={c.id} className="list-none"><ContestCard c={c} onZero={onZero} /></li>)}</ul>
        ) : (
          <EmptyState icon={<Trophy size={24} aria-hidden />} title="No upcoming contests" body="Got a code from your teacher? Register and you'll see a countdown here." action={<Link to="/contests?join=1" className={BTN_PRIMARY_MD}>Enter a code</Link>} />
        )}
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section aria-labelledby="subjects-title">
          <SectionHeader id="subjects-title" title={t.subjects} dot="#E5A526" />
          {subjects.length ? (
            <ul className="grid grid-cols-1 gap-2">
              {subjects.map((s) => (
                <li key={s.subject} className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5">
                  <SubjectTile subject={s.subject} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-[#1B1B1B]">{s.subject}</p>
                    {s.contestAvg != null && (
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EEF0F3]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.contestAvg} aria-label={`${s.subject} contest average`}>
                          <div className="h-full rounded-full bg-[#246BCE]" style={{ width: `${Math.min(100, s.contestAvg)}%` }} />
                        </div>
                        <span className="text-[12px] font-semibold tabular-nums text-[#1B1B1B]">{s.contestAvg}%</span>
                      </div>
                    )}
                    <p className="mt-0.5 text-[11.5px] text-[#5D6570]">
                      {[s.contests ? `${s.contests} contest${s.contests === 1 ? "" : "s"}` : null, s.got + s.review ? `practice: ${s.got} got it · ${s.review} review (this device)` : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<ListChecks size={24} aria-hidden />} title="No subject data yet" body="Finish a contest or mark practice questions and each subject shows up here." />
          )}
        </section>

        <section aria-labelledby="activity-title">
          <SectionHeader id="activity-title" title={t.activity} dot="#14243A" />
          {activity.length ? (
            <ol className="divide-y divide-[#E5E7EB] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
              {activity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                    a.kind === "contest" ? "bg-[#EAF1FB] text-[#1D4F99]" : a.kind === "coins" ? "bg-[#FFF8E8] text-[#7A5200]" : "bg-[#E7F6EE] text-[#0E6B43]")}>
                    {a.kind === "contest" ? <Trophy size={16} aria-hidden /> : a.kind === "coins" ? <Award size={16} aria-hidden /> : <Target size={16} aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-[#1B1B1B]">
                      {a.kind === "contest" ? `Submitted ${a.title}` : a.kind === "coins" ? a.description : `Practised ${a.count} question${a.count === 1 ? "" : "s"}`}
                    </p>
                    <p className="text-[12px] text-[#5D6570]">
                      {a.kind === "practice" ? `${new Date(a.at).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · this device`
                        : new Date(a.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                  {a.kind === "contest" && (
                    a.pending ? <span className="text-[12px] font-semibold text-[#7A5200]">Results soon</span>
                      : <Link to={a.href} className={cn("text-[12.5px] font-semibold tabular-nums text-[#1B1B1B] hover:underline", FOCUS_RING)}>{a.score != null ? `${a.score}${a.total ? `/${a.total}` : ""}` : "View"}</Link>
                  )}
                  {a.kind === "coins" && <span className={cn("font-halenoir text-[14px] font-extrabold tabular-nums", a.spent ? "text-[#A92532]" : "text-[#0E6B43]")}>{a.spent ? "−" : "+"}{a.amount}</span>}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState icon={<History size={24} aria-hidden />} title={t.activity} body={t.noActivity} />
          )}
        </section>
      </div>
      <StaticSarthi variant="student" />
    </StudentLayout>
  );
}
