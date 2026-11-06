// Floating "Ask a4ai" button on staff dashboard routes → right sheet (440px on desktop, full screen on phones)
// with the same chat as /dashboard?tab=agent (shared store, so closing the sheet keeps the conversation).
// Hidden on /dashboard?tab=agent itself. Sits above the help bubble (StaticSarthi: bottom-4/sm:bottom-6).
import { Suspense, lazy, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { useAccess } from "@/context/AccessProvider";
import { useAgentWorkspaceOpen } from "@/lib/agent/surface";
import { AgentSheetFrame, SheetClose } from "./AgentSheetFrame";

const AgentChatPanel = lazy(() => import("./AgentChatPanel"));

export const AGENT_DASHBOARD_ROUTES = /^\/(dashboard|institute|hod)(\/|$)/;

export function showAskA4ai(pathname: string, role: string | null | undefined, search = ""): boolean {
  if (!role || role === "none" || role === "student" || !AGENT_DASHBOARD_ROUTES.test(pathname)) return false;
  return !(pathname.replace(/\/+$/, "") === "/dashboard" && new URLSearchParams(search).get("tab") === "agent");
}

export default function AskA4aiLauncher() {
  const { access } = useAccess();
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(false);
  const workspaceOpen = useAgentWorkspaceOpen();
  if (workspaceOpen || !showAskA4ai(pathname, access?.primary_role, search)) return null;

  return (
    <>
      <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} data-testid="ask-a4ai"
        className="fixed bottom-20 right-4 z-[105] inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 font-halenoir text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:bottom-24 sm:right-6">
        <Sparkles aria-hidden="true" className="h-4 w-4" /> Ask a4ai
      </button>
      <AgentSheetFrame open={open} onOpenChange={setOpen} side="right" title="a4ai Agent" description="Attendance, marks aur verified CBSE test papers."
        onOpenAutoFocus={(e) => e.preventDefault()} className="w-full sm:w-[440px]">
        <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Loading…</p>}>
          <AgentChatPanel variant="sheet" autoFocus
            trailing={(
              <SheetClose aria-label="Close"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X aria-hidden="true" className="h-5 w-5" />
              </SheetClose>
            )} />
        </Suspense>
      </AgentSheetFrame>
    </>
  );
}
