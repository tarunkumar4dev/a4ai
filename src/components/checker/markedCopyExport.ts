// src/components/checker/markedCopyExport.ts
// Renders a "red pen" marked copy: page images with per-question marks + ✓/✗ drawn in the
// right margin, a small red comment where marks were deducted, and the total on page 1.
// Uses the browser Canvas API directly (no html2canvas) + jsPDF (already a project dependency).
// Font: Caveat-Bold from /fonts/Caveat-Bold.ttf, served by the app itself — no CDN.

import type { CheckSession, CheckSheet } from "./copyCheckerApi";
import { effectiveMarks, effectiveTotal } from "./AiGradeBreakdown";
import type { GradedQuestion } from "./AiGradeBreakdown";

// ── constants ──────────────────────────────────────────────────────────────────
const RED = "#DC2626";
const RED_LIGHT = "#FCA5A5";
const MARGIN_W = 72;        // right-margin strip width in canvas pixels (≈ 1 cm at 72 dpi)
const FONT_MARKS = "bold 26px CaveatRed, 'Comic Sans MS', cursive";
const FONT_COMMENT = "italic 18px CaveatRed, 'Comic Sans MS', cursive";
const FONT_TOTAL = "bold 32px CaveatRed, 'Comic Sans MS', cursive";

// ── font loading ───────────────────────────────────────────────────────────────

let _fontReady: Promise<boolean> | null = null;

async function loadFont(): Promise<boolean> {
  if (_fontReady) return _fontReady;
  _fontReady = (async () => {
    try {
      const face = new FontFace("CaveatRed", "url(/fonts/Caveat-Bold.ttf)");
      const loaded = await face.load();
      document.fonts.add(loaded);
      return true;
    } catch {
      return false; // system fallback (Comic Sans MS / cursive) will be used
    }
  })();
  return _fontReady;
}

// ── helpers ────────────────────────────────────────────────────────────────────

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Groups graded questions by page_index. Questions with null page_index go on page 0. */
function byPage(questions: GradedQuestion[]): Map<number, GradedQuestion[]> {
  const m = new Map<number, GradedQuestion[]>();
  for (const q of questions) {
    const p = q.page_index ?? 0;
    if (!m.has(p)) m.set(p, []);
    m.get(p)!.push(q);
  }
  return m;
}

/** y_start (0-1000) → canvas y coordinate. */
function toCanvasY(y_start: number | null | undefined, canvasH: number): number {
  const frac = Math.max(0, Math.min(1000, y_start ?? 500)) / 1000;
  return Math.round(frac * canvasH);
}

/**
 * Draw one page's annotations on an existing canvas.
 * The page image must already be drawn onto the canvas before calling this.
 */
function annotateCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  questions: GradedQuestion[],
  isFirstPage: boolean,
  totalText: string | null,
  blind: boolean,
) {
  // Right-margin background
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(w - MARGIN_W, 0, MARGIN_W, h);

  // Margin separator line
  ctx.strokeStyle = RED_LIGHT;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(w - MARGIN_W, 0);
  ctx.lineTo(w - MARGIN_W, h);
  ctx.stroke();

  // Per-question marks + ✓/✗ + comment
  for (const q of questions) {
    const y = toCanvasY(q.y_start, h);
    const eff = effectiveMarks(q);
    const isFull = eff >= q.max_marks;
    const isZero = eff === 0 && !q.not_attempted;

    // ✓ or ✗ tick in margin
    ctx.font = FONT_MARKS;
    ctx.fillStyle = RED;
    ctx.textAlign = "center";
    ctx.save();
    ctx.translate(w - MARGIN_W + 16, y + 10);
    ctx.rotate(0.03);
    ctx.fillText(isFull ? "✓" : isZero ? "✗" : "~", 0, 0);
    ctx.restore();

    // Marks circle-ish background
    const marksText = q.not_attempted ? "—" : `${eff}/${q.max_marks}`;
    ctx.font = FONT_MARKS;
    ctx.fillStyle = RED;
    ctx.textAlign = "center";
    ctx.save();
    ctx.translate(w - MARGIN_W / 2, y + 36);
    ctx.rotate(-0.02);
    ctx.fillText(marksText, 0, 0);
    ctx.restore();

    // Q label
    ctx.font = FONT_COMMENT;
    ctx.fillStyle = RED_LIGHT;
    ctx.textAlign = "center";
    ctx.fillText(`Q${q.q_no}`, w - MARGIN_W / 2, y + 56);

    // Short comment next to the answer (missed concepts, max 40 chars)
    const missed = (q.key_concepts_missed || []).slice(0, 2).join(", ");
    if (missed && !isFull) {
      const commentX = w - MARGIN_W - 8;
      ctx.font = FONT_COMMENT;
      ctx.fillStyle = RED;
      ctx.textAlign = "right";
      ctx.save();
      ctx.translate(commentX, y + 10);
      ctx.rotate(-0.015);
      const short = missed.length > 40 ? missed.slice(0, 38) + "…" : missed;
      ctx.fillText(short, 0, 0);
      ctx.restore();
    }
  }

  // Total on page 1 (top-right corner)
  if (isFirstPage && totalText) {
    ctx.font = FONT_TOTAL;
    ctx.fillStyle = RED;
    ctx.textAlign = "right";
    ctx.save();
    ctx.translate(w - MARGIN_W - 12, 44);
    ctx.rotate(-0.03);
    ctx.fillText(totalText, 0, 0);
    ctx.restore();

    // Underline for emphasis
    const metrics = ctx.measureText(totalText);
    const tw = Math.min(metrics.width, 180);
    ctx.strokeStyle = RED;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w - MARGIN_W - 12, 50);
    ctx.lineTo(w - MARGIN_W - 12 - tw, 50);
    ctx.stroke();
  }
}

// ── main export ────────────────────────────────────────────────────────────────

export interface MarkedCopyOptions {
  /** Signed URL map path→url (from signedUrls()). */
  urls: Record<string, string>;
  /** When true, student name is not drawn anywhere on the PDF. */
  blind: boolean;
}

/**
 * Generates a "marked copy" PDF for one student's checked sheet:
 * page images with red-pen marks drawn in the right margin.
 * Triggers a browser download automatically.
 */
export async function downloadMarkedCopy(
  session: CheckSession,
  sheet: CheckSheet,
  options: MarkedCopyOptions,
): Promise<void> {
  if (!sheet.ai_result) throw new Error("No AI result yet — check the copy first.");

  await loadFont();

  const { jsPDF } = await import("jspdf");
  const questions = sheet.ai_result.graded_questions ?? [];
  const qByPage = byPage(questions);
  const pages = sheet.pages.filter(p => !p.endsWith(".pdf") && options.urls[p]);

  if (!pages.length) throw new Error("No image pages to draw.");

  const total = effectiveTotal(sheet.ai_result);
  const totalText = `${total}/${sheet.ai_result.max_marks}`;
  const studentLabel = options.blind ? "" : sheet.student_name;

  // We'll build the PDF page by page; dimensions come from the first image.
  let pdf: InstanceType<typeof jsPDF> | null = null;

  for (let pi = 0; pi < pages.length; pi++) {
    const path = pages[pi];
    const url = options.urls[path];
    let img: HTMLImageElement;
    try {
      img = await loadImage(url);
    } catch {
      continue; // signed URL expired — skip this page gracefully
    }

    // Canvas: image dimensions + right margin
    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;
    const canvasW = imgW + MARGIN_W;
    const canvasH = imgH;

    const canvas = document.createElement("canvas");
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext("2d")!;

    // Draw page image
    ctx.drawImage(img, 0, 0, imgW, imgH);

    // Annotate
    const qs = qByPage.get(pi) ?? [];
    annotateCanvas(
      ctx, canvasW, canvasH,
      qs,
      pi === 0,
      pi === 0 ? totalText : null,
      options.blind,
    );

    // Student name + page number in small text at bottom of margin (not blind)
    if (!options.blind && studentLabel) {
      ctx.font = "bold 14px sans-serif";
      ctx.fillStyle = "#6B7280";
      ctx.textAlign = "center";
      ctx.fillText(studentLabel, canvasW - MARGIN_W / 2, canvasH - 24);
    }
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#9CA3AF";
    ctx.textAlign = "center";
    ctx.fillText(`${pi + 1}/${pages.length}`, canvasW - MARGIN_W / 2, canvasH - 8);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    // PDF page: same aspect ratio, A4-ish width
    const pdfW = 210; // mm
    const pdfH = Math.round((canvasH / canvasW) * pdfW);

    if (!pdf) {
      pdf = new jsPDF({ orientation: pdfW >= pdfH ? "l" : "p", unit: "mm", format: [pdfW, pdfH] });
    } else {
      pdf.addPage([pdfW, pdfH], pdfW >= pdfH ? "l" : "p");
    }
    pdf.addImage(dataUrl, "JPEG", 0, 0, pdfW, pdfH);
  }

  if (!pdf) throw new Error("No pages could be rendered.");

  const safeName = (options.blind ? "student" : sheet.student_name)
    .replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 60) || "student";
  const sessionName = session.title.replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 40) || "check";
  pdf.save(`${sessionName}_${safeName}_marked.pdf`);
}
