import { describe, expect, it, vi, beforeEach } from "vitest";

// compressImage needs a real canvas (not in jsdom): stand in for it — "compress" = keep the first `n` bytes
const compressMock = vi.fn();
vi.mock("@/lib/imageCompress", () => ({ compressImage: (...a: unknown[]) => compressMock(...a) }));
// pdf.js can't run here → pdfPageCount falls back to counting /Type /Page in the bytes
vi.mock("pdfjs-dist", () => { throw new Error("no pdf.js in tests"); });

import {
  HEIC_ERROR, classify, formatError, heicToJpeg, pdfPageCount, pdfPagesFromBytes, scaledSize, sizeError,
} from "../files";
import { preparePage } from "@/lib/uploadFlow";

const MB = 1048576;
const file = (name: string, type: string, size: number) => new File([new Uint8Array(size)], name, { type });

beforeEach(() => {
  compressMock.mockReset();
  compressMock.mockImplementation(async (f: File) => ({ blob: new Blob([new Uint8Array(Math.min(f.size, 300_000))], { type: "image/jpeg" }), ext: "jpg", type: "image/jpeg" }));
});

describe("HEIC → JPEG", () => {
  const heic = file("IMG_0001.HEIC", "", 2 * MB);

  it("uses heic2any first", async () => {
    const out = new Blob(["jpeg"], { type: "image/jpeg" });
    const native = vi.fn();
    await expect(heicToJpeg(heic, { heic2any: async () => out, nativeToJpeg: native })).resolves.toBe(out);
    expect(native).not.toHaveBeenCalled();
  });

  it("takes the first image of a multi-image HEIC", async () => {
    const a = new Blob(["a"], { type: "image/jpeg" });
    await expect(heicToJpeg(heic, { heic2any: async () => [a, new Blob(["b"])], nativeToJpeg: vi.fn() })).resolves.toBe(a);
  });

  it("falls back to the browser's own decoder when heic2any fails", async () => {
    const out = new Blob(["native"], { type: "image/jpeg" });
    const native = vi.fn(async () => out);
    await expect(heicToJpeg(heic, { heic2any: async () => { throw new Error("libheif"); }, nativeToJpeg: native })).resolves.toBe(out);
    expect(native).toHaveBeenCalledOnce();
  });

  it("gives a clear Hinglish error when both fail", async () => {
    await expect(heicToJpeg(heic, {
      heic2any: async () => { throw new Error("x"); }, nativeToJpeg: async () => { throw new Error("y"); },
    })).rejects.toThrow(HEIC_ERROR);
  });
});

describe("file checks", () => {
  it("classifies by type or extension (Android often sends no type)", () => {
    expect(classify({ name: "a.heif", type: "" })).toBe("heic");
    expect(classify({ name: "scan.PDF", type: "" })).toBe("pdf");
    expect(classify({ name: "p.jpg", type: "image/jpeg" })).toBe("image");
    expect(classify({ name: "notes.docx", type: "application/vnd.openxmlformats" })).toBe("bad");
  });

  it("messages name the file", () => {
    expect(formatError("notes.docx")).toBe("notes.docx: sirf photo ya PDF chalega");
    expect(sizeError("page3.jpg", 12 * MB, 10)).toBe("page3.jpg 12 MB hai, max 10 MB");
  });

  it("scales the long edge to 1600 px and never up", () => {
    expect(scaledSize(4000, 3000)).toEqual({ w: 1600, h: 1200 });
    expect(scaledSize(3000, 4000)).toEqual({ w: 1200, h: 1600 });
    expect(scaledSize(800, 600)).toEqual({ w: 800, h: 600 });
  });

  it("counts PDF pages from the bytes when pdf.js is not there", async () => {
    expect(pdfPagesFromBytes("<< /Type /Pages /Count 2 >> << /Type /Page >> << /Type/Page >>")).toBe(2);
    await expect(pdfPageCount(new Blob(["%PDF-1.4 /Type /Page /Type /Page /Type /Page"]))).resolves.toBe(3);
  });
});

describe("preparePage (compress + limits)", () => {
  const link = { mimes: ["application/pdf", "image/jpeg", "image/png", "image/webp"], mb: 10 };

  it("compresses a big phone photo to a JPEG under the limit", async () => {
    const p = await preparePage(file("page1.jpg", "image/jpeg", 6 * MB), link.mimes, link.mb);
    expect(p.mime).toBe("image/jpeg");
    expect(p.ext).toBe("jpg");
    expect(p.size).toBeLessThan(6 * MB);
    expect(compressMock).toHaveBeenCalledWith(expect.any(File), 1600, 0.8);
  });

  it("refuses a photo still too big after compressing", async () => {
    compressMock.mockImplementation(async () => ({ blob: new Blob([new Uint8Array(12 * MB)]), ext: "jpg", type: "image/jpeg" }));
    await expect(preparePage(file("page3.jpg", "image/jpeg", 20 * MB), link.mimes, link.mb)).rejects.toThrow("page3.jpg 12 MB hai, max 10 MB");
  });

  it("keeps PDFs as they are and checks their size against the link's max_mb", async () => {
    await expect(preparePage(file("big.pdf", "application/pdf", 11 * MB), link.mimes, 10)).rejects.toThrow("big.pdf 11 MB hai, max 10 MB");
    await expect(preparePage(file("small.pdf", "application/pdf", 4 * MB), link.mimes, 3)).rejects.toThrow("max 3 MB");
    const ok = await preparePage(file("copy.pdf", "application/pdf", 1 * MB), link.mimes, 10);
    expect(ok.mime).toBe("application/pdf");
    expect(compressMock).not.toHaveBeenCalled();
  });

  it("never allows more than the 10 MB bucket limit, whatever max_mb says", async () => {
    await expect(preparePage(file("big.pdf", "application/pdf", 10.5 * MB), link.mimes, 50)).rejects.toThrow("max 10 MB");
  });

  it("rejects formats the link doesn't allow", async () => {
    await expect(preparePage(file("notes.docx", "application/msword", 1000), link.mimes, 10)).rejects.toThrow("notes.docx: sirf photo ya PDF chalega");
    await expect(preparePage(file("a.pdf", "application/pdf", 1000), ["image/jpeg"], 10)).rejects.toThrow("sirf photo chalegi");
    await expect(preparePage(file("a.jpg", "image/jpeg", 1000), ["application/pdf"], 10)).rejects.toThrow("sirf PDF chalegi");
  });
});
