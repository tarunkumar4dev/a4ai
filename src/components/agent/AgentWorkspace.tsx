// /dashboard?tab=agent — chat history on the left (collapsible on lg+, a drawer on phones / tablets), the chat in
// the middle. Staff only.
import { useLayoutEffect, useRef, useState } from "react";
import { History, Lock, PanelLeftOpen, X } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useAccess } from "@/context/AccessProvider";
import { loadPref, savePref } from "@/lib/agent/persist";
import { useAgentQueryClient } from "@/lib/agent/queries";
import { useAgentStore } from "@/lib/agent/store";
import { useMarkAgentWorkspace } from "@/lib/agent/surface";
import AgentChatPanel from "./AgentChatPanel";
import { AgentHistoryPanel } from "./AgentHistoryPanel";
import { AgentSheetFrame, SheetClose } from "./AgentSheetFrame";
import { isStaffRole } from "./roles";

const iconBtn = "grid h-11 w-11 shrink-0 place-items-center rounded-md text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function AgentWorkspace() {
  const { user } = useAuth();
  const { access, loading } = useAccess();
  const uid = user?.id ?? null;
  const s = useAgentStore(uid ?? "anon", useAgentQueryClient());
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(() => (uid ? loadPref(uid, "historyCollapsed") === "1" : false));
  const historyBtn = useRef<HTMLButtonElement>(null);
  const expandBtn = useRef<HTMLButtonElement>(null);
  useMarkAgentWorkspace();
  const box = useRef<HTMLDivElement>(null);

  const setCollapse = (v: boolean) => {
    setCollapsed(v);
    if (uid) savePref(uid, "historyCollapsed", v ? "1" : "0");
    // keep focus on a real control after the panel goes away / comes back
    requestAnimationFrame(() => (v ? expandBtn.current : document.getElementById("agent-history-search"))?.focus());
  };

  // fill the dashboard's scroll area below its header, so the composer is always on screen (phones included)
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      const main = el.closest("main");
      const area = main ?? document.documentElement;
      const top = el.getBoundingClientRect().top - (main ? main.getBoundingClientRect().top - main.scrollTop : 0);
      el.style.height = `${Math.max(420, area.clientHeight - top - 12)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [loading]);

  if (!loading && !isStaffRole(access?.primary_role)) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        <Lock aria-hidden="true" className="h-5 w-5" />
        a4ai Agent sirf institute staff (admin, HOD, proctor, teacher) ke liye hai.
      </div>
    );
  }

  return (
    <div ref={box} data-testid="agent-workspace" data-agent-workspace=""
      className="-mx-4 flex h-[calc(100dvh-15rem)] min-h-[420px] overflow-hidden border-y border-border bg-card font-halenoir text-card-foreground sm:mx-0 sm:rounded-lg sm:border">
      {/* the help bubble would sit on the send button; the agent is the help here */}
      <style>{"body:has([data-agent-workspace]) .a4-help{display:none!important}"}</style>
      {!collapsed ? (
        <aside className="hidden w-72 shrink-0 border-r border-border bg-muted/30 lg:block" data-testid="history-sidebar">
          <AgentHistoryPanel uid={uid} activeKey={s.activeKey} busy={s.chat.busy} onCollapse={() => setCollapse(true)} />
        </aside>
      ) : null}
      <AgentChatPanel variant="page"
        leading={(
          <>
            <button ref={historyBtn} type="button" onClick={() => setDrawer(true)} aria-label="Chat history" title="Chat history" className={`${iconBtn} lg:hidden`}>
              <History aria-hidden="true" className="h-5 w-5" />
            </button>
            {collapsed ? (
              <button ref={expandBtn} type="button" onClick={() => setCollapse(false)} aria-label="Show chat history" title="Show chat history" className={`${iconBtn} hidden lg:grid`}>
                <PanelLeftOpen aria-hidden="true" className="h-5 w-5" />
              </button>
            ) : null}
          </>
        )}
        newChatInSidebar={!collapsed} />
      <AgentSheetFrame open={drawer} onOpenChange={setDrawer} side="left" title="Chat history" description="a4ai Agent ki pichhli chats" returnFocus={historyBtn}
        className="w-[88vw] max-w-sm">
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
          <p className="text-sm font-semibold">Chat history</p>
          <SheetClose className={iconBtn} aria-label="Close chat history">
            <X aria-hidden="true" className="h-5 w-5" />
          </SheetClose>
        </div>
        <div className="min-h-0 flex-1">
          <AgentHistoryPanel uid={uid} activeKey={s.activeKey} busy={s.chat.busy} onPicked={() => setDrawer(false)} />
        </div>
      </AgentSheetFrame>
    </div>
  );
}
