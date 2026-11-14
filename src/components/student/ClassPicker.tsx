// Class chooser shared by Practice and Flashcards: a radio group (arrow keys move between usable classes),
// a phone-width swipe row, unusable classes shown disabled with a reason.
import type { KeyboardEvent } from "react";
import { FOCUS_RING } from "./ui";
import { cn } from "@/lib/utils";

export function ClassPicker({ classes, value, onChange, usable = () => true, unusableTitle = "Nothing for this class yet", idPrefix = "class" }: {
  classes: readonly string[]; value: string; onChange: (c: string) => void; usable?: (c: string) => boolean; unusableTitle?: string; idPrefix?: string;
}) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const ok = classes.filter(usable);
    const i = ok.indexOf(value);
    const next = ok[(i + (e.key === "ArrowRight" ? 1 : ok.length - 1)) % ok.length];
    onChange(next);
    document.getElementById(`${idPrefix}-${next}`)?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Class" onKeyDown={onKey} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
      {classes.map((c) => {
        const on = c === value;
        const ok = usable(c);
        return (
          <button key={c} id={`${idPrefix}-${c}`} type="button" role="radio" aria-checked={on} aria-label={`Class ${c}`} disabled={!ok} tabIndex={on ? 0 : -1}
            onClick={() => onChange(c)} title={ok ? undefined : unusableTitle}
            className={cn("flex h-14 min-w-[76px] shrink-0 flex-col items-center justify-center rounded-xl border px-3",
              on ? "border-[#14243A] bg-[#14243A] text-white" : ok ? "border-[#E5E7EB] bg-white text-[#1B1B1B] hover:border-[#9CA3AF]" : "border-dashed border-[#E5E7EB] bg-[#FAFBFC] text-[#9CA3AF]",
              FOCUS_RING)}>
            <span aria-hidden className={cn("text-[11px] font-semibold uppercase tracking-[0.06em]", on ? "text-white/80" : ok ? "text-[#5D6570]" : "text-[#9CA3AF]")}>Class</span>
            <span aria-hidden className="font-halenoir text-[18px] font-extrabold leading-none">{c}</span>
          </button>
        );
      })}
    </div>
  );
}
