// src/components/checker/markedCopyExport.ts
// "Red pen" marked copy: each page image gets a right-margin strip with ✓/✗ + marks at the height where
// the answer starts (page_index + y_start from the grader), a short red note where marks were lost,
// and the total on page 1. Plain Canvas + jsPDF; font served from /fonts (no CDN).
// Pages: the backend's upright, student-ordered page images (ai_result.norm_pages — works for PDF uploads too);
// older results without them use the uploaded photos. Stopgap until the backend renderer (checker v4, G4).
// Delivery: the PDF is stored next to the copy and opened through an https signed URL with a download
// filename — never a blob: URL (the Android WebView app can't save those).

import { supabase } from "@/lib/supabaseClient";
import { BUCKET, signedUrls } from "./copyCheckerApi";
import type { CheckSession, CheckSheet } from "./copyCheckerApi";
import { effectiveMarks, effectiveTotal } from "./AiGradeBreakdown";
import type { GradedQuestion, SheetFlag } from "./AiGradeBreakdown";

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

type Unplaced = GradedQuestion & { unplaced?: boolean };

/** Sheet-level notes for page 1's margin, a few words each (the strip is narrow). */
function sheetNotes(flags: SheetFlag[] | undefined): string[] {
  const notes: string[] = [];
  for (const f of flags || []) {
    if (f.code === "PAGES_REORDERED") notes.push("Pages put in order");
    else if (f.code === "PAGE_ROTATED" && f.page != null) notes.push(`p.${f.page + 1} turned upright`);
    else if (f.code === "BLANK_PAGE" && f.page != null) notes.push(`p.${f.page + 1} blank`);
  }
  return notes;
}

function annotatePage(
  ctx: CanvasRenderingContext2D, imgW: number, h: number, s: number,
  questions: GradedQuestion[], totalText: string | null, footer: string, notes: string[] = [],
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
    const marks = q.not_attempted ? "—" : `${tick}${got}/${q.max_marks}`;
    // listed on page 1 because the grader couldn't place it: say which question it is
    const label = (q as Unplaced).unplaced ? `Q${q.q_no} ${marks}` : marks;

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

  // sheet notes (page 1): bottom of the strip, above the footer, last note lowest
  ctx.font = `${17 * s}px sans-serif`;
  ctx.fillStyle = RED;
  ctx.textAlign = "center";
  notes.forEach((note, i) => {
    ctx.fillText(note, w - m / 2, h - (44 + (notes.length - 1 - i) * 22) * s, m - 12 * s);
  });

  ctx.font = `${16 * s}px sans-serif`;
  ctx.fillStyle = "#6B7280";
  ctx.textAlign = "center";
  ctx.fillText(footer, w - m / 2, h - 14 * s, m - 12 * s);
}

export interface MarkedCopyOptions {
  /** Signed URL map path→url (from signedUrls()); missing pages are signed on demand. */
  urls: Record<string, string>;
  /** When true, the student's name appears nowhere in the PDF (content or file name). */
  blind: boolean;
}

/** Storage paths of the page images the grader's positions refer to. */
export function markedCopyPages(sheet: CheckSheet): string[] {
  const norm = sheet.ai_result?.norm_pages;
  if (norm?.length) return [...norm].sort((a, b) => a.index - b.index).map(p => p.path);
  return sheet.pages.filter(p => !p.endsWith(".pdf"));
}

export function markedCopyFileName(session: CheckSession, sheet: CheckSheet, blind: boolean): string {
  const clean = (t: string) => t.replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 50);
  const who = blind ? "student" : clean(sheet.student_name) || "student";
  return `${clean(session.title) || "check"}_${who}_marked.pdf`;
}

/** Builds the marked copy for one checked sheet (no upload). */
export async function buildMarkedCopyPdf(session: CheckSession, sheet: CheckSheet, options: MarkedCopyOptions): Promise<Blob> {
  const r = sheet.ai_result;
  if (!r) throw new Error("This copy has not been checked yet.");
  await loadFont();
  const { jsPDF } = await import("jspdf");

  const all = markedCopyPages(sheet);
  const missing = all.filter(p => !options.urls[p]);
  const urls = missing.length ? { ...options.urls, ...(await signedUrls(missing)) } : options.urls;
  const pages = all.filter(p => urls[p]);
  if (!pages.length || pages.length < all.length) throw new Error("No page images to mark.");

  const byPage = new Map<number, GradedQuestion[]>();
  for (const q of r.graded_questions || []) {
    if (q.counted === false || q.page_index == null || q.page_index >= pages.length) continue;
    byPage.set(q.page_index, [...(byPage.get(q.page_index) || []), q]);
  }
  const unplaced = (r.graded_questions || []).filter(q => q.counted !== false && (q.page_index == null || q.page_index >= pages.length));
  // Older results (before page_index existed) or answers the grader could not place: list them on page 1
  // in question order rather than dropping their marks from the copy.
  if (unplaced.length) {
    byPage.set(0, [...(byPage.get(0) || []), ...unplaced.map((q, i): Unplaced => ({ ...q, unplaced: true, y_start: Math.min(950, 120 + i * 45) }))]);
  }

  const totalText = `${effectiveTotal(r)}/${r.max_marks}`;
  const notes = sheetNotes(r.sheet_flags);
  let pdf: InstanceType<typeof jsPDF> | null = null;

  for (let i = 0; i < pages.length; i++) {
    const img = await loadImage(urls[pages[i]]);
    const imgW = img.naturalWidth, h = img.naturalHeight;
    const s = Math.max(0.5, imgW / BASE_W);
    const canvas = document.createElement("canvas");
    canvas.width = imgW + Math.round(MARGIN * s);
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, imgW, h);
    const footer = `${options.blind ? "" : `${sheet.student_name} · `}${i + 1}/${pages.length}`;
    annotatePage(ctx, imgW, h, s, byPage.get(i) || [], i === 0 ? totalText : null, footer, i === 0 ? notes : []);

    const pdfW = 210;
    const pdfH = Math.round((h / canvas.width) * pdfW);
    if (!pdf) pdf = new jsPDF({ orientation: "p", unit: "mm", format: [pdfW, pdfH] });
    else pdf.addPage([pdfW, pdfH], "p");
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.85), "JPEG", 0, 0, pdfW, pdfH);
  }

  return pdf!.output("blob");
}

/** Builds the marked copy, stores it next to the copy and downloads it through an https signed URL. */
export async function downloadMarkedCopy(session: CheckSession, sheet: CheckSheet, options: MarkedCopyOptions): Promise<void> {
  const blob = await buildMarkedCopyPdf(session, sheet, options);
  const { data: auth } = await supabase.auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) throw new Error("Please log in again.");
  const folder = `${uid}/${session.id}/${sheet.id}/rendered`;
  const path = `${folder}/marked_${Date.now()}.pdf`;
  const store = supabase.storage.from(BUCKET);
  const { error } = await store.upload(path, blob, { contentType: "application/pdf", upsert: false });
  if (error) throw new Error(error.message);
  // keep only the newest marked copy of this sheet
  const { data: old } = await store.list(folder);
  const stale = (old || []).map(f => `${folder}/${f.name}`).filter(p => p !== path && p.endsWith(".pdf"));
  if (stale.length) await store.remove(stale);
  const { data: signed, error: signError } = await store.createSignedUrl(path, 600, {
    download: markedCopyFileName(session, sheet, options.blind),
  });
  if (signError || !signed?.signedUrl) throw new Error(signError?.message || "Could not create the download link.");
  window.location.assign(signed.signedUrl);
}
