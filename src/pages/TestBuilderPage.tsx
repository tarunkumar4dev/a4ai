/**
 * TestBuilderPage.tsx — NCERT Drag & Drop Test Builder (Production v4.1 — God Level)
 *
 * Combines:
 *   - Mobile-first slide-up Chapter Bottom Sheet with search autofocus & ESC listener
 *   - Sticky bottom bar in clean light mode with sleek BLACK "View Paper" button
 *   - Both mobile reorder methods: Touch drag handle (⠿) + Quick ▲/▼ buttons
 *   - Export buttons with animated loading spinner (<Spinner />)
 *   - Smooth requestAnimationFrame useIsMobile hook
 *   - Full-width question cards on mobile, 2-panel split on desktop
 *   - Full KaTeX math, diagram badge, and responsive table support
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
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
import { toast } from "sonner";

// ── Config ──────────────────────────────────────────────────────
const API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  "http://localhost:8000"
).replace(/\/+$/, "");
const API_PREFIX = "/api/v1";
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
    let raf = 0;
    const handleResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() =>
        setIsMobile(window.innerWidth < breakpoint)
      );
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(raf);
    };
  }, [breakpoint]);
  return isMobile;
}

// ── Safe LaTeX Renderer ─────────────────────────────────────────
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
            <span key={i} style={{ fontFamily: "monospace", fontSize: 12 }}>
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Table Renderer ──────────────────────────────────────────────
function QuestionTableView({ table }: { table: QuestionTable }) {
  if (!table?.headers?.length) return null;
  return (
    <div
      style={{
        overflowX: "auto",
        margin: "8px 0",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <table
        style={{
          borderCollapse: "collapse",
          fontSize: 12,
          width: "100%",
          border: "1px solid #e2e8f0",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <thead>
          <tr style={{ background: "#f1f5f9" }}>
            {table.headers.map((h, i) => (
              <th
                key={i}
                style={{
                  padding: "6px 10px",
                  borderBottom: "1px solid #e2e8f0",
                  textAlign: "center",
                  fontWeight: 600,
                  color: "#334155",
                  fontSize: 11,
                  borderRight:
                    i < table.headers.length - 1
                      ? "1px solid #e2e8f0"
                      : "none",
                }}
              >
                {renderMathText(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr
              key={ri}
              style={{ background: ri % 2 === 0 ? "#fff" : "#fafbfc" }}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: "5px 10px",
                    textAlign: "center",
                    color: "#475569",
                    borderRight:
                      ci < row.length - 1 ? "1px solid #e2e8f0" : "none",
                    borderBottom:
                      ri < table.rows.length - 1
                        ? "1px solid #f1f5f9"
                        : "none",
                  }}
                >
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
  all: "All",
  exercise: "Exercise",
  example: "Examples",
  intext: "In-Text",
  activity: "Activities",
  hots: "HOTS",
  diagram: "Diagram",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "#16a34a",
  medium: "#ca8a04",
  hard: "#dc2626",
};

// ── Diagram Badge ───────────────────────────────────────────────
function DiagramBadge({
  figRef,
  hasImage,
}: {
  figRef?: string | null;
  hasImage?: boolean;
}) {
  if (hasImage) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          fontSize: 10,
          fontWeight: 600,
          color: "#047857",
          background: "#d1fae5",
          padding: "2px 8px",
          borderRadius: 4,
          marginLeft: 6,
          border: "1px solid #a7f3d0",
        }}
      >
        📷 {figRef ? `${figRef}` : "Diagram Included"}
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 10,
        fontWeight: 600,
        color: "#b45309",
        background: "#fef3c7",
        padding: "2px 8px",
        borderRadius: 4,
        marginLeft: 6,
        border: "1px solid #fde68a",
      }}
    >
      📐 {figRef ? `Refer ${figRef}` : "Diagram required"}
    </span>
  );
}

// ── Spinner ─────────────────────────────────────────────────────
function Spinner({
  size = 14,
  color = "#fff",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid ${color}40`,
        borderTopColor: color,
        borderRadius: "50%",
        animation: "tbspin 0.7s linear infinite",
        verticalAlign: "-2px",
        marginRight: 6,
      }}
    />
  );
}

// ── Question Content ────────────────────────────────────────────
function QuestionContent({
  question,
  truncateAt,
}: {
  question: NCERTQuestion;
  truncateAt?: number;
}) {
  const text = question.question_text || "";
  const displayText =
    truncateAt && text.length > truncateAt
      ? text.slice(0, truncateAt) + "…"
      : text;

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

  return (
    <div>
      <div style={{ color: "#1e293b" }}>{renderMathText(displayText)}</div>
      {parsedTable?.headers && <QuestionTableView table={parsedTable} />}
      {question.image_url && (
        <img
          src={question.image_url}
          alt="Question diagram"
          style={{
            maxWidth: "100%",
            maxHeight: 200,
            objectFit: "contain",
            marginTop: 6,
            borderRadius: 6,
            border: "1px solid #e2e8f0",
          }}
          loading="lazy"
        />
      )}
    </div>
  );
}

// ── Library Question Card ───────────────────────────────────────
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
    opacity: isDragging ? 0.35 : isAdded ? 0.55 : 1,
    padding: isMobile ? "12px 14px" : "10px 12px",
    marginBottom: 8,
    background: isAdded ? "#f8fafc" : "#fff",
    border: `1px solid ${
      isAdded ? "#cbd5e1" : isDragging ? "#6366f1" : "#e2e8f0"
    }`,
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 1.55,
    boxShadow: isDragging
      ? "0 8px 20px rgba(99,102,241,0.2)"
      : "0 1px 2px rgba(0,0,0,0.03)",
    transition: "opacity 0.15s, box-shadow 0.15s, border-color 0.15s",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        {/* Desktop Drag Handle */}
        {!isAdded && !isMobile && (
          <div
            {...listeners}
            style={{
              touchAction: "none",
              cursor: "grab",
              padding: "4px 7px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#94a3b8",
              userSelect: "none",
              borderRadius: 6,
              background: "#f1f5f9",
              marginTop: 2,
              flexShrink: 0,
            }}
            title="Drag to add to test paper"
            aria-label="Drag question"
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>⠿</span>
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              marginBottom: 4,
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#4f46e5",
                background: "#eef2ff",
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              {question.question_number || question.question_type}
            </span>
            {question.section && (
              <span
                style={{
                  fontSize: 10,
                  color: "#64748b",
                  background: "#f1f5f9",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                {question.section}
              </span>
            )}
            {(question.question_type === "diagram" || !!question.image_url) && (
              <DiagramBadge figRef={question.figure_ref} hasImage={!!question.image_url} />
            )}
          </div>

          <QuestionContent
            question={question}
            truncateAt={isMobile ? 150 : 220}
          />
        </div>

        {/* Tap-to-add action button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isAdded) onAdd(question);
          }}
          disabled={isAdded}
          style={{
            flexShrink: 0,
            border: "none",
            borderRadius: 8,
            padding: isMobile ? "8px 16px" : "5px 14px",
            fontSize: 12,
            fontWeight: 600,
            cursor: isAdded ? "default" : "pointer",
            background: isAdded ? "#e2e8f0" : "#4f46e5",
            color: isAdded ? "#94a3b8" : "#fff",
            transition: "all 0.15s ease",
            minWidth: isMobile ? 70 : "auto",
            minHeight: isMobile ? 42 : "auto",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: isAdded ? "none" : "0 2px 4px rgba(79, 70, 229, 0.2)",
          }}
        >
          {isAdded ? "✓ Added" : "+ Add"}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 8,
          fontSize: 11,
          color: "#94a3b8",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span
          style={{
            color: DIFFICULTY_COLORS[question.difficulty] || "#94a3b8",
            fontWeight: 500,
          }}
        >
          {question.difficulty}
        </span>
        <span>·</span>
        <span>{question.marks}m</span>
        <span>·</span>
        <span>
          {TYPE_LABELS[question.question_type] || question.question_type}
        </span>
        {parseOptions(question.options).length > 0 && (
          <>
            <span>·</span>
            <span>MCQ</span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sortable Test Question (Paper Panel) ─────────────────────────
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.paperId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    padding: isMobile ? "12px 14px" : "10px 12px",
    marginBottom: 8,
    background: isDragging ? "#eef2ff" : "#fff",
    border: `1px solid ${isDragging ? "#6366f1" : "#e2e8f0"}`,
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 1.55,
    boxShadow: isDragging
      ? "0 8px 20px rgba(99,102,241,0.2)"
      : "0 1px 2px rgba(0,0,0,0.03)",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* Touch Drag Handle: Supported on BOTH mobile & desktop */}
          <div
            {...listeners}
            style={{
              touchAction: "none",
              cursor: "grab",
              padding: isMobile ? "6px 8px" : "4px 8px",
              background: "#f1f5f9",
              borderRadius: 6,
              color: "#64748b",
              fontSize: isMobile ? 18 : 16,
              marginTop: 2,
              flexShrink: 0,
              userSelect: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: isMobile ? 32 : "auto",
              minHeight: isMobile ? 32 : "auto",
            }}
            title="Drag to reorder question in paper"
            aria-label="Drag to reorder"
          >
            ⠿
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <span
              style={{ fontWeight: 600, color: "#4f46e5", fontSize: 12 }}
            >
              Q{index + 1}.
            </span>{" "}
            <QuestionContent
              question={question}
              truncateAt={isMobile ? 160 : 250}
            />
            {(question.question_type === "diagram" || !!question.image_url) && (
              <DiagramBadge figRef={question.figure_ref} hasImage={!!question.image_url} />
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 4,
            flexShrink: 0,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          {/* Quick-nudge buttons for mobile single-tap reorder */}
          {isMobile && (
            <div style={{ display: "flex", gap: 3 }}>
              <button
                onClick={() => onMoveUp(question.paperId)}
                disabled={index === 0}
                style={{
                  background: index === 0 ? "#f8fafc" : "#f1f5f9",
                  color: index === 0 ? "#cbd5e1" : "#475569",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontSize: 12,
                  cursor: index === 0 ? "not-allowed" : "pointer",
                  minHeight: 34,
                }}
                aria-label="Move up"
                title="Move up"
              >
                ▲
              </button>
              <button
                onClick={() => onMoveDown(question.paperId)}
                disabled={index === totalCount - 1}
                style={{
                  background:
                    index === totalCount - 1 ? "#f8fafc" : "#f1f5f9",
                  color: index === totalCount - 1 ? "#cbd5e1" : "#475569",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontSize: 12,
                  cursor:
                    index === totalCount - 1 ? "not-allowed" : "pointer",
                  minHeight: 34,
                }}
                aria-label="Move down"
                title="Move down"
              >
                ▼
              </button>
            </div>
          )}

          <select
            value={question.marks}
            onChange={(e) =>
              onEditMarks(question.paperId, Number(e.target.value))
            }
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              padding: isMobile ? "6px 8px" : "2px 4px",
              fontSize: 11,
              cursor: "pointer",
              background: "#fff",
              fontWeight: 500,
              minHeight: isMobile ? 36 : "auto",
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((m) => (
              <option key={m} value={m}>
                {m}m
              </option>
            ))}
          </select>

          <button
            onClick={() => onRemove(question.paperId)}
            style={{
              background: "#fee2e2",
              color: "#dc2626",
              border: "none",
              borderRadius: 6,
              padding: isMobile ? "6px 10px" : "2px 8px",
              fontSize: 11,
              cursor: "pointer",
              fontWeight: 600,
              minHeight: isMobile ? 36 : "auto",
            }}
            aria-label="Remove question"
          >
            ✕
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 6,
          marginTop: 4,
          marginLeft: isMobile ? 0 : 28,
          fontSize: 11,
          color: "#94a3b8",
          flexWrap: "wrap",
        }}
      >
        <span>{question.chapter}</span>
        <span>·</span>
        <span
          style={{ color: DIFFICULTY_COLORS[question.difficulty] || "#94a3b8" }}
        >
          {question.difficulty}
        </span>
      </div>
    </div>
  );
}

// ── Droppable Paper Zone ────────────────────────────────────────
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
      style={{
        padding: 10,
        minHeight: isMobile ? 240 : 480,
        maxHeight: isMobile ? "none" : 650,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        borderRadius: 8,
        transition: "all 0.2s ease",
        background: isOver
          ? "#eef2ff"
          : isDragging
          ? "#f8fafc"
          : "transparent",
        border: isOver
          ? "2px dashed #4f46e5"
          : isDragging
          ? "2px dashed #cbd5e1"
          : "2px dashed transparent",
      }}
    >
      {children}
    </div>
  );
}

// ── Mobile Bottom Bar (with Black "View Paper" Button) ──────────
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
  const isPaperScreen = activeScreen === "paper";

  return (
    <div
      className="lg:hidden"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: "#ffffff",
        borderTop: "1px solid #e2e8f0",
        color: "#0f172a",
        padding: "12px 16px",
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          style={{
            margin: 0,
            fontWeight: 700,
            fontSize: 13,
            color: "#1e293b",
          }}
        >
          📝 {questionCount} Questions · {totalMarks} Marks
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>
          {questionCount === 0
            ? "Tap + Add on questions to build paper"
            : isPaperScreen
            ? "Ready to review and export"
            : "Tap to review test paper"}
        </p>
      </div>

      {isPaperScreen ? (
        <button
          onClick={onOpenLibrary}
          style={{
            background: "#4f46e5",
            color: "#ffffff",
            border: "none",
            borderRadius: 10,
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            flexShrink: 0,
            minHeight: 44,
            boxShadow: "0 2px 8px rgba(79, 70, 229, 0.25)",
          }}
        >
          + Add More
        </button>
      ) : (
        /* Black View Paper button as explicitly requested */
        <button
          onClick={onViewPaper}
          disabled={questionCount === 0}
          style={{
            background: questionCount === 0 ? "#cbd5e1" : "#0f172a",
            color: questionCount === 0 ? "#94a3b8" : "#ffffff",
            border: "none",
            borderRadius: 10,
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 600,
            cursor: questionCount === 0 ? "not-allowed" : "pointer",
            flexShrink: 0,
            minHeight: 44,
            boxShadow:
              questionCount === 0
                ? "none"
                : "0 2px 8px rgba(15, 23, 42, 0.3)",
          }}
        >
          View Paper ({questionCount}) →
        </button>
      )}
    </div>
  );
}

// ── Chapter Bottom Sheet ────────────────────────────────────────
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

  // Close on ESC key
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
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(15, 23, 42, 0.4)",
        display: "flex",
        alignItems: "flex-end",
        animation: "tbfade 0.15s ease",
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Select chapter"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxHeight: "85vh",
          background: "#ffffff",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "tbslide 0.2s ease",
          boxShadow: "0 -8px 30px rgba(0, 0, 0, 0.12)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "10px 0 6px",
          }}
        >
          <div
            style={{
              width: 44,
              height: 4,
              borderRadius: 2,
              background: "#cbd5e1",
            }}
          />
        </div>

        <div
          style={{
            padding: "8px 16px 12px",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                Select Chapter
              </h2>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                {subject} · Class {classGrade} ({chapterStats.length} Chapters)
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "#f1f5f9",
                border: "none",
                borderRadius: 8,
                width: 36,
                height: 36,
                fontSize: 16,
                cursor: "pointer",
                color: "#64748b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chapters…"
            autoFocus
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              fontSize: 13,
              boxSizing: "border-box",
              outline: "none",
              background: "#f8fafc",
            }}
          />
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "4px 0",
          }}
        >
          {statsLoading ? (
            <p
              style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}
            >
              Loading chapters…
            </p>
          ) : filtered.length === 0 ? (
            <p
              style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}
            >
              No chapters found.
            </p>
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
                  style={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 18px",
                    border: "none",
                    background: isSelected ? "#eef2ff" : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    borderLeft: isSelected
                      ? "4px solid #4f46e5"
                      : "4px solid transparent",
                    transition: "background 0.15s ease",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1, paddingRight: 10 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? "#4338ca" : "#1e293b",
                        lineHeight: 1.4,
                      }}
                    >
                      {ch.chapter}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#64748b",
                        marginTop: 2,
                      }}
                    >
                      {ch.total} questions
                      {ch.sections.length > 0 &&
                        ` · ${ch.sections.length} sections`}
                    </div>
                  </div>
                  {isSelected && (
                    <span
                      style={{
                        color: "#4f46e5",
                        fontSize: 18,
                        fontWeight: 700,
                        marginLeft: 8,
                      }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────
export default function TestBuilderPage() {
  // Filters
  const [classGrade, setClassGrade] = useState("10");
  const [subject, setSubject] = useState("Science");

  const availableSubjects = useMemo(() => {
    return SUBJECTS_BY_CLASS[classGrade] || ["Science", "Mathematics"];
  }, [classGrade]);

  // When class changes, ensure selected subject is valid for the new class
  useEffect(() => {
    const valid = SUBJECTS_BY_CLASS[classGrade] || [];
    if (valid.length > 0 && !valid.includes(subject)) {
      setSubject(valid[0]);
    }
  }, [classGrade, subject]);

  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [questionType, setQuestionType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Mobile screen state
  const [mobileScreen, setMobileScreen] = useState<"library" | "paper">(
    "library"
  );
  const [showChapterSheet, setShowChapterSheet] = useState(false);

  // Data
  const [chapterStats, setChapterStats] = useState<ChapterStat[]>([]);
  const [libraryQuestions, setLibraryQuestions] = useState<NCERTQuestion[]>([]);
  const [testQuestions, setTestQuestions] = useState<TestQuestion[]>([]);
  const [examTitle, setExamTitle] = useState("Untitled Test");
  const [templateTier, setTemplateTier] = useState<"standard" | "premium">(
    "standard"
  );
  const [colorTheme, setColorTheme] = useState<
    "teal" | "navy" | "dark_green" | "orange"
  >("teal");
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

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  // ── Fetch chapter stats ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function fetchStats() {
      setStatsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE}${API_PREFIX}/test-generator/ncert-question-stats?subject=${encodeURIComponent(
            subject
          )}&class_grade=${classGrade}`,
          { headers: getAuthHeaders() }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled && data.ok) {
          const chs = data.chapters || [];
          setChapterStats(chs);
          setSelectedChapter((prev) => {
            if (prev && chs.some((c: ChapterStat) => c.chapter === prev))
              return prev;
            return chs.length > 0 ? chs[0].chapter : null;
          });
          setLibraryQuestions([]);
          setOffset(0);
        }
      } catch (err) {
        if (!cancelled)
          setError("Failed to load chapters. Check your connection.");
        console.error("Stats fetch error:", err);
      }
      if (!cancelled) setStatsLoading(false);
    }
    fetchStats();
    return () => {
      cancelled = true;
    };
  }, [classGrade, subject]);

  // ── Fetch questions ───────────────────────────────────────────
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
          `${API_BASE}${API_PREFIX}/test-generator/ncert-questions?${params}`,
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
        setError("Failed to load questions.");
        console.error("Questions fetch error:", err);
      }
      setLoading(false);
      setLoadingMore(false);
    },
    [
      selectedChapter,
      questionType,
      debouncedSearch,
      classGrade,
      subject,
      offset,
    ]
  );

  useEffect(() => {
    if (selectedChapter) {
      setOffset(0);
      setLibraryQuestions([]);
      fetchQuestions(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChapter, questionType, debouncedSearch]);

  // ── Add / Remove / Edit / Move ────────────────────────────────
  const addToTest = useCallback(
    (q: NCERTQuestion) => {
      if (addedIds.has(q.id)) return;
      const testQ: TestQuestion = {
        ...q,
        options: parseOptions(q.options),
        paperId: `paper-${q.id}-${Date.now()}`,
      };
      setTestQuestions((prev) => [...prev, testQ]);
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

  // ── Drag handlers ────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) =>
    setActiveId(event.active.id as string);

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

  // ── Export ────────────────────────────────────────────────────
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
        console.log("[TestBuilder] Test auto-saved to history:", testId);
      }
    } catch (saveErr) {
      console.warn("[TestBuilder] Could not auto-save test to history:", saveErr);
    }
  };

  const handleExport = async (format: "pdf" | "docx") => {
    if (testQuestions.length === 0) {
      alert("Add questions to the test paper first!");
      return;
    }
    setExporting(true);
    // Auto-save test so it appears in Test History
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
        template:
          templateTier === "premium" ? `${colorTheme}_premium` : colorTheme,
        teacher_name: teacherName || undefined,
        institute_name: instituteName || undefined,
        duration: duration || undefined,
        topic:
          topic ||
          selectedChapter ||
          testQuestions[0]?.chapter ||
          undefined,
        paperDate: new Date().toLocaleDateString("en-GB"),
        questions: buildQuestionsPayload(false),
      };
      const res = await fetch(
        `${API_BASE}${API_PREFIX}/test-generator/export`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${examTitle.replace(/\s+/g, "_")}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Test paper exported successfully!");
    } catch (err) {
      console.warn("Backend export error, attempting client-side generator:", err);
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
              correct_answer: q.answer || (q as any).correctAnswer || (q as any).solution || "",
              explanation: (q as any).solution || (q as any).explanation || "",
              image_url: q.image_url || undefined,
              imageUrl: q.image_url || undefined,
            }))
          );
          toast.success("Generated Question Paper PDF in browser!");
          return;
        } catch (pdfErr) {
          console.error("Client PDF generation error:", pdfErr);
        }
      }
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportAnswerKey = async (format: "pdf" | "docx") => {
    if (testQuestions.length === 0) {
      alert("Add questions to the test paper first!");
      return;
    }
    setExporting(true);
    // Auto-save test so it appears in Test History
    autoSaveTestToHistory();

    try {
      const payload = {
        examTitle,
        board: "CBSE",
        classGrade: `Class ${classGrade}`,
        subject,
        format,
        includeExplanations,
        template:
          templateTier === "premium" ? `${colorTheme}_premium` : colorTheme,
        teacher_name: teacherName || undefined,
        institute_name: instituteName || undefined,
        duration: duration || undefined,
        topic:
          topic ||
          selectedChapter ||
          testQuestions[0]?.chapter ||
          undefined,
        paperDate: new Date().toLocaleDateString("en-GB"),
        questions: buildQuestionsPayload(true),
      };
      const res = await fetch(
        `${API_BASE}${API_PREFIX}/test-generator/export-answer-key`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error("Answer key export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${examTitle.replace(/\s+/g, "_")}_AnswerKey.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Answer key exported successfully!");
    } catch (err) {
      console.warn("Backend answer key error, attempting client-side generator:", err);
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
        } catch (pdfErr) {
          console.error("Client PDF generation error:", pdfErr);
        }
      }
      alert("Answer key export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // ── Computed ──────────────────────────────────────────────────
  const totalMarks = testQuestions.reduce((sum, q) => sum + q.marks, 0);

  // ── Render: Library Questions List ────────────────────────────
  const renderLibraryList = () => (
    <>
      {loading ? (
        <p
          style={{
            color: "#94a3b8",
            fontSize: 13,
            textAlign: "center",
            paddingTop: 40,
          }}
        >
          Loading questions…
        </p>
      ) : libraryQuestions.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            paddingTop: 40,
            color: "#94a3b8",
          }}
        >
          <p style={{ fontSize: 28, marginBottom: 8 }}>📖</p>
          <p style={{ fontSize: 13 }}>No questions match this filter.</p>
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
              style={{
                display: "block",
                width: "100%",
                padding: "12px",
                marginTop: 8,
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                fontSize: 13,
                color: "#4f46e5",
                cursor: loadingMore ? "wait" : "pointer",
                fontWeight: 600,
                minHeight: 44,
              }}
            >
              {loadingMore ? "Loading more…" : "Load more questions"}
            </button>
          )}
        </>
      )}
    </>
  );

  // ── Render: Mobile Library Screen ─────────────────────────────
  const renderMobileLibrary = () => (
    <div style={{ paddingBottom: 100 }}>
      {/* Chapter Trigger Card */}
      <button
        onClick={() => setShowChapterSheet(true)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          background: "#ffffff",
          border: "1px solid #cbd5e1",
          borderRadius: 12,
          marginBottom: 10,
          cursor: "pointer",
          textAlign: "left",
          minHeight: 56,
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              color: "#64748b",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Chapter
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#1e293b",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {selectedChapter || "Select a chapter…"}
          </div>
        </div>
        <span
          style={{
            color: "#4f46e5",
            fontSize: 12,
            fontWeight: 700,
            background: "#eef2ff",
            padding: "4px 10px",
            borderRadius: 6,
            marginLeft: 8,
          }}
        >
          Change ▾
        </span>
      </button>

      {/* Search & Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search questions in chapter…"
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            fontSize: 13,
            outline: "none",
            boxSizing: "border-box",
            minHeight: 44,
            background: "#fff",
          }}
        />
        <select
          value={questionType}
          onChange={(e) => setQuestionType(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            fontSize: 13,
            background: "#fff",
            fontWeight: 500,
            minHeight: 44,
          }}
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
  );

  // ── Render: Mobile Paper Screen ───────────────────────────────
  const renderMobilePaper = () => (
    <div style={{ paddingBottom: 100 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
          Questions ({testQuestions.length}) · {totalMarks} Marks
        </div>
        {testQuestions.length > 0 && (
          <button
            onClick={() => {
              if (confirm("Remove all questions from paper?"))
                setTestQuestions([]);
            }}
            style={{
              background: "#fee2e2",
              border: "none",
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 11,
              color: "#dc2626",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Reset All
          </button>
        )}
      </div>

      <PaperDropZone isDragging={Boolean(activeId)} isMobile>
        {testQuestions.length === 0 ? (
          <div
            style={{
              border: "2px dashed #cbd5e1",
              borderRadius: 12,
              padding: "50px 20px",
              textAlign: "center",
              color: "#94a3b8",
              background: "#fafbfc",
            }}
          >
            <p style={{ fontSize: 32, marginBottom: 8 }}>📄</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>
              Your test paper is empty
            </p>
            <p style={{ fontSize: 12, marginTop: 4, color: "#94a3b8" }}>
              Tap "+ Add More" below or switch to Library tab
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
                isMobile={isMobile}
              />
            ))}
          </SortableContext>
        )}
      </PaperDropZone>

      {/* Export Section */}
      {testQuestions.length > 0 && (
        <div
          style={{
            marginTop: 16,
            background: "#f8fafc",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            padding: 14,
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#64748b",
                margin: "0 0 8px",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Question Paper
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => handleExport("pdf")}
                disabled={exporting}
                style={{
                  background: "#0f172a",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: exporting ? "not-allowed" : "pointer",
                  opacity: exporting ? 0.6 : 1,
                  flex: 1,
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {exporting && <Spinner />}
                📄 PDF
              </button>
              <button
                onClick={() => handleExport("docx")}
                disabled={exporting}
                style={{
                  background: "#ffffff",
                  color: "#0f172a",
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: exporting ? "not-allowed" : "pointer",
                  opacity: exporting ? 0.6 : 1,
                  flex: 1,
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {exporting && <Spinner color="#0f172a" />}
                📄 DOCX
              </button>
            </div>
          </div>

          <div
            style={{
              borderTop: "1px dashed #e2e8f0",
              paddingTop: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748b",
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Answer Key
              </p>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={includeExplanations}
                  onChange={(e) => setIncludeExplanations(e.target.checked)}
                  style={{ cursor: "pointer", width: 16, height: 16 }}
                />
                Explanations
              </label>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => handleExportAnswerKey("pdf")}
                disabled={exporting}
                style={{
                  background: "#059669",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: exporting ? "not-allowed" : "pointer",
                  opacity: exporting ? 0.6 : 1,
                  flex: 1,
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {exporting && <Spinner />}
                🔑 PDF
              </button>
              <button
                onClick={() => handleExportAnswerKey("docx")}
                disabled={exporting}
                style={{
                  background: "#ffffff",
                  color: "#059669",
                  border: "1px solid #059669",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: exporting ? "not-allowed" : "pointer",
                  opacity: exporting ? 0.6 : 1,
                  flex: 1,
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {exporting && <Spinner color="#059669" />}
                🔑 DOCX
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── Render: Desktop 2-Panel ───────────────────────────────────
  const renderDesktop = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      {/* LEFT: NCERT Question Library */}
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#fafbfc",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
            fontWeight: 600,
            fontSize: 14,
            color: "#0f172a",
          }}
        >
          NCERT Question Library
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "220px 1fr",
            minHeight: 500,
          }}
        >
          {/* Chapter sidebar */}
          <div
            style={{
              borderRight: "1px solid #e2e8f0",
              padding: "6px 0",
              maxHeight: 600,
              overflowY: "auto",
              background: "#f1f5f9",
            }}
          >
            {statsLoading ? (
              <p style={{ padding: 12, color: "#94a3b8", fontSize: 13 }}>
                Loading…
              </p>
            ) : chapterStats.length === 0 ? (
              <p
                style={{
                  padding: 12,
                  color: "#94a3b8",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                No questions found for {subject} Class {classGrade}.
              </p>
            ) : (
              chapterStats.map((ch) => (
                <button
                  key={ch.chapter}
                  onClick={() => {
                    setSelectedChapter(ch.chapter);
                    setQuestionType("all");
                    setSearchQuery("");
                    setOffset(0);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "7px 12px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    lineHeight: 1.4,
                    background:
                      selectedChapter === ch.chapter
                        ? "#e0e7ff"
                        : "transparent",
                    color:
                      selectedChapter === ch.chapter ? "#4338ca" : "#334155",
                    fontWeight: selectedChapter === ch.chapter ? 600 : 400,
                    borderLeft:
                      selectedChapter === ch.chapter
                        ? "3px solid #6366f1"
                        : "3px solid transparent",
                  }}
                >
                  {ch.chapter}
                  <span
                    style={{
                      display: "block",
                      fontSize: 10,
                      color:
                        selectedChapter === ch.chapter
                          ? "#6366f1"
                          : "#94a3b8",
                    }}
                  >
                    {ch.total} questions
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Question List */}
          <div
            style={{
              padding: 12,
              maxHeight: 600,
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {selectedChapter ? (
              <>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search questions…"
                    style={{
                      flex: 1,
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 12,
                      background: "#fff",
                    }}
                  />
                  <select
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value)}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 12,
                      background: "#fff",
                    }}
                  >
                    {Object.entries(TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {renderLibraryList()}
              </>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  paddingTop: 60,
                  color: "#94a3b8",
                }}
              >
                <p style={{ fontSize: 28, marginBottom: 8 }}>📖</p>
                <p style={{ fontSize: 13 }}>
                  Select a chapter to browse questions
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: Test Paper */}
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#fafbfc",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span
              style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}
            >
              Your Test Paper
            </span>
            <span
              style={{ fontSize: 12, color: "#64748b", marginLeft: 8 }}
            >
              {testQuestions.length} questions · {totalMarks} marks
            </span>
          </div>
          {testQuestions.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Remove all questions from paper?"))
                  setTestQuestions([]);
              }}
              style={{
                background: "none",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "4px 10px",
                fontSize: 11,
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              Reset
            </button>
          )}
        </div>

        <PaperDropZone isDragging={Boolean(activeId)} isMobile={false}>
          {testQuestions.length === 0 ? (
            <div
              style={{
                border: "2px dashed #cbd5e1",
                borderRadius: 12,
                padding: "60px 20px",
                textAlign: "center",
                color: "#94a3b8",
                minHeight: 300,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <p style={{ fontSize: 28, marginBottom: 8 }}>📄</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>
                Drop questions here to build your test
              </p>
              <p style={{ fontSize: 12, marginTop: 4, color: "#94a3b8" }}>
                Or click "+ Add" on any question
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

        {testQuestions.length > 0 && (
          <div
            style={{
              padding: "12px 16px",
              borderTop: "1px solid #e2e8f0",
              background: "#f8fafc",
            }}
          >
            <div style={{ marginBottom: 10 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748b",
                  margin: "0 0 6px",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Question Paper
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => handleExport("pdf")}
                  disabled={exporting}
                  style={{
                    background: "#0f172a",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 20px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: exporting ? "not-allowed" : "pointer",
                    opacity: exporting ? 0.6 : 1,
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {exporting && <Spinner />}
                  📄 Download PDF
                </button>
                <button
                  onClick={() => handleExport("docx")}
                  disabled={exporting}
                  style={{
                    background: "#ffffff",
                    color: "#0f172a",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "8px 20px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: exporting ? "not-allowed" : "pointer",
                    opacity: exporting ? 0.6 : 1,
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {exporting && <Spinner color="#0f172a" />}
                  📄 Download DOCX
                </button>
              </div>
            </div>

            <div
              style={{
                borderTop: "1px dashed #e2e8f0",
                paddingTop: 10,
                marginTop: 4,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    margin: 0,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Answer Key (separate file)
                </p>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    color: "#64748b",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={includeExplanations}
                    onChange={(e) => setIncludeExplanations(e.target.checked)}
                    style={{ cursor: "pointer" }}
                  />
                  Include explanations
                </label>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => handleExportAnswerKey("pdf")}
                  disabled={exporting}
                  style={{
                    background: "#059669",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 20px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: exporting ? "not-allowed" : "pointer",
                    opacity: exporting ? 0.6 : 1,
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {exporting && <Spinner />}
                  🔑 Answer Key (PDF)
                </button>
                <button
                  onClick={() => handleExportAnswerKey("docx")}
                  disabled={exporting}
                  style={{
                    background: "#ffffff",
                    color: "#059669",
                    border: "1px solid #059669",
                    borderRadius: 8,
                    padding: "8px 20px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: exporting ? "not-allowed" : "pointer",
                    opacity: exporting ? 0.6 : 1,
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {exporting && <Spinner color="#059669" />}
                  🔑 Answer Key (DOCX)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── Main Render ───────────────────────────────────────────────
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <style>{`
        @keyframes tbfade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes tbslide { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes tbspin { to { transform: rotate(360deg) } }
      `}</style>

      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: isMobile ? "16px 14px 100px" : "20px 16px",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: isMobile ? 12 : 16 }}>
          <h1
            style={{
              fontSize: isMobile ? 18 : 22,
              fontWeight: 700,
              color: "#0f172a",
              margin: 0,
            }}
          >
            {isMobile && mobileScreen === "paper"
              ? "Your Test Paper"
              : "NCERT Test Builder"}
          </h1>
          <p style={{ color: "#64748b", fontSize: isMobile ? 12 : 13, margin: "4px 0 0" }}>
            Browse over 1,00,000 NCERT questions across 1,000 chapters — drag or
            click to build your test paper.
          </p>
        </div>

        {/* Primary Selectors: Class, Subject, Title */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "100px 160px 1fr",
            gap: 10,
            marginBottom: 12,
            alignItems: "flex-end",
          }}
        >
          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#64748b",
                display: "block",
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Class
            </label>
            <select
              value={classGrade}
              onChange={(e) => setClassGrade(e.target.value)}
              style={{
                padding: isMobile ? "10px 12px" : "7px 12px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                fontSize: 13,
                width: "100%",
                background: "#fff",
                fontWeight: 500,
                minHeight: isMobile ? 44 : "auto",
              }}
            >
              {CLASS_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  Class {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#64748b",
                display: "block",
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Subject
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{
                padding: isMobile ? "10px 12px" : "7px 12px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                fontSize: 13,
                width: "100%",
                background: "#fff",
                fontWeight: 500,
                minHeight: isMobile ? 44 : "auto",
              }}
            >
              {availableSubjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Title on desktop */}
          {!isMobile && (
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748b",
                  display: "block",
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Test Title
              </label>
              <input
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                placeholder="Enter test title…"
                style={{
                  padding: "7px 12px",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  width: "100%",
                  boxSizing: "border-box",
                  background: "#fff",
                }}
              />
            </div>
          )}
        </div>

        {/* Title on mobile */}
        {isMobile && (
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#64748b",
                display: "block",
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Test Title
            </label>
            <input
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              placeholder="e.g. Unit Test 1…"
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                fontSize: 13,
                width: "100%",
                boxSizing: "border-box",
                background: "#fff",
                minHeight: 44,
              }}
            />
          </div>
        )}

        {/* Settings toggle */}
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "12px 14px",
              background: "#f1f5f9",
              color: "#334155",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>⚙️</span>
              {isMobile
                ? "Paper Details & Template (Optional)"
                : "More Paper Details (Institute, Teacher, Template, Color)"}
            </span>
            <span style={{ color: "#4f46e5", fontWeight: 700 }}>
              {showSettings ? "▲ Hide" : "▼ Edit"}
            </span>
          </button>
        </div>

        {/* Collapsible settings */}
        {showSettings && (
          <div
            style={{
              marginBottom: 16,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: isMobile ? "100%" : 180 }}>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#64748b",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Institute / Coaching Name
                </label>
                <input
                  value={instituteName}
                  onChange={(e) => setInstituteName(e.target.value)}
                  placeholder="e.g., DeepJyoti Coaching Institute"
                  style={{
                    padding: isMobile ? "10px 12px" : "6px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    width: "100%",
                    boxSizing: "border-box",
                    background: "#fff",
                    minHeight: isMobile ? 44 : "auto",
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: isMobile ? "100%" : 140 }}>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#64748b",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Teacher Name
                </label>
                <input
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="e.g., Mr. Sharma"
                  style={{
                    padding: isMobile ? "10px 12px" : "6px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    width: "100%",
                    boxSizing: "border-box",
                    background: "#fff",
                    minHeight: isMobile ? 44 : "auto",
                  }}
                />
              </div>
              <div style={{ minWidth: isMobile ? "100%" : 100 }}>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#64748b",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Duration
                </label>
                <input
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g., 1 hr"
                  style={{
                    padding: isMobile ? "10px 12px" : "6px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    width: "100%",
                    boxSizing: "border-box",
                    background: "#fff",
                    minHeight: isMobile ? 44 : "auto",
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: isMobile ? "100%" : 160 }}>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#64748b",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Topic / Subtitle
                </label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={
                    selectedChapter
                      ? `e.g., ${selectedChapter}`
                      : "e.g., Unit 1"
                  }
                  style={{
                    padding: isMobile ? "10px 12px" : "6px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    width: "100%",
                    boxSizing: "border-box",
                    background: "#fff",
                    minHeight: isMobile ? 44 : "auto",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 20,
                flexWrap: "wrap",
                alignItems: "flex-start",
                marginTop: 14,
              }}
            >
              <div style={{ flex: isMobile ? "1 1 100%" : "0 0 auto" }}>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#64748b",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Paper Template
                </label>
                <div
                  style={{
                    display: "flex",
                    borderRadius: 10,
                    overflow: "hidden",
                    border: "1px solid #cbd5e1",
                    width: "100%",
                  }}
                >
                  {[
                    { id: "standard" as const, label: "⚡ Standard" },
                    { id: "premium" as const, label: "✨ Premium" },
                  ].map((tier) => (
                    <button
                      key={tier.id}
                      onClick={() => setTemplateTier(tier.id)}
                      style={{
                        flex: 1,
                        padding: isMobile ? "10px 8px" : "8px 18px",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                        background:
                          templateTier === tier.id ? "#0f172a" : "#fff",
                        color:
                          templateTier === tier.id ? "#fff" : "#374151",
                        transition: "all 0.15s",
                        minHeight: isMobile ? 44 : "auto",
                      }}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ flex: isMobile ? "1 1 100%" : "0 0 auto" }}>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#64748b",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Paper Color
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { id: "teal" as const, label: "Teal", color: "#0f766e" },
                    {
                      id: "navy" as const,
                      label: "Navy",
                      color: "#1e3a8a",
                    },
                    {
                      id: "dark_green" as const,
                      label: "Green",
                      color: "#166534",
                    },
                    {
                      id: "orange" as const,
                      label: "Orange",
                      color: "#c2410c",
                    },
                  ].map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setColorTheme(theme.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: isMobile ? "8px 12px" : "6px 14px",
                        borderRadius: 10,
                        border:
                          colorTheme === theme.id
                            ? `2px solid ${theme.color}`
                            : "1px solid #cbd5e1",
                        background:
                          colorTheme === theme.id
                            ? `${theme.color}15`
                            : "#fff",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                        color:
                          colorTheme === theme.id ? theme.color : "#334155",
                        transition: "all 0.15s",
                        minHeight: isMobile ? 42 : "auto",
                      }}
                    >
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          background: theme.color,
                          border: "1px solid rgba(0,0,0,0.1)",
                        }}
                      />
                      {theme.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div
            style={{
              padding: "10px 14px",
              marginBottom: 12,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 10,
              color: "#dc2626",
              fontSize: 13,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ flex: 1 }}>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{
                background: "none",
                border: "none",
                color: "#dc2626",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 16,
                padding: 4,
                flexShrink: 0,
              }}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Mobile Tab Switcher */}
        {isMobile && (
          <div
            style={{
              display: "flex",
              background: "#f1f5f9",
              padding: 4,
              borderRadius: 12,
              marginBottom: 14,
              gap: 4,
            }}
          >
            <button
              onClick={() => setMobileScreen("library")}
              style={{
                flex: 1,
                padding: "10px 12px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                background:
                  mobileScreen === "library" ? "#ffffff" : "transparent",
                color:
                  mobileScreen === "library" ? "#4f46e5" : "#64748b",
                boxShadow:
                  mobileScreen === "library"
                    ? "0 2px 6px rgba(0,0,0,0.06)"
                    : "none",
                transition: "all 0.15s ease",
                minHeight: 44,
              }}
            >
              📚 Question Library
            </button>
            <button
              onClick={() => setMobileScreen("paper")}
              style={{
                flex: 1,
                padding: "10px 12px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                background:
                  mobileScreen === "paper" ? "#ffffff" : "transparent",
                color:
                  mobileScreen === "paper" ? "#4f46e5" : "#64748b",
                boxShadow:
                  mobileScreen === "paper"
                    ? "0 2px 6px rgba(0,0,0,0.06)"
                    : "none",
                transition: "all 0.15s ease",
                minHeight: 44,
              }}
            >
              📝 Test Paper ({testQuestions.length})
            </button>
          </div>
        )}

        {/* Main Content Area */}
        {isMobile
          ? mobileScreen === "paper"
            ? renderMobilePaper()
            : renderMobileLibrary()
          : renderDesktop()}
      </div>

      {/* Mobile Sticky Bottom Bar */}
      {isMobile && (
        <MobileBottomBar
          questionCount={testQuestions.length}
          totalMarks={totalMarks}
          onViewPaper={() => setMobileScreen("paper")}
          onOpenLibrary={() => setMobileScreen("library")}
          activeScreen={mobileScreen}
        />
      )}

      {/* Mobile Chapter Bottom Sheet */}
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

      <DragOverlay dropAnimation={defaultDropAnimation}>
        {activeId ? (
          <div
            style={{
              padding: "10px 14px",
              background: "#ffffff",
              border: "2px solid #4f46e5",
              borderRadius: 10,
              fontSize: 13,
              boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
              maxWidth: 320,
              cursor: "grabbing",
              touchAction: "none",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#4f46e5",
                  background: "#eef2ff",
                  padding: "1px 6px",
                  borderRadius: 4,
                }}
              >
                Dragging Question
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "#1e293b",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {activeId.startsWith("lib-")
                ? libraryQuestions.find((q) => `lib-${q.id}` === activeId)
                    ?.question_text || "Question"
                : testQuestions.find((q) => q.paperId === activeId)
                    ?.question_text || "Question"}
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}