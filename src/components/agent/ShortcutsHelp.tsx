// Keyboard shortcuts (./shortcuts), opened from the header's ⋯ menu. A small dialog above the agent sheet (z 245+).
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useAgentT } from "@/lib/agent/i18n";
import { SHORTCUTS } from "./shortcuts";

export function ShortcutsHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useAgentT();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[245] bg-black/40 dark:bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[250] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl outline-none" data-testid="shortcuts-help">
          <div className="flex items-center justify-between border-b border-border py-1.5 pl-4 pr-1.5">
            <Dialog.Title className="text-sm font-semibold">{t("header.shortcuts")}</Dialog.Title>
            <Dialog.Close aria-label={t("header.close")} className="grid h-10 w-10 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X aria-hidden="true" className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{t("header.shortcuts")}</Dialog.Description>
          <dl className="divide-y divide-border text-sm">
            {SHORTCUTS.map((s) => (
              <div key={s.keys} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <dt className="text-muted-foreground">{t(s.label)}</dt>
                <dd className="shrink-0"><kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-xs font-medium text-foreground">{s.keys}</kbd></dd>
              </div>
            ))}
          </dl>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
