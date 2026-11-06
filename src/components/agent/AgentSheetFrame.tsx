// Side sheet for the agent (Radix Dialog, styled like ui/sheet) stacked ABOVE the dashboard chrome: the staff
// dashboard's sidebar/header (z 150–200), the Ask a4ai button (105) and the help bubble (110) — ui/sheet is z-50.
// Radix moves focus in on open, traps it and closes on Esc; `returnFocus` gets focus back on close (Radix only
// does that for a Dialog.Trigger, and our buttons open the sheet themselves).
import type { ReactNode, RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";

export function AgentSheetFrame({ open, onOpenChange, side, title, description, children, onOpenAutoFocus, returnFocus, className = "" }: {
  open: boolean; onOpenChange: (o: boolean) => void; side: "left" | "right"; title: string; description: string;
  children: ReactNode; onOpenAutoFocus?: (e: Event) => void; returnFocus?: RefObject<HTMLElement>; className?: string;
}) {
  const pos = side === "right" ? "inset-y-0 right-0 border-l" : "inset-y-0 left-0 border-r";
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[220] bg-black/40 dark:bg-black/60" />
        <Dialog.Content onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={(e) => { if (returnFocus?.current) { e.preventDefault(); returnFocus.current.focus(); } }}
          className={`fixed z-[230] flex h-[100dvh] flex-col border-border bg-background text-foreground shadow-xl outline-none ${pos} ${className}`}>
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{description}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const SheetClose = Dialog.Close;
