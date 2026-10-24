// src/components/contest/ImportContestFromPdf.tsx
// "Create contest from PDF": PDF → Storage → backend parse job → teacher reviews / fixes → the existing
// CreateContestModal (configure → share). Used on /dashboard/test-generator?tab=contest-pdf (/contests links there).
// {jobId, storagePath, startedAt} (and later the reviewed draft) live in sessionStorage, so a refresh resumes.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, FileText, Loader2, Pencil, Plus, Trash2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import MathText from "@/components/MathText";
import LoginModal from "@/components/LoginModal";
import { CreateContestModal } from "./CreateContestModal";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/providers/AuthProvider";
import { useGuestAccess } from "@/hooks/useGuestAccess";
import {
  ImportError, MAX_PDF_MB, answerLabel, getPdfImportJob, isImportMock, retryImport, startPdfImport, uploadImportPdf, warningText,
  type ImportJob, type ImportResult, type ImportWarning, type ImportedQuestion,
} from "@/lib/contestImportApi";

const STORE_KEY = "a4ai_contest_pdf_import";
const POLL_MS = 2000;
const MAX_POLL_ERRORS = 5;
const MAX_WAIT_MS = 6 * 60 * 1000;
const MAX_OPTIONS = 4;
const SUSPECT_CODES = new Set(["KEY_MISMATCH_SUSPECT", "KEY_GRID_MISMATCH", "KEY_TEXT_MISMATCH"]);
const LABELS = ["A", "B", "C", "D"];

type Item = { uid: string; q: ImportedQuestion; warnings: ImportWarning[]; checked: boolean; edited: boolean };
type Meta = Omit<ImportResult, "questions" | "warnings"> & { warnings: ImportWarning[] };
type Stored = { storagePath: string; fileName: string; jobId?: string | null; startedAt?: number; draft?: { meta: Meta; items: Item[] } };
type Phase = "pick" | "uploading" | "starting" | "processing" | "review" | "failed";
/** what the failed screen offers: re-POST the same path, resume polling, re-upload the same File,
 *  pick the same file again (the File is gone after a refresh), or only a new file */
type Failure = { message: string; action: "repost" | "repoll" | "reupload" | "repick" | "new" };

function readStore(): Stored | null {
  try { const raw = sessionStorage.getItem(STORE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function writeStore(v: Stored | null) {
  try {
    if (v) sessionStorage.setItem(STORE_KEY, JSON.stringify(v));
    else sessionStorage.removeItem(STORE_KEY);
  } catch { /* private mode */ }
}

/** New answer in the same style the paper used (backend sends bare "B"; "B) text" stays "label) text"). */
function answerFor(prev: string, opt: { label: string; text: string }): string {
  const p = prev.trim();
  return !p || /^\(?[A-Ha-h]\)?$/.test(p) ? opt.label : `${opt.label}) ${opt.text}`;
}

function toItems(result: ImportResult): { meta: Meta; items: Item[] } {
  const { questions, warnings = [], ...rest } = result;
  // warning.question = the paper's source_number (position only if the parser sent no numbers)
  const bySource = questions.some((q) => q.source_number != null);
  const items: Item[] = questions.map((q, i) => {
    const num = bySource ? String(q.source_number ?? "") : String(i + 1);
    return {
      uid: `q${i}-${Math.random().toString(36).slice(2, 8)}`,
      q: { ...q, options: q.options || [], correct_answer: q.correct_answer || "" },
      warnings: warnings.filter((w) => w.question != null && String(w.question) === num),
      checked: false,
      edited: false,
    };
  });
  const general = warnings.filter((w) => !items.some((it) => it.warnings.includes(w)));
  return { meta: { ...rest, warnings: general }, items };
}

const isMcq = (q: ImportedQuestion) => q.options.length > 0 || /mcq/i.test(q.question_type || "");
const hasAnswer = (it: Item) => !!it.q.correct_answer?.trim();
function isComplete(q: ImportedQuestion): boolean {
  if (!q.question_text.trim()) return false;
  if (!isMcq(q)) return !!q.correct_answer.trim();
  const filled = q.options.filter((o) => o.text.trim());
  const label = answerLabel(q.correct_answer, q.options);
  return filled.length >= 2 && !!label && filled.some((o) => o.label.toUpperCase() === label);
}
const needsFix = (it: Item) => it.q.usable === false && !(it.edited && isComplete(it.q));
const needsCheck = (it: Item) =>
  !it.checked && (it.q.answer_source === "ai" || it.q.answer_source === "missing" || it.warnings.some((w) => SUSPECT_CODES.has(w.code)));

const asClassLabel = (c: string) => {
  const t = (c || "").trim();
  return /^(\d{1,2}|[ivx]{1,4})$/i.test(t) ? `Class ${t.toUpperCase()}` : t;
};
const clampDuration = (m?: number | null) => (m && m > 0 ? Math.min(180, Math.max(5, Math.round(m))) : 30);
const mmss = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

function statusText(phase: Phase, job: ImportJob | null, elapsedMs: number): string {
  if (phase === "uploading") return "Uploading PDF…";
  if (phase === "starting") return "Sending to the reader…";
  if (!job || job.status === "queued") return "Waiting in line…";
  if (elapsedMs > 150_000) return "Taking a bit longer than usual — still working…";
  const p = job.progress ?? 0;
  if (p < 20) return "Reading paper…";
  if (p < 50) return "Finding questions and options…";
  if (p < 80) return "Matching answer key…";
  return "Double-checking answers…";
}

export default function ImportContestFromPdf() {
  const { role } = useAuth();
  const { gateAction, showLoginModal, setShowLoginModal } = useGuestAccess();
  const stored = useMemo(readStore, []);
  const [phase, setPhase] = useState<Phase>(stored?.draft ? "review" : stored?.jobId ? "processing" : stored ? "starting" : "pick");
  const [storagePath, setStoragePath] = useState<string | null>(stored?.storagePath ?? null);
  const [jobId, setJobId] = useState<string | null>(stored?.jobId ?? null);
  const [startedAt, setStartedAt] = useState<number>(stored?.startedAt ?? Date.now());
  const [fileName, setFileName] = useState(stored?.fileName ?? "");
  const [job, setJob] = useState<ImportJob | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [now, setNow] = useState(Date.now());
  const [meta, setMeta] = useState<Meta | null>(stored?.draft?.meta ?? null);
  const [items, setItems] = useState<Item[]>(stored?.draft?.items ?? []);
  const [editing, setEditing] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saveToHistory, setSaveToHistory] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  /** the chosen PDF — lets "Try again" upload it again if the stored copy is gone (lost on refresh) */
  const [file, setFile] = useState<File | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const fail = (message: string, action: Failure["action"]) => { setFailure({ message, action }); setPhase("failed"); };

  const startedJob = (id: string, path: string, name: string) => {
    const t = Date.now();
    writeStore({ storagePath: path, fileName: name, jobId: id, startedAt: t });
    setStoragePath(path); setJob(null); setStartedAt(t); setNow(t); setJobId(id);
    setPhase("processing");
  };
  const startFailed = (e: any) => {
    const kind = e instanceof ImportError ? e.kind : "OTHER";
    // limit / login: retrying now can't help. A bad path goes through retryImport (re-upload) on "Try again".
    const hopeless = kind === "LIMIT" || kind === "AUTH";
    if (hopeless) writeStore(null);
    setFailure({ message: e?.message || "Could not start reading the PDF.", action: hopeless ? "new" : "repost" });
    setPhase("failed");
  };

  // POST the storage path → job id.
  const begin = useCallback(async (path: string, name: string) => {
    setPhase("starting");
    setFailure(null);
    try {
      const id = await startPdfImport(path);
      if (alive.current) startedJob(id, path, name);
    } catch (e: any) {
      if (alive.current) startFailed(e);
    }
  }, []);

  // "Try again": the SAME path; if the backend says it's gone, the File in memory goes up again to a new path.
  const repost = async (path: string) => {
    setPhase("starting");
    setFailure(null);
    try {
      const r = await retryImport(path, file);
      if (!alive.current) return;
      if ("needFile" in r) {
        fail("The uploaded copy of this PDF has expired. Choose the same file again to continue.", "repick");
        return;
      }
      startedJob(r.jobId, r.path, file?.name || fileName);
    } catch (e: any) {
      if (alive.current) startFailed(e);
    }
  };

  // refresh between "uploaded" and "job created" → create the job for the stored path
  useEffect(() => {
    if (phase === "starting" && stored?.storagePath && !stored.jobId) begin(stored.storagePath, stored.fileName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the reviewed draft across refreshes
  useEffect(() => {
    if (phase === "review" && storagePath && meta) writeStore({ storagePath, fileName, jobId, draft: { meta, items } });
  }, [phase, storagePath, jobId, fileName, meta, items]);

  // elapsed clock — a 1–2 minute parse must not look stuck
  useEffect(() => {
    if (phase !== "processing" && phase !== "starting") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // poll every 2 s; stops on done / failed / 404 / 6 minutes / unmount
  useEffect(() => {
    if (phase !== "processing" || !jobId) return;
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let errors = 0;
    const stop = (message: string, action: Failure["action"]) => { setFailure({ message, action }); setPhase("failed"); };
    const tick = async () => {
      if (Date.now() - startedAt > MAX_WAIT_MS) {
        stop("This is taking much longer than it should (over 6 minutes).", "repost");
        return;
      }
      try {
        const j = await getPdfImportJob(jobId, ctrl.signal);
        if (ctrl.signal.aborted) return;
        errors = 0;
        setJob(j);
        if (j.status === "done") {
          if (!j.result?.questions?.length) {
            writeStore(null);
            stop("No questions were found in this PDF. Is it a scanned image or an empty file?", "new");
            return;
          }
          const draft = toItems(j.result);
          setMeta(draft.meta);
          setItems(draft.items);
          setPhase("review");
          return;
        }
        if (j.status === "failed") {
          if (!j.retryable) writeStore(null);
          stop(j.error || "We could not read this PDF.", j.retryable ? "repost" : "new");
          return;
        }
      } catch (e: any) {
        if (ctrl.signal.aborted) return;
        if (e instanceof ImportError && (e.kind === "NOT_FOUND" || e.kind === "AUTH")) {
          writeStore(null);
          stop(e.message, "new");
          return;
        }
        if (++errors >= MAX_POLL_ERRORS) {
          stop(/fetch|network/i.test(e?.message || "") ? "No connection to the server. Check your internet and try again." : e?.message || "Could not check the import.", "repoll");
          return;   // keep the job: "Try again" resumes polling
        }
      }
      timer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => { ctrl.abort(); if (timer) clearTimeout(timer); };
  }, [phase, jobId, startedAt]);

  const reset = useCallback(() => {
    writeStore(null);
    setFile(null);
    setPhase("pick"); setStoragePath(null); setJobId(null); setJob(null); setFailure(null); setPickError(null);
    setMeta(null); setItems([]); setEditing(null); setCreatedLink(null); setFileName("");
  }, []);

  const upload = async (f: File) => {
    setFileName(f.name);
    setFailure(null);
    setPhase("uploading");
    try {
      const path = await uploadImportPdf(f);
      if (!alive.current) return;
      writeStore({ storagePath: path, fileName: f.name });
      setStoragePath(path);
      await begin(path, f.name);
    } catch (e: any) {
      if (!alive.current) return;
      fail(/fetch|network/i.test(e?.message || "") ? "Upload failed — check your internet and try again." : e?.message || "Upload failed.", "reupload");
    }
  };

  const handleFile = (f?: File) => {
    if (!f) return;
    setPickError(null);
    if (!(f.type === "application/pdf" || /\.pdf$/i.test(f.name))) { setPickError("Please choose a PDF file (.pdf)."); return; }
    if (f.size === 0) { setPickError("This file is empty."); return; }
    if (f.size > MAX_PDF_MB * 1024 * 1024) {
      setPickError(`This PDF is ${(f.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_PDF_MB} MB — try a smaller or compressed file.`);
      return;
    }
    if (!gateAction("create contest")) return;
    setFile(f);
    upload(f);
  };

  // Every retryable failure offers a way on: Try again (same path / polling / same File) or picking the file again.
  const retryAction = !failure ? null
    : failure.action === "repost" && storagePath ? "repost"
    : failure.action === "repost" || failure.action === "reupload" ? (file ? "reupload" : "repick")
    : failure.action === "repoll" && jobId ? "repoll"
    : failure.action === "repick" ? "repick" : null;
  const retry = () => {
    if (retryAction === "repost" && storagePath) repost(storagePath);
    else if (retryAction === "repoll") { setFailure(null); setPhase("processing"); }
    else if (retryAction === "reupload" && file) upload(file);
    else if (retryAction === "repick") fileInput.current?.click();
  };

  // ── review edits ──
  const update = (uid: string, patch: Partial<ImportedQuestion>, answerTouched = false) =>
    setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, q: { ...it.q, ...patch }, edited: true, checked: it.checked || answerTouched } : it)));

  const remove = (uid: string) => {
    const idx = items.findIndex((it) => it.uid === uid);
    if (idx < 0) return;
    const removed = items[idx];
    setItems((prev) => prev.filter((it) => it.uid !== uid));
    if (editing === uid) setEditing(null);
    toast("Question deleted", {
      action: { label: "Undo", onClick: () => setItems((prev) => { const next = [...prev]; next.splice(Math.min(idx, next.length), 0, removed); return next; }) },
    });
  };

  const totalMarks = items.reduce((s, it) => s + (Number(it.q.marks) || 0), 0);
  const toFix = items.filter(needsFix);
  const missing = items.filter((it) => !needsFix(it) && !hasAnswer(it));
  const toCheck = items.filter((it) => !needsFix(it) && hasAnswer(it) && needsCheck(it));
  const subject = meta?.subject?.trim() || "";
  const classGrade = meta?.class_grade?.trim() || "";
  const blockers = [
    items.length === 0 && "There are no questions left.",
    toFix.length > 0 && `${toFix.length} question${toFix.length > 1 ? "s need" : " needs"} fixing.`,
    missing.length > 0 && `${missing.length} question${missing.length > 1 ? "s have" : " has"} no correct answer.`,
    !subject && "Enter the subject.",
    !classGrade && "Enter the class.",
  ].filter(Boolean) as string[];
  const qNo = (it: Item) => items.indexOf(it) + 1;
  const jumpTo = (uid: string) => document.getElementById(`imp-${uid}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  const setMetaField = (k: "title" | "subject" | "class_grade", v: string) => setMeta((m) => (m ? { ...m, [k]: v } : m));

  const saveTestToHistory = async () => {
    if (!meta) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return;
    const testId = crypto.randomUUID();
    const { error: testErr } = await supabase.from("tests").insert({
      id: testId, teacher_id: user.id, exam_title: meta.title || "Imported test", board: meta.board || "CBSE",
      class_grade: asClassLabel(classGrade), subject, status: "saved",
      total_questions: items.length, total_marks: totalMarks, created_at: new Date().toISOString(),
      paper_date: new Date().toLocaleDateString("en-GB"), cbse_pattern: false,
    });
    if (testErr) { toast.warning("Contest created, but saving to Test History failed."); return; }
    const { error: qErr } = await supabase.from("questions").insert(items.map(({ q }, idx) => ({
      test_id: testId, text: q.question_text, options: q.options.map((o) => `${o.label}) ${o.text}`),
      correct_answer: q.correct_answer, explanation: q.explanation || "", marks: q.marks || 1,
      difficulty: (q.difficulty || "medium").toLowerCase(), chapter: q.chapter || "", topic: "",
      format: isMcq(q) ? "mcq" : "short_answer", position: idx + 1,
    })));
    if (qErr) toast.warning("Contest created, but its questions weren't saved to Test History.");
    else toast.success("Also saved in your Test History.");
  };

  if (role === "student") {
    return <div className="max-w-xl mx-auto rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">Only teachers can create contests.</div>;
  }

  const elapsed = now - startedAt;
  const inputCls = "mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-300";

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-black text-gray-900 leading-tight">Create contest from PDF</h2>
          <p className="text-xs text-gray-500">Upload a question paper — we read the questions and the answer key, you check and share.</p>
        </div>
        {isImportMock() && <span className="shrink-0 text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 rounded-full px-2 py-1">Mock</span>}
      </div>

      {/* ── 1. pick ── */}
      {phase === "pick" && (
        <>
          <div
            role="button" tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
            className={`rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center cursor-pointer transition-colors ${dragOver ? "border-gray-900 bg-gray-50" : "border-gray-300 bg-white"}`}
          >
            <UploadCloud size={36} className="mx-auto text-gray-400" />
            <p className="mt-3 text-sm font-bold text-gray-900">Tap to choose a PDF <span className="hidden sm:inline">or drop it here</span></p>
            <p className="mt-1 text-xs text-gray-500">PDF only · up to {MAX_PDF_MB} MB · answer key in the same PDF works best</p>
          </div>
          {pickError && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{pickError}</p>}
        </>
      )}
      <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" data-testid="pdf-input"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handleFile(f); }} />

      {/* ── 2. upload + processing ── */}
      {(phase === "uploading" || phase === "starting" || phase === "processing") && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-gray-400 shrink-0" />
            <p className="text-sm font-bold text-gray-900 truncate flex-1">{fileName || "Your PDF"}</p>
            <Loader2 size={18} className="animate-spin text-gray-500 shrink-0" />
          </div>
          <div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full bg-gray-900 transition-[width] duration-500"
                style={{ width: `${phase === "processing" ? Math.max(6, Math.min(100, job?.progress ?? 0)) : 3}%` }} />
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-gray-700">{statusText(phase, job, elapsed)}</p>
              {phase === "processing" && <p className="text-xs tabular-nums text-gray-400 shrink-0">{mmss(elapsed)}</p>}
            </div>
            <p className="mt-1 text-xs text-gray-500">This usually takes 1–2 minutes. You can leave this page — we'll pick up where you left off.</p>
          </div>
          <button onClick={() => { if (window.confirm("Stop and upload a different file?")) reset(); }} className="text-xs font-bold text-gray-500 underline">Cancel</button>
        </div>
      )}

      {/* ── failed ── */}
      {phase === "failed" && failure && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 space-y-3">
          <p className="text-sm font-bold text-red-800 flex items-start gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" /> {failure.message}</p>
          <div className="flex flex-wrap gap-2">
            {retryAction && (
              <button onClick={retry} className="px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold">
                {retryAction === "repick" ? "Choose the file again" : "Try again"}
              </button>
            )}
            <button onClick={reset} className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-800">Upload a different file</button>
          </div>
          {pickError && <p className="text-sm text-red-700">{pickError}</p>}
        </div>
      )}

      {/* ── 3. review ── */}
      {phase === "review" && meta && (
        <>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-black text-gray-900 break-words">
                  {[classGrade && asClassLabel(classGrade), subject].filter(Boolean).join(" — ") || "Imported paper"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{[meta.title, meta.institute, meta.board].filter(Boolean).join(" · ") || fileName}</p>
              </div>
              <button onClick={() => { if (window.confirm("Discard this paper and upload another?")) reset(); }}
                className="shrink-0 text-xs font-bold text-gray-500 underline">Start over</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="rounded-xl bg-gray-50 py-2"><p className="text-lg font-black text-gray-900">{items.length}</p><p className="text-[10px] font-bold uppercase text-gray-400">Questions</p></div>
              <div className="rounded-xl bg-gray-50 py-2"><p className="text-lg font-black text-gray-900">{totalMarks}</p><p className="text-[10px] font-bold uppercase text-gray-400">Marks</p></div>
              <div className="rounded-xl bg-gray-50 py-2"><p className="text-lg font-black text-gray-900">{clampDuration(meta.duration_minutes)}</p><p className="text-[10px] font-bold uppercase text-gray-400">Minutes</p></div>
              <div className={`rounded-xl py-2 ${meta.answer_key_found ? "bg-emerald-50" : "bg-amber-50"}`}>
                <p className={`text-lg font-black ${meta.answer_key_found ? "text-emerald-700" : "text-amber-700"}`}>
                  {meta.answer_key_found ? `${meta.answer_key_count}/${items.length}` : "No"}
                </p>
                <p className="text-[10px] font-bold uppercase text-gray-400">Answer key</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="block sm:col-span-3">
                <span className="text-xs font-bold text-gray-500">Contest title</span>
                <input value={meta.title || ""} onChange={(e) => setMetaField("title", e.target.value)} placeholder="e.g. Foreign Exchange Rate – MCQ test"
                  className={`${inputCls} border-gray-200`} />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-bold text-gray-500">Subject <span className="text-red-500">*</span></span>
                <input value={meta.subject || ""} onChange={(e) => setMetaField("subject", e.target.value)} placeholder="e.g. Economics"
                  className={`${inputCls} ${subject ? "border-gray-200" : "border-red-300"}`} />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-gray-500">Class <span className="text-red-500">*</span></span>
                <input value={meta.class_grade || ""} onChange={(e) => setMetaField("class_grade", e.target.value)} placeholder="e.g. XII"
                  className={`${inputCls} ${classGrade ? "border-gray-200" : "border-red-300"}`} />
              </label>
            </div>
          </div>

          {(meta.warnings.length > 0 || toFix.length + missing.length + toCheck.length > 0) && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
              <p className="text-sm font-bold text-amber-900 flex items-center gap-2"><AlertTriangle size={16} /> Please check before sharing</p>
              {([["Fix these questions", toFix, "text-red-700"], ["No correct answer", missing, "text-red-700"], ["Check the answer", toCheck, "text-amber-900"]] as const)
                .filter(([, list]) => list.length > 0).map(([label, list, cls]) => (
                  <p key={label} className={`text-xs ${cls}`}>{label}: {list.map((it) => (
                    <button key={it.uid} onClick={() => jumpTo(it.uid)} className="underline font-bold mr-1.5">Q{qNo(it)}</button>
                  ))}</p>
                ))}
              {meta.warnings.map((w, i) => <WarningLine key={i} w={w} />)}
            </div>
          )}

          <div className="space-y-3">
            {items.length === 0 && <p className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">All questions were deleted. Upload the PDF again to start over.</p>}
            {items.map((it, idx) => (
              <QuestionReviewCard key={it.uid} item={it} index={idx} editing={editing === it.uid}
                onEdit={() => setEditing(editing === it.uid ? null : it.uid)}
                onChange={(patch, answerTouched) => update(it.uid, patch, answerTouched)}
                onConfirm={() => setItems((prev) => prev.map((x) => (x.uid === it.uid ? { ...x, checked: true } : x)))}
                onDelete={() => remove(it.uid)} />
            ))}
          </div>

          {/* sticky actions */}
          <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 p-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
            <div className="max-w-3xl mx-auto space-y-2">
              {createdLink ? (
                <div className="flex gap-2">
                  <button onClick={() => setShowModal(true)} className="flex-1 py-3.5 rounded-2xl bg-emerald-600 text-white font-black text-sm">✓ Contest created — share again</button>
                  <button onClick={reset} className="px-4 py-3.5 rounded-2xl bg-gray-100 text-gray-800 font-bold text-sm">New PDF</button>
                </div>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                    <input type="checkbox" checked={saveToHistory} onChange={(e) => setSaveToHistory(e.target.checked)} className="h-4 w-4 accent-gray-900" />
                    Also save as test in my history
                  </label>
                  {blockers.length > 0 && <p className="text-xs font-semibold text-red-600">{blockers.join(" ")}</p>}
                  <button disabled={blockers.length > 0} onClick={() => { if (gateAction("create contest")) { setEditing(null); setShowModal(true); } }}
                    className="w-full py-4 rounded-2xl bg-gray-900 text-white font-black text-sm disabled:bg-gray-300">
                    Create contest · {items.length} questions{toCheck.length ? ` (${toCheck.length} unchecked)` : ""}
                  </button>
                </>
              )}
            </div>
          </div>

          {showModal && (
            <CreateContestModal
              isOpen={showModal}
              onClose={() => setShowModal(false)}
              questions={items.map((it) => it.q)}
              testTitle={meta.title?.trim() || `${subject} – ${asClassLabel(classGrade)}`}
              subject={subject}
              classGrade={asClassLabel(classGrade)}
              board={meta.board || undefined}
              initialDuration={clampDuration(meta.duration_minutes)}
              onCreated={(res) => {
                setCreatedLink(res.share_link);
                writeStore(null);
                if (saveToHistory) saveTestToHistory();
              }}
            />
          )}
        </>
      )}

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} action="share" onLoginSuccess={() => setShowLoginModal(false)} />
    </div>
  );
}

function WarningLine({ w }: { w: ImportWarning }) {
  const { title, detail } = warningText(w);
  return <p className="text-xs">• <span className="font-semibold">{title}</span>{detail && <span className="opacity-80"> — {detail}</span>}</p>;
}

// ═══════════════════════════════════════════════════════════
function QuestionReviewCard({ item, index, editing, onEdit, onChange, onConfirm, onDelete }: {
  item: Item; index: number; editing: boolean;
  onEdit: () => void;
  onChange: (patch: Partial<ImportedQuestion>, answerTouched?: boolean) => void;
  onConfirm: () => void;
  onDelete: () => void;
}) {
  const { q } = item;
  const correct = answerLabel(q.correct_answer, q.options);
  const fix = needsFix(item);
  const noAnswer = !hasAnswer(item);
  const flagged = needsCheck(item);
  const mcq = isMcq(q);
  const lines: ImportWarning[] = [
    ...item.warnings,
    ...(q.answer_source === "ai" && !item.warnings.some((w) => w.code === "AI_ANSWER") ? [{ question: null, code: "AI_ANSWER", message: "" }] : []),
  ];

  const setOptions = (options: { label: string; text: string }[], answer: string) => onChange({ options, correct_answer: answer });
  const removeOption = (oi: number) => {
    const kept = q.options.filter((_, i) => i !== oi);
    const options = kept.map((o, i) => ({ ...o, label: LABELS[i] || o.label }));
    const ni = correct ? kept.findIndex((o) => o.label.toUpperCase() === correct) : -1;
    setOptions(options, ni >= 0 ? answerFor(q.correct_answer, options[ni]) : "");
  };

  const badge = fix ? ["Fix this question", "bg-red-100 text-red-700"]
    : noAnswer ? ["No answer", "bg-red-100 text-red-700"]
    : flagged ? ["Check answer", "bg-amber-100 text-amber-800"]
    : item.checked || (item.edited && q.usable === false) ? ["Checked", "bg-emerald-100 text-emerald-700"] : null;

  return (
    <div id={`imp-${item.uid}`} className={`rounded-2xl border bg-white p-4 ${fix || noAnswer ? "border-red-300" : flagged ? "border-amber-300" : "border-gray-200"}`}>
      <div className="flex items-start gap-2">
        <span className="shrink-0 text-xs font-black text-gray-400 mt-0.5">Q{index + 1}</span>
        <div className="flex-1 min-w-0 flex flex-wrap gap-1.5">
          {q.difficulty && <span className="text-[10px] font-bold uppercase bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{q.difficulty}</span>}
          <span className="text-[10px] font-bold uppercase bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{q.marks} mark{q.marks === 1 ? "" : "s"}</span>
          {badge && <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${badge[1]}`}>{badge[0]}</span>}
        </div>
        <button onClick={onEdit} aria-label={editing ? "Done editing" : "Edit question"}
          className={`shrink-0 h-9 w-9 rounded-xl flex items-center justify-center ${editing ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
          {editing ? <Check size={16} /> : <Pencil size={15} />}
        </button>
        <button onClick={onDelete} aria-label="Delete question" className="shrink-0 h-9 w-9 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center"><Trash2 size={15} /></button>
      </div>

      {(fix || noAnswer || flagged) && (
        <div className={`mt-2 text-xs rounded-lg px-2.5 py-1.5 space-y-0.5 ${fix || noAnswer ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>
          {fix && <p className="font-semibold">This question wasn't read completely — edit it (text, at least 2 options and the correct answer) or delete it.</p>}
          {!fix && noAnswer && <p className="font-semibold">Pick the correct answer.</p>}
          {lines.map((w, i) => <WarningLine key={i} w={w} />)}
          {flagged && !fix && !noAnswer && !editing && <button onClick={onConfirm} className="font-bold underline">Answer is correct</button>}
        </div>
      )}

      {editing ? (
        <div className="mt-3 space-y-2">
          <textarea value={q.question_text} onChange={(e) => onChange({ question_text: e.target.value })} rows={3}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          {mcq ? (
            <>
              <p className="text-[11px] text-gray-400">Tap the letter next to the correct option.</p>
              {q.options.map((o, oi) => {
                const isRight = correct === o.label.toUpperCase();
                return (
                  <div key={oi} className="flex items-center gap-2">
                    <button onClick={() => onChange({ correct_answer: answerFor(q.correct_answer, o) }, true)} aria-label={`Mark ${o.label} correct`}
                      className={`shrink-0 h-9 w-9 rounded-full border-2 text-xs font-black ${isRight ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 text-gray-500"}`}>
                      {o.label}
                    </button>
                    <input value={o.text} placeholder={`Option ${o.label}`}
                      onChange={(e) => {
                        const options = q.options.map((x, xi) => (xi === oi ? { ...x, text: e.target.value } : x));
                        // a "label) text" answer follows the edited text; bare "B" stays as is
                        const answer = isRight && !/^\(?[A-Ha-h]\)?$/.test(q.correct_answer.trim()) ? `${o.label}) ${e.target.value}` : q.correct_answer;
                        setOptions(options, answer);
                      }}
                      className="flex-1 min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
                    <button onClick={() => removeOption(oi)} aria-label={`Remove option ${o.label}`} className="shrink-0 h-9 w-9 rounded-xl text-gray-400 flex items-center justify-center"><X size={15} /></button>
                  </div>
                );
              })}
              {q.options.length < MAX_OPTIONS && (
                <button onClick={() => setOptions([...q.options, { label: LABELS[q.options.length], text: "" }], q.correct_answer)}
                  className="text-xs font-bold text-gray-700 inline-flex items-center gap-1 py-1"><Plus size={14} /> Add option</button>
              )}
            </>
          ) : (
            <label className="block">
              <span className="text-xs font-bold text-gray-500">Correct answer</span>
              <textarea value={q.correct_answer} onChange={(e) => onChange({ correct_answer: e.target.value }, true)} rows={2}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </label>
          )}
          <label className="flex items-center gap-2 text-xs font-bold text-gray-500">
            Marks
            <input type="number" inputMode="numeric" min={1} max={100} value={q.marks}
              onChange={(e) => onChange({ marks: Math.max(1, Math.min(100, Math.round(Number(e.target.value) || 1))) })}
              className="w-20 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900" />
          </label>
          <button onClick={onEdit} className="mt-1 w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold">Done</button>
        </div>
      ) : (
        <div className="mt-2">
          <div className="text-sm text-gray-900 break-words"><MathText text={q.question_text} /></div>
          {mcq && q.options.length > 0 ? (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {q.options.map((o, oi) => {
                const isRight = correct === o.label.toUpperCase();
                return (
                  <div key={oi} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${isRight ? "bg-emerald-50 border border-emerald-300 text-emerald-900 font-semibold" : "bg-gray-50 border border-transparent text-gray-700"}`}>
                    <span className="font-black shrink-0">{o.label}.</span>
                    <span className="min-w-0 break-words"><MathText text={o.text} /></span>
                    {isRight && <Check size={14} className="ml-auto shrink-0 mt-0.5 text-emerald-600" />}
                  </div>
                );
              })}
            </div>
          ) : !mcq && q.correct_answer ? (
            <p className="mt-2 text-sm bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl px-3 py-2"><span className="font-bold">Answer:</span> {q.correct_answer}</p>
          ) : null}
          {mcq && q.correct_answer && !correct && (
            <p className="mt-1.5 text-xs text-amber-800">Key says “{q.correct_answer}” — doesn't match an option. Tap <Pencil size={11} className="inline" /> to pick one.</p>
          )}
        </div>
      )}
    </div>
  );
}
