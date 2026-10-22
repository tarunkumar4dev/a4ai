// src/lib/uploadLink/blobStore.ts — prepared page blobs in IndexedDB, so a refresh mid-upload can resume
// without the student picking the photos again. Every call fails soft (private mode / no IndexedDB → no resume).

const DB = "a4ai-upload-link";
const STORE = "pages";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).finally(() => db.close());
  } catch {
    return undefined;
  }
}

export const putBlob = (id: string, blob: Blob) => run("readwrite", s => s.put(blob, id));
export const getBlob = (id: string) => run<Blob>("readonly", s => s.get(id) as IDBRequest<Blob>);
export const deleteBlob = (id: string) => run("readwrite", s => s.delete(id));
export async function deleteBlobs(ids: string[]) { for (const id of ids) await deleteBlob(id); }
