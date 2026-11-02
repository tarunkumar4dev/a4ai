// One clock for every countdown on a page: a single timer (not one setInterval per card), corrected to the
// SERVER's time (the phone's clock may be minutes off), paused while the tab is hidden.
//   syncServerClock(server_now, sentAt)  after any response that carries the server time
//   useServerNow(select)                 re-renders only when select(now) changes (a phase flip, a new second)
import { useCallback, useSyncExternalStore } from "react";

let offsetMs = 0; // server − device
let now = Date.now();
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

export const serverNow = () => Date.now() + offsetMs;

/** The server read its clock somewhere between send and receive → assume the middle of the round trip. */
export function syncServerClock(serverIso: string | null | undefined, sentAt: number, receivedAt = Date.now()): void {
  const server = Date.parse(serverIso ?? "");
  if (!Number.isFinite(server) || receivedAt < sentAt) return;
  offsetMs = server - (sentAt + receivedAt) / 2;
  emit();
}

function emit() {
  now = serverNow();
  listeners.forEach((l) => l());
}

function schedule() {
  if (timer || !listeners.size || document.visibilityState === "hidden") return;
  // fire just after each full (server) second, so every countdown on the page changes at the same moment
  timer = setTimeout(() => {
    timer = null;
    emit();
    schedule();
  }, 1000 - (serverNow() % 1000) + 5);
}

function stop() {
  if (timer) clearTimeout(timer);
  timer = null;
}

// Back from the background / the network: jump to the right time at once (setTimeout is throttled while hidden).
function onVisibility() {
  if (document.visibilityState === "hidden") return stop();
  emit();
  schedule();
}
function onOnline() {
  emit();
}

function subscribe(listener: () => void) {
  if (!listeners.size) {
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    now = serverNow();
  }
  listeners.add(listener);
  schedule();
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    stop();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("online", onOnline);
  };
}

/** select must return a primitive (or the same object for the same input) — React compares with Object.is. */
export function useServerNow<T = number>(select?: (nowMs: number) => T): T {
  const pick = useCallback(() => (select ? select(now) : (now as unknown as T)), [select]);
  return useSyncExternalStore(subscribe, pick, pick);
}

/** test helper */
export function _resetServerClock() {
  stop();
  offsetMs = 0;
  now = Date.now();
}
export const _listenerCount = () => listeners.size;
export const _timerRunning = () => timer !== null;
