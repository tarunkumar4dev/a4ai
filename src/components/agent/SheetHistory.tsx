// Chat history as a drawer INSIDE the "Ask a4ai" sheet (opened by the history icon in its header). Covers the chat,
// focus goes to the search box, Esc / the back button close it and focus returns to the history icon. It is an
// Esc layer (./escLayer), so the first Esc closes only this drawer, not the sheet.
import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useAgentQueryClient } from "@/lib/agent/queries";
import { useAgentStore } from "@/lib/agent/store";
import { AgentHistoryPanel } from "./AgentHistoryPanel";
import { ESC_LAYER } from "./escLayer";

export default function SheetHistory({ onClose, onPicked }: { onClose: () => void; onPicked: () => void }) {
  const { user } = useAuth();
  const s = useAgentStore(user?.id ?? "anon", useAgentQueryClient());
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // an inner layer (rename box, search text, open menu) handles its own Esc first
      const inner = (e.target as HTMLElement | null)?.closest?.(`[${ESC_LAYER}]`);
      if (inner && inner !== box.current) return;
      if (document.querySelector("[role=menu]")) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div ref={box} {...{ [ESC_LAYER]: "" }} role="region" aria-label="Chat history"
      className="absolute inset-0 z-10 flex flex-col bg-card" data-testid="sheet-history">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <button type="button" onClick={onClose} aria-label="Back to chat"
          className="grid h-11 w-11 place-items-center rounded-md text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        </button>
        <p className="text-sm font-semibold">Chat history</p>
      </div>
      <div className="min-h-0 flex-1">
        <AgentHistoryPanel uid={user?.id ?? null} activeKey={s.activeKey} busy={s.chat.busy} onPicked={onPicked} autoFocusSearch />
      </div>
    </div>
  );
}
