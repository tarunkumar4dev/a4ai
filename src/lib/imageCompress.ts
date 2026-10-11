// src/lib/imageCompress.ts
// Phone photos are 3–8 MB; a class of 40 × 8 pages would be gigabytes on school Wi-Fi.
// Downscale to ~1600 px on the long side + JPEG ≈ 200–400 KB, still sharp enough for handwriting.

const MAX_SIDE = 1600;
const QUALITY = 0.72;

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    // imageOrientation honours the EXIF rotation phones write
    return await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  } catch {
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read this image")); };
      img.src = url;
    });
  }
}

/** Returns a compressed JPEG for images; PDFs and anything else are returned unchanged. */
export async function compressImage(file: File, maxSide = MAX_SIDE, quality = QUALITY): Promise<{ blob: Blob; ext: string; type: string }> {
  if (!file.type.startsWith("image/")) {
    const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
    return { blob: file, ext, type: file.type || "application/pdf" };
  }
  const img = await decode(file);
  const w = "naturalWidth" in img ? img.naturalWidth : img.width;
  const h = "naturalHeight" in img ? img.naturalHeight : img.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return { blob: file, ext: "jpg", type: file.type };
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  if ("close" in img && typeof img.close === "function") img.close();
  const blob: Blob | null = await new Promise(res => canvas.toBlob(res, "image/jpeg", quality));
  // Keep the original if the browser can't encode or the "compressed" file is bigger
  if (!blob || blob.size >= file.size) return { blob: file, ext: (file.name.split(".").pop() || "jpg").toLowerCase(), type: file.type };
  return { blob, ext: "jpg", type: "image/jpeg" };
}
