// A small per-user JSON store in localStorage with a React hook: same data → same object (useSyncExternalStore),
// other tabs follow through the storage event, a corrupt or blocked storage never crashes the page.
import { useCallback, useSyncExternalStore } from "react";

export interface DeviceStore<T> {
  get(uid: string | null): T;
  set(uid: string | null, next: T): void;
  update(uid: string | null, fn: (cur: T) => T): void;
  use(uid: string | null): T;
}

export function createDeviceStore<T>(prefix: string, empty: T, parse: (raw: unknown) => T | null): DeviceStore<T> {
  const keyFor = (uid: string | null) => `${prefix}${uid || "guest"}`;
  const event = `a4ai-store:${prefix}`;
  const cache = new Map<string, { raw: string | null; value: T }>();

  const get = (uid: string | null): T => {
    const key = keyFor(uid);
    let raw: string | null = null;
    try { raw = localStorage.getItem(key); } catch { /* private mode / blocked */ }
    const hit = cache.get(key);
    if (hit && hit.raw === raw) return hit.value;
    let value = empty;
    try { value = (raw ? parse(JSON.parse(raw)) : null) ?? empty; } catch { /* corrupt → start fresh */ }
    cache.set(key, { raw, value });
    return value;
  };
  const set = (uid: string | null, next: T) => {
    try { localStorage.setItem(keyFor(uid), JSON.stringify(next)); } catch { /* full / blocked */ }
    cache.delete(keyFor(uid));
    window.dispatchEvent(new Event(event));
  };
  const subscribe = (cb: () => void) => {
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key.startsWith(prefix)) cb(); };
    window.addEventListener(event, cb);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(event, cb); window.removeEventListener("storage", onStorage); };
  };
  return {
    get,
    set,
    update: (uid, fn) => set(uid, fn(get(uid))),
    // eslint-disable-next-line react-hooks/rules-of-hooks
    use: (uid) => { const g = useCallback(() => get(uid), [uid]); return useSyncExternalStore(subscribe, g, g); },
  };
}

/** Local calendar day of a timestamp, "YYYY-MM-DD" (midnight / time-zone changes need no reset job). */
export const dayOf = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
