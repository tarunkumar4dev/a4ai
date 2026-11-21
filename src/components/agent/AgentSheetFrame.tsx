// Side sheet for the agent (Radix Dialog, styled like ui/sheet) stacked ABOVE the dashboard chrome: the staff
// dashboard's sidebar/header (z 150–200), the Ask a4ai button (105) and the help bubble (110) — ui/sheet is z-50.
// Radix moves focus in on open, traps it and closes on Esc; `returnFocus` gets focus back on close (Radix only
// does that for a Dialog.Trigger, and our buttons open the sheet themselves). Esc: see ./escLayer.
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { hasEscLayer } from "./escLayer";

export function AgentSheetFrame({ open, onOpenChange, side, title, description, children, onOpenAutoFocus, returnFocus, className = "" }: {
  open: boolean; onOpenChange: (o: boolean) => void; side: "left" | "right"; title: string; description: string;
  children: ReactNode; onOpenAutoFocus?: (e: Event) => void; returnFocus?: RefObject<HTMLElement>; className?: string;
}) {
  const pos = side === "right" ? "inset-y-0 right-0 border-l" : "inset-y-0 left-0 border-r";
  const content = useRef<HTMLDivElement>(null);
  // phones: the sheet follows the on-screen keyboard (visualViewport), so the composer is never hidden behind it
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!open || !vv) return;
    const fit = () => {
      const el = content.current;
      if (!el) return;
      const phone = window.innerWidth < 640;
      el.style.height = phone ? `${Math.round(vv.height)}px` : "";
      el.style.top = phone ? `${Math.round(vv.offsetTop)}px` : "";
    };
    const id = requestAnimationFrame(fit);
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    return () => { cancelAnimationFrame(id); vv.removeEventListener("resize", fit); vv.removeEventListener("scroll", fit); };
  }, [open]);
  // Esc closes the sheet only when the message box is empty (a half-written question is never lost to Esc)
  const hasDraft = () => !!content.current?.querySelector<HTMLTextAreaElement>("textarea[role=combobox]")?.value.trim();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[220] bg-black/40 dark:bg-black/60 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:duration-200" />
        <Dialog.Content ref={content} onOpenAutoFocus={onOpenAutoFocus}
          // an open suggestions list / rename box / inner drawer takes Esc first; the sheet closes on the next Esc
          onEscapeKeyDown={(e) => { if (hasEscLayer(content.current) || hasDraft()) e.preventDefault(); }}
          onCloseAutoFocus={(e) => { if (returnFocus?.current) { e.preventDefault(); returnFocus.current.focus(); } }}
          className={`fixed z-[230] flex h-[100dvh] flex-col border-border bg-card pt-[env(safe-area-inset-top,0px)] font-halenoir text-card-foreground shadow-2xl outline-none ${side === "right" ? "motion-safe:data-[state=open]:slide-in-from-right" : "motion-safe:data-[state=open]:slide-in-from-left"} motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:[animation-duration:180ms] motion-safe:data-[state=open]:ease-out ${pos} ${className}`}>
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{description}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const SheetClose = Dialog.Close;
