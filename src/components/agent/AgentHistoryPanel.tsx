// ChatGPT-style chat history: New chat, title search, groups (Pinned · Today · Yesterday · Previous 7 days · Older),
// one row per chat (title, relative time, ⋯ menu: Rename inline, Pin/Unpin, Delete with confirm + Undo toast).
// Server-owned (GET /agent/sessions, pinned + paged rest, infinite scroll). The list is windowed: only the rows on
// screen (+ overscan) are in the DOM, so hundreds of chats stay cheap.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Loader2, MessageSquare, MoreHorizontal, PanelLeftClose, Pencil, Pin, PinOff, RotateCcw, Search, SquarePen, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getAgentApi } from "@/lib/agent/api";
import { flattenGroups, groupSessions, relativeTime, rowOffsets, sessionTime, windowByOffsets, type HistoryRow } from "@/lib/agent/history";
import { deleteSessionWithUndo, patchSessionOptimistic, useAgentQueryClient, useDebounced, useSessionLists } from "@/lib/agent/queries";
import { agentStore } from "@/lib/agent/store";
import type { SessionItem } from "@/lib/agent/types";
import { AgentConfirm } from "./AgentConfirm";
import { ESC_LAYER } from "./escLayer";
import { NEW_CHAT_SHORTCUT } from "./shortcuts";

const HEADER_H = 32;
const ITEM_H = 48;

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const Row = memo(function Row({ s, active, now, disabled, editing, onOpen, onStartRename, onRename, onCancelRename, onPin, onDelete }: {
  s: SessionItem; active: boolean; now: number; disabled: boolean; editing: boolean;
  onOpen: (s: SessionItem) => void; onStartRename: (id: string) => void; onRename: (s: SessionItem, title: string) => void;
  onCancelRename: () => void; onPin: (s: SessionItem) => void; onDelete: (s: SessionItem) => void;
}) {
  const [title, setTitle] = useState(s.title);
  useEffect(() => { if (editing) setTitle(s.title); }, [editing, s.title]);

  if (editing) {
    const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") { e.preventDefault(); onRename(s, title); }
      if (e.key === "Escape") { e.preventDefault(); onCancelRename(); }
    };
    return (
      <div className="flex h-full items-center px-1" {...{ [ESC_LAYER]: "" }}>
        <label className="sr-only" htmlFor={`rename-${s.id}`}>Chat ka naya naam</label>
        <input id={`rename-${s.id}`} autoFocus value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={onKey} onBlur={() => onRename(s, title)} onFocus={(e) => e.currentTarget.select()}
          className={`h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground ${focusRing}`} />
      </div>
    );
  }
  const when = relativeTime(sessionTime(s), now);
  return (
    <div className={`group relative flex h-full items-center rounded-md ${active ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`} data-testid="history-item" data-session={s.id}>
      <button type="button" onClick={() => onOpen(s)} disabled={disabled && !active} aria-current={active ? "page" : undefined}
        title={s.title}
        className={`flex h-full min-w-0 flex-1 items-center gap-2 rounded-md pl-2.5 pr-10 text-left disabled:opacity-60 ${focusRing}`}>
        {s.pinned ? <Pin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
        <span className={`min-w-0 flex-1 truncate text-sm ${active ? "font-medium" : "text-foreground"}`}>{s.title}</span>
        <span className={`shrink-0 text-[11px] tabular-nums group-hover:invisible group-focus-within:invisible ${active ? "text-accent-foreground/75" : "text-muted-foreground"}`}>{when}</span>
        <span className="sr-only">{s.pinned ? ", pinned" : ""}</span>
      </button>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`${s.title} — options`}
            className={`absolute right-0.5 grid h-10 w-9 place-items-center rounded-md text-muted-foreground opacity-100 hover:bg-background hover:text-foreground data-[state=open]:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 sm:group-focus-within:opacity-100 ${active ? "sm:opacity-100" : ""} ${focusRing}`}>
            <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[240] w-44">
          <DropdownMenuItem className="min-h-10 gap-2" onSelect={() => onStartRename(s.id)}><Pencil aria-hidden="true" className="h-4 w-4" />Naam badlo</DropdownMenuItem>
          <DropdownMenuItem className="min-h-10 gap-2" onSelect={() => onPin(s)}>
            {s.pinned ? <><PinOff aria-hidden="true" className="h-4 w-4" />Unpin</> : <><Pin aria-hidden="true" className="h-4 w-4" />Pin</>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="min-h-10 gap-2 text-destructive focus:text-destructive dark:text-red-400 dark:focus:text-red-400" onSelect={() => onDelete(s)}>
            <Trash2 aria-hidden="true" className="h-4 w-4" />Mitao
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

export function AgentHistoryPanel({ uid, activeKey, busy, onPicked, onCollapse, autoFocusSearch }: {
  uid: string | null; activeKey: string; busy: boolean;
  /** after opening / starting a chat (closes a drawer) */ onPicked?: () => void;
  /** desktop: collapse the panel */ onCollapse?: () => void;
  autoFocusSearch?: boolean;
}) {
  const qc = useAgentQueryClient();
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 200);
  const { pinned, rest, pinnedList, restList } = useSessionLists(uid, q);
  // while the server search runs, filter what we already have (instant), then show the server's answer
  const base = useSessionLists(uid, "");
  const searching = q !== search.trim() || (!!q && (pinned.isPending || rest.isPending));
  const pinnedShown = q && !pinned.data ? base.pinnedList : pinnedList;
  const restShown = q && !rest.data ? base.restList : restList;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(id); }, []);

  // local title filter only while the server's answer is on its way (the server also matches message text)
  const serverDone = !!q && q === search.trim() && !!pinned.data && !!rest.data;
  const localQ = serverDone ? "" : search;
  const groups = useMemo(() => groupSessions(pinnedShown, restShown, now, localQ), [pinnedShown, restShown, now, localQ]);
  const rows = useMemo(() => flattenGroups(groups), [groups]);
  const offsets = useMemo(() => rowOffsets(rows.map((r) => (r.kind === "header" ? HEADER_H : ITEM_H))), [rows]);

  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<SessionItem | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState({ top: 0, height: 600 });

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setView({ top: el.scrollTop, height: el.clientHeight || 600 });
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  useEffect(() => { if (autoFocusSearch) searchRef.current?.focus(); }, [autoFocusSearch]);

  const { start, end } = windowByOffsets(offsets, view.top, view.height);
  const total = offsets[offsets.length - 1] ?? 0;

  // infinite scroll: near the end of what's loaded → next page
  useEffect(() => {
    if (rows.length && end >= rows.length - 4 && rest.hasNextPage && !rest.isFetchingNextPage && !rest.isError) void rest.fetchNextPage();
  }, [end, rows.length, rest]);

  const open = useCallback((s: SessionItem) => { agentStore.openSession(s.id, s.title); onPicked?.(); }, [onPicked]);
  const startNew = () => { agentStore.newChat(); onPicked?.(); };

  const rename = useCallback((s: SessionItem, title: string) => {
    setEditing(null);
    const t = title.trim();
    if (!t || t === s.title || !uid) return;
    void (async () => {
      try {
        const saved = await patchSessionOptimistic(qc, uid, await getAgentApi(), s.id, { title: t });
        agentStore.sessionRenamed(s.id, saved.title);
      } catch (err) { toast.error((err as Error).message); }
    })();
  }, [qc, uid]);

  const pin = useCallback((s: SessionItem) => {
    if (!uid) return;
    void (async () => {
      try { await patchSessionOptimistic(qc, uid, await getAgentApi(), s.id, { pinned: !s.pinned }); } catch (err) { toast.error((err as Error).message); }
    })();
  }, [qc, uid]);

  const remove = (s: SessionItem) => {
    setConfirm(null);
    if (!uid) return;
    void getAgentApi().then((api) => {
      const wasActive = activeKey === s.id;
      const h = deleteSessionWithUndo(qc, uid, api, s.id, {
        onError: (msg) => toast.error(msg),
        onCommitted: () => agentStore.sessionDeleted(s.id),
      });
      if (wasActive) agentStore.newChat();
      toast("Chat delete ho gayi", {
        description: s.title,
        duration: 5000,
        action: { label: "Undo", onClick: () => { if (h.undo() && wasActive) agentStore.openSession(s.id, s.title); } },
      });
    });
  };

  const renderRow = (r: HistoryRow) => (r.kind === "header"
    ? <p className="flex h-full items-end px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground" role="presentation" data-testid="history-group">{r.label}</p>
    : <Row s={r.session} active={r.session.id === activeKey} now={now} disabled={busy} editing={editing === r.session.id}
        onOpen={open} onStartRename={setEditing} onRename={rename} onCancelRename={() => setEditing(null)} onPin={pin} onDelete={setConfirm} />);

  const loading = (pinned.isPending || rest.isPending) && !rows.length && !!uid;
  const failed = (pinned.isError || rest.isError) && !rows.length;

  return (
    <nav aria-label="Pichhli chats" className="flex h-full min-h-0 flex-col" data-testid="agent-history">
      <div className="flex items-center gap-1.5 p-3 pb-2">
        <button type="button" onClick={startNew} title={`Naya sawaal (${NEW_CHAT_SHORTCUT})`}
          className={`flex h-11 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted ${focusRing}`}>
          <SquarePen aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="truncate">Naya sawaal</span>
          <kbd className="ml-auto hidden shrink-0 rounded border border-border px-1 font-sans text-[10px] text-muted-foreground xl:inline">{NEW_CHAT_SHORTCUT}</kbd>
        </button>
        {onCollapse ? (
          <button type="button" onClick={onCollapse} aria-label="Chats chhupao" title="Chats chhupao"
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground ${focusRing}`}>
            <PanelLeftClose aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="agent-history-search" className="sr-only">Chats dhoondho</label>
          <input ref={searchRef} id="agent-history-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chats dhoondho"
            onKeyDown={(e) => { if (e.key === "Escape" && search) { e.preventDefault(); e.stopPropagation(); setSearch(""); } }}
            {...(search ? { [ESC_LAYER]: "" } : {})}
            className={`h-10 w-full rounded-md border border-input bg-card pl-8 pr-8 text-sm text-foreground placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden ${focusRing}`} />
          {searching ? <Loader2 aria-hidden="true" className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            : search ? (
              <button type="button" onClick={() => { setSearch(""); searchRef.current?.focus(); }} aria-label="Clear search"
                className={`absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground ${focusRing}`}>
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            ) : null}
        </div>
      </div>

      <div ref={scroller} onScroll={(e) => setView({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight || 600 })}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3" data-testid="history-scroller">
        {loading ? (
          <div className="space-y-2 px-1 pt-2" aria-label="Chats load ho rahi hain">
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-9 rounded-md bg-muted/70" />)}
          </div>
        ) : failed ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-xs text-muted-foreground">
            Chats load nahi ho payi.
            <button type="button" onClick={() => { void pinned.refetch(); void rest.refetch(); }}
              className={`inline-flex h-10 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-foreground hover:bg-muted ${focusRing}`}>
              <RotateCcw aria-hidden="true" className="h-4 w-4" />Dobara try karein
            </button>
          </div>
        ) : !rows.length ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-xs text-muted-foreground" data-testid="history-empty">
            <MessageSquare aria-hidden="true" className="h-5 w-5" />
            {search.trim() ? <>“{search.trim()}” se koi chat nahi mili.</> : "Aapki chats yahan dikhengi."}
          </div>
        ) : (
          <div style={{ height: total, position: "relative" }}>
            {rows.slice(start, end).map((r, i) => {
              const idx = start + i;
              return (
                <div key={r.key} style={{ position: "absolute", top: offsets[idx], left: 0, right: 0, height: offsets[idx + 1] - offsets[idx] }}>
                  {renderRow(r)}
                </div>
              );
            })}
          </div>
        )}
        {rest.isFetchingNextPage ? <p className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground"><Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />Aur load ho rahi hain…</p> : null}
        {rest.isError && rows.length ? (
          <button type="button" onClick={() => void rest.fetchNextPage()} className={`mx-auto mt-2 flex h-10 items-center gap-1.5 rounded-md px-3 text-xs text-muted-foreground hover:bg-muted ${focusRing}`}>
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />Aur chats load nahi hui — dobara try karein
          </button>
        ) : null}
      </div>

      <AgentConfirm open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }} title="Chat delete karein?"
        description={`“${confirm?.title ?? ""}” aur uske saare messages hat jayenge. 5 second tak Undo kar sakte hain.`}
        confirmLabel="Mitao" onConfirm={() => { if (confirm) remove(confirm); }} />
    </nav>
  );
}
