// The a4ai Agent chat column, shared by the /dashboard?tab=agent workspace and the floating sheet. State lives in
// the app-wide store (src/lib/agent/store.ts), so both show the same conversation. The ONLY aria-live region is the
// (visually hidden) status line below the messages.
// Long chats: turns above the last few use `content-visibility: auto` (the browser skips their layout/paint until
// they scroll into view) with a remembered intrinsic size, so a 100-turn chat costs about as much as a short one and
// nothing jumps; the streaming turn is never skipped.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowDown, History, Loader2, LogIn, RefreshCw, WifiOff } from "lucide-react";
import { connectionView, type ConnectionView } from "@/lib/agent/connection";
import { Button } from "@/components/ui/button";
import { useAgentAccess, useAgentNet, useAgentScope, useAgentUser } from "@/lib/agent/env";
import { stepLabel } from "@/lib/agent/chatState";
import { clearRecentQueries, useAgentQueryClient } from "@/lib/agent/queries";
import { getAgentApi } from "@/lib/agent/api";
import { htmlLang, useAgentT, type TFn } from "@/lib/agent/i18n";
import { agentStore, useAgentStore } from "@/lib/agent/store";
import { ErrorCard, type BlockHandlers } from "./AgentEventBlock";
import { AgentEmptyState } from "./AgentEmptyState";
import { AgentHeader } from "./AgentHeader";
import { AgentMessage, buildContexts } from "./AgentMessage";
import { agentRole, emptyCards, roleLabel, scopeLine as scopeLineOf, templatesFor } from "./roles";
import { AgentConfirm } from "./AgentConfirm";
import { LazyVoiceComposer } from "@/components/voice/LazyVoiceComposer";
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
export function liveStatus(s: Pick<ReturnType<typeof useAgentStore>, "chat" | "authExpired">, now = Date.now(), t?: TFn, lang?: Parameters<typeof stepLabel>[2]): string {
  if (!s.chat.busy) {
    if (s.authExpired) return t ? t("error.session") : "Session expire ho gaya. Dobara sign in karein.";
    const approvals = s.chat.turns.flatMap((t) => t.blocks).filter((b) => b.kind === "approval");
    const lastAppr = approvals[approvals.length - 1];
    if (lastAppr?.kind === "approval" && lastAppr.state === "failed" && lastAppr.error) return lastAppr.error;
    const last = s.chat.turns[s.chat.turns.length - 1];
    if (!last || last.role !== "assistant" || !(typeof last.endedAt === "number" && now - last.endedAt < 10_000)) return "";
    const err = last.blocks.find((b) => b.kind === "error");
    if (err && err.kind === "error") return t ? t("chat.failedLive", { message: err.message }) : `Jawab nahi aa paya: ${err.message}`;
    if (last.stopped) return t ? t("chat.stopped") : "Jawab rok diya gaya.";
    return t ? t("chat.replied") : ""; // one announcement for the finished answer, never per token
  }
  const last = s.chat.turns[s.chat.turns.length - 1];
  const running = [...(last?.steps ?? [])].reverse().find((x) => x.status === "running");
  if (running) return `${stepLabel(running.key, running.params, lang)}…`;
  return s.chat.status ? `${stepLabel(s.chat.status.key, s.chat.status.params, lang)}…` : "";
}

/** One line above the composer for every connection problem; nothing when ready (no permanent badge). */
function ConnectionStrip({ view, onRetry }: { view: ConnectionView; onRetry: () => void }) {
  const { t } = useAgentT();
  if (view === "none" || view === "connecting") return null;
  const retry = (
    <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 rounded-full" onClick={onRetry} data-testid="connection-retry">
      <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />{t("action.retry")}
    </Button>
  );
  const box = "mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border px-3 py-2 text-[13px]";
  if (view === "offline") return (
    <p className={`${box} border-border bg-muted/60 text-foreground`} data-testid="agent-offline">
      <WifiOff aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="agent-prose"><strong className="font-medium">{t("status.offline")}.</strong> {t("status.offlineNote")}</span>
    </p>
  );
  if (view === "reconnecting") return (
    <p className={`${box} border-transparent text-muted-foreground`} data-testid="agent-connection" data-state="reconnecting">
      <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 motion-safe:animate-spin" /><span className="agent-prose">{t("status.reconnecting")}</span>
    </p>
  );
  if (view === "slow") return (
    <div className={`${box} border-border bg-muted/40 text-foreground`} data-testid="agent-connection" data-state="slow">
      <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 text-primary motion-safe:animate-spin" />
      <span className="agent-prose min-w-0 flex-1">{t("status.slow")}</span>{retry}
    </div>
  );
  return (
    <div className={`${box} border-destructive/30 bg-destructive/5 text-foreground`} data-testid="agent-connection" data-state="failed" role="status">
      <WifiOff aria-hidden="true" className="h-4 w-4 shrink-0 text-destructive dark:text-red-400" />
      <span className="agent-prose min-w-0 flex-1"><strong className="block font-medium">{t("status.failed")}</strong><span className="text-muted-foreground">{t("status.failedHelp")}</span></span>{retry}
    </div>
  );
}

/**
 * 401 after a silent token refresh: sign in again in a NEW TAB, so this page — and the text in the box — stays as it
 * is (nothing is saved to storage). The store clears the prompt on SIGNED_IN / when this tab gets focus back.
 */
function SessionExpired() {
  const { t } = useAgentT();
  const signIn = () => { window.open("/login", "_blank", "noopener"); };
  return (
    <div className="mx-auto mb-2 flex max-w-3xl items-start gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 text-sm" data-testid="session-expired">
      <LogIn aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{t("session.title")}</p>
        <p className="agent-prose text-[13px] text-muted-foreground">{t("session.body")}</p>
      </div>
      <Button type="button" size="sm" className="h-10 shrink-0" onClick={signIn}>{t("session.signIn")}</Button>
    </div>
  );
}

export default function AgentChatPanel({ variant = "page", leading, trailing, autoFocus, newChatInSidebar, wide, onToggleWide }: {
  variant?: "page" | "sheet"; leading?: ReactNode; trailing?: ReactNode; autoFocus?: boolean;
  /** the workspace sidebar (lg+) has its own New chat button */ newChatInSidebar?: boolean;
  /** sheet on desktop: 420 ↔ 720 px (the ⋯ menu) */ wide?: boolean; onToggleWide?: () => void;
}) {
  const user = useAgentUser();
  const access = useAgentAccess();
  const s = useAgentStore(user?.id ?? "anon", useAgentQueryClient());
  const net = useAgentNet();
  const offline = net === "offline";
  const { chat } = s;
  const compact = variant === "sheet";
  const { t, lang } = useAgentT();
  const [confirmClear, setConfirmClear] = useState(false);
  // typing 2+ characters hands the suggestions over to the typeahead: the starter cards step aside (one surface)
  const [typing, setTyping] = useState(false);
  const onTextChange = useCallback((v: string) => setTyping(v.trim().length >= 2), []);
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [awayFromBottom, setAway] = useState(false);
  const ctx = useMemo(() => buildContexts(chat.turns), [chat.turns]);
  const firstName = s.meta?.first_name ?? firstNameOf(user?.user_metadata?.full_name ?? user?.user_metadata?.name);
  const myScope = useAgentScope();
  const who = agentRole(s.meta?.role, access);
  const role = roleLabel(s.meta?.role, access?.primary_role, access, t);
  const metaScope = s.meta?.scope;
  const metaBatchNames = metaScope?.batches;
  const features = s.meta?.features;
  const batchCount = metaScope?.batch_count ?? (myScope.loading ? null : myScope.batches.length);
  // admin / HOD read the whole institute / department; only teachers and proctors need their own batch
  const hasBatch = who === "admin" || who === "hod" || batchCount === null ? null : batchCount > 0;
  const templates = useMemo(() => templatesFor(who, { t, hasBatch, features }), [who, t, hasBatch, features]);
  const cards = useMemo(() => {
    const batches = metaBatchNames?.length ? metaBatchNames.map((name) => ({ name })) : myScope.batches;
    return emptyCards(who, batches, { t, hasBatch, features });
  }, [who, metaBatchNames, myScope.batches, t, hasBatch, features]);
  const scopeLine = scopeLineOf(who, batchCount, metaScope?.student_count, t);
  const qcAgent = useAgentQueryClient();
  const clearSearch = useCallback(() => {
    setConfirmClear(false);
    const uid = user?.id;
    if (!uid) return;
    void getAgentApi().then((api) => clearRecentQueries(qcAgent, uid, api))
      .then(() => toast.success(t("clear.done")))
      .catch(() => toast.error(t("error.generic")));
  }, [user?.id, qcAgent, t]);

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
  useEffect(() => { pinned.current = true; setAway(false); }, [chat.turns.length, s.activeKey]);
  // auto-scroll only while the user is near the bottom; scrolled up → it pauses and a "Jump to latest" pill shows
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setAway(!pinned.current);
  };
  const jumpToLatest = () => {
    const el = scroller.current;
    if (!el) return;
    pinned.current = true;
    setAway(false);
    el.scrollTo({ top: el.scrollHeight, behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const conn = connectionView(s.metaStatus, offline);

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
    <div lang={htmlLang(lang)} data-agent-root="" className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-card font-halenoir text-card-foreground" data-testid={`agent-chat-${variant}`}>
      <AgentHeader meta={s.meta} compact={compact} newChatInSidebar={newChatInSidebar} title={chat.title ?? null}
        canNew={chat.turns.length > 0 || !!chat.sessionId} onNewChat={() => agentStore.newChat()} leading={leading} trailing={trailing}
        wide={wide} onToggleWide={onToggleWide} onClearSearch={user?.id ? () => setConfirmClear(true) : null} />

      <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scroller} onScroll={onScroll} aria-busy={chat.busy} className="min-h-0 flex-1 overflow-y-auto overscroll-contain [overflow-anchor:none]" data-testid="agent-scroller">
        <div className={`mx-auto w-full max-w-3xl space-y-6 [container-type:inline-size] ${compact ? "px-3 py-4" : "px-3 py-5 sm:px-6"}`}>
          {s.loadNote ? (
            <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground" data-testid="load-note">
              <History aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{s.loadNote}
            </p>
          ) : null}
          {s.load === "loading" && chat.turns.length === 0 ? (
            <div className="space-y-6" aria-label={t("chat.loading")} data-testid="chat-loading">
              <div className="ml-auto h-10 w-1/2 rounded-2xl bg-muted" />
              <div className="space-y-2"><div className="h-4 w-3/4 rounded bg-muted" /><div className="h-4 w-1/2 rounded bg-muted" /><div className="h-24 rounded-lg bg-muted/70" /></div>
            </div>
          ) : s.load === "error" && chat.turns.length === 0 ? (
            <ErrorCard code={offline ? "offline" : "network"} message={t("chat.loadFailed")} retryText="retry" busy={false} onRetry={() => agentStore.retryLoad()} />
          ) : chat.turns.length === 0 ? (
            <AgentEmptyState firstName={firstName} suggestions={cards} compact={compact} scopeLine={scopeLine} role={role}
              noBatch={hasBatch === false} disabled={chat.busy || offline} onPick={agentStore.send} hideCards={typing} connecting={conn === "connecting" || conn === "slow" || conn === "reconnecting"} />
          ) : chat.turns.map((t, i) => (
            <div key={t.id} className={i < firstLive ? "[content-visibility:auto] [contain-intrinsic-size:auto_320px]" : undefined}>
              <AgentMessage turn={t} h={h} ctx={ctx} isLast={t.id === lastAssistant}
                onFeedback={agentStore.feedback} onRegenerate={agentStore.regenerate} onEdit={agentStore.editAndResend} />
            </div>
          ))}
        </div>
      </div>

      {awayFromBottom && chat.turns.length > 0 ? (
        <button type="button" onClick={jumpToLatest} data-testid="jump-latest"
          className="absolute bottom-3 left-1/2 z-10 inline-flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[13px] font-medium text-foreground shadow-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowDown aria-hidden="true" className="h-4 w-4" />{t("chat.jumpLatest")}
        </button>
      ) : null}
      </div>

      <p aria-live="polite" className="sr-only" data-testid="agent-status">{liveStatus(s, Date.now(), t, lang)}</p>

      <div className="border-t border-border bg-card pb-[env(safe-area-inset-bottom,0px)]">
        {conn !== "none" && conn !== "connecting" ? (
          <div className={compact ? "px-3 pt-2" : "px-3 pt-2 sm:px-6"}><ConnectionStrip view={conn} onRetry={agentStore.retryMeta} /></div>
        ) : null}
        {s.authExpired ? <div className={compact ? "px-3 pt-2" : "px-3 pt-2 sm:px-6"}><SessionExpired /></div> : null}
        <LazyVoiceComposer inputId={inputId} busy={chat.busy} onSend={agentStore.send} onStop={agentStore.stop}
          draftRequest={s.draft} autoFocus={autoFocus} compact={compact} uid={user?.id ?? null} templates={templates} offline={offline} onTextChange={onTextChange} />
      </div>
      <AgentConfirm open={confirmClear} onOpenChange={setConfirmClear} title={t("clear.title")} description={t("clear.body")}
        confirmLabel={t("clear.ok")} onConfirm={clearSearch} />
    </div>
  );
}
