// An icon button's tooltip (desktop hover / keyboard focus). The button itself carries the aria-label; the tooltip
// only repeats it visually. Above the agent sheet (z 240).
import type { ReactElement } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function IconTip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" className="z-[240] text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}

export const iconBtn = "grid h-10 w-10 shrink-0 place-items-center rounded-lg text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11";
