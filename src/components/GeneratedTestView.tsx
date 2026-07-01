// src/components/GeneratedTestView.tsx
// ──────────────────────────────────────────────────────────────────────
// V10 — Export template picker
//
// v10 changes vs v9:
//   - New `selectedTemplate` state ("modern" | "classic" | "compact" | "colorful")
//   - downloadFile() now accepts and sends `template` in the export payload
//   - Download dropdown: new "Template" picker row at the top (4 buttons),
//     selection persists across PDF/DOCX and Student/Answers/Teacher choices
//   - No other logic changes
//
// v9 changes vs v8:
//   - Header action buttons (Show Answers / Copy / Add Question / Share /
//     Download): on mobile now a clean 2-col grid with full-width buttons +
//     44px tap targets; desktop unchanged (flex-wrap).
//   - Download dropdown: on mobile spans full button width (left-0 right-0) so
//     it no longer clips off-screen; desktop keeps w-60 right-aligned.
//   - Sticky bottom bar: adopts TestGeneratorForm mobile pattern — edge-to-edge
//     on phone, safe-area inset, flex-1 buttons, min-h-44px, touch-action.
//   - No handler / state / data changes.
//
// v8 features retained:
//   - QuestionTable (Statistics) + AnswerTable (Accountancy) rendering
//   - Save & Finish, Contest, Download menu, editable date, manual questions
//   - Show answers for Short/Long, localStorage auto-save
// ──────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from "react";
import AddManualQuestionModal, { ManualQuestion } from "./AddManualQuestionModal";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, ChevronUp, CheckCircle2, XCircle, Copy, FileDown,
  Eye, EyeOff, BookOpen, Brain, Zap, Edit3, RotateCcw, Check,
  X, Download, FileText, Loader2, Save, Share2, Calendar, Plus, Image as ImageIcon,
} from "lucide-react";
import MathText from "./MathText";
import { api } from "@/lib/api";
import type { GenerateTestResponse, GeneratedQuestion } from "@/lib/api";
import { CreateContestModal } from "./contest/CreateContestModal";
import { supabase } from "@/lib/supabaseClient";
import { useGuestAccess } from "@/hooks/useGuestAccess";
import LoginModal from "@/components/LoginModal";

// ── Types ──────────────────────────────────────────────────────────────

type QuestionStatus = "pending" | "approved" | "rejected" | "editing";

// v10: Export template options (must match backend TEMPLATE_PRESETS keys)
type ExportTemplate = "modern" | "classic" | "compact" | "colorful";

const TEMPLATE_OPTIONS: { id: ExportTemplate; label: string }[] = [
  { id: "modern", label: "Modern" },
  { id: "classic", label: "Classic" },
  { id: "compact", label: "Compact" },
  { id: "colorful", label: "Colorful" },
];

interface AnswerTable {
  type: string;  // "journal_entry" | "ledger" | "trial_balance"
  headers: string[];
  rows: string[][];
  total_row?: string[] | null;
}

// v8: Structured table embedded in the QUESTION (Statistics, Data-handling)
interface QuestionTable {
  type: string;  // "frequency_distribution" | "cumulative_frequency" | "data_table"
  headers: string[];
  rows: string[][];
  caption?: string | null;
}

interface QuestionWithStatus extends GeneratedQuestion {
  status: QuestionStatus;
  editData?: Partial<GeneratedQuestion>;
  answer_table?: AnswerTable | null;
  answerTable?: AnswerTable | null;
  // v8: Statistics question table
  question_table?: QuestionTable | null;
  questionTable?: QuestionTable | null;
}

// ── v8: Markdown table stripper ───────────────────────────────────────
// Mirrors backend _strip_markdown_table_from_text — removes inline pipe
// tables when a structured questionTable is present (avoids double render).

function stripMarkdownTable(text: string): string {
  if (!text || !text.includes("\n")) return text;

  const lines = text.split("\n");
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const stripped = line.trim();
    const hasPipes =
      stripped.startsWith("|") &&
      (stripped.match(/\|/g) || []).length >= 2;
    const nextIsSep =
      i + 1 < lines.length &&
      /^\|?[\s\-:]+\|[\s\-:|]*$/.test(lines[i + 1].trim());

    if (hasPipes && nextIsSep) {
      // Skip entire table block
      while (i < lines.length) {
        const tl = lines[i].trim();
        if (tl.startsWith("|") || /^\|?[\s\-:]+\|/.test(tl)) {
          i++;
        } else {
          break;
        }
      }
    } else {
      output.push(line);
      i++;
    }
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ── Badges ─────────────────────────────────────────────────────────────

const difficultyConfig: Record<string, { bg: string; text: string; border: string }> = {
  easy: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  medium: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  hard: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  very_hard: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
};

const statusBorder: Record<QuestionStatus, string> = {
  pending: "border-gray-200",
  approved: "border-emerald-300 bg-emerald-50/20",
  rejected: "border-red-300 bg-red-50/20 opacity-50",
  editing: "border-blue-300 bg-blue-50/20",
};

const DiffBadge = ({ level }: { level: string }) => {
  const c = difficultyConfig[level] || difficultyConfig.medium;
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
      {level.replace("_", " ")}
    </span>
  );
};

const BloomBadge = ({ level }: { level: string | null }) => {
  if (!level) return null;
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border bg-blue-50 text-blue-600 border-blue-200 flex items-center gap-1">
      <Brain size={10} /> {level}
    </span>
  );
};

// ── Format Badge (v7 — table format type) ──────────────────────────────

const formatBadgeConfig: Record<string, { bg: string; text: string; border: string; label: string }> = {
  journal_entry: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", label: "Journal Entry" },
  ledger: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", label: "Ledger" },
  trial_balance: { bg: "bg-fuchsia-50", text: "text-fuchsia-700", border: "border-fuchsia-200", label: "Trial Balance" },
};

const FormatBadge = ({ format }: { format: string }) => {
  const c = formatBadgeConfig[format];
  if (!c) return null;
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
      {c.label}
    </span>
  );
};


// ═══════════════════════════════════════════════════════════════════════
// v7: AnswerTableView — Renders Accountancy answer tables (emerald)
// ═══════════════════════════════════════════════════════════════════════

const TABLE_TITLES: Record<string, string> = {
  journal_entry: "Journal Entry",
  ledger: "Ledger Account",
  trial_balance: "Trial Balance",
};

const AMOUNT_COLS: Record<string, number[]> = {
  journal_entry: [3, 4],
  trial_balance: [3, 4],
  ledger: [3, 7],
};

const AnswerTableView = ({ table }: { table: AnswerTable }) => {
  if (!table || !table.headers || !table.rows) return null;

  const tableType = table.type || "journal_entry";
  const title = TABLE_TITLES[tableType] || "Answer Table";
  const amountCols = AMOUNT_COLS[tableType] || [];
  const isLedger = tableType === "ledger";

  return (
    <div className="mt-3 mb-2 mx-5">
      <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-2">
        {title}
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-xs border-collapse">
          {/* Ledger: Dr/Cr super-header */}
          {isLedger && table.headers.length >= 8 && (
            <thead>
              <tr>
                <th
                  colSpan={4}
                  className="bg-emerald-50 text-emerald-800 font-bold text-center py-1.5 border-b border-r-2 border-gray-300 text-[10px] uppercase tracking-wider"
                >
                  Debit (Dr.)
                </th>
                <th
                  colSpan={4}
                  className="bg-rose-50 text-rose-800 font-bold text-center py-1.5 border-b border-gray-300 text-[10px] uppercase tracking-wider"
                >
                  Credit (Cr.)
                </th>
              </tr>
            </thead>
          )}

          {/* Column headers */}
          <thead>
            <tr>
              {table.headers.map((h: string, i: number) => (
                <th
                  key={i}
                  className={`
                    bg-gray-50 text-gray-700 font-bold py-2 px-3 border-b border-gray-200
                    text-[10px] uppercase tracking-wider
                    ${amountCols.includes(i) ? "text-right" : "text-left"}
                    ${isLedger && i === 3 ? "border-r-2 border-gray-300" : ""}
                  `}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          {/* Data rows */}
          <tbody>
            {table.rows.map((row: string[], rowIdx: number) => {
              const isNarration = tableType === "journal_entry"
                && row[1] && row[1].startsWith("(")
                && !row[3] && !row[4];

              return (
                <tr
                  key={rowIdx}
                  className={`
                    border-b border-gray-100
                    ${isNarration ? "bg-gray-50/50 italic" : "hover:bg-gray-50/80"}
                  `}
                >
                  {row.map((cell: string, cellIdx: number) => (
                    <td
                      key={cellIdx}
                      className={`
                        py-1.5 px-3 text-gray-700
                        ${amountCols.includes(cellIdx) ? "text-right font-mono" : "text-left"}
                        ${isLedger && cellIdx === 3 ? "border-r-2 border-gray-300" : ""}
                        ${isNarration && cellIdx === 1 ? "text-gray-500 text-[10px]" : ""}
                        ${cell && (cell.includes("Dr.") || cell.includes(" Dr")) ? "font-semibold" : ""}
                        ${cell && (cell.startsWith("  To ") || cell.startsWith("To ")) ? "pl-8" : ""}
                      `}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              );
            })}

            {/* Total row */}
            {table.total_row && (
              <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
                {table.total_row.map((cell: string, i: number) => (
                  <td
                    key={i}
                    className={`
                      py-2 px-3 text-gray-900
                      ${amountCols.includes(i) ? "text-right font-mono" : "text-left"}
                      ${isLedger && i === 3 ? "border-r-2 border-gray-300" : ""}
                    `}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════
// v8: QuestionTableView — Renders Statistics question tables (blue)
// Always visible (it's the question data, not the answer)
// ═══════════════════════════════════════════════════════════════════════

const QUESTION_TABLE_TITLES: Record<string, string> = {
  frequency_distribution: "Frequency Distribution",
  cumulative_frequency: "Cumulative Frequency",
  data_table: "Data",
};

const QuestionTableView = ({ table }: { table: QuestionTable }) => {
  if (!table || !table.headers || !table.rows || table.rows.length === 0) {
    return null;
  }

  const tableType = table.type || "frequency_distribution";
  const title = QUESTION_TABLE_TITLES[tableType] || "Data";

  return (
    <div className="mt-3 mb-3 mx-5">
      {/* Optional caption above table */}
      {table.caption && (
        <p className="text-xs italic text-gray-500 mb-2 text-center">
          {table.caption}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-blue-200 bg-white">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              {table.headers.map((h: string, i: number) => (
                <th
                  key={i}
                  className={`
                    bg-blue-50 text-blue-900 font-bold py-2.5 px-4
                    border-b-2 border-blue-200
                    text-[11px] uppercase tracking-wider
                    ${i === 0 ? "text-left" : "text-right"}
                  `}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row: string[], rowIdx: number) => (
              <tr
                key={rowIdx}
                className="border-b border-blue-100/60 hover:bg-blue-50/30 transition-colors"
              >
                {row.map((cell: string, cellIdx: number) => (
                  <td
                    key={cellIdx}
                    className={`
                      py-2 px-4 text-gray-800
                      ${cellIdx === 0 ? "text-left font-medium" : "text-right font-mono"}
                    `}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Subtle hint badge */}
      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-blue-600/70 font-medium">
        <span className="inline-block w-1 h-1 rounded-full bg-blue-400" />
        {title}
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════
// Question Card
// ═══════════════════════════════════════════════════════════════════════

const QuestionCard = ({
  question, index, showAnswer, onStatusChange, onEdit, onSaveEdit,
}: {
  question: QuestionWithStatus;
  index: number;
  showAnswer: boolean;
  onStatusChange: (id: string, status: QuestionStatus) => void;
  onEdit: (id: string, field: string, value: any) => void;
  onSaveEdit: (id: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const labels = ["A", "B", "C", "D", "E", "F"];
  const isEditing = question.status === "editing";
  const ed = question.editData || question;

  const correctLetter = (isEditing ? ed.correctAnswer : question.correctAnswer)?.trim()?.[0]?.toUpperCase();
  const correctIdx = labels.indexOf(correctLetter || "");

  // v7: Get answer table from either key
  const answerTable = (question as any).answerTable || (question as any).answer_table || null;
  // v8: Get question table from either key
  const questionTable: QuestionTable | null =
    (question as any).questionTable || (question as any).question_table || null;
  const questionFormat = (question as any).format || "mcq";

  // v8: When structured questionTable is present, strip inline markdown table
  // from question text to avoid double rendering
  const displayText = questionTable
    ? stripMarkdownTable(question.text)
    : question.text;
  const editingDisplayText = questionTable && ed.text
    ? stripMarkdownTable(ed.text)
    : (ed.text || question.text);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 120, damping: 20 }}
      className={`rounded-2xl border-2 shadow-sm transition-all duration-300 overflow-hidden ${statusBorder[question.status]}`}
    >
      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg">Q{index + 1}</span>
            <DiffBadge level={question.difficulty} />
            <BloomBadge level={question.bloomLevel} />
            <FormatBadge format={questionFormat} />
            {question.status === "approved" && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Approved</span>}
            {question.status === "rejected" && <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">Rejected</span>}
            {/* Manual badge */}
            {(question as any).isManual && (
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                MANUAL
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs font-bold text-gray-400 mr-1">{question.marks}m</span>
            <button
              onClick={() => onStatusChange(question.id, question.status === "approved" ? "pending" : "approved")}
              className={`p-1.5 rounded-lg transition-all ${question.status === "approved" ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-400 hover:bg-emerald-100 hover:text-emerald-600"}`}
              title="Approve"
            ><Check size={14} /></button>
            <button
              onClick={() => isEditing ? onSaveEdit(question.id) : onStatusChange(question.id, "editing")}
              className={`p-1.5 rounded-lg transition-all ${isEditing ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-400 hover:bg-blue-100 hover:text-blue-600"}`}
              title={isEditing ? "Save" : "Edit"}
            >{isEditing ? <Save size={14} /> : <Edit3 size={14} />}</button>
            <button
              onClick={() => onStatusChange(question.id, question.status === "rejected" ? "pending" : "rejected")}
              className={`p-1.5 rounded-lg transition-all ${question.status === "rejected" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600"}`}
              title="Reject"
            ><X size={14} /></button>
          </div>
        </div>

        {/* Question Text */}
        {isEditing ? (
          <textarea
            className="w-full text-sm font-semibold text-gray-800 bg-white border border-blue-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-300 resize-none"
            rows={3}
            value={editingDisplayText}
            onChange={(e) => onEdit(question.id, "text", e.target.value)}
          />
        ) : (
          <p className={`text-sm font-semibold leading-relaxed ${question.status === "rejected" ? "text-gray-400 line-through" : "text-gray-800"}`}>
            <MathText text={displayText} />
          </p>
        )}
      </div>

      {/* v8: Question Table (Statistics — Frequency Distribution / Data) */}
      {/* Always visible — it's PART of the question, not the answer */}
      {questionTable && (
        <QuestionTableView table={questionTable} />
      )}

      {/* Manual question image */}
      {(question as any).imageUrl && (
        <div className="px-5 pb-3">
          <img
            src={(question as any).imageUrl}
            alt="Question reference"
            className="max-w-full max-h-[300px] rounded-xl border border-gray-200 object-contain bg-gray-50"
          />
        </div>
      )}

      {/* Options (MCQ / Assertion-Reason) */}
      {question.options && question.options.length > 0 && (
        <div className="px-5 pb-3 space-y-2">
          {(isEditing ? (ed.options || question.options) : question.options).map((opt, optIdx) => {
            const isCorrect = showAnswer && optIdx === correctIdx;
            const letter = labels[optIdx];

            return (
              <div key={optIdx} className={`flex items-start gap-3 px-4 py-2.5 rounded-xl text-sm transition-all duration-200 ${isCorrect ? "bg-emerald-50 border border-emerald-200" : "bg-gray-50/80 border border-transparent hover:bg-gray-100/80"}`}>
                <span className={`font-bold text-xs mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isCorrect ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-500"}`}>
                  {letter}
                </span>
                {isEditing ? (
                  <input
                    className="flex-1 text-sm bg-white border border-blue-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-300"
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...(ed.options || question.options)];
                      newOpts[optIdx] = e.target.value;
                      onEdit(question.id, "options", newOpts);
                    }}
                  />
                ) : (
                  <span className={isCorrect ? "font-semibold text-emerald-800" : "text-gray-600"}>
                    <MathText text={opt} />
                  </span>
                )}
              </div>
            );
          })}

          {/* Correct answer selector in edit mode */}
          {isEditing && (
            <div className="flex items-center gap-2 px-4 pt-2">
              <span className="text-xs font-bold text-gray-500">Correct:</span>
              {labels.slice(0, question.options.length).map((letter) => (
                <button
                  key={letter}
                  onClick={() => {
                    const opts = ed.options || question.options;
                    const idx = labels.indexOf(letter);
                    if (idx >= 0 && idx < opts.length) {
                      onEdit(question.id, "correctAnswer", opts[idx]);
                    }
                  }}
                  className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${(ed.correctAnswer || question.correctAnswer)?.startsWith(letter)
                      ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-emerald-100"
                    }`}
                >{letter}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fix 3: Show answer for Short/Long/non-MCQ questions */}
      {showAnswer
        && (!question.options || question.options.length === 0)
        && !answerTable
        && question.correctAnswer && (
          <div className="px-5 pb-3">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1.5">
                Answer
              </p>
              <p className="text-sm font-medium text-emerald-900 leading-relaxed">
                <MathText text={question.correctAnswer} />
              </p>
            </div>
          </div>
        )}

      {/* v7: Answer Table (Accountancy — Journal Entry / Ledger / Trial Balance) */}
      {showAnswer && answerTable && (
        <AnswerTableView table={answerTable} />
      )}

      {/* Explanation (collapsible) */}
      <div className="border-t border-gray-100">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-5 py-3 flex items-center justify-between text-xs font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50/50 transition-colors"
        >
          <span className="flex items-center gap-1.5"><BookOpen size={12} /> Explanation</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed bg-blue-50/20">
                <MathText text={question.explanation} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chapter tag */}
      {question.chapter && (
        <div className="px-5 pb-3">
          <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded">{question.chapter}</span>
        </div>
      )}
    </motion.div>
  );
};

// ── Download Helper ────────────────────────────────────────────────────

async function downloadFile(
  questions: GeneratedQuestion[],
  meta: { examTitle: string; board: string; classGrade: string; subject: string; paperDate?: string },
  format: "pdf" | "docx",
  mode: "student" | "answers" | "teacher",
  template: ExportTemplate,   // v10: which visual template to render
  logoBase64?: string | null,
) {
  const payload = {
    examTitle: meta.examTitle,
    paperDate: meta.paperDate,
    board: meta.board,
    classGrade: meta.classGrade,
    subject: meta.subject,
    questions,
    includeAnswers: mode !== "student",
    includeExplanations: mode === "teacher",
    format,
    template,   // v10: sent through to backend ExportRequest.template
    logoBase64: logoBase64 || null,
  };

  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const res = await fetch(`${API_BASE}/api/v1/test-generator/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Export failed");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${meta.examTitle.replace(/\s+/g, "_")}_${mode}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════

interface GeneratedTestViewProps {
  result: GenerateTestResponse;
  onReset: () => void;
  logoBase64?: string | null;
}

const GeneratedTestView = ({ result, onReset, logoBase64 }: GeneratedTestViewProps) => {
  const navigate = useNavigate();
  const { isGuest, gateAction, showLoginModal, setShowLoginModal, saveTestDataForRestore } = useGuestAccess();

  const [showAnswers, setShowAnswers] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");

  // v10: Selected export template — persists across format/mode choices
  const [selectedTemplate, setSelectedTemplate] = useState<ExportTemplate>("modern");

  // Paper Date State
  const [paperDate, setPaperDate] = useState<string>(
    result.meta?.paperDate || new Date().toISOString().split("T")[0]
  );
  const [isEditingDate, setIsEditingDate] = useState(false);

  // Manual question modal state
  const [showManualModal, setShowManualModal] = useState(false);

  // Contest modal state
  const [showContestModal, setShowContestModal] = useState(false);

  const [questions, setQuestions] = useState<QuestionWithStatus[]>(() => {
    // 🚩 FIX: Strict testId match — prevents old test data overwriting new generation
    const fresh = result.questions.map((q) => ({ ...q, status: "pending" as QuestionStatus }));

    if (!result.testId) return fresh;

    const saved = localStorage.getItem(`test-progress-${result.testId}`);
    if (!saved) return fresh;

    try {
      const parsed = JSON.parse(saved);
      if (
        parsed.testId === result.testId &&
        Array.isArray(parsed.questions) &&
        parsed.questions.length === result.questions.length
      ) {
        return parsed.questions;
      }
    } catch { }

    return fresh;
  });

  // Fix 4: Auto-save to localStorage
  const STORAGE_KEY = `test-progress-${result.testId}`;

  // Load saved state on mount
  // Save on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        questions,
        paperDate,
        savedAt: new Date().toISOString(),
      }));
    } catch (err) {
      console.error("Failed to save progress:", err);
    }
  }, [questions, paperDate]);

  // Save on every change
  // Save on every change
  useEffect(() => {
    if (!result.testId) return;  // 🚩 FIX: guard against undefined testId
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        testId: result.testId,  // 🚩 FIX: persist testId for strict match on reload
        questions,
        paperDate,
        savedAt: new Date().toISOString(),
      }));
    } catch (err) {
      console.error("Failed to save progress:", err);
    }
  }, [questions, paperDate, result.testId]);

  // Clear localStorage when user clicks "Save & Finish" or "New Test"
  const clearStoredProgress = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, [STORAGE_KEY]);

  // ── Handler: add manual question to local state ──────────────────────
  const handleAddManualQuestion = useCallback((q: ManualQuestion) => {
    const newQuestion: QuestionWithStatus = {
      id: q.id,
      text: q.text,
      options: q.options || [],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || "",
      marks: q.marks,
      difficulty: q.difficulty,
      bloomLevel: null,
      chapter: q.chapter || "Manual Addition",
      topic: null,
      format: q.type,
      validationStatus: "manual",
      section: q.section || null,
      status: q.status,
      // Custom fields for manual questions:
      ...(q.imageUrl ? { imageUrl: q.imageUrl } : {}),
      isManual: true,
    } as any;

    setQuestions((prev) => [...prev, newQuestion]);
  }, []);

  // ── Download handler with guest check ─────────────────────────────────
  const handleDownload = (format: "pdf" | "docx", mode: "student" | "answers" | "teacher") => {
    // 🚩 FIX: Block download if nothing approved
    if (activeQuestions.length === 0) {
      alert("Kam se kam ek question approve karo, ya 'Approve All' dabao");
      setShowDownloadMenu(false);
      return;
    }
    if (!gateAction("download")) {
      saveTestDataForRestore({
        testId: result.testId,
        examTitle: result.examTitle,
        questions: activeQuestions,
        meta: result.meta,
        logoBase64: logoBase64
      });
      return;
    }
    handleExport(format, mode);
  };

  // ── Share handler with guest check ───────────────────────────────────
  const handleShare = () => {
    if (!gateAction("share")) return;
    setShowContestModal(true);
  };

  // ── Save handler with guest check ────────────────────────────────────
  const handleSave = async () => {
    if (!gateAction("save")) return;
    await performSave();
  };

  // ── Actual save logic (extracted) ────────────────────────────────────
  const performSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const teacherId = user?.id || "00000000-0000-0000-0000-000000000000";
      await api.saveTest(result.testId, teacherId);
      setSaveStatus("saved");
      clearStoredProgress();
      setTimeout(() => navigate("/dashboard"), 800);
    } catch (err) {
      console.error("Save failed:", err);
      alert("Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── New Test ─────────────────────────────────────────────────────
  const handleNewTest = () => {
    if (saveStatus === "saved" || window.confirm("Start a new test? Progress will be lost.")) {
      clearStoredProgress();
      onReset();
    }
  };

  // ── Per-question actions ─────────────────────────────────────────
  const handleStatusChange = useCallback((id: string, status: QuestionStatus) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        if (status === "editing") {
          return { ...q, status, editData: { text: q.text, options: [...(q.options || [])], correctAnswer: q.correctAnswer } };
        }
        return { ...q, status, editData: undefined };
      })
    );
  }, []);

  const handleEdit = useCallback((id: string, field: string, value: any) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        return { ...q, editData: { ...q.editData, [field]: value } };
      })
    );
  }, []);

  const handleSaveEdit = useCallback((id: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id || !q.editData) return q;
        return {
          ...q,
          text: q.editData.text || q.text,
          options: q.editData.options || q.options,
          correctAnswer: q.editData.correctAnswer || q.correctAnswer,
          status: "approved",
          editData: undefined,
        };
      })
    );
  }, []);

  // ── Bulk ─────────────────────────────────────────────────────────
  const approveAll = () => setQuestions((prev) => prev.map((q) => q.status !== "rejected" ? { ...q, status: "approved" } : q));
  const resetAll = () => setQuestions((prev) => prev.map((q) => ({ ...q, status: "pending", editData: undefined })));

  // ── Regenerate ───────────────────────────────────────────────────
  const rejectedCount = questions.filter((q) => q.status === "rejected").length;

  const handleRegenerate = async () => {
    if (rejectedCount === 0) return;
    setIsRegenerating(true);
    try {
      const approved = questions.filter((q) => q.status !== "rejected");
      const rejectedChapters = questions.filter((q) => q.status === "rejected").map((q) => q.chapter);

      const regenResult = await api.generateTest({
        examTitle: result.examTitle,
        paperDate: paperDate,
        board: result.meta?.board || "CBSE",
        classGrade: result.meta?.classGrade || "Class 10",
        subject: result.meta?.subject || "Science",
        simpleData: [...new Set(rejectedChapters)].map((ch) => ({
          topic: ch,
          quantity: Math.max(1, Math.ceil(rejectedCount / [...new Set(rejectedChapters)].length)),
          difficulty: "Medium",
          format: "PDF",
        })),
      });

      if (regenResult.ok && regenResult.questions.length > 0) {
        const newQs = regenResult.questions.slice(0, rejectedCount).map((q) => ({
          ...q, status: "pending" as QuestionStatus,
        }));
        setQuestions([...approved, ...newQs]);
      }
    } catch (err) {
      console.error("Regeneration failed:", err);
    } finally {
      setIsRegenerating(false);
    }
  };

  // ── Export ────────────────────────────────────────────────────────
  // 🚩 FIX: Only approved questions go to PDF/Contest/Copy 
  const activeQuestions = questions.filter((q) => q.status === "approved");

  const handleExport = async (format: "pdf" | "docx", mode: "student" | "answers" | "teacher") => {
    setIsExporting(true);
    setShowDownloadMenu(false);
    try {
      await downloadFile(activeQuestions, {
        examTitle: result.examTitle,
        board: result.meta?.board || "CBSE",
        classGrade: result.meta?.classGrade || "Class 10",
        subject: result.meta?.subject || "Science",
        paperDate: paperDate,
      }, format, mode, selectedTemplate, logoBase64);   // v10: pass selectedTemplate
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyAll = () => {
    const text = activeQuestions
      .map((q, i) => `Q${i + 1}. ${q.text}\n${q.options?.map((o, j) => `  ${String.fromCharCode(65 + j)}) ${o}`).join("\n") || ""}\nAnswer: ${q.correctAnswer}\n`)
      .join("\n---\n");
    navigator.clipboard.writeText(text);
  };

  const approvedCount = questions.filter((q) => q.status === "approved").length;
  const pendingCount = questions.filter((q) => q.status === "pending").length;

  // v9: shared classes for header action buttons (mobile-first)
  const actionBtnBase =
    "flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-2 text-xs font-bold rounded-xl transition-colors w-full lg:w-auto min-h-[44px]";

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        {/* ── Header Bar ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100"
        >
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                <Zap size={20} className="text-yellow-500 flex-shrink-0" />
                <span className="truncate">{result.examTitle}</span>
              </h2>

              {/* Editable Date */}
              <div className="flex items-center gap-2 mt-1.5">
                {isEditingDate ? (
                  <input
                    type="date"
                    value={paperDate}
                    onChange={(e) => setPaperDate(e.target.value)}
                    onBlur={() => setIsEditingDate(false)}
                    autoFocus
                    className="text-xs font-semibold border border-blue-300 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-blue-200"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingDate(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors group"
                    title="Click to edit date"
                  >
                    <Calendar size={12} />
                    {new Date(paperDate).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric"
                    })}
                    <Edit3 size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>

              <p className="text-sm text-gray-500 mt-1">
                {activeQuestions.length} questions · {activeQuestions.reduce((s, q) => s + q.marks, 0)} marks · Generated in {result.generationTime}s
              </p>
              <div className="flex gap-3 mt-2 text-xs">
                <span className="text-emerald-600 font-bold">{approvedCount} approved</span>
                <span className="text-gray-400 font-bold">{pendingCount} pending</span>
                <span className="text-red-500 font-bold">{rejectedCount} rejected</span>
              </div>
            </div>

            {/* v9: Actions — 2-col grid on mobile, flex-wrap on desktop */}
            <div className="grid grid-cols-2 gap-2 w-full lg:flex lg:flex-wrap lg:items-center lg:w-auto">
              <button
                onClick={() => setShowAnswers(!showAnswers)}
                className={`${actionBtnBase} border border-gray-200 hover:bg-gray-50 active:bg-gray-100`}
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                {showAnswers ? <EyeOff size={14} /> : <Eye size={14} />}
                {showAnswers ? "Hide" : "Show"} Answers
              </button>

              <button
                onClick={handleCopyAll}
                className={`${actionBtnBase} border border-gray-200 hover:bg-gray-50 active:bg-gray-100`}
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                <Copy size={14} /> Copy
              </button>

              {/* Add Manual Question button */}
              <button
                onClick={() => setShowManualModal(true)}
                className={`${actionBtnBase} bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800`}
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                <Plus size={14} /> Add Question
              </button>

              {/* Share as Contest Button */}
              <button
                onClick={handleShare}
                className={`${actionBtnBase} bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800`}
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                <Share2 size={14} /> Share as Contest
              </button>

              {/* Download Menu — spans full width on mobile */}
              <div className="relative col-span-2 lg:col-span-1">
                <button
                  onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                  disabled={isExporting}
                  className={`${actionBtnBase} bg-gray-800 text-white hover:bg-gray-900 active:bg-black disabled:opacity-50`}
                  style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                >
                  {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  Download
                  <ChevronDown size={12} />
                </button>
                <AnimatePresence>
                  {showDownloadMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -5, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 right-0 sm:left-auto sm:right-0 top-full mt-2 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50 sm:w-64 max-w-[calc(100vw-2rem)]"
                    >
                      {/* v10: Template picker — persists across format/mode choices below */}
                      <div className="px-3 pb-2.5 mb-1 border-b border-gray-100">
                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 pt-1">
                          Template
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {TEMPLATE_OPTIONS.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setSelectedTemplate(t.id)}
                              className={`text-[11px] font-bold px-2.5 py-2 rounded-lg border transition-colors min-h-[32px] ${
                                selectedTemplate === t.id
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase">PDF</div>
                      <button onClick={() => handleDownload("pdf", "student")} className="w-full px-4 py-3 text-xs text-left hover:bg-gray-50 active:bg-gray-100 flex items-center gap-2 transition-colors min-h-[44px]">
                        <FileText size={14} className="text-red-500 flex-shrink-0" /> Student Copy
                      </button>
                      <button onClick={() => handleDownload("pdf", "answers")} className="w-full px-4 py-3 text-xs text-left hover:bg-gray-50 active:bg-gray-100 flex items-center gap-2 transition-colors min-h-[44px]">
                        <FileText size={14} className="text-orange-500 flex-shrink-0" /> With Answer Key
                      </button>
                      <button onClick={() => handleDownload("pdf", "teacher")} className="w-full px-4 py-3 text-xs text-left hover:bg-gray-50 active:bg-gray-100 flex items-center gap-2 transition-colors min-h-[44px]">
                        <FileText size={14} className="text-emerald-500 flex-shrink-0" /> Teacher Copy (+ explanations)
                      </button>
                      <div className="border-t border-gray-100 my-1" />
                      <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase">DOCX</div>
                      <button onClick={() => handleDownload("docx", "student")} className="w-full px-4 py-3 text-xs text-left hover:bg-gray-50 active:bg-gray-100 flex items-center gap-2 transition-colors min-h-[44px]">
                        <FileDown size={14} className="text-blue-500 flex-shrink-0" /> Student Copy
                      </button>
                      <button onClick={() => handleDownload("docx", "answers")} className="w-full px-4 py-3 text-xs text-left hover:bg-gray-50 active:bg-gray-100 flex items-center gap-2 transition-colors min-h-[44px]">
                        <FileDown size={14} className="text-orange-500 flex-shrink-0" /> With Answer Key
                      </button>
                      <button onClick={() => handleDownload("docx", "teacher")} className="w-full px-4 py-3 text-xs text-left hover:bg-gray-50 active:bg-gray-100 flex items-center gap-2 transition-colors min-h-[44px]">
                        <FileDown size={14} className="text-emerald-500 flex-shrink-0" /> Teacher Copy (+ explanations)
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Bulk Actions ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 sm:gap-3 flex-wrap"
        >
          <button onClick={approveAll} className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-bold rounded-xl bg-emerald-100 text-emerald-700 hover:bg-emerald-200 active:bg-emerald-300 transition-colors min-h-[44px]" style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>
            <CheckCircle2 size={14} /> Approve All
          </button>
          <button onClick={resetAll} className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-bold rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-300 transition-colors min-h-[44px]" style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>
            <RotateCcw size={14} /> Reset All
          </button>
          {rejectedCount > 0 && (
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-bold rounded-xl bg-blue-100 text-blue-700 hover:bg-blue-200 active:bg-blue-300 transition-colors disabled:opacity-50 min-h-[44px]"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              {isRegenerating ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Regenerate {rejectedCount} Rejected
            </button>
          )}
        </motion.div>

        {/* ── Questions ───────────────────────────────────────────────── */}
        <div className="space-y-4 pb-32">
          {questions.map((q, idx) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={idx}
              showAnswer={showAnswers}
              onStatusChange={handleStatusChange}
              onEdit={handleEdit}
              onSaveEdit={handleSaveEdit}
            />
          ))}
        </div>

        {/* ── Contest Modal ───────────────────────────────────────────── */}
        <AnimatePresence>
          {showContestModal && (
            <CreateContestModal
              isOpen={showContestModal}
              onClose={() => setShowContestModal(false)}
              questions={activeQuestions}
              testTitle={result.examTitle || "Test Paper"}
              subject={result.meta?.subject || "Science"}
              classGrade={result.meta?.classGrade || "Class 10"}
              board={result.meta?.board || "CBSE"}
              logoBase64={logoBase64}
            />
          )}
        </AnimatePresence>

        {/* ── Sticky Bottom Bar (v9: mobile edge-to-edge + safe-area) ──── */}
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 80, damping: 15, delay: 0.5 }}
          className="fixed bottom-0 sm:bottom-8 left-0 w-full px-0 sm:px-4 md:px-6 pointer-events-none z-50"
        >
          <div className="max-w-4xl mx-auto
            flex items-center justify-between
            bg-[#111827] text-white
            p-3 sm:pl-6
            rounded-none sm:rounded-[24px]
            shadow-[0_-4px_20px_rgba(0,0,0,0.15)] sm:shadow-[0_20px_40px_rgba(0,0,0,0.3)]
            pointer-events-auto border-t sm:border border-white/10
            gap-2 sm:gap-3
            pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-3">

            {/* Left — status info */}
            <div className="flex items-center gap-2 text-gray-400 flex-shrink-0">
              <CheckCircle2 size={16} className={approvedCount > 0 ? "text-emerald-400" : "text-gray-500"} />
              <span className="text-xs font-bold uppercase tracking-wider">
                <span className="text-white">{approvedCount}</span>
                <span className="hidden xs:inline"> approved</span>
                {pendingCount > 0 && (
                  <span className="text-amber-400 ml-2 hidden sm:inline">· {pendingCount} pending</span>
                )}
              </span>
            </div>

            {/* Right — actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={handleNewTest}
                className="px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl text-[13px] sm:text-sm font-bold bg-gray-700 text-gray-200 hover:bg-gray-600 active:bg-gray-500 transition-all min-h-[44px] whitespace-nowrap"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                New Test
              </motion.button>

              <motion.button
                whileHover={!isSaving ? { scale: 1.03, boxShadow: "0 0 20px rgba(52,211,153,0.3)" } : {}}
                whileTap={!isSaving ? { scale: 0.97 } : {}}
                type="button"
                onClick={handleSave}
                disabled={isSaving || saveStatus === "saved"}
                className="px-5 sm:px-8 py-3 sm:py-3.5 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl font-bold text-[13px] sm:text-sm text-white shadow-[0_4px_14px_rgba(0,0,0,0.4)] flex items-center gap-2 transition-all border border-white/10 disabled:opacity-70 disabled:cursor-not-allowed min-h-[44px] whitespace-nowrap"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                {isSaving ? (
                  <><Loader2 size={18} className="animate-spin" /> Saving...</>
                ) : saveStatus === "saved" ? (
                  <><Check size={18} /> Saved!</>
                ) : (
                  <><Save size={18} /> <span className="hidden xs:inline">Save & Finish</span><span className="xs:hidden">Save</span></>
                )}
              </motion.button>
            </div>

          </div>
        </motion.div>

      </motion.div>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        action="download"
        onLoginSuccess={() => {
          setShowLoginModal(false);
        }}
      />

      {/* Add Manual Question Modal */}
      <AnimatePresence>
        {showManualModal && (
          <AddManualQuestionModal
            isOpen={showManualModal}
            onClose={() => setShowManualModal(false)}
            onSave={handleAddManualQuestion}
            cbsePattern={result.meta?.cbsePattern || false}
            testId={result.testId}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default GeneratedTestView;