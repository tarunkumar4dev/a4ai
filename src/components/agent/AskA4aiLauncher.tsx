// Floating "Ask a4ai" button on staff dashboard routes. Side sheet on desktop, full screen on phones.
// Chat state lives here (not in the lazy panel), so closing the sheet keeps the conversation.
// Sits above the help bubble (StaticSarthi uses bottom-4/sm:bottom-6, right-4/sm:right-6).
import { Suspense, lazy, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAccess } from "@/context/AccessProvider";
import { useAgentChat } from "./useAgentChat";

const AgentChatPanel = lazy(() => import("./AgentChatPanel"));

export const AGENT_DASHBOARD_ROUTES = /^\/(dashboard|institute|hod)(\/|$)/;

export function showAskA4ai(pathname: string, role: string | null | undefined): boolean {
  return !!role && role !== "none" && AGENT_DASHBOARD_ROUTES.test(pathname);
}

export default function AskA4aiLauncher() {
  const { access } = useAccess();
  const { pathname } = useLocation();
  const chat = useAgentChat();
  const [open, setOpen] = useState(false);
  const role = access?.primary_role ?? "none";
  if (!showAskA4ai(pathname, role)) return null;

  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-[105] inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:bottom-24 sm:right-6">
        <span aria-hidden="true">✦</span> Ask a4ai
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="border-b border-border px-4 py-3 text-left">
            <SheetTitle>Ask a4ai</SheetTitle>
            <SheetDescription className="text-xs">Attendance, marks and verified CBSE test papers.</SheetDescription>
          </SheetHeader>
          <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Loading…</p>}>
            <AgentChatPanel chat={chat} role={role === "admin" ? "admin" : "teacher"} />
          </Suspense>
        </SheetContent>
      </Sheet>
    </>
  );
}
