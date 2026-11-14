// Student experience design tokens (dashboard, contests, practice, rewards share these).
// Text colours are checked for WCAG 2.2 AA (≥ 4.5:1) on the surface they are used on.

/** Palette. Solid colours; text-safe pairs noted where they are used. */
export const S = {
  crimson: "#A92532", // white text 7.0:1
  red: "#C93642",
  coral: "#F95D6A", // decoration only (2.8:1 on white)
  navy: "#14243A", // primary buttons, white text 15:1
  blue: "#246BCE", // white text 5.2:1
  blueDark: "#1D4F99",
  emerald: "#168B59", // icons / dots (white text only ≥ 18px bold)
  emeraldDark: "#0E6B43", // text on white 6.3:1
  gold: "#E5A526", // dark text 8.0:1
  goldText: "#7A5200", // text on white / cream 6.9:1
  ink: "#1B1B1B",
  muted: "#5D6570", // on white 6.2:1, on #F5F6F8 5.7:1
  line: "#E5E7EB",
  soft: "#F5F6F8",
} as const;

export const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#246BCE]";

/** Button looks. Heights come from the caller (h-10 everywhere in the student pages). */
export const BTN = {
  primary: `bg-[#14243A] text-white hover:bg-[#0B1626] ${FOCUS_RING}`,
  secondary: `bg-white text-[#1B1B1B] border border-[#D5D9DF] hover:border-[#9CA3AF] hover:bg-[#F9FAFB] ${FOCUS_RING}`,
  muted: "bg-[#F1F2F4] text-[#4B5563] border border-transparent cursor-default",
};

/** A standard 40 px button, primary look. */
export const BTN_PRIMARY_MD = `inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold ${BTN.primary}`;
export const BTN_SECONDARY_MD = `inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold ${BTN.secondary}`;
