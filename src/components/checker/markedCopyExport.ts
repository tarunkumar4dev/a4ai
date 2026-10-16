// src/components/checker/markedCopyExport.ts
// "Red pen" marked copy: each page image gets a right-margin strip with ✓/✗ + marks at the height where
// the answer starts (page_index + y_start from the grader), a short red note where marks were lost,
// and the total on page 1. Plain Canvas + jsPDF; font served from /fonts (no CDN).

import type { CheckSession, CheckSheet } from "./copyCheckerApi";
import { effectiveMarks, effectiveTotal } from "./AiGradeBreakdown";
import type { GradedQuestion } from "./AiGradeBreakdown";

const RED = "#DC2626";
const RED_LIGHT = "#FCA5A5";
const HAND = "CaveatRed, 'Comic Sans MS', cursive";
// Sizes are tuned for an A4 page 1240 px wide (150 dpi) and scaled to the real image width,
// so a 4000 px phone photo gets proportionally larger marks.
const BASE_W = 1240;
const MARGIN = 150;
const COMMENT_CHARS = 48;

let _fontReady: Promise<boolean> | null = null;

function loadFont(): Promise<boolean> {
  if (!_fontReady) {
    _fontReady = new FontFace("CaveatRed", "url(/fonts/Caveat-Bold.ttf)").load()
      .then(f => { document.fonts.add(f); return true; })
      .catch(() => false); // system cursive fallback
  }
  return _fontReady;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** What went wrong, in a few words: the grader's reason on the first point that lost marks. */
function shortComment(q: GradedQuestion): string | null {
  if (q.not_attempted || q.max_marks <= 1 || effectiveMarks(q) >= q.max_marks) return null;
  const points = q.has_subparts ? q.subpart_grades.flatMap(s => s.points || []) : q.points || [];
  const lost = points.find(p => p.marks_awarded < p.max_marks && p.reason);
  let text = (lost?.reason || q.feedback || "").trim();
  // "Values identified correctly, but squared the coefficient" → keep the part that says what went wrong
  const but = text.search(/,?\s+but\s+/i);
  if (but > 0) {
    const rest = text.slice(but).replace(/^,?\s+but\s+/i, "");
    text = rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  if (!text || text === "See sub-part feedback") return null;
  if (text.length <= COMMENT_CHARS) return text;
  const cut = text.slice(0, COMMENT_CHARS);
  return cut.slice(0, cut.lastIndexOf(" ") > 20 ? cut.lastIndexOf(" ") : COMMENT_CHARS).replace(/[,;:.\s]+$/, "") + "…";
}

function annotatePage(
  ctx: CanvasRenderingContext2D, imgW: number, h: number, s: number,
  questions: GradedQuestion[], totalText: string | null, footer: string,
) {
  const m = Math.round(MARGIN * s);
  const w = imgW + m;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(imgW, 0, m, h);
  ctx.strokeStyle = RED_LIGHT;
  ctx.lineWidth = 2 * s;
  ctx.beginPath(); ctx.moveTo(imgW, 0); ctx.lineTo(imgW, h); ctx.stroke();

  const marksPx = 36 * s;
  const lineH = marksPx * 1.05;
  let lastY = -Infinity;
  const sorted = [...questions].sort((a, b) => (a.y_start ?? 500) - (b.y_start ?? 500));
  for (const q of sorted) {
    // baseline a little below where the answer starts; pushed down if it would overlap the previous mark
    const y = Math.max(((q.y_start ?? 500) / 1000) * h + marksPx * 0.6, lastY + lineH);
    lastY = y;
    const got = effectiveMarks(q);
    const tick = q.not_attempted ? "" : got >= q.max_marks ? "✓ " : got === 0 ? "✗ " : "";
    const label = q.not_attempted ? "—" : `${tick}${got}/${q.max_marks}`;

    ctx.save();
    ctx.translate(imgW + m / 2, y);
    ctx.rotate(-0.03);
    ctx.font = `bold ${marksPx}px ${HAND}`;
    ctx.fillStyle = RED;
    ctx.textAlign = "center";
    ctx.fillText(label, 0, 0, m - 10 * s);
    ctx.restore();

    const note = shortComment(q);
    if (note) {
      ctx.font = `${24 * s}px ${HAND}`;
      const tw = ctx.measureText(note).width;
      const x = imgW - 12 * s;
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillRect(x - tw - 6 * s, y - 22 * s, tw + 10 * s, 30 * s);
      ctx.fillStyle = RED;
      ctx.textAlign = "right";
      ctx.fillText(note, x, y);
    }
  }

  if (totalText) {
    ctx.save();
    ctx.translate(imgW - 20 * s, 64 * s);
    ctx.rotate(-0.04);
    ctx.font = `bold ${52 * s}px ${HAND}`;
    ctx.fillStyle = RED;
    ctx.textAlign = "right";
    ctx.fillText(totalText, 0, 0);
    const tw = ctx.measureText(totalText).width;
    ctx.strokeStyle = RED;
    ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(0, 10 * s); ctx.lineTo(-tw, 10 * s); ctx.stroke();
    ctx.restore();
  }

  ctx.font = `${16 * s}px sans-serif`;
  ctx.fillStyle = "#6B7280";
  ctx.textAlign = "center";
  ctx.fillText(footer, w - m / 2, h - 14 * s, m - 12 * s);
}

export interface MarkedCopyOptions {
  /** Signed URL map path→url (from signedUrls()). */
  urls: Record<string, string>;
  /** When true, the student's name appears nowhere in the PDF (content or file name). */
  blind: boolean;
}

/** Builds the marked copy for one checked sheet and downloads it as a PDF. */
export async function downloadMarkedCopy(session: CheckSession, sheet: CheckSheet, options: MarkedCopyOptions): Promise<void> {
  const r = sheet.ai_result;
  if (!r) throw new Error("This copy has not been checked yet.");
  await loadFont();
  const { jsPDF } = await import("jspdf");

  const pages = sheet.pages.filter(p => !p.endsWith(".pdf") && options.urls[p]);
  if (!pages.length) throw new Error("No page photos to mark.");

  const byPage = new Map<number, GradedQuestion[]>();
  for (const q of r.graded_questions || []) {
    if (q.counted === false || q.page_index == null || q.page_index >= pages.length) continue;
    byPage.set(q.page_index, [...(byPage.get(q.page_index) || []), q]);
  }
  const unplaced = (r.graded_questions || []).filter(q => q.counted !== false && (q.page_index == null || q.page_index >= pages.length));
  // Older results (before page_index existed) or answers the grader could not place: list them on page 1
  // in question order rather than dropping their marks from the copy.
  if (unplaced.length) {
    byPage.set(0, [...(byPage.get(0) || []), ...unplaced.map((q, i) => ({ ...q, y_start: Math.min(950, 120 + i * 45) }))]);
  }

  const totalText = `${effectiveTotal(r)}/${r.max_marks}`;
  let pdf: InstanceType<typeof jsPDF> | null = null;

  for (let i = 0; i < pages.length; i++) {
    const img = await loadImage(options.urls[pages[i]]);
    const imgW = img.naturalWidth, h = img.naturalHeight;
    const s = Math.max(0.5, imgW / BASE_W);
    const canvas = document.createElement("canvas");
    canvas.width = imgW + Math.round(MARGIN * s);
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, imgW, h);
    const footer = `${options.blind ? "" : `${sheet.student_name} · `}${i + 1}/${pages.length}`;
    annotatePage(ctx, imgW, h, s, byPage.get(i) || [], i === 0 ? totalText : null, footer);

    const pdfW = 210;
    const pdfH = Math.round((h / canvas.width) * pdfW);
    if (!pdf) pdf = new jsPDF({ orientation: "p", unit: "mm", format: [pdfW, pdfH] });
    else pdf.addPage([pdfW, pdfH], "p");
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.85), "JPEG", 0, 0, pdfW, pdfH);
  }

  const clean = (t: string) => t.replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 50);
  const who = options.blind ? "student" : clean(sheet.student_name) || "student";
  pdf!.save(`${clean(session.title) || "check"}_${who}_marked.pdf`);
}
