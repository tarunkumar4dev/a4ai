// Data for /contests: get_my_contests (one call per page of the list), get_contest_card, register_for_contest
// (29_contest_feed.sql). TanStack Query keys start with ["contests", userId] so one invalidate refreshes all.
//   - search / subject / tab are part of the key → an older response can never overwrite a newer one, and the
//     superseded request is aborted (TanStack's signal → .abortSignal())
//   - every request has a 12 s timeout; errors are sorted into kinds the page can explain
//   - refetch on tab focus / reconnect when older than 30 s; other tabs hear about a registration (BroadcastChannel)
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { syncServerClock } from "@/lib/serverClock";
import { normalizeContest, type FeedContest } from "@/lib/contestLifecycle";
import { contestApi } from "@/lib/contestApi";

export type FeedView = "upcoming" | "past";
export interface FeedCursor { at: string; id: string }
export interface FeedPage {
  serverNow: string | null;
  items: FeedContest[];
  nextCursor: FeedCursor | null;
  counts: { upcoming: number; past: number; live: number };
  subjects: { name: string; count: number }[];
  next: FeedContest | null;
  scheduled: string[];
}

export const PAGE_SIZE = 20;
export const REQUEST_TIMEOUT_MS = 12_000;

export const contestKeys = {
  all: (uid: string) => ["contests", uid] as const,
  feed: (uid: string, view: FeedView, search: string, subject: string) =>
    ["contests", uid, "feed", view, search, subject] as const,
};

export type FeedErrorKind = "missing" | "auth" | "timeout" | "offline" | "server";
export class FeedError extends Error {
  kind: FeedErrorKind;
  constructor(kind: FeedErrorKind, message: string) {
    super(message);
    this.name = "FeedError";
    this.kind = kind;
  }
}

export const FEED_ERROR_TEXT: Record<FeedErrorKind, string> = {
  missing: "Contest list isn't switched on yet.",
  auth: "Your session has expired. Please sign in again.",
  timeout: "This is taking too long. Check your internet and try again.",
  offline: "You seem to be offline. Check your internet and try again.",
  server: "Something went wrong while loading contests. Please try again.",
};

type PgError = { message?: string; code?: string; details?: string | null } | null;

/** PostgREST / fetch failure → FeedError. Aborted (not timed out) requests keep their AbortError. */
export function classifyError(error: PgError | Error | unknown, status: number | null, timedOut: boolean): Error {
  const e = (error ?? {}) as { message?: string; code?: string; name?: string };
  const msg = String(e.message ?? "");
  if (timedOut) return new FeedError("timeout", FEED_ERROR_TEXT.timeout);
  if (e.name === "AbortError" || /^AbortError/.test(msg)) {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    return abort;
  }
  if (e.code === "PGRST202" || (status === 404 && /function|schema cache/i.test(msg))) {
    return new FeedError("missing", FEED_ERROR_TEXT.missing);
  }
  if (status === 401 || e.code === "PGRST301" || e.code === "PGRST303" || /jwt|sign in required/i.test(msg)) {
    return new FeedError("auth", FEED_ERROR_TEXT.auth);
  }
  if (/^(FetchError|TypeError)|failed to fetch|network/i.test(msg) || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return new FeedError("offline", FEED_ERROR_TEXT.offline);
  }
  return new FeedError("server", FEED_ERROR_TEXT.server);
}

/** Abort on the caller's signal (superseded query) or after ms. */
function withTimeout(parent: AbortSignal | undefined, ms = REQUEST_TIMEOUT_MS) {
  const ctl = new AbortController();
  let timedOut = false;
  const t = setTimeout(() => { timedOut = true; ctl.abort(); }, ms);
  const onAbort = () => ctl.abort();
  if (parent?.aborted) ctl.abort();
  else parent?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: ctl.signal,
    timedOut: () => timedOut,
    done: () => { clearTimeout(t); parent?.removeEventListener("abort", onAbort); },
  };
}

/** No exceptions for a partial body: missing pieces become empty, bad rows are skipped. */
export function parseFeedPage(data: unknown): FeedPage {
  const o = (data && typeof data === "object" ? data : {}) as Record<string, any>;
  const items = Array.isArray(o.items) ? o.items.map(normalizeContest).filter((c): c is FeedContest => !!c) : [];
  const cur = o.next_cursor && typeof o.next_cursor === "object" ? o.next_cursor : null;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    serverNow: typeof o.server_now === "string" ? o.server_now : null,
    items,
    nextCursor: cur && typeof cur.at === "string" && typeof cur.id === "string" ? { at: cur.at, id: cur.id } : null,
    counts: { upcoming: n(o.counts?.upcoming), past: n(o.counts?.past), live: n(o.counts?.live) },
    subjects: Array.isArray(o.subjects)
      ? o.subjects.filter((s: any) => s && typeof s.name === "string").map((s: any) => ({ name: s.name, count: n(s.count) }))
      : [],
    next: normalizeContest(o.next),
    scheduled: Array.isArray(o.scheduled) ? o.scheduled.filter((d: unknown): d is string => typeof d === "string") : [],
  };
}

/** Errors go to the console with a stable tag + to analytics as a code only (no names, codes or ids). */
export function reportContestError(where: string, err: unknown) {
  const kind = err instanceof FeedError ? err.kind : (err as Error)?.name === "AbortError" ? "abort" : "unknown";
  if (kind === "abort") return;
  console.warn(`[contests] ${where} failed (${kind})`, err);
  try {
    (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.("event", "contests_error", { where, kind });
  } catch { /* analytics must never break the page */ }
}

async function callRpc<T>(fn: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const t = withTimeout(signal);
  const sentAt = Date.now();
  try {
    const { data, error, status } = await supabase.rpc(fn, args).abortSignal(t.signal);
    if (error) throw classifyError(error, status ?? null, t.timedOut());
    const serverNow = (data as { server_now?: string } | null)?.server_now;
    syncServerClock(serverNow, sentAt);
    return data as T;
  } catch (e) {
    if (e instanceof FeedError || (e as Error)?.name === "AbortError") throw e;
    throw classifyError(e, null, t.timedOut());
  } finally {
    t.done();
  }
}

export async function fetchFeedPage(
  p: { view: FeedView; search: string; subject: string; cursor: FeedCursor | null; limit?: number },
  signal?: AbortSignal,
): Promise<FeedPage> {
  const data = await callRpc<unknown>("get_my_contests", {
    p_view: p.view,
    p_search: p.search || null,
    p_subject: p.subject || null,
    p_limit: p.limit ?? PAGE_SIZE,
    p_cursor_at: p.cursor?.at ?? null,
    p_cursor_id: p.cursor?.id ?? null,
  }, signal);
  return parseFeedPage(data);
}

export type CardState = "ok" | "not_found" | "invalid_code";
export type RegisterState = "registered" | "already_registered" | "owner" | "ended" | "not_found" | "invalid_code";

export async function getContestCard(code: string, signal?: AbortSignal): Promise<{ state: CardState; contest: FeedContest | null }> {
  const d = await callRpc<{ state?: string; contest?: unknown }>("get_contest_card", { p_code: code }, signal);
  const state = (["ok", "not_found", "invalid_code"].includes(String(d?.state)) ? d!.state : "not_found") as CardState;
  return { state, contest: normalizeContest(d?.contest) };
}

const REGISTER_STATES: RegisterState[] = ["registered", "already_registered", "owner", "ended", "not_found", "invalid_code"];

/** Safe to retry: the server keeps one row per (contest, student) and answers a repeat with already_registered. */
export async function registerForContest(code: string): Promise<{ state: RegisterState; contest: FeedContest | null }> {
  const d = await callRpc<{ state?: string; contest?: unknown }>("register_for_contest", { p_code: code });
  const state = (REGISTER_STATES.includes(d?.state as RegisterState) ? d!.state : "not_found") as RegisterState;
  return { state, contest: normalizeContest(d?.contest) };
}

const retryable = (count: number, err: unknown) =>
  count < 2 && err instanceof FeedError && (err.kind === "offline" || err.kind === "timeout" || err.kind === "server");

/** enabled=false: wait (e.g. the sidebar asks only once it is on screen); same key → same cache as the list. */
export function useContestFeed(uid: string | null, view: FeedView, search: string, subject: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: contestKeys.feed(uid ?? "-", view, search, subject),
    enabled: !!uid && enabled,
    initialPageParam: null as FeedCursor | null,
    queryFn: ({ pageParam, signal }) => fetchFeedPage({ view, search, subject, cursor: pageParam }, signal),
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 30_000,
    refetchOnWindowFocus: true, // TanStack's focus manager listens to visibilitychange
    refetchOnReconnect: true,
    placeholderData: keepPreviousData, // a new search keeps the old rows (dimmed) instead of a blank list
    retry: retryable,
    retryDelay: (n) => 1000 * 2 ** n,
  });
}

/** Top of a contest's leaderboard (FastAPI, which decides visibility). Only for contests whose results the viewer may see. */
export function useContestBoard(uid: string | null, contestId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["contests", uid ?? "-", "board", contestId] as const,
    enabled: !!uid && !!contestId && enabled,
    queryFn: () => contestApi.getLeaderboard(contestId!),
    staleTime: 60_000,
    retry: 1,
  });
}

const CHANNEL = "a4ai-contests";

/** Tell this tab's queries and every other open tab that the user's contests changed. */
export function contestsChanged(qc: QueryClient, uid: string) {
  qc.invalidateQueries({ queryKey: contestKeys.all(uid) });
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage({ uid });
    ch.close();
  } catch { /* old browser: other tabs refresh on focus */ }
}

export function useContestsChangedListener(uid: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!uid || typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = (e) => {
      if (e.data?.uid === uid) qc.invalidateQueries({ queryKey: contestKeys.all(uid) });
    };
    return () => ch.close();
  }, [qc, uid]);
}

export function useRegisterContest(uid: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => registerForContest(code),
    retry: retryable,
    onSuccess: (res) => {
      if (uid && (res.state === "registered" || res.state === "already_registered")) contestsChanged(qc, uid);
    },
    onError: (err) => reportContestError("register", err),
  });
}
