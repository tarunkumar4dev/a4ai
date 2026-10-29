// src/components/checker/markedCopyExport.ts
// "Red pen" marked copy: each page image gets a white margin column on the right with the marks of every answer
// on that page at the height where it starts (page_index + y_start from the grader), the sub-part marks and the
// full comment, wrapped to the column. Nothing is ever written on the student's page: a comment that doesn't fit
// next to its answer gets a marker (①) there and goes, in full, into "Teacher's notes" in a white band added
// under that page. Page 1's margin has the total; a summary page at the end lists every question + review flags.
// Layout rules: markedCopyLayout.ts (pure, tested). Plain Canvas + jsPDF; font served from /fonts (no CDN).
// Pages: the backend's upright, student-ordered page images (ai_result.norm_pages — works for PDF uploads too);
// older results without them use the uploaded photos. Stopgap until the backend renderer (checker v4, G4).
// Delivery: the PDF is stored next to the copy and opened through an https signed URL with a download
// filename — never a blob: URL (the Android WebView app can't save those).

import { supabase } from "@/lib/supabaseClient";
import { BUCKET, signedUrls } from "./copyCheckerApi";
import type { CheckSession, CheckSheet } from "./copyCheckerApi";
import { effectiveTotal } from "./AiGradeBreakdown";
import type { GradedQuestion, SheetFlag } from "./AiGradeBreakdown";
import {
  type LayoutFonts, type Measure, type Note, layoutMargin, reviewFlags, summaryRows, wrapText,
} from "./markedCopyLayout";

const RED = "#DC2626";
const RED_LIGHT = "#FCA5A5";
const GREY = "#6B7280";
const HAND = "CaveatRed, 'Comic Sans MS', cursive";
const SANS = "Inter, 'Segoe UI', Arial, sans-serif";
// Sizes are tuned for an A4 page 1240 px wide (150 dpi) and scaled to the real image width,
// so a 4000 px phone photo gets proportionally larger marks.
const BASE_W = 1240;
export const MARGIN = 340;          // the margin column, wide enough for ~30 characters of comment per line

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

const canvasMeasure = (ctx: CanvasRenderingContext2D): Measure => (text, font) => {
  ctx.font = font;
  return ctx.measureText(text).width;
};

function fontsFor(s: number): LayoutFonts {
  return {
    marks: `bold ${34 * s}px ${HAND}`, marksH: 40 * s,
    sub: `${19 * s}px ${SANS}`, subH: 24 * s,
    comment: `${25 * s}px ${HAND}`, commentH: 28 * s,
  };
}

type Unplaced = GradedQuestion & { unplaced?: boolean };

/** Sheet-level notes for page 1's margin, a few words each. */
function sheetNotes(flags: SheetFlag[] | undefined): string[] {
  const notes: string[] = [];
  for (const f of flags || []) {
    if (f.code === "PAGES_REORDERED") notes.push("Pages put in order");
    else if (f.code === "PAGE_ROTATED" && f.page != null) notes.push(`p.${f.page + 1} turned upright`);
    else if (f.code === "BLANK_PAGE" && f.page != null) notes.push(`p.${f.page + 1} blank`);
  }
  return notes;
}

/** Height of the "Teacher's notes" band for these notes (0 when none). */
function notesBand(measure: Measure, notes: Note[], width: number, s: number) {
  if (!notes.length) return { height: 0, lines: [] as { text: string; marker: string | null }[] };
  const font = `${25 * s}px ${HAND}`;
  const lines: { text: string; marker: string | null }[] = [];
  for (const n of notes) {
    wrapText(`Q${n.q_no}: ${n.text}`, width - 56 * s, measure, font)
      .forEach((t, i) => lines.push({ text: t, marker: i === 0 ? n.marker : null }));
  }
  return { height: Math.round((70 + lines.length * 30 + 24) * s), lines };
}

/** One page: image, margin column, optional notes band below. Returns the canvas. */
function renderPage(img: HTMLImageElement, questions: (GradedQuestion & { prefY: number })[], opts: {
  totalText: string | null; footer: string; sheetNotes: string[]; firstMarker: number;
}): { canvas: HTMLCanvasElement; markersUsed: number } {
  const imgW = img.naturalWidth, h = img.naturalHeight;
  const s = Math.max(0.5, imgW / BASE_W);
  const m = Math.round(MARGIN * s);
  const w = imgW + m;
  const pad = 14 * s;
  const fonts = fontsFor(s);

  const probe = document.createElement("canvas").getContext("2d")!;
  const measure = canvasMeasure(probe);
  const top = opts.totalText ? 100 * s : 16 * s;
  const reserved = (40 + opts.sheetNotes.length * 22) * s;      // footer + sheet notes at the bottom of the column
  const layout = layoutMargin(questions, {
    width: m - 2 * pad, top, bottom: h - reserved, gap: 12 * s, fonts, measure, firstMarker: opts.firstMarker,
  });
  const band = notesBand(measure, layout.notes, w, s);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h + band.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, imgW, h);
  ctx.strokeStyle = RED_LIGHT;
  ctx.lineWidth = 2 * s;
  ctx.beginPath(); ctx.moveTo(imgW, 0); ctx.lineTo(imgW, h); ctx.stroke();
  ctx.textBaseline = "top";

  if (opts.totalText) {
    ctx.font = `bold ${50 * s}px ${HAND}`;
    ctx.fillStyle = RED;
    ctx.textAlign = "center";
    ctx.fillText(opts.totalText, imgW + m / 2, 22 * s, m - 2 * pad);
    const tw = Math.min(ctx.measureText(opts.totalText).width, m - 2 * pad);
    ctx.lineWidth = 3 * s;
    ctx.strokeStyle = RED;
    ctx.beginPath(); ctx.moveTo(imgW + m / 2 - tw / 2, 80 * s); ctx.lineTo(imgW + m / 2 + tw / 2, 80 * s); ctx.stroke();
  }

  const x = imgW + pad;
  ctx.textAlign = "left";
  for (const b of layout.placed) {
    let y = b.y;
    ctx.font = fonts.marks; ctx.fillStyle = RED;
    ctx.fillText(b.marks, x, y, m - 2 * pad);
    y += fonts.marksH;
    ctx.font = fonts.sub; ctx.fillStyle = "#991B1B";
    for (const line of b.sub) { ctx.fillText(line, x, y, m - 2 * pad); y += fonts.subH; }
    ctx.font = fonts.comment; ctx.fillStyle = RED;
    for (const line of b.comment) { ctx.fillText(line, x, y); y += fonts.commentH; }
  }

  ctx.textAlign = "center";
  ctx.font = `${17 * s}px ${SANS}`;
  ctx.fillStyle = RED;
  opts.sheetNotes.forEach((note, i) => {
    ctx.fillText(note, imgW + m / 2, h - (60 + (opts.sheetNotes.length - 1 - i) * 22) * s, m - 2 * pad);
  });
  ctx.font = `${16 * s}px ${SANS}`;
  ctx.fillStyle = GREY;
  ctx.fillText(opts.footer, imgW + m / 2, h - 30 * s, m - 2 * pad);

  if (band.height) {
    ctx.strokeStyle = RED_LIGHT;
    ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w, h); ctx.stroke();
    ctx.textAlign = "left";
    ctx.font = `bold ${24 * s}px ${SANS}`;
    ctx.fillStyle = RED;
    ctx.fillText("Teacher's notes", 24 * s, h + 20 * s);
    ctx.font = `${25 * s}px ${HAND}`;
    band.lines.forEach((l, i) => {
      const y = h + (62 + i * 30) * s;
      if (l.marker) ctx.fillText(l.marker, 24 * s, y);
      ctx.fillText(l.text, 56 * s, y);
    });
  }
  return { canvas, markersUsed: layout.notes.length };
}

/** Summary page(s), A4 at 150 dpi: total, one row per question (Q, marks, max, comment), review flags. */
function renderSummary(sheet: CheckSheet, questions: GradedQuestion[], totalText: string, blind: boolean,
                       title: string): HTMLCanvasElement[] {
  const W = 1240, H = 1754, P = 70;
  const cols = { q: P, marks: P + 110, max: P + 240, comment: P + 350 };
  const commentW = W - P - cols.comment;
  const pages: HTMLCanvasElement[] = [];
  let ctx!: CanvasRenderingContext2D;
  let y = 0;
  const measure: Measure = (t, f) => { ctx.font = f; return ctx.measureText(t).width; };
  const body = `21px ${SANS}`, small = `18px ${SANS}`;

  const newPage = (first: boolean) => {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    ctx = c.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "top"; ctx.textAlign = "left";
    pages.push(c);
    y = P;
    if (first) {
      ctx.fillStyle = "#111827"; ctx.font = `bold 34px ${SANS}`;
      ctx.fillText("Summary", P, y); y += 50;
      ctx.font = `22px ${SANS}`; ctx.fillStyle = GREY;
      ctx.fillText([title, blind ? null : sheet.student_name, sheet.roll_no && !blind ? `Roll ${sheet.roll_no}` : null]
        .filter(Boolean).join(" · "), P, y, W - 2 * P);
      y += 44;
      ctx.fillStyle = RED; ctx.font = `bold 56px ${HAND}`;
      ctx.fillText(`Total ${totalText}`, P, y); y += 84;
    } else {
      ctx.fillStyle = GREY; ctx.font = `20px ${SANS}`; ctx.fillText("Summary (continued)", P, y); y += 40;
    }
    ctx.font = `bold 20px ${SANS}`; ctx.fillStyle = "#111827";
    ctx.fillText("Q", cols.q, y); ctx.fillText("Marks", cols.marks, y); ctx.fillText("Max", cols.max, y);
    ctx.fillText("Comment", cols.comment, y);
    y += 32;
    ctx.strokeStyle = "#D1D5DB"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(P, y - 6); ctx.lineTo(W - P, y - 6); ctx.stroke();
  };

  newPage(true);
  const rows = summaryRows(questions);
  for (const r of rows) {
    const sub = r.sub ? wrapText(r.sub, commentW, measure, small) : [];
    const com = r.comment ? wrapText(r.comment, commentW, measure, body) : [];
    const rev = r.review.length ? wrapText(`Needs review: ${r.review.join(", ")}`, commentW, measure, small) : [];
    const rowH = Math.max(30, sub.length * 24 + com.length * 28 + rev.length * 24) + 14;
    if (y + rowH > H - P) newPage(false);
    ctx.fillStyle = "#111827"; ctx.font = `bold 21px ${SANS}`;
    ctx.fillText(`Q${r.q_no}`, cols.q, y);
    ctx.font = body;
    ctx.fillText(r.marks, cols.marks, y); ctx.fillText(r.max, cols.max, y);
    let cy = y;
    ctx.font = small; ctx.fillStyle = GREY;
    for (const l of sub) { ctx.fillText(l, cols.comment, cy); cy += 24; }
    ctx.font = body; ctx.fillStyle = "#111827";
    for (const l of com) { ctx.fillText(l, cols.comment, cy); cy += 28; }
    ctx.font = small; ctx.fillStyle = "#B45309";
    for (const l of rev) { ctx.fillText(l, cols.comment, cy); cy += 24; }
    y += rowH;
    ctx.strokeStyle = "#F3F4F6";
    ctx.beginPath(); ctx.moveTo(P, y - 7); ctx.lineTo(W - P, y - 7); ctx.stroke();
  }

  const flags = reviewFlags((sheet as CheckSheet & { needs_review_reasons?: string[] | null }).needs_review_reasons, rows);
  const flagLines = flags.flatMap(f => wrapText(`• ${f}`, W - 2 * P, measure, body));
  if (y + 60 + flagLines.length * 28 > H - P) newPage(false);
  y += 20;
  ctx.fillStyle = "#111827"; ctx.font = `bold 24px ${SANS}`;
  ctx.fillText("Needs review", P, y); y += 38;
  ctx.font = body;
  if (!flagLines.length) { ctx.fillStyle = GREY; ctx.fillText("Nothing flagged.", P, y); }
  ctx.fillStyle = "#B45309";
  for (const l of flagLines) {
    if (y + 28 > H - P) { newPage(false); ctx.font = body; ctx.fillStyle = "#B45309"; }
    ctx.fillText(l, P, y); y += 28;
  }
  return pages;
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

  const byPage = new Map<number, Unplaced[]>();
  for (const q of r.graded_questions || []) {
    if (q.counted === false || q.page_index == null || q.page_index >= pages.length) continue;
    byPage.set(q.page_index, [...(byPage.get(q.page_index) || []), q]);
  }
  const unplaced = (r.graded_questions || []).filter(q => q.counted !== false && (q.page_index == null || q.page_index >= pages.length));
  // Older results (before page_index existed) or answers the grader could not place: listed on page 1
  // in question order rather than dropping their marks from the copy.
  if (unplaced.length) {
    byPage.set(0, [...(byPage.get(0) || []), ...unplaced.map((q, i): Unplaced => ({ ...q, unplaced: true, y_start: Math.min(950, 120 + i * 45) }))]);
  }

  const totalText = `${effectiveTotal(r)}/${r.max_marks}`;
  const notes = sheetNotes(r.sheet_flags);
  let pdf: InstanceType<typeof jsPDF> | null = null;
  const addCanvas = (canvas: HTMLCanvasElement) => {
    const pdfW = 210;
    const pdfH = Math.round((canvas.height / canvas.width) * pdfW);
    if (!pdf) pdf = new jsPDF({ orientation: "p", unit: "mm", format: [pdfW, pdfH] });
    else pdf.addPage([pdfW, pdfH], "p");
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.85), "JPEG", 0, 0, pdfW, pdfH);
  };

  let nextMarker = 1;                          // ①, ② … count on across the whole copy
  for (let i = 0; i < pages.length; i++) {
    const img = await loadImage(urls[pages[i]]);
    const qs = (byPage.get(i) || []).map(q => ({ ...q, prefY: ((q.y_start ?? 500) / 1000) * img.naturalHeight }));
    const footer = `${options.blind ? "" : `${sheet.student_name} · `}${i + 1}/${pages.length}`;
    const { canvas, markersUsed } = renderPage(img, qs, {
      totalText: i === 0 ? totalText : null, footer, sheetNotes: i === 0 ? notes : [], firstMarker: nextMarker,
    });
    nextMarker += markersUsed;
    addCanvas(canvas);
  }
  for (const c of renderSummary(sheet, r.graded_questions || [], totalText, options.blind, session.title)) addCanvas(c);

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
