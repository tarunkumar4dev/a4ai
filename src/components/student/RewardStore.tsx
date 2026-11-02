// Rewards store: the voucher catalogue from CoinContext, as glossy brand cards with the student's real progress.
// Redeeming stays OFF: nothing on the server issues voucher codes yet (the old page took coins in the browser and
// promised an email that was never sent). REDEEM_OPEN flips the button on once a server-side redemption exists.
// Brand names are text only (no logos). Big text on the colour panel is ≥ 3:1 (large text); small text sits on white.
import { useMemo, useState } from "react";
import { Award, Clock3, Gift, Lock } from "lucide-react";
import { useCoins } from "@/context/CoinContext";
import { FOCUS_RING } from "./ui";
import { cn } from "@/lib/utils";

const REDEEM_OPEN = false;
/** Not offered: PUBG Mobile and Free Fire are banned in India. */
const HIDDEN = new Set(["PUBG", "Free Fire"]);

const BRAND: Record<string, { from: string; to: string; accent: string }> = {
  Amazon: { from: "#232F3E", to: "#0F161F", accent: "#FF9900" },
  Flipkart: { from: "#2459C9", to: "#163C8C", accent: "#FFE11B" },
  AJIO: { from: "#2C4152", to: "#16222C", accent: "#C8A26B" },
  Myntra: { from: "#D9265B", to: "#8E1640", accent: "#FFB3C7" },
  Swiggy: { from: "#D9620B", to: "#9A3F06", accent: "#FFD2A8" },
  Zomato: { from: "#CB202D", to: "#861019", accent: "#FFC2C6" },
  "Amazon Books": { from: "#146EB4", to: "#0B4677", accent: "#FF9900" },
  "BYJU'S": { from: "#6E2C8A", to: "#43175A", accent: "#E7C3F5" },
  Netflix: { from: "#B20710", to: "#141414", accent: "#FF4B55" },
  Spotify: { from: "#168D40", to: "#0E2A18", accent: "#7CF2A4" },
  Croma: { from: "#0B7F6A", to: "#063D33", accent: "#5CF2D4" },
  BigBasket: { from: "#4E7D12", to: "#2B4709", accent: "#C9F07A" },
};
const FALLBACK = { from: "#14243A", to: "#0B1626", accent: "#E5A526" };
const CATS = [["all", "All"], ["shopping", "Shopping"], ["food", "Food"], ["entertainment", "Entertainment"], ["education", "Education"]] as const;
const monogram = (b: string) => b.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export function RewardStore() {
  const { vouchers, balance } = useCoins();
  const [cat, setCat] = useState<(typeof CATS)[number][0]>("all");
  const list = useMemo(() => vouchers.filter((v) => !HIDDEN.has(v.brand) && (cat === "all" || v.category === cat))
    .sort((a, b) => a.coinsRequired - b.coinsRequired), [vouchers, cat]);

  return (
    <>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-2 rounded-lg bg-[#FFF8E8] px-3 py-2 text-[12.5px] font-medium text-[#7A5200]">
          <Clock3 size={14} aria-hidden /> Redeeming opens soon — save your coins for these.
        </p>
        <div role="group" aria-label="Category" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {CATS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={cat === id} onClick={() => setCat(id)}
              className={cn("inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-medium",
                cat === id ? "border-[#14243A] bg-[#14243A] text-white" : "border-[#E5E7EB] bg-white text-[#1B1B1B] hover:border-[#9CA3AF]", FOCUS_RING)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((v) => {
          const b = BRAND[v.brand] ?? FALLBACK;
          const have = balance ?? 0;
          const pct = balance != null ? Math.min(100, Math.round((have / v.coinsRequired) * 100)) : 0;
          const short = balance != null ? Math.max(0, v.coinsRequired - have) : null;
          return (
            <li key={v.id} className="list-none">
              <article aria-labelledby={`v-${v.id}`} className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(20,36,58,0.04)] transition-shadow hover:shadow-[0_8px_24px_rgba(20,36,58,0.12)]">
                <div className="relative h-[124px] overflow-hidden p-4 text-white" style={{ background: `linear-gradient(135deg, ${b.from} 0%, ${b.to} 100%)` }}>
                  {/* gloss: a soft light sweep + a top highlight line (decoration only) */}
                  <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(120deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 32%, rgba(255,255,255,0) 52%)" }} />
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/40" />
                  <span aria-hidden className="pointer-events-none absolute -bottom-10 -right-8 h-32 w-32 rounded-full border-[18px]" style={{ borderColor: `${b.accent}33` }} />
                  <div className="relative flex items-start justify-between gap-2">
                    <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl border border-white/30 bg-white/15 text-[13px] font-extrabold tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                      {monogram(v.brand)}
                    </span>
                    <span className="rounded-lg px-2.5 py-1 font-halenoir text-[18px] font-extrabold leading-none text-[#1B1B1B] shadow-[0_2px_8px_rgba(0,0,0,0.25)]" style={{ background: b.accent }}>
                      {v.value}
                    </span>
                  </div>
                  <h3 id={`v-${v.id}`} className="relative mt-3 truncate font-halenoir text-[20px] font-extrabold leading-tight">{v.brand}</h3>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-[13px] font-semibold text-[#1B1B1B]">{v.name}</p>
                  <p className="mt-0.5 text-[12.5px] text-[#5D6570]">{v.description} · valid {v.validity}</p>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="inline-flex items-center gap-1 font-semibold text-[#7A5200]"><Award size={13} aria-hidden /> {v.coinsRequired.toLocaleString("en-IN")} coins</span>
                      <span className="tabular-nums text-[#5D6570]">{balance != null ? `${Math.min(have, v.coinsRequired).toLocaleString("en-IN")} / ${v.coinsRequired.toLocaleString("en-IN")}` : "—"}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#EEF0F3]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
                      aria-label={`${v.brand}: ${pct}% of the coins needed`}>
                      <div className="h-full rounded-full bg-[#E5A526]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="mt-auto pt-3">
                    {REDEEM_OPEN && short === 0 ? (
                      <button type="button" className={cn("inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#14243A] text-[13px] font-semibold text-white hover:bg-[#0B1626]", FOCUS_RING)}>
                        <Gift size={14} aria-hidden /> Redeem
                      </button>
                    ) : (
                      <span aria-disabled="true" className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#F1F2F4] text-[13px] font-semibold text-[#4B5563]">
                        <Lock size={14} aria-hidden /> {short ? `${short.toLocaleString("en-IN")} more coins needed` : "Opens soon"}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </>
  );
}
