/**
 * TestBuilderPage.tsx — Modernized a4ai NCERT Test Builder
 * 
 * Performance & Design Upgrades:
 *   - Fast load: Zero CSS keyframe animations, in-memory stats cache, instant rendering
 *   - Modern a4ai native design: Clean surfaces, crisp typography, Lucide icons, dark CTAs
 *   - Desktop 2-panel live workspace + Mobile responsive bottom sheet & drawer
 *   - Drag & drop reordering with quick-nudge up/down arrows
 *   - PDF & DOCX export with browser-side fallback + auto-save to history
 *   - KaTeX math, tables, diagrams, and responsive options
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  DndContext,
  closestCenter,
  DragOverlay,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useDroppable,
  defaultDropAnimation,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";
import { supabase } from "@/lib/supabaseClient";
import { generateTestPaperPdf, generateAnswerKeyPdf } from "@/utils/testPdfExporter";
import { getQuestionSegments, hasTable, type AccSegment } from "@/utils/accountancyTables";
import { AccountancySegments } from "@/components/AccountancyTableView";
import { toast } from "sonner";
import {
  BookOpen,
  FileText,
  Search,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Check,
  CheckCircle2,
  SlidersHorizontal,
  Download,
  Image as ImageIcon,
  Sparkles,
  Clock,
  Layers,
  ChevronRight,
  RotateCcw,
  X,
  FileKey,
  Shield,
  Loader2,
} from "lucide-react";

// ── Config ──────────────────────────────────────────────────────
const RAW_API_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const API_BASE = RAW_API_URL.endsWith("/api/v1")
  ? RAW_API_URL
  : `${RAW_API_URL}/api/v1`;

const PAGE_SIZE = 30;
const MOBILE_BREAKPOINT = 1024;

// ── Types ───────────────────────────────────────────────────────
interface NCERTQuestion {
  id: number;
  class_grade: string;
  subject: string;
  chapter: string;
  section: string | null;
  question_number: string | null;
  question_text: string;
  question_type: string;
  answer: string | null;
  options: string[] | string;
  marks: number;
  difficulty: string;
  figure_ref?: string | null;
  question_table?: QuestionTable | null;
  image_url?: string | null;
  /** Accountancy only: text/table segments rebuilt by the backend (same as the exported PDF). */
  structured_segments?: AccSegment[] | null;
}

interface QuestionTable {
  headers: string[];
  rows: string[][];
}

interface TestQuestion extends NCERTQuestion {
  paperId: string;
  options: string[];
}

interface ChapterStat {
  chapter: string;
  total: number;
  sections: { name: string; count: number }[];
  types: { name: string; count: number }[];
}

// ── Constants ───────────────────────────────────────────────────
const CLASS_OPTIONS = ["6", "7", "8", "9", "10", "11", "12"];

const SUBJECTS_BY_CLASS: Record<string, string[]> = {
  "6":  ["Science", "Mathematics"],
  "7":  ["Mathematics"],
  "8":  ["Science", "Mathematics"],
  "9":  ["Science", "Mathematics", "English", "Economics", "Geography", "History", "Political Science"],
  "10": ["Science", "Mathematics", "English", "Economics", "Geography", "History", "Political Science"],
  "11": ["Accountancy", "Physics", "Chemistry", "Biology", "Mathematics", "Economics", "History", "Political Science"],
  "12": ["Accountancy", "Physics", "Chemistry", "Biology", "Mathematics", "Economics", "English", "History", "Political Science"],
};

const TYPE_LABELS: Record<string, string> = {
  all: "All Types",
  exercise: "Exercise",
  example: "Examples",
  intext: "In-Text",
  activity: "Activities",
  hots: "HOTS",
  diagram: "Diagrams",
};

// ── In-Memory Cache for Instant Loads ────────────────────────────
const statsCache: Record<string, ChapterStat[]> = {};

// ── Helpers ─────────────────────────────────────────────────────
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  try {
    const raw = localStorage.getItem("sb-dcmnzvjftmdbywrjkust-auth-token");
    if (raw) {
      const parsed = JSON.parse(raw);
      const token = parsed?.access_token;
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
  } catch {
    /* no auth token */
  }
  return headers;
}

function parseOptions(opts: string[] | string | null | undefined): string[] {
  if (!opts) return [];
  if (Array.isArray(opts)) return opts;
  if (typeof opts === "string") {
    try {
      return JSON.parse(opts);
    } catch {
      return [];
    }
  }
  return [];
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function useIsMobile(breakpoint = MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);
  return isMobile;
}

// ── Safe LaTeX Math Renderer ────────────────────────────────────
function renderMathText(text: string): React.ReactNode {
  if (!text) return null;
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g);
  return (
    <>
      {parts.map((part, i) => {
        try {
          if (part.startsWith("$$") && part.endsWith("$$")) {
            return <BlockMath key={i} math={part.slice(2, -2)} />;
          }
          if (part.startsWith("$") && part.endsWith("$")) {
            return <InlineMath key={i} math={part.slice(1, -1)} />;
          }
        } catch {
          return (
            <span key={i} className="font-mono text-xs">
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Question Table View ─────────────────────────────────────────
function QuestionTableView({ table }: { table: QuestionTable }) {
  if (!table?.headers?.length) return null;
  return (
    <div className="overflow-x-auto my-2.5 rounded-lg border border-gray-200">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold">
            {table.headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-center border-r border-gray-200 last:border-r-0">
                {renderMathText(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {table.rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-1.5 text-center text-gray-600 border-r border-gray-100 last:border-r-0">
                  {renderMathText(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Diagram Badge ───────────────────────────────────────────────
function DiagramBadge({ figRef, hasImage }: { figRef?: string | null; hasImage?: boolean }) {
  if (hasImage) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md">
        <ImageIcon className="w-3 h-3 text-emerald-600" />
        {figRef ? `${figRef}` : "Diagram Included"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md">
      <Sparkles className="w-3 h-3 text-amber-600" />
      {figRef ? `Refer ${figRef}` : "Diagram Required"}
    </span>
  );
}

// ── Difficulty Badge ────────────────────────────────────────────
function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const d = (difficulty || "medium").toLowerCase();
  if (d === "easy") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Easy
      </span>
    );
  }
  if (d === "hard") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        Hard
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      Medium
    </span>
  );
}

// ── Question Content Component ──────────────────────────────────
function QuestionContent({ question, truncateAt }: { question: NCERTQuestion; truncateAt?: number }) {
  const text = question.question_text || "";
  const displayText = truncateAt && text.length > truncateAt ? text.slice(0, truncateAt) + "…" : text;

  const table = question.question_table;
  const parsedTable = useMemo(() => {
    if (!table) return null;
    if (typeof table === "string") {
      try {
        return JSON.parse(table);
      } catch {
        return null;
      }
    }
    return table;
  }, [table]);

  const opts = parseOptions(question.options);

  // Accountancy: ledgers, balance sheets, cash books and trial balances as real tables.
  const isAccountancy = /account/i.test(question.subject || "");
  const accSegments = useMemo(
    () => (isAccountancy ? getQuestionSegments(question) : null),
    [isAccountancy, question.question_text, question.question_table, question.structured_segments]
  );
  const showAccTables = !!accSegments && hasTable(accSegments);

  return (
    <div className="space-y-2">
      {showAccTables ? (
        <AccountancySegments
          segments={accSegments!}
          renderText={renderMathText}
          truncateAt={truncateAt}
          maxRows={truncateAt ? 6 : undefined}
        />
      ) : (
        <div className="text-gray-900 text-sm leading-relaxed font-normal">
          {renderMathText(isAccountancy ? displayText.replace(/`/g, "₹") : displayText)}
        </div>
      )}

      {!showAccTables && parsedTable?.headers && <QuestionTableView table={parsedTable} />}

      {question.image_url && (
        <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 inline-block bg-white p-1">
          <img
            src={question.image_url}
            alt="Question diagram"
            className="max-h-48 max-w-full object-contain"
            loading="lazy"
          />
        </div>
      )}

      {opts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2 pt-1">
          {opts.map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx);
            return (
              <div
                key={idx}
                className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 border border-gray-200/60 text-xs text-gray-700 font-medium"
              >
                <span className="w-5 h-5 flex-shrink-0 rounded bg-white border border-gray-200 text-gray-700 font-bold flex items-center justify-center text-[10px]">
                  {letter}
                </span>
                <span className="leading-snug">{renderMathText(opt)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Draggable Question Card (Library Stream) ────────────────────
function DraggableQuestion({
  question,
  onAdd,
  isAdded,
  isMobile,
}: {
  question: NCERTQuestion;
  onAdd: (q: NCERTQuestion) => void;
  isAdded: boolean;
  isMobile: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({ id: `lib-${question.id}` });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`relative p-4 rounded-xl border transition-colors bg-white mb-2.5 ${
        isDragging
          ? "opacity-30 border-blue-500 shadow-md ring-2 ring-blue-500/20"
          : isAdded
          ? "bg-gray-50/60 border-gray-200/80"
          : "border-gray-200/80 hover:border-gray-300 shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
      }`}
    >
      <div className="flex items-start gap-3 justify-between">
        {!isAdded && !isMobile && (
          <div
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex-shrink-0 mt-0.5"
            title="Drag to test paper"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Header Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-md">
              {question.question_number || question.question_type}
            </span>

            {question.section && (
              <span className="text-[10px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                {question.section}
              </span>
            )}

            {(question.question_type === "diagram" || !!question.image_url) && (
              <DiagramBadge figRef={question.figure_ref} hasImage={!!question.image_url} />
            )}

            <DifficultyBadge difficulty={question.difficulty} />

            <span className="text-[10px] font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md ml-auto">
              {question.marks}m
            </span>
          </div>

          <QuestionContent question={question} truncateAt={isMobile ? 180 : 300} />
        </div>

        {/* Action Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isAdded) onAdd(question);
          }}
          disabled={isAdded}
          className={`flex-shrink-0 ml-2 rounded-xl text-xs font-semibold px-3 py-1.5 flex items-center gap-1 transition-all ${
            isAdded
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
              : "bg-gray-900 hover:bg-black text-white shadow-sm active:scale-95 cursor-pointer"
          }`}
        >
          {isAdded ? (
            <>
              <Check className="w-3.5 h-3.5" /> Added
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" /> Add
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Sortable Question (Test Paper Panel) ────────────────────────
function SortableTestQuestion({
  question,
  index,
  totalCount,
  onRemove,
  onEditMarks,
  onMoveUp,
  onMoveDown,
  isMobile,
}: {
  question: TestQuestion;
  index: number;
  totalCount: number;
  onRemove: (paperId: string) => void;
  onEditMarks: (paperId: string, marks: number) => void;
  onMoveUp: (paperId: string) => void;
  onMoveDown: (paperId: string) => void;
  isMobile: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({ id: question.paperId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`p-3.5 mb-2.5 rounded-xl border bg-white transition-colors ${
        isDragging
          ? "opacity-40 border-blue-500 shadow-lg ring-2 ring-blue-500/20"
          : "border-gray-200/80 hover:border-gray-300 shadow-sm"
      }`}
    >
      <div className="flex items-start gap-2.5 justify-between">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {/* Touch/Mouse Drag handle */}
          <div
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex-shrink-0 mt-0.5"
            title="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          <div className="w-6 h-6 rounded-lg bg-gray-900 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
            {index + 1}
          </div>

          <div className="flex-1 min-w-0">
            <QuestionContent question={question} truncateAt={isMobile ? 160 : 250} />

            <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-gray-400">
              <span className="font-medium text-gray-600">{question.chapter}</span>
              <span>•</span>
              <DifficultyBadge difficulty={question.difficulty} />
            </div>
          </div>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          {/* Quick Nudge Buttons */}
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg p-0.5">
            <button
              onClick={() => onMoveUp(question.paperId)}
              disabled={index === 0}
              className="p-1 rounded text-gray-500 hover:text-gray-900 hover:bg-white disabled:opacity-30 disabled:pointer-events-none"
              title="Move Up"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onMoveDown(question.paperId)}
              disabled={index === totalCount - 1}
              className="p-1 rounded text-gray-500 hover:text-gray-900 hover:bg-white disabled:opacity-30 disabled:pointer-events-none"
              title="Move Down"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Marks Picker */}
          <select
            value={question.marks}
            onChange={(e) => onEditMarks(question.paperId, Number(e.target.value))}
            className="bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-lg px-2 py-1 focus:ring-1 focus:ring-gray-900 outline-none cursor-pointer"
          >
            {[1, 2, 3, 4, 5, 6].map((m) => (
              <option key={m} value={m}>
                {m}m
              </option>
            ))}
          </select>

          {/* Delete Button */}
          <button
            onClick={() => onRemove(question.paperId)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Remove Question"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Droppable Paper Dropzone ────────────────────────────────────
function PaperDropZone({
  children,
  isDragging,
  isMobile,
}: {
  children: React.ReactNode;
  isDragging: boolean;
  isMobile: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: "paper-dropzone" });

  return (
    <div
      ref={setNodeRef}
      className={`p-3 rounded-xl transition-colors ${
        isOver
          ? "bg-blue-50/70 border-2 border-dashed border-blue-500"
          : isDragging
          ? "bg-gray-50 border-2 border-dashed border-gray-300"
          : "border-2 border-dashed border-transparent"
      } ${isMobile ? "min-h-[200px]" : "min-h-[500px]"}`}
    >
      {children}
    </div>
  );
}

// ── Chapter Bottom Sheet (Mobile) ───────────────────────────────
function ChapterBottomSheet({
  open,
  onClose,
  chapterStats,
  selectedChapter,
  onSelect,
  statsLoading,
  subject,
  classGrade,
}: {
  open: boolean;
  onClose: () => void;
  chapterStats: ChapterStat[];
  selectedChapter: string | null;
  onSelect: (chapter: string) => void;
  statsLoading: boolean;
  subject: string;
  classGrade: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      chapterStats.filter((c) =>
        c.chapter.toLowerCase().includes(search.toLowerCase())
      ),
    [chapterStats, search]
  );

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-h-[85vh] bg-white rounded-t-2xl flex flex-col shadow-2xl overflow-hidden"
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-gray-300" />
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">Select Chapter</h2>
              <p className="text-xs text-gray-500">
                {subject} • Class {classGrade} ({chapterStats.length} Chapters)
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:text-gray-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chapters..."
              autoFocus
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 divide-y divide-gray-50">
          {statsLoading ? (
            <div className="p-8 text-center text-gray-400 text-xs">Loading chapters...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs">No chapters found.</div>
          ) : (
            filtered.map((ch) => {
              const isSelected = selectedChapter === ch.chapter;
              return (
                <button
                  key={ch.chapter}
                  onClick={() => {
                    onSelect(ch.chapter);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between p-3.5 text-left rounded-xl transition-colors ${
                    isSelected ? "bg-blue-50/80 text-blue-700 font-semibold" : "hover:bg-gray-50 text-gray-800"
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium leading-snug">{ch.chapter}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{ch.total} questions</div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-blue-600 ml-2" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── Mobile Bottom Floating Bar ──────────────────────────────────
function MobileBottomBar({
  questionCount,
  totalMarks,
  onViewPaper,
  onOpenLibrary,
  activeScreen,
}: {
  questionCount: number;
  totalMarks: number;
  onViewPaper: () => void;
  onOpenLibrary: () => void;
  activeScreen: "library" | "paper";
}) {
  const isPaper = activeScreen === "paper";

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-lg flex items-center justify-between gap-3">
      <div>
        <div className="text-xs font-bold text-gray-900">
          {questionCount} Questions • {totalMarks} Marks
        </div>
        <div className="text-[11px] text-gray-500">
          {isPaper ? "Review & Export" : "Tap View Paper to review"}
        </div>
      </div>

      {isPaper ? (
        <button
          onClick={onOpenLibrary}
          className="bg-gray-900 hover:bg-black text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add Questions
        </button>
      ) : (
        <button
          onClick={onViewPaper}
          disabled={questionCount === 0}
          className={`text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5 ${
            questionCount === 0
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-gray-900 hover:bg-black text-white cursor-pointer active:scale-95"
          }`}
        >
          View Paper ({questionCount}) <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Main Page Component ─────────────────────────────────────────
export default function TestBuilderPage() {
  // Filters
  const [classGrade, setClassGrade] = useState("10");
  const [subject, setSubject] = useState("Science");

  const availableSubjects = useMemo(() => {
    return SUBJECTS_BY_CLASS[classGrade] || ["Science", "Mathematics"];
  }, [classGrade]);

  useEffect(() => {
    const valid = SUBJECTS_BY_CLASS[classGrade] || [];
    if (valid.length > 0 && !valid.includes(subject)) {
      setSubject(valid[0]);
    }
  }, [classGrade, subject]);

  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [questionType, setQuestionType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 250);

  // Mobile state
  const [mobileScreen, setMobileScreen] = useState<"library" | "paper">("library");
  const [showChapterSheet, setShowChapterSheet] = useState(false);

  // Data
  const [chapterStats, setChapterStats] = useState<ChapterStat[]>([]);
  const [libraryQuestions, setLibraryQuestions] = useState<NCERTQuestion[]>([]);
  const [testQuestions, setTestQuestions] = useState<TestQuestion[]>([]);
  const [examTitle, setExamTitle] = useState("Custom NCERT Test Paper");
  const [templateTier, setTemplateTier] = useState<"standard" | "premium">("standard");
  const [colorTheme, setColorTheme] = useState<"teal" | "navy" | "dark_green" | "orange">("teal");
  const [instituteName, setInstituteName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [duration, setDuration] = useState("");
  const [topic, setTopic] = useState("");
  const [includeExplanations, setIncludeExplanations] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const isMobile = useIsMobile();

  const addedIds = useMemo(
    () => new Set(testQuestions.map((q) => q.id)),
    [testQuestions]
  );

  const totalMarks = useMemo(
    () => testQuestions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0),
    [testQuestions]
  );

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // ── Fetch Chapter Stats with In-Memory Cache ──────────────────
  useEffect(() => {
    let cancelled = false;
    const cacheKey = `${subject}_${classGrade}`;

    if (statsCache[cacheKey]) {
      const cached = statsCache[cacheKey];
      setChapterStats(cached);
      setSelectedChapter((prev) => {
        if (prev && cached.some((c) => c.chapter === prev)) return prev;
        return cached.length > 0 ? cached[0].chapter : null;
      });
      return;
    }

    async function fetchStats() {
      setStatsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE}/test-generator/ncert-question-stats?subject=${encodeURIComponent(
            subject
          )}&class_grade=${classGrade}`,
          { headers: getAuthHeaders() }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled && data.ok) {
          const chs = data.chapters || [];
          statsCache[cacheKey] = chs;
          setChapterStats(chs);
          setSelectedChapter((prev) => {
            if (prev && chs.some((c: ChapterStat) => c.chapter === prev)) return prev;
            return chs.length > 0 ? chs[0].chapter : null;
          });
          setLibraryQuestions([]);
          setOffset(0);
        }
      } catch (err) {
        if (!cancelled) setError("Could not load chapters. Please check your connection.");
      }
      if (!cancelled) setStatsLoading(false);
    }

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, [classGrade, subject]);

  // ── Fetch Questions ───────────────────────────────────────────
  const fetchQuestions = useCallback(
    async (append = false) => {
      if (!selectedChapter) return;
      const currentOffset = append ? offset : 0;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          subject,
          class_grade: classGrade,
          chapter: selectedChapter,
          limit: String(PAGE_SIZE),
          offset: String(currentOffset),
        });
        if (questionType !== "all") params.set("question_type", questionType);
        if (debouncedSearch) params.set("search", debouncedSearch);

        const res = await fetch(
          `${API_BASE}/test-generator/ncert-questions?${params}`,
          { headers: getAuthHeaders() }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data.ok) {
          const questions = (data.questions || []).map((q: NCERTQuestion) => ({
            ...q,
            options: parseOptions(q.options),
          }));
          if (append) setLibraryQuestions((prev) => [...prev, ...questions]);
          else setLibraryQuestions(questions);
          setHasMore(data.hasMore || false);
          setOffset(currentOffset + questions.length);
        }
      } catch (err) {
        setError("Failed to fetch questions from NCERT repository.");
      }
      setLoading(false);
      setLoadingMore(false);
    },
    [selectedChapter, questionType, debouncedSearch, classGrade, subject, offset]
  );

  useEffect(() => {
    if (selectedChapter) {
      setOffset(0);
      setLibraryQuestions([]);
      fetchQuestions(false);
    }
  }, [selectedChapter, questionType, debouncedSearch]);

  // ── Paper Mutation Callbacks ──────────────────────────────────
  const addToTest = useCallback(
    (q: NCERTQuestion) => {
      if (addedIds.has(q.id)) return;
      const testQ: TestQuestion = {
        ...q,
        options: parseOptions(q.options),
        paperId: `paper-${q.id}-${Date.now()}`,
      };
      setTestQuestions((prev) => [...prev, testQ]);
      toast.success(`Added question Q${q.question_number || ""}`);
    },
    [addedIds]
  );

  const removeFromTest = useCallback((paperId: string) => {
    setTestQuestions((prev) => prev.filter((q) => q.paperId !== paperId));
  }, []);

  const editMarks = useCallback((paperId: string, marks: number) => {
    setTestQuestions((prev) =>
      prev.map((q) => (q.paperId === paperId ? { ...q, marks } : q))
    );
  }, []);

  const moveQuestion = useCallback((paperId: string, direction: -1 | 1) => {
    setTestQuestions((prev) => {
      const idx = prev.findIndex((q) => q.paperId === paperId);
      if (idx === -1) return prev;
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      return arrayMove(prev, idx, target);
    });
  }, []);

  // ── Drag & Drop Handlers ──────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeStr = String(active.id);
    const overStr = String(over.id);

    if (
      activeStr.startsWith("lib-") &&
      (overStr === "paper-dropzone" || overStr.startsWith("paper-"))
    ) {
      const libId = Number(activeStr.replace("lib-", ""));
      const q = libraryQuestions.find((q) => q.id === libId);
      if (q) addToTest(q);
      return;
    }

    if (activeStr.startsWith("paper-") && overStr.startsWith("paper-")) {
      const oldIndex = testQuestions.findIndex((q) => q.paperId === activeStr);
      const newIndex = testQuestions.findIndex((q) => q.paperId === overStr);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        setTestQuestions(arrayMove(testQuestions, oldIndex, newIndex));
      }
    }
  };

  // ── Export Flow & Auto-save ───────────────────────────────────
  const autoSaveTestToHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;

      const testId = crypto.randomUUID();
      const { error: testErr } = await supabase.from("tests").insert({
        id: testId,
        teacher_id: user.id,
        exam_title: examTitle || "Custom NCERT Test Paper",
        board: "CBSE",
        class_grade: `Class ${classGrade}`,
        subject: subject,
        status: "saved",
        total_questions: testQuestions.length,
        total_marks: totalMarks,
        created_at: new Date().toISOString(),
        paper_date: new Date().toLocaleDateString("en-GB"),
        cbse_pattern: false,
      });

      if (!testErr) {
        const qRows = testQuestions.map((q, idx) => ({
          test_id: testId,
          text: q.question_text || (q as any).text || "",
          options: Array.isArray(q.options) ? q.options : [],
          correct_answer: q.answer || (q as any).correctAnswer || (q as any).solution || "",
          explanation: (q as any).solution || (q as any).explanation || "",
          marks: q.marks || 1,
          difficulty: q.difficulty || "medium",
          chapter: q.chapter || selectedChapter || "",
          topic: q.topic || "",
          format: q.format || (q.options && q.options.length > 0 ? "mcq" : "short_answer"),
          position: idx + 1,
          image_url: q.image_url || undefined,
        }));
        await supabase.from("questions").insert(qRows);
      }
    } catch {
      // silently proceed
    }
  };

  const buildQuestionsPayload = (includeAnswers: boolean) =>
    testQuestions.map((q) => ({
      id: String(q.id),
      text: q.question_text,
      options: q.options || [],
      correctAnswer: includeAnswers ? q.answer || "" : "",
      explanation: "",
      marks: q.marks,
      difficulty: q.difficulty,
      chapter: q.chapter,
      format: q.options && q.options.length > 0 ? "mcq" : "short_answer",
      section: q.section,
      subParts: (q as any).subParts || (q as any).sub_parts || undefined,
      image_url: q.image_url || undefined,
      imageUrl: q.image_url || undefined,
      question_table: q.question_table || undefined,
      isManual: false,
      validationStatus: "valid",
    }));

  const handleExport = async (format: "pdf" | "docx") => {
    if (testQuestions.length === 0) {
      toast.error("Please add at least 1 question to the test paper!");
      return;
    }
    setExporting(true);
    autoSaveTestToHistory();

    try {
      const payload = {
        examTitle,
        board: "CBSE",
        classGrade: `Class ${classGrade}`,
        subject,
        format,
        includeAnswers: false,
        includeExplanations: false,
        template: templateTier === "premium" ? `${colorTheme}_premium` : colorTheme,
        teacher_name: teacherName || undefined,
        institute_name: instituteName || undefined,
        duration: duration || undefined,
        topic: topic || selectedChapter || testQuestions[0]?.chapter || undefined,
        paperDate: new Date().toLocaleDateString("en-GB"),
        questions: buildQuestionsPayload(false),
      };

      const res = await fetch(`${API_BASE}/test-generator/export`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Backend export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${examTitle.replace(/\s+/g, "_")}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Test Paper downloaded successfully!");
    } catch {
      if (format === "pdf") {
        try {
          await generateTestPaperPdf(
            {
              id: "temp",
              exam_title: examTitle || "Custom NCERT Test Paper",
              board: "CBSE",
              class_grade: `Class ${classGrade}`,
              subject,
              total_questions: testQuestions.length,
              total_marks: totalMarks,
              teacher_name: teacherName,
              institute_name: instituteName,
              duration,
            },
            testQuestions.map((q, idx) => ({
              position: idx + 1,
              text: q.question_text || (q as any).text || "",
              marks: q.marks,
              options: q.options,
              correct_answer: q.answer || (q as any).correctAnswer || "",
              explanation: "",
              image_url: q.image_url || undefined,
              imageUrl: q.image_url || undefined,
            }))
          );
          toast.success("Generated PDF via browser engine!");
          return;
        } catch {
          toast.error("Export failed. Please try again.");
        }
      } else {
        toast.error("Export failed. Please try again.");
      }
    } finally {
      setExporting(false);
    }
  };

  const handleExportAnswerKey = async (format: "pdf" | "docx") => {
    if (testQuestions.length === 0) {
      toast.error("Please add questions first!");
      return;
    }
    setExporting(true);
    autoSaveTestToHistory();

    try {
      const payload = {
        examTitle,
        board: "CBSE",
        classGrade: `Class ${classGrade}`,
        subject,
        format,
        includeExplanations,
        template: templateTier === "premium" ? `${colorTheme}_premium` : colorTheme,
        teacher_name: teacherName || undefined,
        institute_name: instituteName || undefined,
        duration: duration || undefined,
        topic: topic || selectedChapter || testQuestions[0]?.chapter || undefined,
        paperDate: new Date().toLocaleDateString("en-GB"),
        questions: buildQuestionsPayload(true),
      };

      const res = await fetch(`${API_BASE}/test-generator/export-answer-key`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Answer key export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${examTitle.replace(/\s+/g, "_")}_AnswerKey.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Answer Key downloaded successfully!");
    } catch {
      if (format === "pdf") {
        try {
          await generateAnswerKeyPdf(
            {
              id: "temp",
              exam_title: examTitle || "Custom NCERT Test Paper",
              board: "CBSE",
              class_grade: `Class ${classGrade}`,
              subject,
              total_questions: testQuestions.length,
              total_marks: totalMarks,
              teacher_name: teacherName,
              institute_name: instituteName,
              duration,
            },
            testQuestions.map((q, idx) => ({
              position: idx + 1,
              text: q.question_text || (q as any).text || "",
              marks: q.marks,
              options: q.options,
              correct_answer: q.answer || (q as any).correctAnswer || (q as any).solution || "",
              explanation: (q as any).solution || (q as any).explanation || "",
              image_url: q.image_url || undefined,
              imageUrl: q.image_url || undefined,
            }))
          );
          toast.success("Generated Answer Key PDF in browser!");
          return;
        } catch {
          toast.error("Could not export answer key.");
        }
      } else {
        toast.error("Could not export answer key.");
      }
    } finally {
      setExporting(false);
    }
  };

  // ── Render Library Question Stream ────────────────────────────
  const renderLibraryList = () => (
    <div>
      {loading ? (
        <div className="py-16 text-center text-gray-400 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
          <span className="text-xs">Loading questions...</span>
        </div>
      ) : libraryQuestions.length === 0 ? (
        <div className="py-16 text-center text-gray-400 flex flex-col items-center gap-2">
          <BookOpen className="w-8 h-8 text-gray-300 stroke-[1.5]" />
          <p className="text-xs font-medium text-gray-600">No questions match this filter.</p>
        </div>
      ) : (
        <>
          <SortableContext
            items={libraryQuestions.map((q) => `lib-${q.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {libraryQuestions.map((q) => (
              <DraggableQuestion
                key={q.id}
                question={q}
                onAdd={addToTest}
                isAdded={addedIds.has(q.id)}
                isMobile={isMobile}
              />
            ))}
          </SortableContext>

          {hasMore && (
            <button
              onClick={() => fetchQuestions(true)}
              disabled={loadingMore}
              className="w-full py-3 my-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {loadingMore ? "Loading more..." : "Load More Questions"}
            </button>
          )}
        </>
      )}
    </div>
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-[#F8F9FB] text-gray-900 pb-24">
        {/* Top Header Navbar */}
        <div className="bg-white border-b border-gray-200/80 sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Left Brand & Title */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-md">
                    NCERT Repository
                  </span>
                  <span className="text-xs text-gray-400 font-medium">• 1,00,000+ Questions</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight mt-0.5">
                  Test Paper Builder
                </h1>
              </div>

              {/* Right Primary Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Class Chips */}
                <div className="flex items-center bg-gray-100 p-0.5 rounded-xl border border-gray-200/70">
                  {CLASS_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setClassGrade(c)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-all ${
                        classGrade === c
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                {/* Subject Dropdown */}
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-800 outline-none focus:ring-1 focus:ring-gray-900 cursor-pointer shadow-sm"
                >
                  {availableSubjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                {/* Settings Toggle */}
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm ${
                    showSettings
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  }`}
                  title="Configure test details & template"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Settings</span>
                </button>
              </div>
            </div>

            {/* Test Title Input Bar */}
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
              <input
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                placeholder="Enter Test Paper Title (e.g. Science Mid-Term Unit Test)..."
                className="w-full text-sm font-medium text-gray-900 placeholder-gray-400 bg-transparent outline-none focus:ring-0"
              />
            </div>
          </div>
        </div>

        {/* Collapsible Paper Settings Card */}
        {showSettings && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
            <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-gray-700" />
                  <h3 className="text-sm font-bold text-gray-900">Paper Details & Template</h3>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Institute / Coaching Name
                  </label>
                  <input
                    value={instituteName}
                    onChange={(e) => setInstituteName(e.target.value)}
                    placeholder="e.g. Apex Academy"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Teacher Name
                  </label>
                  <input
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    placeholder="e.g. Prof. Sharma"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Duration
                  </label>
                  <input
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 1.5 Hours"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Subtitle / Topic
                  </label>
                  <input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={selectedChapter || "Chapter or Topic name"}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
              </div>

              {/* Template & Color */}
              <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700">Template:</span>
                  <div className="flex items-center bg-gray-100 p-0.5 rounded-xl border border-gray-200">
                    <button
                      onClick={() => setTemplateTier("standard")}
                      className={`text-xs font-semibold px-3 py-1 rounded-lg ${
                        templateTier === "standard" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
                      }`}
                    >
                      Standard
                    </button>
                    <button
                      onClick={() => setTemplateTier("premium")}
                      className={`text-xs font-semibold px-3 py-1 rounded-lg ${
                        templateTier === "premium" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
                      }`}
                    >
                      ✨ Premium
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700">Accent Color:</span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { id: "teal" as const, label: "Teal", color: "bg-teal-600" },
                      { id: "navy" as const, label: "Navy", color: "bg-blue-800" },
                      { id: "dark_green" as const, label: "Green", color: "bg-emerald-700" },
                      { id: "orange" as const, label: "Orange", color: "bg-orange-600" },
                    ].map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => setColorTheme(theme.id)}
                        className={`w-6 h-6 rounded-full ${theme.color} transition-all ${
                          colorTheme === theme.id ? "ring-2 ring-offset-2 ring-gray-900 scale-110" : "opacity-80"
                        }`}
                        title={theme.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs font-medium flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Mobile Tab Switcher */}
        {isMobile && (
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center bg-gray-200/80 p-1 rounded-xl">
              <button
                onClick={() => setMobileScreen("library")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  mobileScreen === "library"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600"
                }`}
              >
                Question Bank
              </button>
              <button
                onClick={() => setMobileScreen("paper")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  mobileScreen === "paper"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600"
                }`}
              >
                Test Paper ({testQuestions.length})
              </button>
            </div>
          </div>
        )}

        {/* Main Content Workspace */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          {/* DESKTOP 2-COLUMN VIEW */}
          {!isMobile && (
            <div className="grid grid-cols-12 gap-5 items-start">
              {/* LEFT: NCERT Question Library (7 cols) */}
              <div className="col-span-7 bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden">
                {/* Library Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-gray-700" />
                    <h2 className="text-sm font-bold text-gray-900">NCERT Question Library</h2>
                  </div>
                  <span className="text-xs text-gray-400 font-medium">
                    {chapterStats.length} Chapters
                  </span>
                </div>

                {/* Chapter Split Pane */}
                <div className="grid grid-cols-12 min-h-[580px]">
                  {/* Chapter Sidebar (4 cols) */}
                  <div className="col-span-4 border-r border-gray-100 bg-[#FAFAFC] p-2 space-y-1 max-h-[650px] overflow-y-auto">
                    {statsLoading ? (
                      <div className="p-4 text-center text-xs text-gray-400">Loading chapters...</div>
                    ) : chapterStats.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400">No chapters found.</div>
                    ) : (
                      chapterStats.map((ch) => {
                        const isSelected = selectedChapter === ch.chapter;
                        return (
                          <button
                            key={ch.chapter}
                            onClick={() => {
                              setSelectedChapter(ch.chapter);
                              setQuestionType("all");
                              setSearchQuery("");
                              setOffset(0);
                            }}
                            className={`w-full text-left p-2.5 rounded-xl text-xs transition-colors flex items-center justify-between gap-1 ${
                              isSelected
                                ? "bg-gray-900 text-white font-semibold shadow-sm"
                                : "text-gray-700 hover:bg-gray-100/80"
                            }`}
                          >
                            <span className="truncate leading-tight">{ch.chapter}</span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                                isSelected ? "bg-white/20 text-white" : "bg-gray-200/70 text-gray-600"
                              }`}
                            >
                              {ch.total}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Question Stream (8 cols) */}
                  <div className="col-span-8 p-3.5 max-h-[650px] overflow-y-auto">
                    {/* Filters */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search questions in chapter..."
                          className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-gray-900"
                        />
                      </div>

                      <select
                        value={questionType}
                        onChange={(e) => setQuestionType(e.target.value)}
                        className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-gray-700 outline-none focus:ring-1 focus:ring-gray-900 cursor-pointer"
                      >
                        {Object.entries(TYPE_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {renderLibraryList()}
                  </div>
                </div>
              </div>

              {/* RIGHT: Test Paper Live Workspace (5 cols) */}
              <div className="col-span-5 bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col">
                {/* Paper Summary Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Your Test Paper</h2>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                      <span className="font-semibold text-gray-800">{testQuestions.length} Questions</span>
                      <span>•</span>
                      <span className="font-semibold text-emerald-600">{totalMarks} Marks</span>
                      <span>•</span>
                      <span className="text-gray-400">~{Math.max(15, totalMarks * 1.5)} mins</span>
                    </div>
                  </div>

                  {testQuestions.length > 0 && (
                    <button
                      onClick={() => {
                        if (confirm("Reset and clear all questions from test paper?")) {
                          setTestQuestions([]);
                        }
                      }}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/70 border border-rose-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                  )}
                </div>

                {/* Paper Droppable List */}
                <div className="p-3.5 flex-1 max-h-[500px] overflow-y-auto">
                  <PaperDropZone isDragging={Boolean(activeId)} isMobile={false}>
                    {testQuestions.length === 0 ? (
                      <div className="py-20 text-center text-gray-400 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl">
                        <FileText className="w-8 h-8 text-gray-300 stroke-[1.5]" />
                        <p className="text-xs font-semibold text-gray-700">Test Paper is Empty</p>
                        <p className="text-[11px] text-gray-400 max-w-[200px]">
                          Click "+ Add" on any question from the library to include it in this test.
                        </p>
                      </div>
                    ) : (
                      <SortableContext
                        items={testQuestions.map((q) => q.paperId)}
                        strategy={verticalListSortingStrategy}
                      >
                        {testQuestions.map((q, i) => (
                          <SortableTestQuestion
                            key={q.paperId}
                            question={q}
                            index={i}
                            totalCount={testQuestions.length}
                            onRemove={removeFromTest}
                            onEditMarks={editMarks}
                            onMoveUp={(id) => moveQuestion(id, -1)}
                            onMoveDown={(id) => moveQuestion(id, 1)}
                            isMobile={false}
                          />
                        ))}
                      </SortableContext>
                    )}
                  </PaperDropZone>
                </div>

                {/* Export Control Deck */}
                {testQuestions.length > 0 && (
                  <div className="p-4 border-t border-gray-100 bg-[#FAFAFC] space-y-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                        Download Test Paper
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleExport("pdf")}
                          disabled={exporting}
                          className="bg-gray-900 hover:bg-black text-white font-semibold py-2.5 px-3 rounded-xl text-xs shadow-sm flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          Question Paper (PDF)
                        </button>

                        <button
                          onClick={() => handleExport("docx")}
                          disabled={exporting}
                          className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 font-semibold py-2.5 px-3 rounded-xl text-xs shadow-sm flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          Word (DOCX)
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-200/60">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Answer Key & Solutions
                        </div>
                        <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeExplanations}
                            onChange={(e) => setIncludeExplanations(e.target.checked)}
                            className="rounded border-gray-300 text-gray-900 focus:ring-0 cursor-pointer"
                          />
                          With Explanations
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleExportAnswerKey("pdf")}
                          disabled={exporting}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-xl text-xs shadow-sm flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <FileKey className="w-3.5 h-3.5" /> Answer Key (PDF)
                        </button>
                        <button
                          onClick={() => handleExportAnswerKey("docx")}
                          disabled={exporting}
                          className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-semibold py-2 px-3 rounded-xl text-xs shadow-sm flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          Answer Key (DOCX)
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MOBILE VIEW */}
          {isMobile && (
            <div>
              {mobileScreen === "library" ? (
                <div>
                  {/* Chapter Select Button */}
                  <button
                    onClick={() => setShowChapterSheet(true)}
                    className="w-full p-3.5 bg-white border border-gray-200/80 rounded-2xl mb-3 flex items-center justify-between text-left shadow-sm active:bg-gray-50"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                        Chapter
                      </span>
                      <span className="text-sm font-semibold text-gray-900 block truncate mt-0.5">
                        {selectedChapter || "Select a chapter..."}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">
                      Change ▾
                    </span>
                  </button>

                  {/* Filter Bar */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search questions..."
                        className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-gray-900 shadow-sm"
                      />
                    </div>

                    <select
                      value={questionType}
                      onChange={(e) => setQuestionType(e.target.value)}
                      className="bg-white border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-gray-700 outline-none shadow-sm"
                    >
                      {Object.entries(TYPE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {renderLibraryList()}
                </div>
              ) : (
                /* Mobile Test Paper Review */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-gray-900">
                        {testQuestions.length} Questions • {totalMarks} Marks
                      </h2>
                    </div>
                    {testQuestions.length > 0 && (
                      <button
                        onClick={() => {
                          if (confirm("Reset and clear all questions?")) setTestQuestions([]);
                        }}
                        className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-lg"
                      >
                        Reset All
                      </button>
                    )}
                  </div>

                  <PaperDropZone isDragging={Boolean(activeId)} isMobile>
                    {testQuestions.length === 0 ? (
                      <div className="py-16 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-white p-6">
                        <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-gray-700">Test Paper is Empty</p>
                        <p className="text-[11px] text-gray-400 mt-1">
                          Switch to Question Bank tab and tap "+ Add" on questions.
                        </p>
                      </div>
                    ) : (
                      <SortableContext
                        items={testQuestions.map((q) => q.paperId)}
                        strategy={verticalListSortingStrategy}
                      >
                        {testQuestions.map((q, i) => (
                          <SortableTestQuestion
                            key={q.paperId}
                            question={q}
                            index={i}
                            totalCount={testQuestions.length}
                            onRemove={removeFromTest}
                            onEditMarks={editMarks}
                            onMoveUp={(id) => moveQuestion(id, -1)}
                            onMoveDown={(id) => moveQuestion(id, 1)}
                            isMobile
                          />
                        ))}
                      </SortableContext>
                    )}
                  </PaperDropZone>

                  {/* Export Controls for Mobile */}
                  {testQuestions.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200/80 p-4 space-y-3 shadow-sm">
                      <button
                        onClick={() => handleExport("pdf")}
                        disabled={exporting}
                        className="w-full bg-gray-900 hover:bg-black text-white font-semibold py-3 px-4 rounded-xl text-xs shadow-sm flex items-center justify-center gap-2"
                      >
                        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Download Question Paper (PDF)
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleExport("docx")}
                          disabled={exporting}
                          className="bg-white border border-gray-200 text-gray-800 font-semibold py-2.5 px-3 rounded-xl text-xs"
                        >
                          DOCX Paper
                        </button>
                        <button
                          onClick={() => handleExportAnswerKey("pdf")}
                          disabled={exporting}
                          className="bg-emerald-600 text-white font-semibold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5"
                        >
                          <FileKey className="w-3.5 h-3.5" /> Answer Key
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile Floating Sticky Bar */}
        {isMobile && (
          <MobileBottomBar
            questionCount={testQuestions.length}
            totalMarks={totalMarks}
            onViewPaper={() => setMobileScreen("paper")}
            onOpenLibrary={() => setMobileScreen("library")}
            activeScreen={mobileScreen}
          />
        )}

        {/* Mobile Chapter Bottom Sheet Drawer */}
        <ChapterBottomSheet
          open={showChapterSheet}
          onClose={() => setShowChapterSheet(false)}
          chapterStats={chapterStats}
          selectedChapter={selectedChapter}
          onSelect={(chapter) => {
            setSelectedChapter(chapter);
            setQuestionType("all");
            setSearchQuery("");
            setOffset(0);
          }}
          statsLoading={statsLoading}
          subject={subject}
          classGrade={classGrade}
        />

        {/* Drag Overlay (Smooth Ghost Preview) */}
        <DragOverlay dropAnimation={defaultDropAnimation}>
          {activeId ? (
            <div className="p-3 bg-white border-2 border-gray-900 rounded-xl shadow-2xl max-w-xs text-xs font-medium text-gray-800 pointer-events-none truncate">
              {activeId.startsWith("lib-")
                ? libraryQuestions.find((q) => `lib-${q.id}` === activeId)?.question_text || "Dragging question..."
                : testQuestions.find((q) => q.paperId === activeId)?.question_text || "Reordering question..."}
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}