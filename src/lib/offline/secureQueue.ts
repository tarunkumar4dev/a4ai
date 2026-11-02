// src/lib/offline/secureQueue.ts — encrypted per-user store for work waiting for the internet.
//   • AES-GCM with a non-extractable key per user. The record's id + user id are authenticated too, so a record
//     edited on disk or copied to another user fails to decrypt and is dropped.
//   • Never falls back to plain text: no IndexedDB / WebCrypto → putItem throws and the caller says "not saved".
//   • Records expire after 7 days (the longest window a proctor can still save in); sign-out wipes everything.
// This protects storage at rest and shared devices. Code running on our own origin (XSS) can still use the key,
// and nothing here is authorisation: every replay goes through the normal RPC with the caller's own JWT.

const DB_NAME = "a4ai-offline";
const RECORDS = "records";
const KEYS = "keys";
const CHANNEL = "a4ai-offline-queue";

export const TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_ITEMS_PER_USER = 100;

type StoredRecord = { id: string; userId: string; rev: string; expiresAt: number; iv: Uint8Array; data: ArrayBuffer };
type Sealed<T> = { createdAt: number; body: T };

export type QueueItem<T> = { id: string; rev: string; createdAt: number; body: T };
export type QueueList<T> = { items: QueueItem<T>[]; expired: number; dropped: number };

export function isSupported(): boolean {
  return typeof indexedDB !== "undefined" && typeof crypto !== "undefined" && !!crypto.subtle;
}

/* ───── crypto ───── */
const enc = new TextEncoder();
const dec = new TextDecoder();

export const newKey = () => crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);

export async function seal(key: CryptoKey, aad: string, value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(aad) }, key, enc.encode(JSON.stringify(value)),
  );
  return { iv, data };
}

/** Throws when the key, the aad or the data don't match. */
export async function unseal<T>(key: CryptoKey, aad: string, iv: Uint8Array, data: ArrayBuffer): Promise<T> {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: enc.encode(aad) }, key, data);
  return JSON.parse(dec.decode(plain)) as T;
}

/** Hides which class a record belongs to, and makes the same class replace its own record. */
async function recordId(userId: string, naturalKey: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(`${userId}|${naturalKey}`));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
}

const aadFor = (id: string, userId: string) => `${id}|${userId}`;

/* ───── IndexedDB ───── */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(RECORDS, { keyPath: "id" });
      req.result.createObjectStore(KEYS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// One transaction; `fn` must only touch IndexedDB (awaiting anything else would close the transaction).
async function tx<T>(stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction, done: (v: T) => void) => void): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(stores, mode);
      let result: T;
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
      fn(t, v => { result = v; });
    });
  } finally {
    db.close();
  }
}

async function userKey(userId: string): Promise<CryptoKey> {
  const existing = await tx<CryptoKey | undefined>([KEYS], "readonly", (t, done) => {
    const r = t.objectStore(KEYS).get(userId);
    r.onsuccess = () => done(r.result);
  });
  if (existing) return existing;
  const fresh = await newKey();
  // another tab may have made one meanwhile: the first one stored wins
  return tx<CryptoKey>([KEYS], "readwrite", (t, done) => {
    const s = t.objectStore(KEYS);
    const r = s.get(userId);
    r.onsuccess = () => {
      if (r.result) { done(r.result); return; }
      s.put(fresh, userId);
      done(fresh);
    };
  });
}

const allRecords = () => tx<StoredRecord[]>([RECORDS], "readonly", (t, done) => {
  const r = t.objectStore(RECORDS).getAll();
  r.onsuccess = () => done(r.result as StoredRecord[]);
});

const deleteRecords = (ids: string[]) => tx<void>([RECORDS], "readwrite", (t, done) => {
  ids.forEach(id => t.objectStore(RECORDS).delete(id));
  done();
});

/* ───── change notifications (this tab + other tabs) ───── */
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (!channel && typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => listeners.forEach(fn => fn());
  }
  return channel;
}

function notify() {
  listeners.forEach(fn => fn());
  getChannel()?.postMessage("changed");
}

export function subscribe(fn: () => void): () => void {
  getChannel();
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/* ───── API ───── */
async function decrypt<T>(rec: StoredRecord): Promise<QueueItem<T>> {
  const key = await userKey(rec.userId);
  const open = await unseal<Sealed<T>>(key, aadFor(rec.id, rec.userId), rec.iv, rec.data);
  return { id: rec.id, rev: rec.rev, createdAt: open.createdAt, body: open.body };
}

/** Adds or replaces the record for this natural key. Throws when it can't be stored safely. */
export async function putItem<T>(userId: string, naturalKey: string, body: T): Promise<QueueItem<T>> {
  if (!isSupported()) throw new Error("Offline storage is not available in this browser");
  const id = await recordId(userId, naturalKey);
  const key = await userKey(userId);
  const createdAt = Date.now();
  const { iv, data } = await seal(key, aadFor(id, userId), { createdAt, body } satisfies Sealed<T>);
  const rec: StoredRecord = { id, userId, rev: crypto.randomUUID(), expiresAt: createdAt + TTL_MS, iv, data };
  await tx<void>([RECORDS], "readwrite", (t, done) => {
    const s = t.objectStore(RECORDS);
    const r = s.getAll();
    r.onsuccess = () => {
      const mine = (r.result as StoredRecord[]).filter(x => x.userId === userId && x.id !== id);
      if (mine.length >= MAX_ITEMS_PER_USER) { t.abort(); return; }
      s.put(rec);
      done();
    };
  });
  notify();
  return { id, rev: rec.rev, createdAt, body };
}

/** Rewrites an item only if it still exists, so a sign-out wipe during a sync can't bring it back. */
export async function updateItem<T>(userId: string, item: QueueItem<T>, body: T): Promise<void> {
  const key = await userKey(userId);
  const { iv, data } = await seal(key, aadFor(item.id, userId), { createdAt: item.createdAt, body } satisfies Sealed<T>);
  await tx<void>([RECORDS], "readwrite", (t, done) => {
    const s = t.objectStore(RECORDS);
    const r = s.get(item.id);
    r.onsuccess = () => {
      const cur = r.result as StoredRecord | undefined;
      if (cur && cur.userId === userId) s.put({ ...cur, rev: crypto.randomUUID(), iv, data });
      done();
    };
  });
  notify();
}

/** With `rev`: removes only if nobody replaced the record meanwhile. True when it was removed. */
export async function removeItem(id: string, rev?: string): Promise<boolean> {
  const removed = await tx<boolean>([RECORDS], "readwrite", (t, done) => {
    const s = t.objectStore(RECORDS);
    const r = s.get(id);
    r.onsuccess = () => {
      const cur = r.result as StoredRecord | undefined;
      if (!cur || (rev && cur.rev !== rev)) { done(false); return; }
      s.delete(id);
      done(true);
    };
  });
  if (removed) notify();
  return removed;
}

export async function getItem<T>(userId: string, naturalKey: string): Promise<QueueItem<T> | null> {
  if (!isSupported()) return null;
  try {
    const id = await recordId(userId, naturalKey);
    const rec = await tx<StoredRecord | undefined>([RECORDS], "readonly", (t, done) => {
      const r = t.objectStore(RECORDS).get(id);
      r.onsuccess = () => done(r.result);
    });
    if (!rec || rec.userId !== userId || rec.expiresAt < Date.now()) return null;
    return await decrypt<T>(rec);
  } catch {
    return null;
  }
}

/** This user's items, oldest first. Expired records (any user's) and records that fail to decrypt are deleted. */
export async function listItems<T>(userId: string): Promise<QueueList<T>> {
  const empty: QueueList<T> = { items: [], expired: 0, dropped: 0 };
  if (!isSupported()) return empty;
  try {
    const now = Date.now();
    const all = await allRecords();
    const stale = all.filter(r => r.expiresAt < now);
    const items: QueueItem<T>[] = [];
    const bad: string[] = [];
    for (const rec of all) {
      if (rec.userId !== userId || rec.expiresAt < now) continue;
      try {
        const item = await decrypt<T>(rec);
        // the sealed time decides: the plain expiresAt could have been edited on disk
        if (item.createdAt + TTL_MS < now) stale.push(rec);
        else items.push(item);
      } catch {
        bad.push(rec.id);
      }
    }
    if (stale.length || bad.length) await deleteRecords([...stale.map(r => r.id), ...bad]);
    return {
      items: items.sort((a, b) => a.createdAt - b.createdAt),
      expired: stale.filter(r => r.userId === userId).length,
      dropped: bad.length,
    };
  } catch {
    return empty;
  }
}

/** Sign-out: deletes every record and every key. Returns how many records were lost. */
export async function wipeAll(): Promise<number> {
  if (!isSupported()) return 0;
  try {
    const count = await tx<number>([RECORDS, KEYS], "readwrite", (t, done) => {
      const r = t.objectStore(RECORDS).count();
      r.onsuccess = () => {
        done(r.result);
        t.objectStore(RECORDS).clear();
        t.objectStore(KEYS).clear();
      };
    });
    if (count) notify();
    return count;
  } catch {
    return 0;
  }
}

export async function countItems(): Promise<number> {
  if (!isSupported()) return 0;
  try {
    return await tx<number>([RECORDS], "readonly", (t, done) => {
      const r = t.objectStore(RECORDS).count();
      r.onsuccess = () => done(r.result);
    });
  } catch {
    return 0;
  }
}
