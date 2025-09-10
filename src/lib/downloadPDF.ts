// src/lib/downloadPDF.ts
import { jsPDF } from "jspdf";

/** Text ko neat A4 PDF me save karta hai (auto-wrap + multi-page). */
export function downloadTextAsPDF(
  text: string,
  filename = "Test.pdf",
  opts?: { title?: string; margin?: number; fontSize?: number }
) {
  const margin = opts?.margin ?? 16;        // mm
  const fontSize = opts?.fontSize ?? 12;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // (Optional) title
  if (opts?.title) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(opts.title, margin, margin);
    doc.setFont("helvetica", "normal");
  }

  doc.setFontSize(fontSize);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - margin * 2;

  // Multi-line wrap
  const paragraphs = text.split(/\r?\n/);
  let y = opts?.title ? margin + 8 + fontSize : margin;

  for (const para of paragraphs) {
    const wrapped = doc.splitTextToSize(para || " ", usableWidth);
    for (const line of wrapped) {
      // page break
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y, { baseline: "top" });
      y += fontSize * 1.4; // line height
    }
  }

  doc.save(filename);
}

/** Blob/bytes ko file ki तरह download कराओ (PDF/any). */
export function downloadBlobAsFile(
  data: BlobPart | Blob,
  filename: string,
  mime = "application/pdf"
) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Signed URL (Supabase Storage) se सीधे download. */
export async function downloadFromSignedUrl(
  signedUrl: string,
  filename = `download-${Date.now()}.pdf`
) {
  const resp = await fetch(signedUrl);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  const blob = await resp.blob();
  downloadBlobAsFile(blob, filename, blob.type || "application/pdf");
}

// Backward compatible default export:
export const downloadPDF = downloadTextAsPDF;
