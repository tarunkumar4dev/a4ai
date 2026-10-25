// src/lib/contestProgress.ts — keeps a student's contest attempt alive through refreshes, sleep, bad networks.
//   • local copy:  localStorage a4_contest_{attemptId} on every change, merged with the server's progress on load
//   • server copy: PUT …/attempts/{id}/progress (2 s after a change, every 15 s, keepalive when the page hides)
//   • timer:       deadline from the server (deadline_at − server_now, so a wrong phone clock doesn't matter)
//   • tab switches: one warning per "away episode" (hidden / blur … visible / focus)
//   • submit:      retried with backoff; never reported as done unless the server said so
// Pure parts are unit-tested in contestProgress.test.ts.

export type WarningType = "tab_hidden" | "window_blur" | "camera_lost" | "fullscreen_exit";
export interface WarningEntry { type: WarningType; at: string; detail?: string }

export interface ProgressAnswer {
  questionId: string;
  selected: string | null;
  textAnswer?: string;
  timeSpent: number;
  flagged: boolean;
}

export interface AttemptProgress {
  answers: ProgressAnswer[];
  current_index: number;
  warning_count: number;
  warning_log: WarningEntry[];
  /** ms epoch of the last change (local copies only) */
  updated_at?: number;
}

export interface LocalAttempt extends AttemptProgress {
  /** client-clock deadline when the backend sent none (old backend): set once at the first start */
  local_deadline?: number;
  local_started?: number;
}

const key = (attemptId: string) => `a4_contest_${attemptId}`;

export function loadLocal(attemptId: string): LocalAttempt | null {
  try {
    const raw = localStorage.getItem(key(attemptId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveLocal(attemptId: string, v: LocalAttempt): void {
  try { localStorage.setItem(key(attemptId), JSON.stringify(v)); } catch { /* full / private mode */ }
}

export function clearLocal(attemptId: string): void {
  try { localStorage.removeItem(key(attemptId)); } catch { /* ignore */ }
}

const answeredCount = (p?: Pick<AttemptProgress, "answers"> | null) =>
  (p?.answers || []).filter((a) => !!a.selected || !!a.textAnswer?.trim()).length;

/**
 * Local vs server progress after a refresh: the copy with more answered questions wins (ties → the newer local
 * copy, since the server only lags behind it); warnings never go down (max of both, longest log).
 */
export function mergeProgress(local: AttemptProgress | null, server: Partial<AttemptProgress> | null | undefined): AttemptProgress | null {
  const srv = server && Array.isArray(server.answers) ? (server as AttemptProgress) : null;
  if (!local && !srv) return null;
  if (!local) return { answers: srv!.answers, current_index: srv!.current_index || 0, warning_count: srv!.warning_count || 0, warning_log: srv!.warning_log || [] };
  if (!srv) return local;
  const base = answeredCount(srv) > answeredCount(local) ? srv : local;
  const logs = [local.warning_log || [], srv.warning_log || []].sort((a, b) => b.length - a.length);
  return {
    answers: base.answers,
    current_index: base.current_index || 0,
    warning_count: Math.max(local.warning_count || 0, srv.warning_count || 0),
    warning_log: logs[0],
    updated_at: local.updated_at,
  };
}

/** Fill an answer list for these questions from saved answers (unknown ids are dropped, missing ones blank). */
export function answersFor(questionIds: string[], saved: ProgressAnswer[] | undefined): ProgressAnswer[] {
  const byId = new Map((saved || []).map((a) => [a.questionId, a]));
  return questionIds.map((id) => {
    const a = byId.get(id);
    return {
      questionId: id,
      selected: a?.selected ?? null,
      textAnswer: a?.textAnswer || "",
      timeSpent: Number(a?.timeSpent) || 0,
      flagged: !!a?.flagged,
    };
  });
}

/**
 * Deadline on THIS device's clock: receivedAt + (deadline_at − server_now). A phone whose clock is 7 minutes off
 * still gets the right remaining time. null when the backend sent no deadline.
 */
export function clientDeadline(deadlineAt: string | null | undefined, serverNow: string | null | undefined, receivedAt: number): number | null {
  if (!deadlineAt) return null;
  const end = Date.parse(deadlineAt);
  if (isNaN(end)) return null;
  const now = serverNow ? Date.parse(serverNow) : NaN;
  return isNaN(now) ? end : receivedAt + (end - now);
}

export const secondsLeft = (deadline: number, now = Date.now()) => Math.max(0, Math.ceil((deadline - now) / 1000));

// ─────────────────────────── tab switching ───────────────────────────

/**
 * Turns hidden / blur / focus / visible events into "away episodes": the first hidden-or-blur starts one (counted
 * once), focus or visible ends it. suppress(ms) ignores blurs right after our own permission prompt / fullscreen
 * change.
 */
export function createAwayTracker(onEpisode: (type: WarningType) => void, now: () => number = Date.now) {
  let away = false;
  let suppressUntil = 0;
  return {
    suppress(ms = 1500) { suppressUntil = now() + ms; },
    hidden() {
      if (away) return;
      away = true;
      onEpisode("tab_hidden");
    },
    blur() {
      if (away || now() < suppressUntil) return;
      away = true;
      onEpisode("window_blur");
    },
    back() { away = false; },
    get away() { return away; },
  };
}

// ─────────────────────────── server sync ───────────────────────────

export type SyncState = "saved" | "saving" | "offline";

/**
 * Sends the latest progress: 2 s after a change, every 15 s, and flush(keepalive) when the page hides.
 * Failures are retried silently (next tick / back online); only the newest snapshot is ever sent.
 */
export function createProgressSync(opts: {
  send: (p: AttemptProgress, keepalive: boolean) => Promise<unknown>;
  snapshot: () => AttemptProgress;
  onState: (s: SyncState) => void;
  onResult?: (res: unknown) => void;
  debounceMs?: number;
  intervalMs?: number;
}) {
  const debounceMs = opts.debounceMs ?? 2000;
  const intervalMs = opts.intervalMs ?? 15000;
  let dirty = false;
  let inFlight = false;
  let stopped = false;
  let debounce: ReturnType<typeof setTimeout> | undefined;

  const run = async (keepalive = false) => {
    if (stopped || !dirty || (inFlight && !keepalive)) return;
    dirty = false;
    inFlight = true;
    opts.onState("saving");
    try {
      const res = await opts.send(opts.snapshot(), keepalive);
      opts.onResult?.(res);
      if (!dirty) opts.onState("saved");
    } catch {
      dirty = true;   // retried on the next tick / when back online
      opts.onState("offline");
    } finally {
      inFlight = false;
      // a change that came in while this request was in flight goes out 2 s later, not at the next 15 s tick
      if (dirty && !stopped && navigator.onLine !== false) {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => { run(); }, debounceMs);
      }
    }
  };

  const interval = setInterval(() => { run(); }, intervalMs);
  const online = () => { run(); };
  window.addEventListener("online", online);

  return {
    changed() {
      dirty = true;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => { run(); }, debounceMs);
    },
    /** page hiding / closing: send now with fetch keepalive */
    flush() { if (debounce) clearTimeout(debounce); run(true); },
    stop() {
      stopped = true;
      clearInterval(interval);
      if (debounce) clearTimeout(debounce);
      window.removeEventListener("online", online);
    },
  };
}

// ─────────────────────────── submit ───────────────────────────

export const SUBMIT_DELAYS_MS = [1000, 2000, 4000, 8000, 8000, 8000, 8000, 8000, 8000];   // ≈ 61 s in total

/**
 * Calls submit until it succeeds or the delays run out (then throws the last error). isFinal(err) stops early for
 * errors a retry can't fix (e.g. 403). The caller keeps the attempt open on failure — never "submitted".
 */
export async function submitWithRetry<T>(
  submit: () => Promise<T>,
  opts: { delays?: number[]; isFinal?: (err: unknown) => boolean; onRetry?: (attempt: number, err: unknown) => void; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const delays = opts.delays ?? SUBMIT_DELAYS_MS;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let lastErr: unknown;
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await submit();
    } catch (err) {
      lastErr = err;
      if (opts.isFinal?.(err) || i === delays.length) break;
      opts.onRetry?.(i + 1, err);
      await sleep(delays[i]);
    }
  }
  throw lastErr;
}
