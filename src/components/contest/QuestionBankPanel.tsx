// src/components/contest/QuestionBankPanel.tsx
// "My question banks" inside the Contest from PDF tab: list (name, count, date) → open one to view / edit / leave
// out questions, delete a bank, and open the Build paper dialog. Banks are created from the review screen above
// (ImportContestFromPdf: "Save as Question Bank").

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, FileText, Library, Loader2, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import MathText from "@/components/MathText";
import { useAuth } from "@/providers/AuthProvider";
import { BuildPaperDialog } from "./BuildPaperDialog";
import {
  QTYPES, QTYPE_LABEL, deleteBank, deleteBankQuestion, getBankQuestions, listBanks, patchBankQuestion,
  type BankQuestion, type QType, type QuestionBank,
} from "@/lib/questionBankApi";

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};
const pill = "text-[10px] font-bold uppercase rounded-full px-2 py-0.5";
const fieldCls = "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300";

/** Small dialog that asks for the bank's name before saving the reviewed questions. */
export function SaveBankDialog({ defaultName, count, busy, onSave, onClose }: {
  defaultName: string; count: number; busy: boolean; onSave: (name: string) => void; onClose: () => void;
}) {
  const [name, setName] = useState(defaultName.slice(0, 120));
  const ok = name.trim().length > 0 && !busy;
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 sm:p-4" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form role="dialog" aria-modal="true" aria-labelledby="save-bank-title" onSubmit={(e) => { e.preventDefault(); if (ok) onSave(name.trim()); }}
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl p-5 space-y-3">
        <h2 id="save-bank-title" className="text-lg font-extrabold text-gray-900">Save as question bank</h2>
        <p className="text-xs text-gray-600">{count} question{count === 1 ? "" : "s"} will be saved as you see them now. Answers that were guessed by AI and not confirmed by you are not saved.</p>
        <label className="block">
          <span className="text-xs font-bold text-gray-500">Name</span>
          <input autoFocus value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="e.g. Economics – Foreign Exchange" className={`mt-1 ${fieldCls}`} data-testid="bank-name" />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-800 font-bold text-sm">Cancel</button>
          <button type="submit" disabled={!ok} className="flex-1 py-3 rounded-2xl bg-gray-900 text-white font-black text-sm disabled:bg-gray-300 inline-flex items-center justify-center gap-2">
            {busy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

type Filter = "all" | "review" | QType;

export default function QuestionBankPanel({ refreshKey = 0, buildBankId = null, onBuildOpened }: {
  /** changes when a bank was saved elsewhere in the tab → reload the list */
  refreshKey?: number;
  /** open the Build paper dialog for this bank as soon as its questions are loaded */
  buildBankId?: string | null;
  onBuildOpened?: () => void;
}) {
  const { session } = useAuth();
  const signedIn = !!session;
  const [banks, setBanks] = useState<QuestionBank[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<BankQuestion[] | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setListError(null);
    try { setBanks((await listBanks()).banks); } catch (e: any) { setBanks([]); setListError(e?.message || "Could not load your question banks."); }
  }, []);
  useEffect(() => { if (signedIn) load(); }, [signedIn, refreshKey, load]);

  const open = useCallback(async (id: string | null) => {
    setOpenId(id); setQuestions(null); setOpenError(null); setEditing(null); setFilter("all");
    if (!id) return;
    try { setQuestions((await getBankQuestions(id)).questions); } catch (e: any) { setOpenError(e?.message || "Could not load the questions."); }
  }, []);

  // "Build paper from these questions" in the review screen: open that bank and its dialog
  useEffect(() => {
    if (!buildBankId || !banks?.some((b) => b.id === buildBankId)) return;
    (async () => { await open(buildBankId); setBuilding(true); onBuildOpened?.(); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildBankId, banks]);

  const bank = banks?.find((b) => b.id === openId) || null;
  const shown = useMemo(() => (questions || []).filter((q) => filter === "all" || (filter === "review" ? q.needs_review : q.qtype === filter)), [questions, filter]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: questions?.length || 0, review: 0 };
    for (const q of questions || []) { c[q.qtype] = (c[q.qtype] || 0) + 1; if (q.needs_review) c.review += 1; }
    return c;
  }, [questions]);

  const replace = (q: BankQuestion) => setQuestions((prev) => (prev || []).map((x) => (x.id === q.id ? q : x)));

  const patch = async (q: BankQuestion, body: Parameters<typeof patchBankQuestion>[2]): Promise<boolean> => {
    if (!openId) return false;
    setBusyId(q.id);
    try { replace((await patchBankQuestion(openId, q.id, body)).question); return true; }
    catch (e: any) { toast.error(e?.message || "Could not save the question."); return false; }
    finally { setBusyId(null); }
  };

  const removeQuestion = async (q: BankQuestion) => {
    if (!openId || !window.confirm("Delete this question from the bank?")) return;
    setBusyId(q.id);
    try {
      await deleteBankQuestion(openId, q.id);
      setQuestions((prev) => (prev || []).filter((x) => x.id !== q.id));
      setBanks((prev) => (prev || []).map((b) => (b.id === openId ? { ...b, question_count: Math.max(0, (b.question_count || 1) - 1) } : b)));
    } catch (e: any) { toast.error(e?.message || "Could not delete the question."); }
    finally { setBusyId(null); }
  };

  const removeBank = async (b: QuestionBank) => {
    if (!window.confirm(`Delete the question bank “${b.name}” and its ${b.question_count ?? ""} questions? Papers you already built stay in Test History.`)) return;
    try {
      await deleteBank(b.id);
      setBanks((prev) => (prev || []).filter((x) => x.id !== b.id));
      if (openId === b.id) open(null);
      toast.success("Question bank deleted.");
    } catch (e: any) { toast.error(e?.message || "Could not delete the question bank."); }
  };

  if (!signedIn) return null;

  return (
    <section id="my-question-banks" className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 space-y-3" data-testid="question-banks">
      <div className="flex items-center gap-2">
        <Library size={18} className="text-gray-700 shrink-0" />
        <h3 className="text-base font-black text-gray-900">My question banks</h3>
      </div>
      <p className="text-xs text-gray-500">Save the questions of a PDF you checked, then build printable papers from them — only your own questions are used.</p>

      {banks === null && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</p>}
      {listError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {listError} <button onClick={load} className="underline font-bold ml-1">Try again</button>
        </p>
      )}
      {banks && banks.length === 0 && !listError && (
        <p className="text-sm text-gray-500 rounded-xl bg-gray-50 px-3 py-4 text-center" data-testid="banks-empty">
          No question banks yet. Upload a PDF above, check the questions, then tap “Save as Question Bank”.
        </p>
      )}

      {banks && banks.map((b) => (
        <div key={b.id} className={`rounded-xl border ${openId === b.id ? "border-gray-900" : "border-gray-200"}`} data-testid="bank-row">
          <div className="flex items-center gap-2 p-3">
            <button onClick={() => open(openId === b.id ? null : b.id)} aria-expanded={openId === b.id} className="flex-1 min-w-0 flex items-center gap-3 text-left">
              <FileText size={18} className="text-gray-400 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-gray-900 truncate">{b.name}</span>
                <span className="block text-xs text-gray-500">{b.question_count ?? 0} questions · {fmtDate(b.created_at)}{b.can_edit ? "" : " · view only"}</span>
              </span>
              <ChevronDown size={16} className={`ml-auto shrink-0 text-gray-400 ${openId === b.id ? "rotate-180" : ""}`} />
            </button>
            {b.can_edit && (
              <button onClick={() => removeBank(b)} aria-label={`Delete ${b.name}`} className="shrink-0 h-9 w-9 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center"><Trash2 size={15} /></button>
            )}
          </div>

          {openId === b.id && (
            <div className="border-t border-gray-100 p-3 space-y-3">
              {openError && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{openError} <button onClick={() => open(b.id)} className="underline font-bold ml-1">Try again</button></p>}
              {!questions && !openError && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading questions…</p>}
              {questions && (
                <>
                  {b.warnings.length > 0 && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900 space-y-0.5">
                      {b.warnings.map((w, i) => <p key={i}>• {w}</p>)}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(["all", "review", ...QTYPES] as Filter[]).filter((f) => f === "all" || counts[f] > 0).map((f) => (
                      <button key={f} onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border ${filter === f ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-300"}`}>
                        {f === "all" ? "All" : f === "review" ? "Needs review" : QTYPE_LABEL[f]} ({counts[f] || 0})
                      </button>
                    ))}
                    <button onClick={() => setBuilding(true)} disabled={questions.length === 0}
                      className="ml-auto px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold disabled:bg-gray-300" data-testid="open-build-paper">Build paper</button>
                  </div>
                  {questions.length === 0 && <p className="text-sm text-gray-500 text-center py-3">This bank has no questions left.</p>}
                  <div className="space-y-2">
                    {shown.map((q) => (
                      <BankQuestionRow key={q.id} q={q} canEdit={b.can_edit} busy={busyId === q.id} editing={editing === q.id}
                        onEdit={() => setEditing(editing === q.id ? null : q.id)}
                        onPatch={async (body) => { const ok = await patch(q, body); if (ok && !("excluded" in body && Object.keys(body).length === 1)) setEditing(null); return ok; }}
                        onDelete={() => removeQuestion(q)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ))}

      {building && bank && questions && <BuildPaperDialog bank={bank} questions={questions} onClose={() => setBuilding(false)} />}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════
function BankQuestionRow({ q, canEdit, busy, editing, onEdit, onPatch, onDelete }: {
  q: BankQuestion; canEdit: boolean; busy: boolean; editing: boolean;
  onEdit: () => void;
  onPatch: (body: Parameters<typeof patchBankQuestion>[2]) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [text, setText] = useState(q.question_text);
  const [options, setOptions] = useState(q.options);
  const [answer, setAnswer] = useState(q.answer || "");
  const [marks, setMarks] = useState<number>(Number(q.marks) || 1);
  useEffect(() => { if (editing) { setText(q.question_text); setOptions(q.options); setAnswer(q.answer || ""); setMarks(Number(q.marks) || 1); } }, [editing, q]);

  const objective = q.qtype === "mcq" || q.qtype === "true_false";
  const choices = q.qtype === "true_false" && q.options.length === 0 ? null : options;      // null: plain True / False
  const answerText = !q.answer ? null
    : q.options.length ? `${q.answer}. ${q.options.find((o) => o.label === q.answer)?.text ?? ""}` : q.answer;

  const save = () => {
    const body: Parameters<typeof patchBankQuestion>[2] = {};
    if (text.trim() !== q.question_text) body.question_text = text.trim();
    if (choices && JSON.stringify(options) !== JSON.stringify(q.options)) body.options = options.filter((o) => o.text.trim());
    if ((answer || "") !== (q.answer || "")) body.answer = answer.trim() || null;
    if (marks !== (Number(q.marks) || 1)) body.marks = marks;
    if (Object.keys(body).length === 0) { if (q.needs_review) body.reviewed = true; else { onEdit(); return; } }
    onPatch(body);
  };

  return (
    <div className={`rounded-xl border p-3 ${q.excluded ? "bg-gray-50 border-gray-200 opacity-70" : q.needs_review ? "border-amber-300 bg-white" : "border-gray-200 bg-white"}`} data-testid="bank-question">
      <div className="flex items-start gap-2">
        <label className="shrink-0 flex items-center gap-1.5 mt-0.5" title={q.excluded ? "Left out of papers" : "Used in papers"}>
          <input type="checkbox" checked={!q.excluded} disabled={!canEdit || busy} onChange={(e) => onPatch({ excluded: !e.target.checked })}
            className="h-4 w-4 accent-gray-900" aria-label={`Use question ${q.position} in papers`} />
          <span className="text-xs font-black text-gray-400">Q{q.position}</span>
        </label>
        <div className="flex-1 min-w-0 flex flex-wrap gap-1.5">
          <span className={`${pill} bg-gray-100 text-gray-600`}>{QTYPE_LABEL[q.qtype]}</span>
          {q.marks != null && <span className={`${pill} bg-gray-100 text-gray-600`}>{q.marks} mark{Number(q.marks) === 1 ? "" : "s"}</span>}
          {q.exam_year && <span className={`${pill} bg-blue-50 text-blue-700`}>{q.source_tag || q.exam_year}</span>}
          {q.needs_review && <span className={`${pill} bg-amber-100 text-amber-800 inline-flex items-center gap-1`}><AlertTriangle size={10} /> Needs review</span>}
          {q.excluded && <span className={`${pill} bg-gray-200 text-gray-600`}>Left out</span>}
        </div>
        {busy && <Loader2 size={14} className="animate-spin text-gray-400 mt-1" />}
        {canEdit && (
          <>
            <button onClick={onEdit} aria-label={editing ? "Close editing" : "Edit question"}
              className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center ${editing ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>{editing ? <X size={14} /> : <Pencil size={13} />}</button>
            <button onClick={onDelete} aria-label="Delete question" className="shrink-0 h-8 w-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center"><Trash2 size={13} /></button>
          </>
        )}
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className={fieldCls} />
          {objective && choices && (
            <>
              <p className="text-[11px] text-gray-400">Tap the letter next to the correct option.</p>
              {options.map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <button onClick={() => setAnswer(answer === o.label ? "" : o.label)} aria-label={`Mark ${o.label} correct`}
                    className={`shrink-0 h-9 w-9 rounded-full border-2 text-xs font-black ${answer === o.label ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 text-gray-500"}`}>{o.label}</button>
                  <input value={o.text} onChange={(e) => setOptions(options.map((x, xi) => (xi === oi ? { ...x, text: e.target.value } : x)))} className={`flex-1 min-w-0 ${fieldCls}`} />
                </div>
              ))}
            </>
          )}
          {objective && !choices && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">Answer</span>
              {["True", "False"].map((v) => (
                <button key={v} onClick={() => setAnswer(answer === v ? "" : v)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border ${answer === v ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 text-gray-600"}`}>{v}</button>
              ))}
            </div>
          )}
          {!objective && (
            <label className="block">
              <span className="text-xs font-bold text-gray-500">Model answer (optional)</span>
              <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={2} className={`mt-1 ${fieldCls}`} />
            </label>
          )}
          <label className="flex items-center gap-2 text-xs font-bold text-gray-500">
            Marks
            <input type="number" inputMode="numeric" min={1} max={100} value={marks}
              onChange={(e) => setMarks(Math.max(1, Math.min(100, Math.round(Number(e.target.value) || 1))))} className="w-20 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900" />
          </label>
          <button onClick={save} disabled={busy || !text.trim()} className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold disabled:bg-gray-300">Save</button>
        </div>
      ) : (
        <div className="mt-2">
          <div className="text-sm text-gray-900 break-words whitespace-pre-line"><MathText text={q.question_text} /></div>
          {q.options.length > 0 && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {q.options.map((o) => (
                <div key={o.label} className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-sm ${q.answer === o.label ? "bg-emerald-50 border border-emerald-300 text-emerald-900 font-semibold" : "bg-gray-50 border border-transparent text-gray-700"}`}>
                  <span className="font-black shrink-0">{o.label}.</span>
                  <span className="min-w-0 break-words"><MathText text={o.text} /></span>
                  {q.answer === o.label && <Check size={14} className="ml-auto shrink-0 mt-0.5 text-emerald-600" />}
                </div>
              ))}
            </div>
          )}
          {q.options.length === 0 && answerText && (
            <p className="mt-2 text-sm bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg px-2.5 py-1.5"><span className="font-bold">Answer:</span> {answerText}</p>
          )}
          {!q.answer && (
            <p className={`mt-1.5 text-xs ${objective ? "text-amber-800" : "text-gray-400"}`}>
              {objective ? "No answer was found in the PDF. Edit the question to set it." : "No model answer in the PDF."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
