// src/lib/uploadLink/compressWorker.ts — compress a photo in a Web Worker when the browser can (Worker +
// OffscreenCanvas + convertToBlob); otherwise on the main thread (src/lib/imageCompress.ts). One shared worker,
// created on first use; if it ever fails, everything after falls back to the main thread.

import { compressImage } from "@/lib/imageCompress";
import type { CompressRequest, CompressResponse } from "./compress.worker";

export interface Compressed { blob: Blob; type: string; tooSmall: boolean | null; tooDark: boolean | null }

let worker: Worker | null = null;
let broken = false;
let seq = 0;
const pending = new Map<number, (r: CompressResponse) => void>();

export const workerSupported = () =>
  typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined"
  && typeof (OffscreenCanvas.prototype as { convertToBlob?: unknown }).convertToBlob === "function";

function getWorker(): Worker | null {
  if (broken || !workerSupported()) return null;
  if (!worker) {
    try {
      worker = new Worker(new URL("./compress.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (e: MessageEvent<CompressResponse>) => { pending.get(e.data.id)?.(e.data); pending.delete(e.data.id); };
      worker.onerror = () => { broken = true; pending.forEach(r => r({ id: -1, ok: false, error: "worker error" })); pending.clear(); };
    } catch {
      broken = true;
      return null;
    }
  }
  return worker;
}

/** Main-thread path (tests, old browsers, or a failed worker). Quality is checked later by the caller. */
async function onMainThread(file: File, maxSide: number, quality: number): Promise<Compressed> {
  const { blob, type } = await compressImage(file, maxSide, quality);
  return { blob, type, tooSmall: null, tooDark: null };
}

export async function compressPhoto(file: File, maxSide: number, quality: number): Promise<Compressed> {
  const w = getWorker();
  if (!w) return onMainThread(file, maxSide, quality);
  const id = ++seq;
  const res = await new Promise<CompressResponse>(resolve => {
    pending.set(id, resolve);
    w.postMessage({ id, blob: file, maxSide, quality } satisfies CompressRequest);
  });
  if (res.ok) return { blob: res.blob, type: res.type, tooSmall: res.tooSmall, tooDark: res.tooDark };
  return onMainThread(file, maxSide, quality);          // e.g. a format the worker's decoder can't read
}
