// Confirm dialog for destructive agent actions (delete chat, clear history). Same look as ui/alert-dialog, but
// stacked above the agent sheet (z 245/250) — ui/alert-dialog is z-50, under the sheet (z 220/230).
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { buttonVariants } from "@/components/ui/button";

export function AgentConfirm({ open, onOpenChange, title, description, confirmLabel, onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; confirmLabel: string; onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[245] bg-black/50 dark:bg-black/70" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[250] grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border bg-background p-6 text-foreground shadow-lg" data-testid="agent-confirm">
          <div className="space-y-2">
            <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
            <AlertDialog.Description className="break-words text-sm text-muted-foreground">{description}</AlertDialog.Description>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel className={`${buttonVariants({ variant: "outline" })} h-11`}>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action className={`${buttonVariants({ variant: "destructive" })} h-11`} onClick={onConfirm}>{confirmLabel}</AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
