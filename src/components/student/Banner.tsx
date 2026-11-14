// Solid-colour banner pieces shared by the student pages (contests banner row, dashboard / practice / rewards
// heroes). Decoration sits in the corners only (aria-hidden, low opacity, never behind body text).
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BannerTone = "crimson" | "blue" | "gold" | "navy" | "emerald";

export function BannerGeometry({ variant }: { variant: BannerTone }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {(variant === "crimson" || variant === "navy") && (
        <>
          <div className="absolute -bottom-28 -right-24 h-56 w-56 rounded-full border-[30px] border-white/[0.07]" />
          <div className="absolute -right-4 -top-4 h-14 w-14 rounded-full border-[9px] border-[#F95D6A]/45" />
        </>
      )}
      {(variant === "blue" || variant === "emerald") && (
        <>
          <div className="absolute -bottom-28 -right-24 h-56 w-56 rounded-full border-[30px] border-white/[0.08]" />
          <div className="absolute right-5 top-5 grid grid-cols-5 gap-1.5">
            {Array.from({ length: 15 }, (_, i) => <span key={i} className="h-1 w-1 rounded-full bg-white/30" />)}
          </div>
        </>
      )}
      {variant === "gold" && (
        <>
          <div className="absolute -bottom-20 -right-16 h-40 w-40 rotate-12 rounded-[32px] border-[22px] border-[#1B1B1B]/[0.07]" />
          <div className="absolute right-6 top-7 h-2.5 w-14 rounded-full bg-[#1B1B1B]/[0.09]" />
          <div className="absolute right-6 top-12 h-2.5 w-9 rounded-full bg-[#1B1B1B]/[0.09]" />
        </>
      )}
    </div>
  );
}

// white on crimson 7.0:1, on navy 15:1, on blue 5.2:1, on #0E6B43 6.3:1; #1B1B1B on gold 8.0:1
const TONE: Record<BannerTone, string> = {
  crimson: "bg-[#A92532] text-white",
  navy: "bg-[#14243A] text-white",
  blue: "bg-[#246BCE] text-white",
  emerald: "bg-[#0E6B43] text-white",
  gold: "bg-[#E5A526] text-[#1B1B1B]",
};

/** A full-width hero panel (dashboard / practice / rewards). */
export function HeroBanner({ tone, children, aside, className, labelledBy }: {
  tone: BannerTone; children: ReactNode; aside?: ReactNode; className?: string; labelledBy?: string;
}) {
  return (
    <section aria-labelledby={labelledBy} className={cn("relative overflow-hidden rounded-xl p-5 sm:p-6", TONE[tone], className)}>
      <BannerGeometry variant={tone} />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">{children}</div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
    </section>
  );
}

export const EYEBROW = "inline-flex h-6 items-center gap-1.5 self-start rounded-md px-2 text-[11px] font-bold uppercase tracking-[0.08em]";
/** Buttons that sit on a dark banner (white surface, dark text). */
export const ON_DARK_BTN = "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-white px-4 text-[13px] font-semibold text-[#1B1B1B] hover:bg-[#F5F6F8] outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#14243A]";
