// /rewards (was /coinshop) — coins, history, milestones. Honest by design:
//   - the balance is profiles.coins as read (useCoins().balance); loading, unknown and 0 look different
//   - the voucher catalogue is shown (components/student/RewardStore) but redeeming is OFF until a server issues
//     codes — the old page took coins in the browser and promised an email nobody sent; its "bonus" buttons that
//     added coins on every click are gone
//   - milestones come from contest results on the server (get_my_contests) and are display-only
import { Link } from "react-router-dom";
import { Award, CalendarCheck2, Gift, History, Lock, Medal, ShieldCheck, Sparkles, Target, Trophy } from "lucide-react";
import { useCoins } from "@/context/CoinContext";
import { useContestFeed, FeedError } from "@/lib/contestFeed";
import { milestones, useCoinHistory } from "@/lib/studentData";
import { HeroBanner, EYEBROW } from "@/components/student/Banner";
import { EmptyState, ErrorState, SectionHeader, SideCard, StudentLayout, useStudentShell } from "@/components/student/Parts";
import { BTN_PRIMARY_MD, BTN_SECONDARY_MD, FOCUS_RING } from "@/components/student/ui";
import { RewardStore } from "@/components/student/RewardStore";
import { cn } from "@/lib/utils";

const when = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t)
    ? new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "";
};

const MEDAL_ICON = { first: Trophy, five: CalendarCheck2, "75": Target, perfect: Medal } as const;

export default function RewardsPage() {
  const { uid, isStudent } = useStudentShell();
  const { balance, earned, isLoading } = useCoins();
  const history = useCoinHistory(uid);
  const past = useContestFeed(uid, "past", "", "");
  const txs = (history.data?.pages ?? []).flat();
  const pastItems = past.data?.pages[0]?.items ?? [];
  const pastMissing = past.error instanceof FeedError && past.error.kind === "missing";
  const ms = milestones(pastItems);
  const balanceText = isLoading ? null : balance;
  const spent = txs.filter((t) => t.type === "spend" || t.type === "redeem" || t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0);

  const sidebar = (
    <>
      <SideCard title="About coins" icon={<ShieldCheck size={16} aria-hidden />} labelledBy="about-coins">
        <ul className="space-y-2 text-[12.5px] leading-relaxed text-[#5D6570]">
          <li>Your balance and history come straight from your a4ai account.</li>
          <li>Coins can't be bought, transferred or exchanged for money.</li>
          <li>Vouchers below show how close you are; redeeming opens once codes can be issued safely.</li>
        </ul>
      </SideCard>
      <SideCard title="Keep learning" icon={<Sparkles size={16} aria-hidden />} labelledBy="keep-learning">
        <div className="grid gap-2">
          <Link to="/contests" className={cn(BTN_SECONDARY_MD, "justify-between")}>Contests <Trophy size={15} aria-hidden /></Link>
          {isStudent && <Link to="/practice" className={cn(BTN_SECONDARY_MD, "justify-between")}>Practice <Target size={15} aria-hidden /></Link>}
        </div>
      </SideCard>
    </>
  );

  return (
    <StudentLayout title="Rewards" sidebar={sidebar}>
      <HeroBanner tone="gold" labelledBy="rewards-title"
        aside={(
          <dl className="grid grid-cols-2 gap-2 text-[#1B1B1B]">
            <div className="rounded-lg bg-[#1B1B1B]/[0.07] px-4 py-2.5">
              <dt className="text-[11.5px] font-semibold text-[#4A3500]">Total earned</dt>
              <dd className="font-halenoir text-[20px] font-extrabold tabular-nums">{earned != null ? earned.toLocaleString("en-IN") : "—"}</dd>
            </div>
            <div className="rounded-lg bg-[#1B1B1B]/[0.07] px-4 py-2.5">
              <dt className="text-[11.5px] font-semibold text-[#4A3500]">Spent</dt>
              {/* a sum of the loaded pages only when there are no older ones left */}
              <dd className="font-halenoir text-[20px] font-extrabold tabular-nums">{history.isSuccess && !history.hasNextPage ? spent.toLocaleString("en-IN") : "—"}</dd>
            </div>
          </dl>
        )}>
        <span className={cn(EYEBROW, "bg-[#1B1B1B]/10 text-[#1B1B1B]")}><Award size={12} aria-hidden /> Rewards</span>
        <h1 id="rewards-title" className="mt-2.5 font-halenoir text-[15px] font-bold text-[#4A3500]">Your coin balance</h1>
        <p className="mt-0.5 flex items-baseline gap-2" aria-live="polite">
          {balanceText == null ? (
            isLoading ? <span className="inline-block h-10 w-36 rounded-lg bg-[#1B1B1B]/10" aria-label="Loading balance" />
              : <span className="text-[16px] font-semibold text-[#1B1B1B]">Balance unavailable right now</span>
          ) : (
            <><span className="font-halenoir text-[44px] font-extrabold leading-none tabular-nums">{balanceText.toLocaleString("en-IN")}</span><span className="text-[15px] font-semibold text-[#4A3500]">coins</span></>
          )}
        </p>
      </HeroBanner>

      <section aria-labelledby="milestones-title" className="mt-8">
        <SectionHeader id="milestones-title" title="Milestones" count={pastMissing ? undefined : `${ms.filter((m) => m.reached).length}/${ms.length}`} dot="#E5A526" />
        {pastMissing ? (
          <EmptyState icon={<Medal size={24} aria-hidden />} title="Milestones switch on with the contest update" body="They're worked out from your contest results." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {ms.map((m) => {
              const Icon = MEDAL_ICON[m.id as keyof typeof MEDAL_ICON] ?? Medal;
              return (
                <li key={m.id} className="list-none">
                  <article className={cn("flex h-full items-start gap-3 rounded-xl border p-4", m.reached ? "border-[#F2D9A2] bg-[#FFFBF0]" : "border-[#E5E7EB] bg-white")}>
                    <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", m.reached ? "bg-[#E5A526] text-[#1B1B1B]" : "bg-[#F1F2F4] text-[#9CA3AF]")}>
                      {m.reached ? <Icon size={20} aria-hidden /> : <Lock size={18} aria-hidden />}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-halenoir text-[14.5px] font-bold text-[#1B1B1B]">{m.title}</h3>
                      <p className="mt-0.5 text-[12.5px] text-[#5D6570]">{m.detail}</p>
                      <p className={cn("mt-1 text-[11.5px] font-semibold", m.reached ? "text-[#7A5200]" : "text-[#5D6570]")}>{m.reached ? "Reached" : "Not yet"}</p>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
        {!pastMissing && <p className="mt-2 text-[12px] text-[#5D6570]">Based on your latest contest results{past.data?.pages[0]?.nextCursor ? " (last 20)" : ""}.</p>}
      </section>

      <section aria-labelledby="history-title" className="mt-8">
        <SectionHeader id="history-title" title="Coin history" dot="#14243A" />
        {history.isPending ? (
          <ul aria-hidden className="space-y-2">{[0, 1, 2].map((i) => <li key={i} className="h-14 list-none rounded-xl border border-[#E5E7EB] bg-white" />)}</ul>
        ) : history.isError ? (
          <ErrorState message="Your coin history couldn't load." onRetry={() => history.refetch()} />
        ) : txs.length === 0 ? (
          <EmptyState icon={<History size={24} aria-hidden />} title="No coin activity yet" body="When coins are added to or taken from your account, each change shows up here with its date." />
        ) : (
          <>
            <ol className="divide-y divide-[#E5E7EB] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
              {txs.map((t) => {
                const out = t.type === "spend" || t.type === "redeem" || t.amount < 0;
                return (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", out ? "bg-[#FBEBED] text-[#A92532]" : "bg-[#FFF8E8] text-[#7A5200]")}>
                      {out ? <Gift size={16} aria-hidden /> : <Award size={16} aria-hidden />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-[#1B1B1B]">{t.description || (out ? "Coins spent" : "Coins added")}</p>
                      <p className="text-[12px] text-[#5D6570]">{when(t.createdAt)}</p>
                    </div>
                    <span className={cn("shrink-0 font-halenoir text-[15px] font-extrabold tabular-nums", out ? "text-[#A92532]" : "text-[#0E6B43]")}>
                      {out ? "−" : "+"}{Math.abs(t.amount).toLocaleString("en-IN")}
                    </span>
                  </li>
                );
              })}
            </ol>
            {history.hasNextPage && (
              <button type="button" onClick={() => history.fetchNextPage()} disabled={history.isFetchingNextPage} className={cn(BTN_SECONDARY_MD, "mt-3 disabled:opacity-60")}>
                {history.isFetchingNextPage ? "Loading…" : "Show older"}
              </button>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="store-title" className="mt-8">
        <SectionHeader id="store-title" title="Rewards store" dot="#A92532" />
        <RewardStore />
      </section>

      <section aria-labelledby="earn-title" className="mt-8">
        <SectionHeader id="earn-title" title="How coins work" dot="#168B59" />
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 text-[13.5px] leading-relaxed text-[#5D6570]">
          <p>Coins aren't added automatically for practice or contests yet. When a4ai adds or removes coins on your account, you'll see it in your coin history above.</p>
          <Link to="/contests" className={cn("mt-2 inline-flex h-9 items-center text-[13px] font-semibold text-[#A92532] hover:underline", FOCUS_RING)}>See your contests</Link>
        </div>
      </section>
    </StudentLayout>
  );
}
