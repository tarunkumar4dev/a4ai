// src/lib/uploadLink/files.ts
// Page helpers for the upload flow (src/lib/uploadFlow.ts preparePage uses them): HEIC/HEIF → JPEG with a
// native-decoder fallback, PDF page count (pdf.js), a "photo saaf nahi" hint, rotate 90°, Hinglish file errors.

import { compressImage } from "@/lib/imageCompress";

export const LONG_EDGE = 1600;
export const JPEG_QUALITY = 0.8;
export const HARD_MAX_MB = 10;                         // bucket file_size_limit (api doc: storage rules)
export const ACCEPT_ATTR = "image/*,.heic,.heif,application/pdf";

export type FileKind = "image" | "heic" | "pdf" | "bad";

const ext = (name: string) => (name.split(".").pop() || "").toLowerCase();

export function classify(file: { name: string; type: string }): FileKind {
  const t = (file.type || "").toLowerCase();
  const e = ext(file.name);
  if (t === "image/heic" || t === "image/heif" || e === "heic" || e === "heif") return "heic";
  if (t === "application/pdf" || e === "pdf") return "pdf";
  if (t.startsWith("image/") || ["jpg", "jpeg", "png", "webp"].includes(e)) return "image";
  return "bad";
}

export const mb = (bytes: number) => Math.round((bytes / 1048576) * 10) / 10;
export const formatError = (name: string) => `${name}: sirf photo ya PDF chalega`;
export const sizeError = (name: string, bytes: number, maxMb: number) => `${name} ${mb(bytes)} MB hai, max ${maxMb} MB`;

/** Long edge scaled down to `maxSide` (never up). */
export function scaledSize(w: number, h: number, maxSide = LONG_EDGE): { w: number; h: number } {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

export interface HeicDeps {
  heic2any: (opts: { blob: Blob; toType: string; quality: number }) => Promise<Blob | Blob[]>;
  /** Browsers that decode HEIC natively (Safari / iOS) → JPEG through the canvas. */
  nativeToJpeg: (file: File) => Promise<Blob>;
}

const defaultHeicDeps: HeicDeps = {
  heic2any: async opts => (await import("heic2any")).default(opts),
  nativeToJpeg: async file => {
    const out = await compressImage(file, LONG_EDGE, JPEG_QUALITY);
    if (out.type !== "image/jpeg") throw new Error("no native HEIC decoder");
    return out.blob;
  },
};

export const HEIC_ERROR = "HEIC photo convert nahi ho payi. Camera setting mein 'Most compatible' (JPEG) karke photo lo, ya screenshot bhejo.";

/** HEIC/HEIF → JPEG: heic2any first, then the browser's own decoder, else a clear error. */
export async function heicToJpeg(file: File, deps: HeicDeps = defaultHeicDeps): Promise<Blob> {
  try {
    const out = await deps.heic2any({ blob: file, toType: "image/jpeg", quality: JPEG_QUALITY });
    const blob = Array.isArray(out) ? out[0] : out;
    if (blob && blob.size > 0) return blob;
  } catch {
    // fall through to the native decoder
  }
  try {
    return await deps.nativeToJpeg(file);
  } catch {
    throw new Error(HEIC_ERROR);
  }
}


/** Blob.arrayBuffer() / .text() are missing on older Android WebViews — FileReader works everywhere. */
function readBlob(blob: Blob, as: "buffer"): Promise<ArrayBuffer>;
function readBlob(blob: Blob, as: "text"): Promise<string>;
function readBlob(blob: Blob, as: "buffer" | "text"): Promise<ArrayBuffer | string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer | string);
    r.onerror = () => reject(r.error);
    if (as === "buffer") r.readAsArrayBuffer(blob); else r.readAsText(blob);
  });
}
export const blobBytes = (blob: Blob) => readBlob(blob, "buffer");
export const blobText = (blob: Blob) => readBlob(blob, "text");

/** Rough count from the raw bytes — fallback when pdf.js can't load. */
export function pdfPagesFromBytes(text: string): number {
  const m = text.match(/\/Type\s*\/Page(?!s)\b/g);
  return Math.max(1, m ? m.length : 1);
}

export async function pdfPageCount(blob: Blob): Promise<number> {
  try {
    const pdfjs = await import("pdfjs-dist");
    const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await blobBytes(blob)) }).promise;
    const n = doc.numPages;
    await doc.destroy();
    return n;
  } catch (e) {
    if (e instanceof Error && /password/i.test(e.message)) throw new Error("PDF par password hai. Bina password wali PDF bhejo.");
    return pdfPagesFromBytes(await blobText(blob));
  }
}

export interface Quality { tooSmall: boolean; tooDark: boolean }

/** Warning only: long edge < 800 px, or mean brightness < 60/255. */
export async function analyzeQuality(blob: Blob): Promise<Quality> {
  try {
    const img = await createImageBitmap(blob);
    const tooSmall = Math.max(img.width, img.height) < 800;
    const c = document.createElement("canvas");
    c.width = 64; c.height = 64;
    const ctx = c.getContext("2d");
    if (!ctx) return { tooSmall, tooDark: false };
    ctx.drawImage(img, 0, 0, 64, 64);
    img.close();
    const px = ctx.getImageData(0, 0, 64, 64).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    return { tooSmall, tooDark: sum / (px.length / 4) < 60 };
  } catch {
    return { tooSmall: false, tooDark: false };
  }
}

/** Turn a JPEG 90° clockwise (re-encoded, so it needs a new sha256 + a new upload). */
export async function rotateJpeg90(blob: Blob): Promise<Blob> {
  const img = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = img.height; c.height = img.width;
  const ctx = c.getContext("2d")!;
  ctx.translate(c.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, 0, 0);
  img.close();
  const out: Blob | null = await new Promise(res => c.toBlob(res, "image/jpeg", JPEG_QUALITY));
  if (!out) throw new Error("Photo ghuma nahi paye.");
  return out;
}
