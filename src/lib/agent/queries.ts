// TanStack Query layer for the agent's REST endpoints (the app's existing data layer).
// Keys: ["agent", uid, "sessions", { q, pinned }] (pinned list + paged rest), ["agent", uid, "queries"],
//       ["agent", uid, "suggest", q]. Mutations are optimistic: the cache changes first, a snapshot rolls it back on
//       error. Delete waits 5 s (Undo toast) before the DELETE is sent; leaving the page sends it with keepalive.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery, useQuery, useQueryClient, type InfiniteData, type QueryClient, type QueryKey,
} from "@tanstack/react-query";
import { getAgentApi, isMissingEndpoint, type AgentApi } from "./api";
import type { QueryItem, SessionItem, SessionList, SessionPatch, Suggestion } from "./types";

export const SESSIONS_PAGE = 20;
export const SUGGEST_DEBOUNCE_MS = 120;
export const UNDO_MS = 5000;

export const agentKeys = {
  all: (uid: string) => ["agent", uid] as const,
  sessionsRoot: (uid: string) => ["agent", uid, "sessions"] as const,
  sessions: (uid: string, q: string, pinned: boolean) => ["agent", uid, "sessions", { q: q.trim(), pinned }] as const,
  queries: (uid: string) => ["agent", uid, "queries"] as const,
  suggest: (uid: string, q: string) => ["agent", uid, "suggest", q.trim().toLowerCase()] as const,
};

type Pages = InfiniteData<SessionList, string | null>;
export type SessionsCache = Pages | SessionItem[] | undefined;

// ---- pure cache transforms (exported for tests) -----------------------------------------------------
const mapPages = (d: Pages, fn: (list: SessionItem[]) => SessionItem[]): Pages =>
  ({ ...d, pages: d.pages.map((p) => ({ ...p, items: fn(p.items) })) });

/** Apply `fn` to every session list in a sessions cache entry (paged or plain). */
export function mapSessionsCache(data: SessionsCache, fn: (list: SessionItem[]) => SessionItem[]): SessionsCache {
  if (!data) return data;
  if (Array.isArray(data)) return fn(data);
  return mapPages(data, fn);
}

const t = (s: SessionItem) => Date.parse(s.last_message_at || s.created_at) || 0;

/** Insert (or move) a session into the right place of a list, newest first. */
export function upsertSorted(list: SessionItem[], s: SessionItem): SessionItem[] {
  const rest = list.filter((x) => x.id !== s.id);
  const i = rest.findIndex((x) => t(x) < t(s));
  return i === -1 ? [...rest, s] : [...rest.slice(0, i), s, ...rest.slice(i)];
}

interface CacheMeta { pinned: boolean; q: string }
const metaOf = (key: QueryKey): CacheMeta => {
  const m = (key[3] ?? {}) as Partial<CacheMeta>;
  return { pinned: m.pinned === true, q: typeof m.q === "string" ? m.q : "" };
};
const fits = (s: SessionItem, meta: CacheMeta) =>
  s.pinned === meta.pinned && (!meta.q || s.title.toLowerCase().includes(meta.q.toLowerCase()));

/** Put a session where it belongs in every cached list (pinned list vs the rest, search filters), removing it elsewhere. */
export function placeSession(qc: QueryClient, uid: string, s: SessionItem) {
  for (const [key, data] of qc.getQueriesData<SessionsCache>({ queryKey: agentKeys.sessionsRoot(uid) })) {
    if (!data) continue;
    const meta = metaOf(key);
    qc.setQueryData<SessionsCache>(key, (d) => {
      if (!d) return d;
      if (!fits(s, meta)) return mapSessionsCache(d, (l) => l.filter((x) => x.id !== s.id));
      if (Array.isArray(d)) return upsertSorted(d, s);
      // paged: drop it everywhere, then insert into the first page whose range covers it (or the first page)
      const cleaned = mapPages(d, (l) => l.filter((x) => x.id !== s.id));
      const idx = Math.max(0, cleaned.pages.findIndex((p) => p.items.length === 0 || t(p.items[p.items.length - 1]) <= t(s)));
      const lastPage = cleaned.pages[cleaned.pages.length - 1];
      const olderThanLoaded = idx === 0 && cleaned.pages.length > 0 && lastPage.next_cursor !== null && lastPage.items.length > 0 && t(lastPage.items[lastPage.items.length - 1]) > t(s);
      if (olderThanLoaded) return cleaned; // it will arrive with a later page
      return { ...cleaned, pages: cleaned.pages.map((p, i) => (i === idx ? { ...p, items: upsertSorted(p.items, s) } : p)) };
    });
  }
}

export function findSession(qc: QueryClient, uid: string, id: string): SessionItem | null {
  for (const [, data] of qc.getQueriesData<SessionsCache>({ queryKey: agentKeys.sessionsRoot(uid) })) {
    const list = !data ? [] : Array.isArray(data) ? data : data.pages.flatMap((p) => p.items);
    const hit = list.find((s) => s.id === id);
    if (hit) return hit;
  }
  return null;
}

export function removeSession(qc: QueryClient, uid: string, id: string) {
  qc.setQueriesData<SessionsCache>({ queryKey: agentKeys.sessionsRoot(uid) }, (d) => mapSessionsCache(d, (l) => l.filter((x) => x.id !== id)));
}

/** Snapshot every agent sessions cache; the returned function restores them. */
export function snapshotSessions(qc: QueryClient, uid: string): () => void {
  const snap = qc.getQueriesData<SessionsCache>({ queryKey: agentKeys.sessionsRoot(uid) });
  return () => { for (const [key, data] of snap) qc.setQueryData(key, data); };
}

// ---- mutations (plain async functions so they're testable without React) -----------------------------
export class AgentMutationError extends Error {
  constructor(message: string, public cause?: unknown) { super(message); }
}

/** Optimistic rename / pin: cache first, PATCH, rollback on error (throws AgentMutationError). */
export async function patchSessionOptimistic(qc: QueryClient, uid: string, api: AgentApi, id: string, patch: SessionPatch): Promise<SessionItem> {
  const before = findSession(qc, uid, id);
  if (!before) throw new AgentMutationError("Chat nahi mili.");
  const rollback = snapshotSessions(qc, uid);
  const title = typeof patch.title === "string" ? patch.title.trim().slice(0, 80) : undefined;
  if (title !== undefined && !title) throw new AgentMutationError("Naam khaali nahi ho sakta.");
  const optimistic: SessionItem = { ...before, ...(title !== undefined ? { title } : {}), ...(typeof patch.pinned === "boolean" ? { pinned: patch.pinned } : {}) };
  placeSession(qc, uid, optimistic);
  try {
    const saved = await api.patchSession(id, { ...patch, ...(title !== undefined ? { title } : {}) });
    const final = saved ? { ...optimistic, ...saved } : optimistic;
    placeSession(qc, uid, final);
    return final;
  } catch (err) {
    rollback();
    throw new AgentMutationError(isMissingEndpoint(err) ? "Server abhi ye support nahi karta." : "Save nahi ho paya. Dobara try karein.", err);
  }
}

interface PendingDelete { id: string; timer: ReturnType<typeof setTimeout>; rollback: () => void; api: AgentApi; onError: (msg: string) => void }
const pendingDeletes = new Map<string, PendingDelete>();
let pagehideHooked = false;

function hookPagehide() {
  if (pagehideHooked || typeof window === "undefined") return;
  pagehideHooked = true;
  window.addEventListener("pagehide", () => {
    for (const p of pendingDeletes.values()) { clearTimeout(p.timer); void p.api.deleteSession(p.id, { keepalive: true }).catch(() => {}); }
    pendingDeletes.clear();
  });
}

/**
 * Optimistic delete with Undo: removed from the cache now, DELETE sent after `delayMs`. `undo()` restores the
 * cache and nothing is sent. A failed DELETE restores the cache and calls onError.
 */
export function deleteSessionWithUndo(qc: QueryClient, uid: string, api: AgentApi, id: string, opts: { delayMs?: number; onError: (msg: string) => void; onCommitted?: () => void }) {
  const rollback = snapshotSessions(qc, uid);
  removeSession(qc, uid, id);
  hookPagehide();
  const commit = async () => {
    pendingDeletes.delete(id);
    try {
      await api.deleteSession(id);
      opts.onCommitted?.();
    } catch (err) {
      rollback();
      opts.onError(isMissingEndpoint(err) ? "Server abhi delete support nahi karta." : "Delete nahi ho paya. Chat wapas list me hai.");
    }
  };
  const timer = setTimeout(() => { void commit(); }, opts.delayMs ?? UNDO_MS);
  pendingDeletes.set(id, { id, timer, rollback, api, onError: opts.onError });
  return {
    undo() {
      const p = pendingDeletes.get(id);
      if (!p) return false;
      clearTimeout(p.timer);
      pendingDeletes.delete(id);
      rollback();
      return true;
    },
    /** send now (tests) */ flush: () => { const p = pendingDeletes.get(id); if (!p) return Promise.resolve(); clearTimeout(p.timer); return commit(); },
  };
}
export const isDeletePending = (id: string) => pendingDeletes.has(id);

// ---- recent queries ------------------------------------------------------------------------------------
export function addRecentQuery(qc: QueryClient, uid: string, text: string) {
  const clean = text.trim();
  if (!clean) return;
  qc.setQueryData<QueryItem[]>(agentKeys.queries(uid), (list) => {
    if (!list) return list;
    const rest = list.filter((x) => x.text.toLowerCase() !== clean.toLowerCase());
    const prev = list.find((x) => x.text.toLowerCase() === clean.toLowerCase());
    return [{ id: prev?.id ?? `local-${Date.now().toString(36)}`, text: clean, last_used_at: new Date().toISOString(), use_count: (prev?.use_count ?? 0) + 1 }, ...rest].slice(0, 50);
  });
}

export async function removeRecentQuery(qc: QueryClient, uid: string, api: AgentApi, id: string) {
  const key = agentKeys.queries(uid);
  const before = qc.getQueryData<QueryItem[]>(key);
  qc.setQueryData<QueryItem[]>(key, (l) => l?.filter((x) => x.id !== id));
  qc.removeQueries({ queryKey: ["agent", uid, "suggest"] });
  if (id.startsWith("local-")) { void qc.invalidateQueries({ queryKey: key }); return; } // server id not known yet
  try { await api.deleteQuery(id); } catch (err) {
    qc.setQueryData(key, before);
    throw new AgentMutationError(isMissingEndpoint(err) ? "Server abhi ye support nahi karta." : "Hata nahi paye. Dobara try karein.", err);
  }
}

export async function clearRecentQueries(qc: QueryClient, uid: string, api: AgentApi) {
  const key = agentKeys.queries(uid);
  const before = qc.getQueryData<QueryItem[]>(key);
  qc.setQueryData<QueryItem[]>(key, []);
  qc.removeQueries({ queryKey: ["agent", uid, "suggest"] });
  try { await api.clearQueries(); } catch (err) {
    qc.setQueryData(key, before);
    throw new AgentMutationError(isMissingEndpoint(err) ? "Server abhi ye support nahi karta." : "History clear nahi hui. Dobara try karein.", err);
  }
}

// ---- hooks ----------------------------------------------------------------------------------------------
/** Pinned chats (one request, ≤ 50) + the rest, paged with infinite scroll. Server-side title search via `q`. */
export function useSessionLists(uid: string | null, q: string) {
  const enabled = !!uid;
  const pinned = useQuery({
    queryKey: agentKeys.sessions(uid ?? "-", q, true),
    enabled,
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const api = await getAgentApi();
      const page = await api.listSessions({ pinned: true, q, limit: 50 }, signal);
      return page.items.map((s) => ({ ...s, pinned: true }));
    },
  });
  const rest = useInfiniteQuery({
    queryKey: agentKeys.sessions(uid ?? "-", q, false),
    enabled,
    staleTime: 30_000,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const api = await getAgentApi();
      return api.listSessions({ pinned: false, q, cursor: pageParam, limit: SESSIONS_PAGE }, signal);
    },
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const restList = useMemo(() => rest.data?.pages.flatMap((p) => p.items) ?? [], [rest.data]);
  return { pinned, rest, pinnedList: pinned.data ?? [], restList };
}

/** Recent questions (GET /agent/history/queries). A backend without the endpoint → empty list, no error. */
export function useRecentQueries(uid: string | null, enabled = true) {
  return useQuery({
    queryKey: agentKeys.queries(uid ?? "-"),
    enabled: !!uid && enabled,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const api = await getAgentApi();
      try { return await api.listQueries({ limit: 20 }, signal); } catch (err) {
        if (isMissingEndpoint(err)) return [] as QueryItem[];
        throw err;
      }
    },
  });
}

export function useDebounced<T>(value: T, ms = SUGGEST_DEBOUNCE_MS): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/**
 * Suggestions for the typed text: debounced 120 ms, the previous request is aborted when the text changes
 * (TanStack passes the AbortSignal), results cached 60 s per query. Missing endpoint → [] (local ranking only).
 */
export function useSuggestions(uid: string | null, text: string, enabled: boolean) {
  const q = useDebounced(text.trim());
  const query = useQuery<Suggestion[], Error, Suggestion[], ReturnType<typeof agentKeys.suggest>>({
    queryKey: agentKeys.suggest(uid ?? "-", q),
    enabled: !!uid && enabled && q.length > 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: false,
    placeholderData: (prev: Suggestion[] | undefined) => prev,
    queryFn: async ({ signal }) => {
      const api = await getAgentApi();
      try { return await api.suggestions({ q, limit: 8 }, signal); } catch (err) {
        if (isMissingEndpoint(err)) return [] as Suggestion[];
        throw err;
      }
    },
  });
  return { ...query, debouncedQ: q };
}

/** The app QueryClient (for the store and the plain mutation functions). */
export function useAgentQueryClient(): QueryClient {
  return useQueryClient();
}

/** Warm the queries + suggestions cache on focus (≤ 1 per 30 s per user). */
let lastPrefetch = 0;
export function prefetchAgentCaches(qc: QueryClient, uid: string) {
  const now = Date.now();
  if (now - lastPrefetch < 30_000) return;
  lastPrefetch = now;
  const stale = 60_000;
  void qc.prefetchQuery({ queryKey: agentKeys.queries(uid), staleTime: stale, queryFn: async ({ signal }) => {
    const api = await getAgentApi(); try { return await api.listQueries({ limit: 20 }, signal); } catch { return []; }
  }});
  void qc.prefetchQuery({ queryKey: agentKeys.suggest(uid, ""), staleTime: stale, queryFn: async ({ signal }) => {
    const api = await getAgentApi(); try { return await api.suggestions("", signal); } catch { return []; }
  }});
}

/** A ref that always holds the latest value (callbacks inside timers / realtime). */
export function useLatest<T>(v: T) {
  const r = useRef(v);
  r.current = v;
  return r;
}
