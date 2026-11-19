// Floating "Ask a4ai" button on staff dashboard routes → right sheet (440px on desktop, full screen on phones)
// with the same chat as /dashboard?tab=agent (shared store, so closing the sheet keeps the conversation).
// Hidden on /dashboard?tab=agent itself. Sits above the help bubble (StaticSarthi: bottom-4/sm:bottom-6).
// Global shortcuts live here (it is mounted on every dashboard route): Ctrl/⌘+K opens the agent (or focuses the
// workspace's message box), Ctrl/⌘+Shift+O starts a new chat, "/" focuses the message box while the agent is on screen.
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { History, Sparkles, X } from "lucide-react";
import { useAgentLang } from "@/lib/agent/i18n/lang";
import type { AgentLang } from "@/lib/agent/i18n/types";
import { IconTip, iconBtn } from "./IconTip";
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

// The launcher is in the initial bundle: it keeps its four labels here instead of importing the dictionaries
// (~45 KB). Same text as hinglish.ts / en.ts / hi.ts (header.history, header.close, brand.title, subtitle).
export const LAUNCHER_LABELS: Record<AgentLang, { history: string; close: string; title: string; desc: string }> = {
  hinglish: { history: "Pichhli chats", close: "Band karein", title: "a4ai Agent", desc: "Attendance, marks ya naya test — seedha poochiye." },
  en: { history: "Past chats", close: "Close", title: "a4ai Agent", desc: "Ask about attendance, marks, or create a new test." },
  hi: { history: "पिछली चैट", close: "बंद करें", title: "a4ai Agent", desc: "अटेंडेंस, मार्क्स या नया टेस्ट — सीधे पूछिए।" },
};
const WIDE_KEY = "a4ai.agent.wide";
const readWide = () => { try { return localStorage.getItem(WIDE_KEY) === "1"; } catch { return false; } };

export default function AskA4aiLauncher() {
  const { access } = useAccess();
  const { user } = useAuth();
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(false);
  const closeSheet = useCallback(() => setOpen(false), []);
  const [history, setHistory] = useState(false);
  const L = LAUNCHER_LABELS[useAgentLang()];
  const [wide, setWide] = useState(readWide);
  const toggleWide = useCallback(() => setWide((w) => {
    try { localStorage.setItem(WIDE_KEY, w ? "0" : "1"); } catch { /* private mode */ }
    return !w;
  }), []);
  const btn = useRef<HTMLButtonElement>(null);
  const historyBtn = useRef<HTMLButtonElement>(null);
  const workspaceOpen = useAgentWorkspaceOpen();
  const staffRoute = AGENT_DASHBOARD_ROUTES.test(pathname) && !!access?.primary_role && !["none", "student"].includes(access.primary_role);
  const visible = !workspaceOpen && showAskA4ai(pathname, access?.primary_role, search);

  useEffect(() => { if (!open) setHistory(false); }, [open]);

  // phones: the system back gesture closes the sheet (one history entry while it is open, removed on close)
  useEffect(() => {
    if (!open || typeof window === "undefined" || !window.matchMedia?.("(max-width: 639px)").matches) return;
    window.history.pushState({ ...(window.history.state ?? {}), a4aiAgentSheet: true }, "");
    const onPop = () => setOpen(false);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (window.history.state?.a4aiAgentSheet) window.history.back(); // closed by the UI, not by Back
    };
  }, [open]);

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
      <AgentSheetFrame open={open} onOpenChange={setOpen} side="right" title={L.title} description={L.desc}
        onOpenAutoFocus={(e) => e.preventDefault()} returnFocus={btn}
        className={`w-full sm:w-[420px] sm:min-w-[360px] sm:max-w-[calc(100vw-2rem)] motion-safe:transition-[width] motion-safe:duration-200 ${wide ? "sm:w-[720px]" : ""}`}>
        <Suspense fallback={<div className="flex h-14 items-center gap-2 border-b border-border px-3" aria-busy="true"><span className="h-8 w-8 rounded-lg bg-muted" /><span className="h-4 w-28 rounded bg-muted" /></div>}>
          <div className="relative flex min-h-0 flex-1 flex-col">
            <AgentChatPanel variant="sheet" autoFocus wide={wide} onToggleWide={toggleWide}
              leading={(
                <IconTip label={L.history}>
                  <button ref={historyBtn} type="button" onClick={() => setHistory(true)} aria-label={L.history}
                    aria-expanded={history} className={iconBtn} data-testid="agent-history">
                    <History aria-hidden="true" className="h-[18px] w-[18px]" />
                  </button>
                </IconTip>
              )}
              trailing={(
                <IconTip label={L.close}>
                  <SheetClose aria-label={L.close} className={iconBtn} data-testid="agent-close">
                    <X aria-hidden="true" className="h-5 w-5" />
                  </SheetClose>
                </IconTip>
              )} />
            {history ? <SheetHistory onClose={() => { setHistory(false); historyBtn.current?.focus(); }} onPicked={() => { setHistory(false); requestAnimationFrame(requestComposerFocus); }} /> : null}
          </div>
        </Suspense>
      </AgentSheetFrame>
    </>
  );
}
