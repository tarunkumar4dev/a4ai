// Floating "Ask a4ai" button on staff dashboard routes → right sheet (440px on desktop, full screen on phones)
// with the same chat as /dashboard?tab=agent (shared store, so closing the sheet keeps the conversation).
// Hidden on /dashboard?tab=agent itself. Sits above the help bubble (StaticSarthi: bottom-4/sm:bottom-6).
// Global shortcuts live here (it is mounted on every dashboard route): Ctrl/⌘+K opens the agent (or focuses the
// workspace's message box), Ctrl/⌘+Shift+O starts a new chat, "/" focuses the message box while the agent is on screen.
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { History, Sparkles, X } from "lucide-react";
import { useAccess } from "@/context/AccessProvider";
import { useAuth } from "@/providers/AuthProvider";
import { LazyFloatingMic } from "@/components/voice";
import { useVoiceNavigation } from "@/lib/voice/useVoiceNavigation";
import { requestComposerFocus, useAgentWorkspaceOpen } from "@/lib/agent/surface";
import { AgentSheetFrame, SheetClose } from "./AgentSheetFrame";
import { matchShortcut, OPEN_SHORTCUT } from "./shortcuts";

const AgentChatPanel = lazy(() => import("./AgentChatPanel"));
const SheetHistory = lazy(() => import("./SheetHistory"));

export const AGENT_DASHBOARD_ROUTES = /^\/(dashboard|institute|hod)(\/|$)/;

export function showAskA4ai(pathname: string, role: string | null | undefined, search = ""): boolean {
  if (!role || role === "none" || role === "student" || !AGENT_DASHBOARD_ROUTES.test(pathname)) return false;
  return !(pathname.replace(/\/+$/, "") === "/dashboard" && new URLSearchParams(search).get("tab") === "agent");
}

const iconBtn = "grid h-11 w-11 shrink-0 place-items-center rounded-md text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function AskA4aiLauncher() {
  const { access } = useAccess();
  const { user } = useAuth();
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(false);
  const closeSheet = useCallback(() => setOpen(false), []);
  const [history, setHistory] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const historyBtn = useRef<HTMLButtonElement>(null);
  const workspaceOpen = useAgentWorkspaceOpen();
  const staffRoute = AGENT_DASHBOARD_ROUTES.test(pathname) && !!access?.primary_role && !["none", "student"].includes(access.primary_role);
  const visible = !workspaceOpen && showAskA4ai(pathname, access?.primary_role, search);

  useEffect(() => { if (!open) setHistory(false); }, [open]);

  useEffect(() => {
    if (!staffRoute) return;
    const onKey = (e: KeyboardEvent) => {
      const action = matchShortcut(e, e.target);
      if (!action) return;
      const agentOnScreen = workspaceOpen || open;
      if (action === "focus-input" && !agentOnScreen) return;
      e.preventDefault();
      if (action === "new-chat") {
        void import("@/lib/agent/store").then(({ agentStore }) => agentStore.newChat());
        if (!agentOnScreen) setOpen(true);
        setHistory(false);
      } else if (!workspaceOpen) {
        setOpen(true);
        setHistory(false);
      }
      requestAnimationFrame(() => requestComposerFocus());
      setTimeout(requestComposerFocus, 120); // the sheet's lazy chat may mount a frame later
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [staffRoute, workspaceOpen, open]);

  // voice (1.4): `ui_action navigate` from a live answer → registry route; closes the sheet so the page is seen
  useVoiceNavigation(closeSheet);

  if (!visible) return null;

  return (
    <>
      <LazyFloatingMic uid={user?.id ?? null} onOpen={() => { setOpen(true); setHistory(false); }} />
      <button ref={btn} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} data-testid="ask-a4ai"
        title={`Ask a4ai (${OPEN_SHORTCUT})`}
        className="fixed bottom-20 right-4 z-[105] inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 font-halenoir text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:bottom-24 sm:right-6">
        <Sparkles aria-hidden="true" className="h-4 w-4" /> Ask a4ai
      </button>
      <AgentSheetFrame open={open} onOpenChange={setOpen} side="right" title="a4ai Agent" description="Attendance, marks aur verified CBSE test papers."
        onOpenAutoFocus={(e) => e.preventDefault()} returnFocus={btn} className="w-full sm:w-[440px]">
        <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Loading…</p>}>
          <div className="relative flex min-h-0 flex-1 flex-col">
            <AgentChatPanel variant="sheet" autoFocus
              leading={(
                <button ref={historyBtn} type="button" onClick={() => setHistory(true)} aria-label="Pichhli chats" title="Pichhli chats"
                  aria-expanded={history} className={iconBtn}>
                  <History aria-hidden="true" className="h-5 w-5" />
                </button>
              )}
              trailing={(
                <SheetClose aria-label="Close" className={iconBtn}>
                  <X aria-hidden="true" className="h-5 w-5" />
                </SheetClose>
              )} />
            {history ? <SheetHistory onClose={() => { setHistory(false); historyBtn.current?.focus(); }} onPicked={() => { setHistory(false); requestAnimationFrame(requestComposerFocus); }} /> : null}
          </div>
        </Suspense>
      </AgentSheetFrame>
    </>
  );
}
