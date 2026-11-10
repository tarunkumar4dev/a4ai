// The a4ai Agent chat column, shared by the /dashboard?tab=agent workspace and the floating sheet. State lives in
// the app-wide store (src/lib/agent/store.ts), so both show the same conversation. The ONLY aria-live region is the
// (visually hidden) status line below the messages.
// Long chats: turns above the last few use `content-visibility: auto` (the browser skips their layout/paint until
// they scroll into view) with a remembered intrinsic size, so a 100-turn chat costs about as much as a short one and
// nothing jumps; the streaming turn is never skipped.
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { History, LogIn, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/AuthProvider";
import { useAccess } from "@/context/AccessProvider";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useMyScope } from "@/hooks/useMyScope";
import { stepLabel } from "@/lib/agent/chatState";
import { useAgentQueryClient } from "@/lib/agent/queries";
import { agentStore, useAgentStore } from "@/lib/agent/store";
import { ErrorCard, type BlockHandlers } from "./AgentEventBlock";
import { AgentComposer } from "./AgentComposer";
import { AgentEmptyState } from "./AgentEmptyState";
import { AgentHeader } from "./AgentHeader";
import { AgentMessage, buildContexts } from "./AgentMessage";
import { agentRole, emptyCards, roleLabel, scopeLine as scopeLineOf, suggestionsFor } from "./roles";
import { LazyVoiceDock } from "@/components/voice";
import { emitUiAction } from "@/lib/voice/uiActions";

/** Turns kept fully rendered at the bottom (the rest use content-visibility). */
export const LIVE_TURNS = 6;

export function firstNameOf(full: unknown): string | null {
  if (typeof full !== "string") return null;
  const f = full.trim().split(/\s+/)[0];
  return f ? f[0].toUpperCase() + f.slice(1) : null;
}

/**
 * The ONE live region's text: while streaming the running step (else the latest status key); after it, a fresh
 * error / stop / failed approval / expired session (so error cards don't need role="alert"). Pure.
 */
export function liveStatus(s: Pick<ReturnType<typeof useAgentStore>, "chat" | "authExpired">, now = Date.now()): string {
  if (!s.chat.busy) {
    if (s.authExpired) return "Session expire ho gaya. Dobara sign in karein.";
    const approvals = s.chat.turns.flatMap((t) => t.blocks).filter((b) => b.kind === "approval");
    const lastAppr = approvals[approvals.length - 1];
    if (lastAppr?.kind === "approval" && lastAppr.state === "failed" && lastAppr.error) return lastAppr.error;
    const last = s.chat.turns[s.chat.turns.length - 1];
    if (!last || last.role !== "assistant" || !(typeof last.endedAt === "number" && now - last.endedAt < 10_000)) return "";
    const err = last.blocks.find((b) => b.kind === "error");
    if (err && err.kind === "error") return `Jawab nahi aa paya: ${err.message}`;
    if (last.stopped) return "Jawab rok diya gaya.";
    return "";
  }
  const last = s.chat.turns[s.chat.turns.length - 1];
  const running = [...(last?.steps ?? [])].reverse().find((x) => x.status === "running");
  if (running) return `${stepLabel(running.key, running.params)}…`;
  return s.chat.status ? `${stepLabel(s.chat.status.key, s.chat.status.params)}…` : "";
}

/**
 * 401 after a silent token refresh: sign in again in a NEW TAB, so this page — and the text in the box — stays as it
 * is (nothing is saved to storage). The store clears the prompt on SIGNED_IN / when this tab gets focus back.
 */
function SessionExpired() {
  const signIn = () => { window.open("/login", "_blank", "noopener"); };
  return (
    <div className="mx-auto mb-2 flex max-w-3xl items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm" data-testid="session-expired">
      <LogIn aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">Session expire ho gaya</p>
        <p className="text-xs text-muted-foreground">Naye tab me sign in karein, phir yahan wapas aaiye — box me likha text yahin rahega.</p>
      </div>
      <Button type="button" size="sm" className="h-10 shrink-0" onClick={signIn}>Sign in again</Button>
    </div>
  );
}

export default function AgentChatPanel({ variant = "page", leading, trailing, autoFocus, newChatInSidebar }: {
  variant?: "page" | "sheet"; leading?: ReactNode; trailing?: ReactNode; autoFocus?: boolean;
  /** the workspace sidebar (lg+) has its own New chat button */ newChatInSidebar?: boolean;
}) {
  const { user } = useAuth();
  const { access } = useAccess();
  const s = useAgentStore(user?.id ?? "anon", useAgentQueryClient());
  const net = useNetworkStatus();
  const offline = net === "offline";
  const { chat } = s;
  const compact = variant === "sheet";
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const ctx = useMemo(() => buildContexts(chat.turns), [chat.turns]);
  const firstName = s.meta?.first_name ?? firstNameOf(user?.user_metadata?.full_name ?? user?.user_metadata?.name);
  const myScope = useMyScope();
  const who = agentRole(s.meta?.role, access);
  const role = roleLabel(s.meta?.role, access?.primary_role, access);
  const templates = useMemo(() => suggestionsFor(who).map((x) => x.prompt), [who]);
  const metaScope = s.meta?.scope;
  const metaBatchNames = metaScope?.batches;
  const cards = useMemo(() => {
    const batches = metaBatchNames?.length ? metaBatchNames.map((name) => ({ name })) : myScope.batches;
    return emptyCards(who, batches);
  }, [who, metaBatchNames, myScope.batches]);
  const batchCount = metaScope?.batch_count ?? (myScope.loading ? null : myScope.batches.length);
  const scopeLine = scopeLineOf(who, batchCount, metaScope?.student_count);

  // stick to the bottom while new content arrives, unless the user scrolled up to read
  const size = chat.turns.reduce((n, t) => {
    const last = t.blocks[t.blocks.length - 1];
    return n + t.blocks.length + (t.steps?.length ?? 0) + (last?.kind === "text" ? last.text.length : 0);
  }, 0);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (!chat.turns.length) el.scrollTop = 0; // the empty state reads from the top (greeting first on phones)
    else if (pinned.current) el.scrollTop = el.scrollHeight;
  }, [size, s.activeKey, s.load, chat.turns.length]);
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
    onDownloadFile: agentStore.downloadFile,
    onNavigate: (routeKey, params) => emitUiAction({ routeKey, params, label: null }),
    confirmHighlight: !!chat.confirmHighlightAt,
  };
  const inputId = compact ? "agent-input-sheet" : "agent-input-page";
  const lastAssistant = [...chat.turns].reverse().find((t) => t.role === "assistant")?.id;
  const firstLive = Math.max(0, chat.turns.length - LIVE_TURNS);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-card font-halenoir text-card-foreground" data-testid={`agent-chat-${variant}`}>
      <AgentHeader meta={s.meta} metaStatus={s.metaStatus} role={role} compact={compact} newChatInSidebar={newChatInSidebar}
        title={chat.title ?? null}
        canNew={chat.turns.length > 0 || !!chat.sessionId} onNewChat={() => agentStore.newChat()} leading={leading} trailing={trailing} />

      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain [overflow-anchor:none]" data-testid="agent-scroller">
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
            <ErrorCard code={offline ? "offline" : "network"} message="Ye chat load nahi ho payi." retryText="retry" busy={false} onRetry={() => agentStore.retryLoad()} />
          ) : chat.turns.length === 0 ? (
            <AgentEmptyState firstName={firstName} suggestions={cards} compact={compact} scopeLine={scopeLine}
              disabled={chat.busy || offline} onPick={agentStore.send} />
          ) : chat.turns.map((t, i) => (
            <div key={t.id} className={i < firstLive ? "[content-visibility:auto] [contain-intrinsic-size:auto_320px]" : undefined}>
              <AgentMessage turn={t} h={h} ctx={ctx} isLast={t.id === lastAssistant}
                onFeedback={agentStore.feedback} onRegenerate={agentStore.regenerate} onEdit={agentStore.editAndResend} />
            </div>
          ))}
        </div>
      </div>

      <p aria-live="polite" className="sr-only" data-testid="agent-status">{liveStatus(s)}</p>

      <div className="border-t border-border bg-card">
        {offline ? (
          <div className={compact ? "px-3 pt-2" : "px-3 pt-2 sm:px-6"}>
            <p className="mx-auto flex max-w-3xl items-center gap-2 rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs text-foreground" data-testid="agent-offline">
              <WifiOff aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
              Aap offline hain. Likhte rahiye — connection aate hi bhej sakenge.
            </p>
          </div>
        ) : null}
        {s.authExpired ? <div className={compact ? "px-3 pt-2" : "px-3 pt-2 sm:px-6"}><SessionExpired /></div> : null}
        {user?.id ? <div className="pt-2"><LazyVoiceDock uid={user.id} compact={compact} offline={offline} /></div> : null}
        <AgentComposer inputId={inputId} busy={chat.busy} onSend={agentStore.send} onStop={agentStore.stop}
          draftRequest={s.draft} autoFocus={autoFocus} compact={compact} uid={user?.id ?? null} templates={templates} offline={offline} />
      </div>
    </div>
  );
}
