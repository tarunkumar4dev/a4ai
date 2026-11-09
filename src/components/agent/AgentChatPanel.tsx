// The a4ai Agent chat column, shared by the /dashboard?tab=agent workspace and the floating sheet. State lives in
// the app-wide store (src/lib/agent/store.ts), so both show the same conversation. The ONLY aria-live region is the
// (visually hidden) status line below the messages.
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { History } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useAccess } from "@/context/AccessProvider";
import { stepLabel } from "@/lib/agent/chatState";
import { agentStore, useAgentStore } from "@/lib/agent/store";
import { useAgentQueryClient } from "@/lib/agent/queries";
import { ErrorCard, type BlockHandlers } from "./AgentEventBlock";
import { AgentComposer } from "./AgentComposer";
import { AgentEmptyState } from "./AgentEmptyState";
import { AgentHeader } from "./AgentHeader";
import { AgentMessage, buildContexts } from "./AgentMessage";
import { roleLabel, suggestionsFor } from "./roles";

export function firstNameOf(full: unknown): string | null {
  if (typeof full !== "string") return null;
  const f = full.trim().split(/\s+/)[0];
  return f ? f[0].toUpperCase() + f.slice(1) : null;
}

/** The live status text: the running step, else the latest status key. */
function liveStatus(s: ReturnType<typeof useAgentStore>): string {
  if (!s.chat.busy) return "";
  const last = s.chat.turns[s.chat.turns.length - 1];
  const running = [...(last?.steps ?? [])].reverse().find((x) => x.status === "running");
  if (running) return `${stepLabel(running.key, running.params)}…`;
  return s.chat.status ? `${stepLabel(s.chat.status.key, s.chat.status.params)}…` : "";
}

export default function AgentChatPanel({ variant = "page", leading, trailing, autoFocus, newChatInSidebar }: {
  variant?: "page" | "sheet"; leading?: ReactNode; trailing?: ReactNode; autoFocus?: boolean;
  /** the workspace sidebar (lg+) has its own New chat button */ newChatInSidebar?: boolean;
}) {
  const { user } = useAuth();
  const { access } = useAccess();
  const s = useAgentStore(user?.id ?? "anon", useAgentQueryClient());
  const { chat } = s;
  const compact = variant === "sheet";
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const ctx = useMemo(() => buildContexts(chat.turns), [chat.turns]);
  const firstName = s.meta?.first_name ?? firstNameOf(user?.user_metadata?.full_name ?? user?.user_metadata?.name);
  const role = roleLabel(s.meta?.role, access?.primary_role);

  // stick to the bottom while new content arrives, unless the user scrolled up to read
  const size = chat.turns.reduce((n, t) => {
    const last = t.blocks[t.blocks.length - 1];
    return n + t.blocks.length + (t.steps?.length ?? 0) + (last?.kind === "text" ? last.text.length : 0);
  }, 0);
  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [size, s.activeKey]);
  useEffect(() => { pinned.current = true; }, [chat.turns.length, s.activeKey]);
  const onScroll = () => {
    const el = scroller.current;
    if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const h: BlockHandlers = {
    busy: chat.busy,
    onAnswer: agentStore.answerClarify,
    onApprove: agentStore.approve,
    onCancel: agentStore.cancelApproval,
    onRetry: agentStore.send,
    onDownload: agentStore.download,
    onSend: agentStore.send,
    onPrefill: agentStore.prefill,
  };
  const inputId = compact ? "agent-input-sheet" : "agent-input-page";

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background font-halenoir text-foreground" data-testid={`agent-chat-${variant}`}>
      <AgentHeader meta={s.meta} metaStatus={s.metaStatus} role={role} compact={compact} newChatInSidebar={newChatInSidebar}
        canNew={chat.turns.length > 0 || !!chat.sessionId} onNewChat={() => agentStore.newChat()} leading={leading} trailing={trailing} />

      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className={`mx-auto w-full max-w-3xl space-y-6 [container-type:inline-size] ${compact ? "px-3 py-4" : "px-3 py-5 sm:px-6"}`}>
          {s.loadNote ? (
            <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground" data-testid="load-note">
              <History aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{s.loadNote}
            </p>
          ) : null}
          {s.load === "loading" && chat.turns.length === 0 ? (
            <div className="space-y-6" aria-label="Chat load ho rahi hai" data-testid="chat-loading">
              <div className="ml-auto h-10 w-1/2 rounded-2xl bg-muted" />
              <div className="space-y-2"><div className="h-4 w-3/4 rounded bg-muted" /><div className="h-4 w-1/2 rounded bg-muted" /><div className="h-24 rounded-lg bg-muted/70" /></div>
            </div>
          ) : s.load === "error" && chat.turns.length === 0 ? (
            <ErrorCard code="network" message="Ye chat load nahi ho payi." retryText="retry" busy={false} onRetry={() => agentStore.retryLoad()} />
          ) : chat.turns.length === 0 ? (
            <AgentEmptyState firstName={firstName} suggestions={suggestionsFor(s.meta?.role, access?.primary_role)} compact={compact}
              disabled={chat.busy} onPick={agentStore.send} />
          ) : chat.turns.map((t) => <AgentMessage key={t.id} turn={t} h={h} ctx={ctx} onFeedback={agentStore.feedback} />)}
        </div>
      </div>

      <p aria-live="polite" className="sr-only" data-testid="agent-status">{liveStatus(s)}</p>

      <div className="border-t border-border bg-background">
        <AgentComposer inputId={inputId} busy={chat.busy} onSend={agentStore.send} onStop={agentStore.stop}
          draftRequest={s.draft} autoFocus={autoFocus} compact={compact} />
      </div>
    </div>
  );
}
