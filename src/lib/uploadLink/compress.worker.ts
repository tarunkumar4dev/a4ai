// src/lib/uploadLink/compress.worker.ts — photo → ~1600 px JPEG off the main thread (OffscreenCanvas), plus the
// "unclear photo" check (tiny / dark), so picking 20+ photos never freezes the page. Used by compressInWorker().

export interface CompressRequest { id: number; blob: Blob; maxSide: number; quality: number }
export type CompressResponse =
  | { id: number; ok: true; blob: Blob; type: string; tooSmall: boolean; tooDark: boolean }
  | { id: number; ok: false; error: string };

self.onmessage = async (e: MessageEvent<CompressRequest>) => {
  const { id, blob, maxSide, quality } = e.data;
  try {
    const img = await createImageBitmap(blob, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const tooSmall = Math.max(img.width, img.height) < 800;
    img.close();

    // mean brightness on a 64×64 sample
    const probe = new OffscreenCanvas(64, 64);
    const pctx = probe.getContext("2d")!;
    pctx.drawImage(canvas, 0, 0, 64, 64);
    const px = pctx.getImageData(0, 0, 64, 64).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const tooDark = sum / (px.length / 4) < 60;

    const out = await canvas.convertToBlob({ type: "image/jpeg", quality });
    // keep the original when the JPEG would be bigger (small screenshots)
    const keep = out.size >= blob.size && blob.type && blob.type !== "image/heic";
    const res: CompressResponse = keep
      ? { id, ok: true, blob, type: blob.type, tooSmall, tooDark }
      : { id, ok: true, blob: out, type: "image/jpeg", tooSmall, tooDark };
    (self as unknown as Worker).postMessage(res);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) } as CompressResponse);
  }
};
