// /dashboard?tab=agent — past chats on the left (a sheet on phones), the chat in the middle. Staff only.
import { useMemo, useState } from "react";
import { History, Lock, X } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useAccess } from "@/context/AccessProvider";
import { agentStore, mergeChatList, useAgentStore } from "@/lib/agent/store";
import { useMarkAgentWorkspace } from "@/lib/agent/surface";
import AgentChatPanel from "./AgentChatPanel";
import { AgentSessionList } from "./AgentSessionList";
import { AgentSheetFrame, SheetClose } from "./AgentSheetFrame";
import { isStaffRole } from "./roles";

export default function AgentWorkspace() {
  const { user } = useAuth();
  const { access, loading } = useAccess();
  const s = useAgentStore(user?.id ?? "anon");
  const items = useMemo(() => mergeChatList(s.index, s.remote), [s.index, s.remote]);
  const [historyOpen, setHistoryOpen] = useState(false);
  useMarkAgentWorkspace();

  if (!loading && !isStaffRole(access?.primary_role)) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        <Lock aria-hidden="true" className="h-5 w-5" />
        a4ai Agent sirf institute staff (admin, HOD, proctor, teacher) ke liye hai.
      </div>
    );
  }

  const list = (onPicked?: () => void) => (
    <AgentSessionList items={items} activeKey={s.activeKey} busy={s.chat.busy}
      onOpen={(k) => { agentStore.openChat(k); onPicked?.(); }}
      onNew={() => { agentStore.newChat(); onPicked?.(); }}
      onRename={(k, t) => agentStore.renameChat(k, t)}
      onDelete={(k) => agentStore.deleteChat(k)} />
  );

  return (
    <div data-testid="agent-workspace"
      className="-mx-4 -mt-2 flex h-[calc(100dvh-11.5rem)] min-h-[460px] overflow-hidden border-y border-border bg-background font-halenoir text-foreground sm:mx-0 sm:mt-0 sm:rounded-lg sm:border lg:h-[calc(100dvh-14rem)]">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-muted/30 lg:block">{list()}</aside>
      <AgentChatPanel variant="page"
        leading={(
          <button type="button" onClick={() => setHistoryOpen(true)} aria-label="Pichhli chats"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden">
            <History aria-hidden="true" className="h-5 w-5" />
          </button>
        )} />
      <AgentSheetFrame open={historyOpen} onOpenChange={setHistoryOpen} side="left" title="Pichhli chats" description="a4ai Agent ki pichhli chats"
        className="w-[85vw] max-w-xs">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">Pichhli chats</p>
          <SheetClose className="grid h-11 w-11 place-items-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Close">
            <X aria-hidden="true" className="h-5 w-5" />
          </SheetClose>
        </div>
        <div className="min-h-0 flex-1">{list(() => setHistoryOpen(false))}</div>
      </AgentSheetFrame>
    </div>
  );
}
