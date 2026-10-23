// src/components/student/UploadAttempts.tsx
// Upload an answer copy (several photos / PDFs, one attempt) + the attempt history, for one assignment.
// Used by the portal's assignment page (/student) and the shared link page (/s/:token).
// Every call is an anon RPC keyed by the access code (src/lib/uploadFlow.ts); nothing here trusts the browser
// for identity — the ids are only used to build the upload path, which the storage policy re-checks.
// Pages go straight to Storage with per-file progress; picked pages + uploaded paths survive a refresh
// (localStorage draft + IndexedDB blobs), so after a drop only the missing files are uploaded.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  type Attempt, type CreateResult, type LinkInfo, attemptKey, clearAttemptKey, createSubmission, fmtCountdown, fmtIST,
  getAssignmentLink, mySubmissions, preparePage, sha256Hex, stateMessage,
} from "@/lib/uploadFlow";
import { ACCEPT_ATTR, rotateJpeg90 } from "@/lib/uploadLink/files";
import { type DraftItem, clearDraft, loadDraft, pendingUploads, resumeItems, saveDraft, totalPages } from "@/lib/uploadLink/session";
import { deleteBlob, deleteBlobs, getBlob, putBlob } from "@/lib/uploadLink/blobStore";
import { uploadPath, uploadWithProgress } from "@/lib/uploadLink/storageUpload";
import { needsPolling, studentBadge } from "@/lib/uploadLink/status";
import { useOnline } from "@/hooks/useUploadLinkTimers";
import { fileErrorText, rejectText, warningText } from "@/lib/uploadLink/messages";


export type UploadTokens = {
  bg: string; surface: string; border: string; textPrimary: string; textSecondary: string; textMuted: string;
  accent: string; accentHover: string; accentBg: string; teal: string; tealBg: string;
};

type Notice = { text: string; tone: "error" | "ok" | "info"; until?: number };

const POLL_MS = 10_000;
const BADGE: Record<string, { bg: string; fg: string }> = {
  amber: { bg: "rgba(245,158,11,0.15)", fg: "#B45309" }, blue: { bg: "rgba(59,130,246,0.15)", fg: "#1D4ED8" },
  slate: { bg: "rgba(100,116,139,0.15)", fg: "#475569" }, red: { bg: "rgba(239,68,68,0.12)", fg: "#DC2626" },
  green: { bg: "rgba(34,197,94,0.15)", fg: "#15803D" },
};

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

export default function UploadAttempts({ code, assignmentRef, student, t, onChange }: {
  code: string;
  assignmentRef: string;                              // link token or assignment id
  student: { id: string; institute_id: string };
  t: UploadTokens;
  onChange?: () => void;
}) {
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [items, setItems] = useState<DraftItem[]>([]);
  const itemsRef = useRef<DraftItem[]>([]);
  const blobs = useRef(new Map<string, Blob>());
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [pickErrors, setPickErrors] = useState<string[]>([]);
  const [processing, setProcessing] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [openResult, setOpenResult] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const online = useOnline();
  const now = useNow(!!notice?.until);

  const asg = link?.assignment;
  const assignmentId = asg?.id;
  const commit = (next: DraftItem[]) => { itemsRef.current = next; setItems(next); };
  const addThumb = (id: string, blob: Blob, mime: string) => {
    if (mime.startsWith("image/")) setThumbs(x => ({ ...x, [id]: URL.createObjectURL(blob) }));
  };

  const refresh = useCallback(async () => {
    try {
      const l = await getAssignmentLink(assignmentRef, code);
      setLink(l);
      if (l.student?.state === "locked") {
        setNotice({ text: stateMessage(l.student), tone: "error", until: Date.now() + (l.student.retry_after_sec || 60) * 1000 });
      }
      const id = l.assignment?.id;
      if (!id || l.student?.state !== "ok") return;
      const h = await mySubmissions(code, id);
      if (h.state === "ok") {
        setAttempts(h.attempts || []);
        setAttemptsLeft(h.attempts_left ?? null);
      } else if (h.state === "locked") {
        setNotice({ text: stateMessage(h), tone: "error", until: Date.now() + (h.retry_after_sec || 60) * 1000 });
      }
    } catch (e: any) {
      setNotice({ text: e.message, tone: "error" });
    } finally {
      setHistoryLoading(false);
    }
  }, [assignmentRef, code]);

  useEffect(() => { refresh(); }, [refresh]);

  // Anon can't use Realtime: poll every 10 s, only while the tab is visible and an attempt can still change
  const polling = needsPolling(attempts);
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", tick);
    const id = polling ? window.setInterval(tick, POLL_MS) : undefined;
    return () => { window.removeEventListener("focus", tick); if (id) window.clearInterval(id); };
  }, [refresh, polling]);

  // countdown finished → the message goes away and the student can try again
  useEffect(() => {
    if (notice?.until && now >= notice.until) {
      setNotice(null);
      refresh();
    }
  }, [now, notice, refresh]);

  // resume a draft (pages picked / uploaded before a refresh or network drop)
  useEffect(() => {
    if (!assignmentId) return;
    let cancelled = false;
    (async () => {
      const draft = loadDraft(assignmentId, code);
      for (const it of draft) {
        const b = await getBlob(it.id);
        if (cancelled) return;
        if (b) { blobs.current.set(it.id, b); addThumb(it.id, b, it.mime); }
      }
      const { kept, lost } = resumeItems(draft, id => blobs.current.has(id));
      if (cancelled) return;
      commit(kept);
      if (kept.length) setNotice({ text: `Your last upload was saved: ${kept.filter(i => i.path).length} of ${kept.length} pages uploaded. Tap Submit.`, tone: "info" });
      if (lost) setPickErrors([`${lost} page${lost === 1 ? "" : "s"} couldn't be restored — add ${lost === 1 ? "it" : "them"} again.`]);
    })();
    return () => { cancelled = true; };
  }, [assignmentId, code]);

  useEffect(() => { if (assignmentId) saveDraft(assignmentId, code, items); }, [items, assignmentId, code]);
  useEffect(() => () => { Object.values(thumbs).forEach(u => URL.revokeObjectURL(u)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const linkClosed = link && !["open", "open_late"].includes(link.state);
  // locked → shown as the countdown notice below; the other states can't be fixed by waiting
  const studentBlocked = link?.student && !["ok", "locked"].includes(link.student.state);
  const noAttemptsLeft = attemptsLeft !== null && attemptsLeft <= 0;
  const locked = !!notice?.until && now < notice.until;
  const canUpload = !!asg && !linkClosed && link?.student?.state === "ok" && !noAttemptsLeft;
  const pageCount = totalPages(items);
  const overPages = !!asg && pageCount > asg.max_pages;

  async function addFiles(list: FileList | null) {
    if (!list || !asg) return;
    const files = Array.from(list);
    setPickErrors([]);
    setProcessing(n => n + files.length);
    const errs: string[] = [];
    for (const f of files) {
      try {
        const p = await preparePage(f, asg.allowed_mimes, asg.max_mb);
        const sha = await sha256Hex(p.blob);
        if (itemsRef.current.some(i => i.sha256 === sha)) { errs.push(`${f.name}: this page is already added`); continue; }
        const id = crypto.randomUUID();
        blobs.current.set(id, p.blob);
        await putBlob(id, p.blob);
        addThumb(id, p.blob, p.mime);
        commit([...itemsRef.current, { id, name: f.name, mime: p.mime, ext: p.ext, size: p.size, sha256: sha,
                                       pages: p.pages, warning: p.warning, path: null }]);
      } catch (e: any) {
        errs.push(e.message || `${f.name}: couldn't open this file`);
      } finally {
        setProcessing(n => n - 1);
      }
    }
    setPickErrors(errs);
  }

  async function rotate(it: DraftItem) {
    const blob = blobs.current.get(it.id);
    if (!blob || !it.mime.startsWith("image/")) return;
    const out = await rotateJpeg90(blob);
    const sha = await sha256Hex(out);
    const id = crypto.randomUUID();
    blobs.current.set(id, out);
    await putBlob(id, out);
    addThumb(id, out, "image/jpeg");
    // new bytes → new file: new sha256 and a fresh upload
    commit(itemsRef.current.map(i => i.id === it.id
      ? { ...i, id, mime: "image/jpeg", ext: "jpg", size: out.size, sha256: sha, path: null } : i));
    blobs.current.delete(it.id);
    deleteBlob(it.id);
  }

  function remove(it: DraftItem) {
    commit(itemsRef.current.filter(i => i.id !== it.id));
    blobs.current.delete(it.id);
    deleteBlob(it.id);
    setFailed(f => { const n = { ...f }; delete n[it.id]; return n; });
  }

  async function uploadOne(it: DraftItem): Promise<boolean> {
    if (!assignmentId) return false;
    const blob = blobs.current.get(it.id) ?? (await getBlob(it.id));
    if (!blob) { setFailed(f => ({ ...f, [it.id]: "This page is no longer on the phone. Add it again." })); return false; }
    const path = uploadPath(student.institute_id, assignmentId, student.id, it.ext);
    setFailed(f => { const n = { ...f }; delete n[it.id]; return n; });
    setProgress(p => ({ ...p, [it.id]: 0 }));
    try {
      await uploadWithProgress(path, blob, it.mime, pct => setProgress(p => ({ ...p, [it.id]: pct })));
      commit(itemsRef.current.map(i => (i.id === it.id ? { ...i, path } : i)));
      return true;
    } catch (e: any) {
      setFailed(f => ({ ...f, [it.id]: e.message || "Upload failed." }));
      return false;
    }
  }

  async function uploadPending(): Promise<boolean> {
    const queue = pendingUploads(itemsRef.current);
    let ok = true;
    const worker = async () => {
      while (queue.length) {
        const it = queue.shift()!;
        if (!(await uploadOne(it))) ok = false;
      }
    };
    await Promise.all([worker(), worker()]);       // 2 at a time — kind to slow 4G
    return ok;
  }

  function showResult(r: CreateResult) {
    const until = r.retry_after_sec ? Date.now() + r.retry_after_sec * 1000 : undefined;
    setNotice({ text: stateMessage(r), tone: "error", until });
  }

  async function submit() {
    if (!asg || !assignmentId || busyRef.current) return;            // double tap → one call
    if (!itemsRef.current.length) { setNotice({ text: "Add the pages of your answer copy first.", tone: "error" }); return; }
    if (processing > 0) { setNotice({ text: "Preparing photos, one moment…", tone: "info" }); return; }
    if (!navigator.onLine) { setNotice({ text: "No internet. Tap Submit again when you're back online.", tone: "error" }); return; }
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    setWarnings([]);
    try {
      if (!(await uploadPending())) {
        setNotice({ text: "Some pages didn't upload. Tap Retry on them, then Submit.", tone: "error" });
        return;
      }
      const key = attemptKey(assignmentId, code);       // same key on every retry of this attempt
      const files = itemsRef.current.map((it, i) => ({ storage_path: it.path!, mime: it.mime, size: it.size,
                                                        sha256: it.sha256, page_order: i + 1 }));
      const r = await createSubmission(code, assignmentId, key, files);
      if (r.state === "created" || r.state === "replayed") {
        const ids = itemsRef.current.map(i => i.id);
        clearAttemptKey(assignmentId, code);
        clearDraft(assignmentId, code);
        commit([]);
        Object.values(thumbs).forEach(u => URL.revokeObjectURL(u));
        setThumbs({});
        setProgress({});
        deleteBlobs(ids);
        setWarnings((r.warnings || []).map(w => warningText(w)));
        setNotice({ text: `✅ ${r.submission?.label || "Upload"} submitted. Your teacher will share the result after checking.`, tone: "ok" });
        await refresh();
        onChange?.();
      } else if (r.state === "invalid_files") {
        const byIndex = new Map((r.errors || []).map(e => [e.index, fileErrorText(e, asg.max_mb)]));
        // a file the server refused is uploaded again (new name) on the next try
        commit(itemsRef.current.map((x, i) => (byIndex.has(i + 1) ? { ...x, path: null } : x)));
        setFailed(f => {
          const n = { ...f };
          itemsRef.current.forEach((x, i) => { if (byIndex.has(i + 1)) n[x.id] = byIndex.get(i + 1)!; });
          return n;
        });
        setNotice({ text: (r.errors || []).map(e => fileErrorText(e, asg.max_mb)).join(" "), tone: "error" });
      } else {
        showResult(r);
        if (["max_attempts", "closed", "inactive", "not_found"].includes(r.state)) refresh();
      }
    } catch (e: any) {
      setNotice({ text: e.message || "Upload failed. Tap Submit again.", tone: "error" });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = itemsRef.current.findIndex(i => i.id === e.active.id);
    const to = itemsRef.current.findIndex(i => i.id === e.over!.id);
    if (from >= 0 && to >= 0) commit(arrayMove(itemsRef.current, from, to));
  }

  const done = items.filter(i => i.path).length;
  const overall = items.length ? Math.round(items.reduce((s, i) => s + (i.path ? 100 : progress[i.id] || 0), 0) / items.length) : 0;
  const uploading = busy && done < items.length;
  const noticeText = notice ? notice.text.replace("{countdown}", fmtCountdown(((notice.until || now) - now) / 1000)) : "";
  const toneStyle = (tone: Notice["tone"]) => tone === "ok"
    ? { background: t.tealBg, color: t.teal, borderColor: `${t.teal}30` }
    : tone === "info" ? { background: t.accentBg, color: t.accent, borderColor: `${t.accent}30` }
      : { background: "rgba(239,68,68,0.08)", color: "#DC2626", borderColor: "rgba(239,68,68,0.3)" };

  if (!link) return <p className="text-sm" style={{ color: t.textMuted }}>Loading…</p>;

  return (
    <div className="space-y-4">
      {!online && (
        <div role="status" className="rounded-lg border px-3 py-2 text-sm font-semibold" style={toneStyle("error")} data-testid="offline">
          📵 No internet — upload paused
        </div>
      )}

      {/* Rules */}
      {asg && (
        <div className="rounded-lg border p-3 text-xs sm:text-sm space-y-1" style={{ background: t.bg, borderColor: t.border, color: t.textSecondary }}>
          {asg.instructions && <p style={{ color: t.textPrimary }}>{asg.instructions}</p>}
          <p>
            {asg.closes_at ? <>Deadline: <b>{fmtIST(asg.closes_at)}</b> · </> : null}
            Max {asg.max_pages} pages · max {Math.min(asg.max_mb, 10)} MB per file · PDF or photos (JPG/PNG/WEBP/HEIC)
            · {asg.max_attempts} attempt{asg.max_attempts > 1 ? "s" : ""}
            {asg.max_attempts > 1 ? ` (your ${asg.count_policy === "best" ? "best" : "latest"} upload counts)` : ""}
          </p>
          {link.question_paper?.file_url && (
            <a href={link.question_paper.file_url} target="_blank" rel="noreferrer" className="font-medium underline" style={{ color: t.teal }}>
              View question paper
            </a>
          )}
        </div>
      )}

      {link.state === "open_late" && (
        <div className="rounded-lg border px-3 py-2 text-sm" style={toneStyle("info")} data-testid="late-warning">
          ⚠️ The deadline has passed. You can still upload, but it will be marked <b>late</b>.
        </div>
      )}
      {(linkClosed || studentBlocked) && (
        <div className="rounded-lg border px-3 py-2 text-sm" style={toneStyle("error")}>
          {stateMessage(studentBlocked ? { state: link.student!.state }
                                       : { state: link.state, opens_at: asg?.opens_at, closes_at: asg?.closes_at })}
        </div>
      )}
      {noAttemptsLeft && !linkClosed && (
        <div className="rounded-lg border px-3 py-2 text-sm" style={toneStyle("info")}>
          You've used all your attempts. See their status below.
        </div>
      )}

      {/* Picker + pages */}
      {canUpload && asg && (
        <div className="space-y-2" ref={pickerRef} data-testid="upload-panel">
          <div className="flex items-center justify-between text-xs" style={{ color: overPages ? "#DC2626" : t.textMuted }}>
            <span>To reorder, press and drag a page</span>
            <b data-testid="page-counter">{pageCount}/{asg.max_pages} pages</b>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => cameraRef.current?.click()} disabled={busy}
              className="py-3 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accentHover})` }}>
              📷 Take photo
            </button>
            <button type="button" onClick={() => galleryRef.current?.click()} disabled={busy}
              className="py-3 rounded-lg border text-sm font-semibold disabled:opacity-50"
              style={{ borderColor: t.border, color: t.accent, background: t.surface }}>
              🖼️ Gallery / PDF
            </button>
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple className="hidden" data-testid="camera-input"
            onChange={async e => { await addFiles(e.target.files); e.target.value = ""; }} />
          <input ref={galleryRef} type="file" accept={ACCEPT_ATTR} multiple className="hidden" data-testid="gallery-input"
            onChange={async e => { await addFiles(e.target.files); e.target.value = ""; }} />

          {processing > 0 && <p className="text-xs" style={{ color: t.textMuted }}>Preparing photos…</p>}
          {pickErrors.length > 0 && (
            <ul className="space-y-0.5" role="alert" data-testid="pick-errors">
              {pickErrors.map((e, i) => <li key={i} className="text-xs sm:text-sm text-red-600">✗ {e}</li>)}
            </ul>
          )}

          {items.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={items.map(i => i.id)} strategy={rectSortingStrategy}>
                <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2" data-testid="thumbs">
                  {items.map((it, i) => (
                    <Thumb key={it.id} item={it} index={i} url={thumbs[it.id]} progress={progress[it.id]} error={failed[it.id]}
                      busy={busy} t={t} onRotate={() => rotate(it)} onDelete={() => remove(it)} onRetry={() => uploadOne(it)} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}

          {uploading && (
            <div data-testid="overall-progress">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: t.border }}>
                <div className="h-full" style={{ width: `${overall}%`, background: t.accent }} />
              </div>
              <p className="text-xs mt-1" style={{ color: t.textMuted }}>{done} of {items.length} uploaded ({overall}%)</p>
            </div>
          )}
          {overPages && <p className="text-xs text-red-600">Max {asg.max_pages} pages allowed — remove some pages.</p>}

          <button onClick={submit} disabled={busy || locked || !items.length || overPages || processing > 0} data-testid="submit-btn"
            className="w-full py-3 rounded-lg text-white font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
            style={{ background: busy || locked ? "#94A3B8" : `linear-gradient(135deg, ${t.accent}, ${t.accentHover})` }}>
            {busy ? (uploading ? "Uploading…" : "Submitting…") : `Submit (${items.length} file${items.length === 1 ? "" : "s"})`}
          </button>
          {attemptsLeft !== null && <p className="text-center text-xs" style={{ color: t.textMuted }} data-testid="attempts-left">{attemptsLeft} attempt{attemptsLeft === 1 ? "" : "s"} left</p>}
        </div>
      )}

      {notice && (
        <div role="status" className="rounded-lg border px-3 py-2 text-sm" style={toneStyle(notice.tone)} data-testid="notice">{noticeText}</div>
      )}
      {warnings.map((w, i) => (
        <div key={i} className="rounded-lg border px-3 py-2 text-xs" style={toneStyle("info")} data-testid="dup-warning">⚠️ {w}</div>
      ))}

      {/* History */}
      {historyLoading && !attempts.length && link.student?.state === "ok" && (
        <p className="text-xs" style={{ color: t.textMuted }}>Loading your uploads…</p>
      )}
      {!historyLoading && !attempts.length && link.student?.state === "ok" && (
        <p className="text-xs text-center" style={{ color: t.textMuted }} data-testid="history-empty">No uploads yet.</p>
      )}
      {attempts.length > 0 && (
        <div data-testid="history">
          <h4 className="text-sm font-semibold mb-2" style={{ color: t.textSecondary }}>Your uploads</h4>
          <ul className="space-y-2">
            {attempts.map(a => {
              const b = studentBadge(a.status);
              return (
                <li key={a.id} className="rounded-lg border p-3 text-sm" style={{ borderColor: t.border, background: t.bg }} data-testid="attempt">
                  <div className="flex flex-wrap items-center gap-2">
                    <b style={{ color: t.textPrimary }}>{a.label}</b>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" data-testid="attempt-status"
                      style={{ background: BADGE[b.tone].bg, color: BADGE[b.tone].fg }}>{b.label}</span>
                    {a.is_late && <span className="rounded px-1.5 text-[11px] bg-amber-100 text-amber-700">late</span>}
                    {a.counts && <span className="rounded px-1.5 text-[11px]" style={{ background: t.tealBg, color: t.teal }}>counts</span>}
                  </div>
                  <p className="mt-0.5 text-xs" style={{ color: t.textMuted }}>
                    {a.submitted_at ? fmtIST(a.submitted_at) : ""} · {a.files.length} file
                  </p>
                  {a.status === "rejected" && (
                    <div className="mt-1 space-y-1">
                      <ul className="list-disc pl-5 text-xs text-red-600">
                        {(a.reject_reasons?.length ? a.reject_reasons : [{ code: "bad_file" }])
                          .map((r, i) => <li key={i}>{rejectText(r)}</li>)}
                      </ul>
                      {canUpload && (
                        <button className="rounded-md px-2.5 py-1 text-xs font-semibold text-white bg-red-600"
                          onClick={() => pickerRef.current?.scrollIntoView({ behavior: "smooth" })}>Upload again</button>
                      )}
                    </div>
                  )}
                  {a.status === "published" && a.result && (
                    <>
                      <p className="mt-1">Marks: <b style={{ color: t.teal }} data-testid="result-marks">{a.result.marks} / {a.result.max_marks}</b>
                        {a.result.percentage != null && <span className="text-xs" style={{ color: t.textMuted }}> ({a.result.percentage}%)</span>}</p>
                      {a.result.feedback && <p className="mt-1 text-xs" style={{ color: t.textPrimary }}>💬 {a.result.feedback}</p>}
                      {a.result.per_question?.length > 0 && (
                        <button className="mt-1 text-xs underline" style={{ color: t.accent }} data-testid="result-toggle"
                          onClick={() => setOpenResult(openResult === a.id ? null : a.id)}>
                          {openResult === a.id ? "Hide marks per question" : "Show marks per question"}
                        </button>
                      )}
                      {openResult === a.id && (
                        <>
                          <table className="mt-2 w-full text-xs" data-testid="result-view">
                            <tbody>
                              {a.result.per_question.map(q => (
                                <tr key={q.q_no} className="border-t align-top" style={{ borderColor: t.border, opacity: q.counted ? 1 : 0.5 }}>
                                  <td className="py-1 pr-2 font-semibold">Q{q.q_no}</td>
                                  <td className="py-1 pr-2 whitespace-nowrap">{q.not_attempted ? "—" : q.marks} / {q.max_marks}</td>
                                  <td className="py-1" style={{ color: t.textSecondary }}>
                                    {q.not_attempted ? "Not attempted" : q.feedback}{!q.counted && " (not counted)"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <p className="mt-1 text-[11px]" style={{ color: t.textMuted }}>
                            {a.is_late ? "This upload was late. " : ""}
                            {asg?.count_policy === "best" ? "Your best-scoring upload counts." : "Your latest upload counts."}
                          </p>
                        </>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Thumb({ item, index, url, progress, error, busy, t, onRotate, onDelete, onRetry }: {
  item: DraftItem; index: number; url?: string; progress?: number; error?: string; busy: boolean; t: UploadTokens;
  onRotate: () => void; onDelete: () => void; onRetry: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: busy });
  return (
    <li ref={setNodeRef} data-testid="thumb" className="relative rounded-lg border overflow-hidden"
      style={{ transform: CSS.Transform.toString(transform), transition, borderColor: error ? "#DC2626" : t.border,
               background: t.surface, zIndex: isDragging ? 10 : undefined }}>
      <div className="relative aspect-[3/4] touch-none" {...attributes} {...listeners} aria-label={`Page ${index + 1}`}>
        {url ? <img src={url} alt={`Page ${index + 1}`} className="h-full w-full object-cover" />
          : <div className="flex h-full flex-col items-center justify-center p-1 text-center text-[10px]" style={{ color: t.textMuted }}>
              <span className="text-2xl">📄</span>
              <span className="line-clamp-2 break-all">{item.name}</span>
              {item.pages > 1 && <b>{item.pages} pages</b>}
            </div>}
        <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[11px] font-bold text-white">{index + 1}</span>
        {item.path && <span className="absolute right-1 bottom-1 rounded-full bg-green-600 px-1.5 text-[11px] text-white" aria-label="Uploaded">✓</span>}
        {!item.path && progress != null && progress < 100 && !error && (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/30"><div className="h-full" style={{ width: `${progress}%`, background: t.accent }} /></div>
        )}
      </div>
      {item.warning && <p className="bg-amber-100 px-1 py-0.5 text-[10px] text-amber-800">⚠️ {item.warning}</p>}
      {error && (
        <div className="bg-red-50 p-1 space-y-1">
          <p className="text-[10px] text-red-700">{error}</p>
          <button type="button" onClick={onRetry}
            className="w-full rounded bg-red-600 py-1 text-[11px] font-semibold text-white">Retry</button>
        </div>
      )}
      <div className="flex border-t" style={{ borderColor: t.border }}>
        <button type="button" onClick={onRotate} disabled={busy || !item.mime.startsWith("image/")} aria-label="Rotate 90°"
          className="flex-1 py-1.5 text-sm disabled:opacity-30" style={{ color: t.textSecondary }}>↻</button>
        <button type="button" onClick={onDelete} disabled={busy} aria-label="Remove"
          className="flex-1 py-1.5 text-sm text-red-600 disabled:opacity-30">✕</button>
      </div>
    </li>
  );
}
