// src/components/contest/BuildPaperDialog.tsx
// "Build paper" for one question bank: sections (type / how many / marks each), answer key, template → download.
// The backend picks the questions, only from this bank; this dialog only says how many of each type it wants.

import React, { useMemo, useState } from "react";
import { AlertTriangle, Download, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  MAX_SECTIONS, PAPER_TEMPLATES, QTYPES, QTYPE_LABEL, availableByType, buildPaper, defaultSections, downloadBlob,
  hasIndicText, paperTotals, sectionProblems,
  type BankQuestion, type PaperMeta, type PaperSection, type PaperTemplate, type QType, type QuestionBank,
} from "@/lib/questionBankApi";

const inputCls = "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-300";
const chip = (active: boolean) =>
  `min-h-[44px] px-3 rounded-xl text-sm font-bold border ${active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-300"}`;

export function BuildPaperDialog({ bank, questions, onClose }: { bank: QuestionBank; questions: BankQuestion[]; onClose: () => void }) {
  const [title, setTitle] = useState(bank.name);
  const [institute, setInstitute] = useState("");
  const [subject, setSubject] = useState(bank.subject || "");
  const [classGrade, setClassGrade] = useState(bank.class_grade || "");
  const [board, setBoard] = useState(bank.board || "CBSE");
  const [includeKey, setIncludeKey] = useState(true);
  const [template, setTemplate] = useState<PaperTemplate>("modern");
  const [format, setFormat] = useState<"pdf" | "docx">("pdf");
  const [shuffle, setShuffle] = useState(false);
  const [allowReview, setAllowReview] = useState(false);
  const [year, setYear] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PaperMeta | null>(null);

  const years = useMemo(() => [...new Set(questions.map((q) => q.exam_year).filter((y): y is number => !!y))].sort((a, b) => b - a), [questions]);
  const available = useMemo(() => availableByType(questions, { allowNeedsReview: allowReview, year }), [questions, allowReview, year]);
  const [sections, setSections] = useState<PaperSection[]>(() => defaultSections(availableByType(questions)));
  const flagged = questions.filter((q) => q.needs_review && !q.excluded).length;
  const hindi = useMemo(() => hasIndicText(questions.filter((q) => !q.excluded).flatMap((q) => [q.question_text, ...q.options.map((o) => o.text)])), [questions]);

  const problems = [
    !title.trim() && "Enter a title for the paper.",
    sections.length === 0 && "Add at least one section.",
    ...sectionProblems(sections, available),
  ].filter(Boolean) as string[];
  const totals = paperTotals(sections);

  const setSection = (i: number, patch: Partial<PaperSection>) => { setDone(null); setSections((prev) => prev.map((s, k) => (k === i ? { ...s, ...patch } : s))); };
  const addSection = () => {
    const used = new Set(sections.map((s) => s.qtype));
    const next = QTYPES.find((t) => available[t] > 0 && !used.has(t)) || QTYPES.find((t) => available[t] > 0) || "mcq";
    setSections((prev) => [...prev, { qtype: next, count: 1, marks_each: next === "long" ? 5 : next === "short" ? 3 : 1 }]);
  };

  const build = async () => {
    setBusy(true); setError(null); setDone(null);
    try {
      const { blob, fileName, meta } = await buildPaper(bank.id, {
        title: title.trim(), institute_name: institute.trim() || null, sections, include_answer_key: includeKey, template,
        shuffle, year_filter: year, format, allow_needs_review: allowReview,
        subject: subject.trim() || null, class_grade: classGrade.trim() || null, board: board.trim() || null,
      });
      downloadBlob(blob, fileName);
      setDone(meta);
      toast.success(`Paper downloaded — ${fileName}`);
      if (meta && !meta.saved_to_history) toast.warning("The paper was built, but it could not be saved to your Test History.");
    } catch (e: any) {
      setError(e?.message || "Could not build the paper.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 sm:p-4" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="build-paper-title"
        className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="shrink-0 border-b border-gray-100 px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="build-paper-title" className="text-lg font-extrabold text-gray-900">Build paper</h2>
            <p className="text-xs text-gray-600 mt-0.5 truncate">From “{bank.name}” · {questions.filter((q) => !q.excluded).length} questions in the bank</p>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Close" className="h-11 w-11 rounded-xl hover:bg-gray-100 text-gray-600 flex items-center justify-center shrink-0"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-bold text-gray-500">Paper title <span className="text-red-500">*</span></span>
              <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unit Test 1" className={inputCls} data-testid="paper-title" />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-bold text-gray-500">Institute name (printed on top)</span>
              <input value={institute} maxLength={200} onChange={(e) => setInstitute(e.target.value)} placeholder="Optional" className={inputCls} />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-gray-500">Subject</span>
              <input value={subject} maxLength={50} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Economics" className={inputCls} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-bold text-gray-500">Class</span>
                <input value={classGrade} maxLength={20} onChange={(e) => setClassGrade(e.target.value)} placeholder="e.g. 12" className={inputCls} />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-gray-500">Board</span>
                <input value={board} maxLength={30} onChange={(e) => setBoard(e.target.value)} placeholder="e.g. CBSE" className={inputCls} />
              </label>
            </div>
          </div>

          <div className="border border-gray-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-gray-900">Sections</p>
              <p className="text-xs text-gray-500">{totals.questions} questions · {totals.marks} marks</p>
            </div>
            <p className="text-[11px] text-gray-500">
              In this bank: {QTYPES.map((t) => `${available[t]} ${QTYPE_LABEL[t]}`).join(" · ")}
            </p>
            {sections.map((s, i) => (
              <div key={i} className="flex items-end gap-2" data-testid={`section-${i}`}>
                <span className="shrink-0 w-6 pb-3 text-sm font-black text-gray-400">{"ABCDEF"[i]}</span>
                <label className="flex-1 min-w-0 block">
                  <span className="text-[11px] font-bold text-gray-500">Type</span>
                  <select value={s.qtype} onChange={(e) => setSection(i, { qtype: e.target.value as QType })} className={inputCls}>
                    {QTYPES.map((t) => <option key={t} value={t}>{QTYPE_LABEL[t]} ({available[t]})</option>)}
                  </select>
                </label>
                <label className="w-20 block">
                  <span className="text-[11px] font-bold text-gray-500">How many</span>
                  <input type="number" inputMode="numeric" min={1} max={100} value={s.count || ""} onChange={(e) => setSection(i, { count: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) })} className={inputCls} />
                </label>
                <label className="w-20 block">
                  <span className="text-[11px] font-bold text-gray-500">Marks each</span>
                  <input type="number" inputMode="numeric" min={1} max={100} value={s.marks_each || ""} onChange={(e) => setSection(i, { marks_each: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) })} className={inputCls} />
                </label>
                <button onClick={() => { setDone(null); setSections((prev) => prev.filter((_, k) => k !== i)); }} aria-label={`Remove section ${"ABCDEF"[i]}`}
                  className="shrink-0 h-11 w-9 rounded-xl text-gray-400 flex items-center justify-center"><Trash2 size={15} /></button>
              </div>
            ))}
            {sections.length < MAX_SECTIONS && (
              <button onClick={addSection} className="text-xs font-bold text-gray-700 inline-flex items-center gap-1 py-1"><Plus size={14} /> Add section</button>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500">Template</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PAPER_TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => setTemplate(t.id)} className={chip(template === t.id)} title={t.hint}>{t.label}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-500">File</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setFormat("pdf")} className={chip(format === "pdf")}>PDF</button>
                <button onClick={() => setFormat("docx")} className={chip(format === "docx")}>Word</button>
              </div>
            </div>
            {years.length > 0 && (
              <label className="block">
                <span className="text-xs font-bold text-gray-500">Only questions from year</span>
                <select value={year ?? ""} onChange={(e) => { setDone(null); setYear(e.target.value ? Number(e.target.value) : null); }} className={inputCls}>
                  <option value="">Any year</option>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={includeKey} onChange={(e) => setIncludeKey(e.target.checked)} className="mt-0.5 h-4 w-4 accent-gray-900" />
              <span><span className="font-bold">Add the answer key</span> <span className="text-gray-500">— on its own page at the end. Questions whose answer was not in your PDF are marked “no answer in the source PDF”.</span></span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} className="mt-0.5 h-4 w-4 accent-gray-900" />
              <span><span className="font-bold">Pick questions at random</span> <span className="text-gray-500">— otherwise the first ones in the bank are used.</span></span>
            </label>
            {flagged > 0 && (
              <label className="flex items-start gap-2 text-sm text-gray-800">
                <input type="checkbox" checked={allowReview} onChange={(e) => { setDone(null); setAllowReview(e.target.checked); }} className="mt-0.5 h-4 w-4 accent-gray-900" />
                <span><span className="font-bold">Also use the {flagged} question{flagged === 1 ? "" : "s"} marked “needs review”</span> <span className="text-gray-500">— they may have no answer.</span></span>
              </label>
            )}
          </div>

          {hindi && format === "pdf" && (
            <p className="text-xs rounded-xl bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> This bank has Hindi text. The PDF file cannot print Hindi yet — choose Word if a Hindi question may be picked.
            </p>
          )}
          {done && (
            <p className="text-xs rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-2" data-testid="paper-done">
              Downloaded: {done.questions} questions, {done.total_marks} marks.
              {done.answer_key_included && ` Answer key: ${done.answers_found} answers from your PDF${done.answers_missing ? `, ${done.answers_missing} without an answer` : ""}.`}
              {done.saved_to_history ? " Saved in your Test History." : ""}
            </p>
          )}
          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2" data-testid="paper-error">{error}</p>}
        </div>

        <div className="shrink-0 border-t border-gray-100 p-4 space-y-2" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          {problems.length > 0 && <p className="text-xs font-semibold text-red-600" data-testid="paper-problems">{problems.join(" ")}</p>}
          <button disabled={busy || problems.length > 0} onClick={build}
            className="w-full py-4 rounded-2xl bg-gray-900 text-white font-black text-sm disabled:bg-gray-300 inline-flex items-center justify-center gap-2">
            {busy ? <><Loader2 size={16} className="animate-spin" /> Building…</> : <><Download size={16} /> {done ? "Build again" : `Download ${format === "pdf" ? "PDF" : "Word file"}`}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
