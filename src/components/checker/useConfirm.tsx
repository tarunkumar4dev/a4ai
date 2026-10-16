// src/components/checker/useConfirm.tsx
// await ask({...}) → true / false, rendered with the app's existing AlertDialog (src/components/ui/alert-dialog)
// instead of the browser's native confirm(). Render {dialog} once in the component that calls ask().

import React, { useCallback, useRef, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmOptions = { title: string; description?: string; confirmLabel?: string; destructive?: boolean };

export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const ask = useCallback((o: ConfirmOptions) => new Promise<boolean>(resolve => {
    resolver.current = resolve;
    setOpts(o);
  }), []);

  const finish = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpts(null);
  };

  const dialog = (
    <AlertDialog open={!!opts} onOpenChange={open => { if (!open) finish(false); }}>
      {/* z-[80]: above the student-copy sheet (z-[60]) */}
      <AlertDialogContent className="z-[80] rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
          {opts?.description && <AlertDialogDescription>{opts.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => finish(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => finish(true)}
            className={opts?.destructive ? "bg-red-600 hover:bg-red-700 text-white" : "bg-gray-900 hover:bg-gray-800 text-white"}>
            {opts?.confirmLabel || "OK"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { ask, dialog };
}
