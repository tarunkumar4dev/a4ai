// src/components/checker/CheckSessionView.tsx
// Step 2 of "Check Copies" (phone-first): the class list. Tap a student → photograph the copy page by
// page → "Done & next" queues the AI check (3 at a time, in the background) and opens the next student.
// Checked copies are reviewed point by point and approved; nothing is final until the teacher approves.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/providers/AuthProvider";
import { AiQuestionList, effectiveTotal, feedbackFromAi } from "./AiGradeBreakdown";
import {
  buildRubric, checkSheet, overrideMarks, removeFiles, signedUrls, uploadPage,
  MAX_PAGES, STRICTNESS_LABEL, type CheckSession, type CheckSheet, type SheetStatus,
} from "./copyCheckerApi";
import { exportSessionResults } from "./checkerExport";

const PARALLEL = 3;

const STATUS: Record<SheetStatus, { label: string; cls: string }> = {
  pending:  { label: "No copy",   cls: "bg-gray-100 text-gray-500" },
  uploaded: { label: "Uploaded",  cls: "bg-blue-50 text-blue-600" },
  checking: { label: "Checking…", cls: "bg-violet-50 text-violet-600" },
  checked:  { label: "Checked",   cls: "bg-amber-50 text-amber-700" },
  failed:   { label: "Failed",    cls: "bg-red-50 text-red-600" },
  approved: { label: "Approved",  cls: "bg-emerald-50 text-emerald-700" },
};

type Filter = "all" | "todo" | "review" | "done";

export default function CheckSessionView({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const { user } = useAuth();
  const [session, setSession] = useState<CheckSession | null>(null);
  const [sheets, setSheets] = useState<CheckSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showScheme, setShowScheme] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRoll, setNewRoll] = useState("");
  const [rubricBusy, setRubricBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: s }, { data: sh }] = await Promise.all([
      supabase.from("check_sessions").select("*").eq("id", sessionId).single(),
      supabase.from("check_sheets").select("*").eq("session_id", sessionId).order("roll_no", { nullsFirst: false }).order("created_at"),
    ]);
    setSession(s as CheckSession);
    setSheets((sh || []) as CheckSheet[]);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  const patchSheet = (id: string, fields: Partial<CheckSheet>) =>
    setSheets(prev => prev.map(s => s.id === id ? { ...s, ...fields } : s));

  /* ── Background check queue (3 parallel). Each copy = one backend request. ── */
  const queue = useRef<string[]>([]);
  const running = useRef(0);
  const pump = useCallback(() => {
    while (running.current < PARALLEL && queue.current.length) {
      const id = queue.current.shift()!;
      running.current++;
      patchSheet(id, { status: "checking", error: null });
      checkSheet(id)
        .then(({ sheet }) => patchSheet(id, sheet))
        .catch((e: Error) => {
          patchSheet(id, { status: "failed", error: e.message });
          if (/daily limit|session expired/i.test(e.message)) { queue.current = []; toast.error(e.message); }
        })
        .finally(() => { running.current--; pump(); });
    }
  }, []);
  const enqueue = useCallback((ids: string[]) => {
    const fresh = ids.filter(id => !queue.current.includes(id));
    queue.current.push(...fresh);
    pump();
  }, [pump]);

  async function retryRubric() {
    setRubricBusy(true);
    setSession(s => s && { ...s, rubric_status: "building", rubric_error: null });
    try {
      const r = await buildRubric(sessionId, true);
      setSession(s => s && { ...s, rubric: r.full_rubric, rubric_status: "ready", rubric_error: null, total_marks: r.rubric.total_marks });
    } catch (e: any) {
      setSession(s => s && { ...s, rubric_status: "failed", rubric_error: e.message });
      toast.error(e.message);
    }
    setRubricBusy(false);
  }

  async function addStudent() {
    if (!newName.trim()) return;
    const { data, error } = await supabase.from("check_sheets")
      .insert({ session_id: sessionId, student_name: newName.trim().slice(0, 120), roll_no: newRoll.trim() || null })
      .select("*").single();
    if (error) return toast.error(error.message);
    setSheets(prev => [...prev, data as CheckSheet]);
    setNewName(""); setNewRoll("");
    setOpenId((data as CheckSheet).id);   // straight to the camera
    setAdding(false);
  }

  async function approveAllClean() {
    const clean = sheets.filter(s => s.status === "checked" && s.ai_result && !(s.ai_result.needs_review_count || 0));
    if (!clean.length) return toast.info("No checked copies without review flags.");
    if (!confirm(`Approve AI marks for ${clean.length} student(s)?`)) return;
    const now = new Date().toISOString();
    const res = await Promise.all(clean.map(s => supabase.from("check_sheets").update({
      status: "approved", final_marks: effectiveTotal(s.ai_result!), feedback: feedbackFromAi(s.ai_result!), approved_at: now, updated_at: now,
    }).eq("id", s.id)));
    const failed = res.filter(r => r.error).length;
    if (failed) toast.error(`${failed} could not be saved`); else toast.success(`${clean.length} approved`);
    load();
  }

  async function exportResults() {
    if (!session) return;
    const withResult = sheets.filter(s => s.ai_result);
    if (!withResult.length) return toast.info("No checked copies to export yet.");
    const notApproved = withResult.filter(s => s.status !== "approved").length;
    if (notApproved && !confirm(`${notApproved} checked ${notApproved > 1 ? "copies are" : "copy is"} not approved yet — their AI marks will be exported. Export anyway?`)) return;
    try {
      await exportSessionResults(session, sheets);
    } catch (e: any) {
      toast.error(`Export failed: ${e?.message || e}`);
    }
  }

  async function deleteSession() {
    if (!session || !confirm(`Delete “${session.title}” and all its photos? This cannot be undone.`)) return;
    await removeFiles([...session.qp_paths, ...session.key_paths, ...sheets.flatMap(s => s.pages)]).catch(() => {});
    const { error } = await supabase.from("check_sessions").delete().eq("id", sessionId);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onBack();
  }

  const counts = useMemo(() => ({
    total: sheets.length,
    todo: sheets.filter(s => s.status === "pending" || s.status === "failed").length,
    review: sheets.filter(s => s.status === "checked").length,
    done: sheets.filter(s => s.status === "approved").length,
    uploaded: sheets.filter(s => s.status === "uploaded").length,
    checking: sheets.filter(s => s.status === "checking").length,
    clean: sheets.filter(s => s.status === "checked" && !(s.ai_result?.needs_review_count || 0)).length,
  }), [sheets]);

  const visible = sheets.filter(s =>
    filter === "all" ? true
      : filter === "todo" ? (s.status === "pending" || s.status === "failed" || s.status === "uploaded")
      : filter === "review" ? s.status === "checked"
      : s.status === "approved");

  if (loading || !session) return <p className="text-center text-sm text-gray-400 py-16">Loading…</p>;

  const open = sheets.find(s => s.id === openId) || null;
  const openIndex = open ? sheets.findIndex(s => s.id === open.id) : -1;
  const rubricReady = session.rubric_status === "ready" && !!session.rubric;

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-32">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="h-10 w-10 shrink-0 rounded-full bg-white border border-gray-200 text-gray-600 font-bold">←</button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black text-gray-900 leading-tight truncate">{session.title}</h2>
          <p className="text-xs text-gray-500">
            {[session.total_marks && `${session.total_marks} marks`, STRICTNESS_LABEL[session.strictness], session.source === "test" ? "From Test History" : "From photos"].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button onClick={exportResults} className="text-xs font-bold text-gray-700 px-2 py-2" title="Download results as Excel">⬇ Export Results</button>
        <button onClick={deleteSession} className="text-xs font-bold text-red-500 px-2 py-2">Delete</button>
      </div>

      {/* Marking scheme status */}
      <div className={`rounded-2xl border p-4 ${session.rubric_status === "failed" ? "bg-red-50 border-red-200" : rubricReady ? "bg-white border-gray-200" : "bg-violet-50 border-violet-200"}`}>
        {session.rubric_status === "failed" ? (
          <div className="flex items-center gap-3">
            <p className="flex-1 text-sm text-red-700"><b>Marking scheme failed.</b> {session.rubric_error}</p>
            <button disabled={rubricBusy} onClick={retryRubric} className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold">Retry</button>
          </div>
        ) : !rubricReady ? (
          <div className="flex items-center gap-3">
            <p className="flex-1 text-sm text-violet-700">Marking scheme not ready yet.</p>
            <button disabled={rubricBusy} onClick={retryRubric} className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold">
              {rubricBusy ? "Preparing…" : "Prepare"}
            </button>
          </div>
        ) : (
          <>
            <button className="w-full flex items-center justify-between" onClick={() => setShowScheme(v => !v)}>
              <span className="text-sm font-bold text-gray-800">📋 Marking scheme · {session.rubric!.total_questions} questions · {session.rubric!.total_marks} marks</span>
              <span className="text-gray-400 text-sm">{showScheme ? "▴" : "▾"}</span>
            </button>
            {session.rubric!.marks_mismatch && <p className="mt-2 text-xs text-amber-700">⚠ {session.rubric!.marks_mismatch}</p>}
            {session.rubric!.questions.some(q => q.scheme_source === "estimated") && (
              <p className="mt-2 text-xs text-amber-700">Some marks splits were estimated by AI — open the scheme to check them.</p>
            )}
            {showScheme && <SchemeList session={session} />}
          </>
        )}
      </div>

      {/* Progress */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { n: counts.total, l: "Students" },
          { n: counts.uploaded + counts.checking, l: "In progress" },
          { n: counts.review, l: "To review" },
          { n: counts.done, l: "Approved" },
        ].map(x => (
          <div key={x.l} className="rounded-2xl bg-white border border-gray-200 py-2.5">
            <p className="text-lg font-black text-gray-900">{x.n}</p>
            <p className="text-[10px] font-bold uppercase text-gray-400">{x.l}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {([["all", `All ${counts.total}`], ["todo", `To upload ${counts.todo + counts.uploaded}`], ["review", `To review ${counts.review}`], ["done", `Approved ${counts.done}`]] as [Filter, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-bold border ${filter === k ? "bg-[#111827] text-white border-[#111827]" : "bg-white text-gray-600 border-gray-200"}`}>{l}</button>
        ))}
      </div>

      {/* Students */}
      <div className="rounded-2xl bg-white border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {visible.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-500">
            {sheets.length === 0 ? "Add your students below, then photograph each copy." : "Nobody here."}
          </p>
        )}
        {visible.map(s => (
          <button key={s.id} onClick={() => setOpenId(s.id)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-gray-100 flex items-center justify-center font-black text-gray-500 text-sm">
              {s.roll_no || (s.student_name[0] || "?").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 truncate">{s.student_name}</p>
              <p className="text-xs text-gray-400">
                {s.pages.length ? `${s.pages.length} page${s.pages.length > 1 ? "s" : ""}` : "No pages yet"}
                {s.status === "checked" && (s.ai_result?.needs_review_count || 0) > 0 && <span className="text-orange-600"> · {s.ai_result!.needs_review_count} to review</span>}
              </p>
            </div>
            {(s.status === "checked" || s.status === "approved") && (
              <span className="text-sm font-black text-gray-900">{s.status === "approved" ? s.final_marks : s.ai_result ? effectiveTotal(s.ai_result) : s.ai_marks}<span className="text-gray-400 font-bold text-xs">/{s.max_marks}</span></span>
            )}
            <span className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-lg ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
          </button>
        ))}
      </div>

      {/* Add student */}
      {adding ? (
        <div className="rounded-2xl bg-white border border-gray-200 p-4 space-y-2">
          <div className="grid grid-cols-[1fr_90px] gap-2">
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Student name"
              className="rounded-xl border border-gray-200 px-3 py-3 text-sm" onKeyDown={e => e.key === "Enter" && addStudent()} />
            <input value={newRoll} onChange={e => setNewRoll(e.target.value)} placeholder="Roll no"
              className="rounded-xl border border-gray-200 px-3 py-3 text-sm" onKeyDown={e => e.key === "Enter" && addStudent()} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 py-3 rounded-xl bg-gray-100 text-sm font-bold text-gray-600">Cancel</button>
            <button onClick={addStudent} disabled={!newName.trim()} className="flex-[2] py-3 rounded-xl bg-[#111827] text-white text-sm font-bold disabled:bg-gray-300">Add & open camera</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full py-3.5 rounded-2xl border-2 border-dashed border-gray-300 text-sm font-bold text-gray-500 active:bg-gray-50">
          + Add student
        </button>
      )}

      {/* Sticky actions */}
      {(counts.uploaded > 0 || counts.clean > 0) && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 p-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <div className="max-w-2xl mx-auto flex gap-2">
            {counts.uploaded > 0 && (
              <button disabled={!rubricReady} onClick={() => enqueue(sheets.filter(s => s.status === "uploaded").map(s => s.id))}
                className="flex-1 py-3.5 rounded-2xl bg-violet-600 text-white text-sm font-black disabled:bg-gray-300">
                ✨ Check {counts.uploaded} uploaded
              </button>
            )}
            {counts.clean > 0 && (
              <button onClick={approveAllClean} className="flex-1 py-3.5 rounded-2xl bg-emerald-600 text-white text-sm font-black">
                ✓ Approve {counts.clean} clean
              </button>
            )}
          </div>
        </div>
      )}

      {open && user && (
        <StudentCopy
          key={open.id}
          sheet={open}
          session={session}
          userId={user.id}
          canCheck={rubricReady}
          position={`${openIndex + 1} / ${sheets.length}`}
          onClose={() => setOpenId(null)}
          onPrev={openIndex > 0 ? () => setOpenId(sheets[openIndex - 1].id) : undefined}
          onNext={openIndex < sheets.length - 1 ? () => setOpenId(sheets[openIndex + 1].id) : undefined}
          onChange={fields => patchSheet(open.id, fields)}
          onCheck={() => enqueue([open.id])}
          onDeleted={() => { setSheets(prev => prev.filter(s => s.id !== open.id)); setOpenId(null); }}
        />
      )}
    </div>
  );
}

/* ── Read-only marking scheme ── */
function SchemeList({ session }: { session: CheckSession }) {
  return (
    <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
      {session.rubric!.questions.map(q => {
        const pts = q.subparts.length ? q.subparts.flatMap(s => s.points.map(p => ({ ...p, sub: s.sub_id }))) : q.points.map(p => ({ ...p, sub: "" }));
        return (
          <div key={q.q_no} className="rounded-xl bg-gray-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-gray-800">Q{q.q_no}</span>
              <span className="text-[11px] font-bold text-gray-500">{q.marks} marks</span>
              {q.scheme_source === "estimated" && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 rounded px-1.5">estimated</span>}
              {q.or_group && <span className="text-[10px] font-bold text-gray-500 bg-gray-200 rounded px-1.5">OR</span>}
            </div>
            <ul className="mt-1 space-y-0.5">
              {pts.map(p => (
                <li key={p.id} className="text-[11px] text-gray-600 flex gap-2">
                  <span className="font-bold text-gray-800 shrink-0">{p.marks}</span>
                  <span>{p.sub && <b>{p.sub}: </b>}{p.expected || p.text}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/* ── One student's copy: camera → pages → check → review → approve ── */
function StudentCopy({ sheet, session, userId, canCheck, position, onClose, onPrev, onNext, onChange, onCheck, onDeleted }: {
  sheet: CheckSheet; session: CheckSession; userId: string; canCheck: boolean; position: string;
  onClose: () => void; onPrev?: () => void; onNext?: () => void;
  onChange: (f: Partial<CheckSheet>) => void; onCheck: () => void; onDeleted: () => void;
}) {
  const cam = useRef<HTMLInputElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(0);
  const [marks, setMarks] = useState<string>(String(sheet.final_marks ?? (sheet.ai_result ? effectiveTotal(sheet.ai_result) : sheet.ai_marks) ?? ""));
  const [feedback, setFeedback] = useState(sheet.feedback || (sheet.ai_result ? feedbackFromAi(sheet.ai_result) : ""));
  const [saving, setSaving] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);

  useEffect(() => {
    const missing = sheet.pages.filter(p => !urls[p] && !p.endsWith(".pdf"));
    if (missing.length) signedUrls(missing).then(u => setUrls(prev => ({ ...prev, ...u })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.pages]);

  useEffect(() => {   // AI result arrived while open → prefill
    if (sheet.status === "checked" && sheet.ai_result) {
      setMarks(String(effectiveTotal(sheet.ai_result)));
      setFeedback(feedbackFromAi(sheet.ai_result));
    }
  }, [sheet.status, sheet.ai_result]);

  /** ✎ on a question: backend saves it (audit-logged); the total and untouched feedback follow. */
  async function overrideQuestion(qNo: string, m: number, note: string) {
    const before = sheet.ai_result;
    const { sheet: s } = await overrideMarks(sheet.id, qNo, m, note);
    if (before && feedback === feedbackFromAi(before) && s.ai_result) setFeedback(feedbackFromAi(s.ai_result));
    onChange({ ai_result: s.ai_result, final_marks: s.final_marks, status: s.status });
    if (s.ai_result) setMarks(String(effectiveTotal(s.ai_result)));
  }

  const locked = sheet.status === "checking";
  const imagePages = sheet.pages.filter(p => !p.endsWith(".pdf") && urls[p]);
  const viewerIndex = viewer ? imagePages.indexOf(viewer) : -1;

  async function addPages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const room = MAX_PAGES - sheet.pages.length;
    if (room <= 0) return toast.error(`Max ${MAX_PAGES} pages per copy.`);
    let pages = [...sheet.pages];
    setUploading(n => n + Math.min(files.length, room));
    for (const f of files.slice(0, room)) {
      try {
        const path = await uploadPage(userId, session.id, `sheets/${sheet.id}`, f);
        pages = [...pages, path];
        const local = f.type.startsWith("image/") ? URL.createObjectURL(f) : "";
        if (local) setUrls(prev => ({ ...prev, [path]: local }));
        const status: SheetStatus = sheet.status === "approved" ? "approved" : "uploaded";
        const { error } = await supabase.from("check_sheets").update({ pages, status, updated_at: new Date().toISOString() }).eq("id", sheet.id);
        if (error) throw error;
        onChange({ pages, status });
      } catch (err: any) {
        toast.error(err.message || "Upload failed");
      }
      setUploading(n => n - 1);
    }
  }

  async function removePage(path: string) {
    const pages = sheet.pages.filter(p => p !== path);
    const status: SheetStatus = pages.length ? (sheet.status === "pending" ? "uploaded" : sheet.status) : "pending";
    const { error } = await supabase.from("check_sheets").update({ pages, status }).eq("id", sheet.id);
    if (error) return toast.error(error.message);
    removeFiles([path]).catch(() => {});
    onChange({ pages, status });
  }

  function doneAndNext() {
    if (!sheet.pages.length) return toast.error("Take at least one photo of the copy.");
    if (!canCheck) toast.info("Saved. Checking starts once the marking scheme is ready.");
    else onCheck();
    if (onNext) onNext(); else onClose();
  }

  async function approve() {
    const m = parseFloat(marks);
    if (Number.isNaN(m) || m < 0 || (sheet.max_marks != null && m > Number(sheet.max_marks))) {
      return toast.error(`Marks must be between 0 and ${sheet.max_marks ?? "max"}.`);
    }
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("check_sheets").update({
      status: "approved", final_marks: m, feedback: feedback.trim() || null, approved_at: now, updated_at: now,
    }).eq("id", sheet.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    onChange({ status: "approved", final_marks: m, feedback: feedback.trim() || null });
    toast.success(`${sheet.student_name}: ${m}/${sheet.max_marks}`);
    if (onNext) onNext();
  }

  async function deleteStudent() {
    if (!confirm(`Remove ${sheet.student_name} from this check?`)) return;
    await removeFiles(sheet.pages).catch(() => {});
    const { error } = await supabase.from("check_sheets").delete().eq("id", sheet.id);
    if (error) return toast.error(error.message);
    onDeleted();
  }

  const r = sheet.ai_result;

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex sm:items-center sm:justify-center" onClick={onClose}>
      {/* Phone: one scrolling column. Desktop (md+): scan on the left (40%), AI result on the right (60%), each scrolls on its own. */}
      <div className="bg-[#F9FAFB] w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-xl sm:rounded-3xl overflow-y-auto md:max-w-6xl md:h-[92vh] md:max-h-none md:overflow-hidden md:flex md:flex-col" onClick={e => e.stopPropagation()}>
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-3 py-2.5 flex items-center gap-2">
          <button onClick={onClose} className="h-10 w-10 rounded-full bg-gray-100 font-bold text-gray-600">✕</button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-sm font-black text-gray-900 truncate">{sheet.student_name}</p>
            <p className="text-[11px] text-gray-400">{sheet.roll_no ? `Roll ${sheet.roll_no} · ` : ""}{position}</p>
          </div>
          <button disabled={!onPrev} onClick={onPrev} className="h-10 w-10 rounded-full bg-gray-100 font-bold text-gray-600 disabled:opacity-30">‹</button>
          <button disabled={!onNext} onClick={onNext} className="h-10 w-10 rounded-full bg-gray-100 font-bold text-gray-600 disabled:opacity-30">›</button>
        </div>

        <div className="md:flex-1 md:min-h-0 md:grid md:grid-cols-[2fr_3fr]">
        {/* Left: the scanned copy (+ its own lightbox on desktop) */}
        <div className="relative md:min-h-0 md:border-r md:border-gray-200">
        <div className="p-4 pb-0 md:pb-4 md:h-full md:overflow-y-auto">
          {/* Pages */}
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2">
              Copy · {sheet.pages.length} page{sheet.pages.length === 1 ? "" : "s"}{uploading > 0 && ` · uploading ${uploading}…`}
            </p>
            <div className="grid grid-cols-3 md:grid-cols-2 gap-2">
              {sheet.pages.map((p, i) => (
                <div key={p} className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-200 border border-gray-200">
                  {p.endsWith(".pdf")
                    ? <div className="h-full flex items-center justify-center text-3xl">📄</div>
                    : urls[p] ? <img src={urls[p]} alt={`Page ${i + 1}`} className="h-full w-full object-cover cursor-zoom-in" onClick={() => setViewer(p)} />
                    : <div className="h-full flex items-center justify-center text-xs text-gray-400">…</div>}
                  <span className="absolute bottom-1 left-1 text-[10px] font-black bg-black/60 text-white rounded px-1.5">{i + 1}</span>
                  {!locked && (
                    <button onClick={() => removePage(p)} className="absolute top-1 right-1 h-7 w-7 rounded-full bg-black/60 text-white text-xs font-bold">✕</button>
                  )}
                </div>
              ))}
            </div>
            {sheet.pages.length === 0 && (
              <p className="text-xs text-gray-500 mb-2">
                Photograph each page of the copy, or upload a scanned PDF (all pages in one file is fine).
              </p>
            )}
            {sheet.pages.length < MAX_PAGES && !locked && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button onClick={() => cam.current?.click()}
                  className="py-4 rounded-2xl bg-[#111827] text-white flex flex-col items-center justify-center active:scale-[0.98]">
                  <span className="text-2xl">📷</span>
                  <span className="text-xs font-bold mt-1">{sheet.pages.length ? "Take next page" : "Take photo"}</span>
                </button>
                <button onClick={() => pick.current?.click()}
                  className="py-4 rounded-2xl bg-white border-2 border-gray-200 text-gray-800 flex flex-col items-center justify-center active:scale-[0.98]">
                  <span className="text-2xl">📄</span>
                  <span className="text-xs font-bold mt-1">Upload PDF / images</span>
                </button>
              </div>
            )}
            <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={addPages} />
            <input ref={pick} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={addPages} />
          </div>
        </div>

          {/* Page viewer: full screen on phones, inside the left panel on desktop (the result stays visible) */}
          {viewer && urls[viewer] && (
            <div className="fixed inset-0 z-[70] bg-black flex items-center justify-center md:absolute md:z-20 md:bg-black/90"
              onClick={e => { e.stopPropagation(); setViewer(null); }}>
              <img src={urls[viewer]} alt="Page" className="max-h-full max-w-full object-contain" />
              <div className="absolute top-3 inset-x-3 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                <span className="text-xs font-bold text-white bg-black/60 rounded-full px-3 py-1.5">
                  Page {viewerIndex + 1} / {imagePages.length}
                </span>
                <button onClick={() => setViewer(null)} className="h-9 w-9 rounded-full bg-black/60 text-white font-bold">✕</button>
              </div>
              {viewerIndex > 0 && (
                <button onClick={e => { e.stopPropagation(); setViewer(imagePages[viewerIndex - 1]); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-black/60 text-white text-xl font-bold">‹</button>
              )}
              {viewerIndex < imagePages.length - 1 && (
                <button onClick={e => { e.stopPropagation(); setViewer(imagePages[viewerIndex + 1]); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-black/60 text-white text-xl font-bold">›</button>
              )}
            </div>
          )}
        </div>

        {/* Right: AI result, marks, feedback */}
        <div className="p-4 space-y-4 pb-32 md:pb-6 md:min-h-0 md:overflow-y-auto">
          {/* Status / result */}
          {sheet.status === "checking" && (
            <div className="rounded-2xl bg-violet-50 border border-violet-200 p-4 text-sm text-violet-700 flex items-center gap-3">
              <span className="inline-block h-5 w-5 rounded-full border-2 border-violet-300 border-t-violet-600 animate-spin" />
              AI is checking this copy… you can move to the next student.
            </div>
          )}
          {sheet.status === "failed" && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              <b>Check failed.</b> {sheet.error}
              <button onClick={onCheck} className="block mt-2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold">Retry</button>
            </div>
          )}

          {r && (sheet.status === "checked" || sheet.status === "approved") && (
            <>
              <div className="rounded-2xl bg-white border border-gray-200 p-4">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-3xl font-black text-gray-900">{effectiveTotal(r)}</span>
                  <span className="text-gray-400 font-bold">/ {r.max_marks}</span>
                  {r.teacher_total != null
                    ? <span className="text-sm font-bold text-blue-700">with your changes · AI gave {r.total_marks_awarded}</span>
                    : <span className="text-sm font-bold text-gray-500">AI · {r.percentage}%</span>}
                </div>
                {r.overall_remarks && <p className="text-xs text-gray-600 mt-1">{r.overall_remarks}</p>}
                {(r.needs_review_count || 0) > 0 && (
                  <p className="text-xs text-orange-600 font-bold mt-2">👀 {r.needs_review_count} answer(s) marked “Review” — please look before approving.</p>
                )}
              </div>
              <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
                <AiQuestionList questions={r.graded_questions || []} onOverride={overrideQuestion} />
              </div>
              <div className="rounded-2xl bg-white border border-gray-200 p-4 space-y-2">
                <label className="text-xs font-bold text-gray-500">Final marks (edit if needed)</label>
                <input type="number" inputMode="decimal" step="0.5" min="0" value={marks} onChange={e => setMarks(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-3 text-lg font-black" />
                <label className="text-xs font-bold text-gray-500">Feedback for the student</label>
                <textarea rows={4} value={feedback} onChange={e => setFeedback(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </div>
            </>
          )}

          <button onClick={deleteStudent} className="text-xs font-bold text-red-500">Remove student from this check</button>
        </div>
        </div>

        {/* Bottom action */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          {sheet.status === "checked" ? (
            <button onClick={approve} disabled={saving} className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black text-sm">
              {saving ? "Saving…" : `✓ Approve ${marks || 0}/${sheet.max_marks}${onNext ? " & next" : ""}`}
            </button>
          ) : sheet.status === "approved" ? (
            <button onClick={approve} disabled={saving} className="w-full py-4 rounded-2xl bg-gray-900 text-white font-black text-sm">
              {saving ? "Saving…" : "Save changes"}
            </button>
          ) : sheet.status === "failed" ? (
            <button onClick={onCheck} disabled={uploading > 0 || sheet.pages.length === 0}
              className="w-full py-4 rounded-2xl bg-red-600 text-white font-black text-sm disabled:bg-gray-300">
              ↻ Retry check
            </button>
          ) : (
            <button onClick={doneAndNext} disabled={locked || uploading > 0 || sheet.pages.length === 0}
              className="w-full py-4 rounded-2xl bg-[#111827] text-white font-black text-sm disabled:bg-gray-300">
              {uploading > 0 ? "Uploading…" : sheet.status === "uploaded" || sheet.status === "pending" ? `✨ Done — check this copy${onNext ? " & next" : ""}` : "Checking…"}
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
