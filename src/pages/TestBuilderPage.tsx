/**
 * TestBuilderPage.tsx — NCERT Drag & Drop Test Builder (Production v2.1)
 *
 * FIXES from v1:
 *   - API_BASE from env (no trailing /api/v1)
 *   - API_PREFIX constant to avoid double /api/v1
 *   - KaTeX error boundary (malformed LaTeX won't crash page)
 *   - Search debounce (300ms)
 *   - Pagination with "Load More"
 *   - Auth token in all API calls
 *   - Table rendering for Statistics/Accountancy questions
 *   - Diagram badge with figure reference
 *   - Export loading state
 *   - Options JSON parsing safety
 *   - Empty/error states
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
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

// ── Config ──────────────────────────────────────────────────────
// NOTE: VITE_API_URL must NOT include /api/v1 — prefix is added below.
// Example: VITE_API_URL=https://rag-backend-kappa-three.vercel.app
const API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const API_PREFIX = "/api/v1";

const PAGE_SIZE = 30;

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
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const raw = localStorage.getItem("sb-dcmnzvjftmdbywrjkust-auth-token");
    if (raw) {
      const parsed = JSON.parse(raw);
      const token = parsed?.access_token;
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
  } catch {
    /* no auth token available */
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
    <div style={{ overflowX: "auto", margin: "8px 0" }}>
      <table
        style={{
          borderCollapse: "collapse",
          fontSize: 12,
          width: "100%",
          border: "1px solid #e2e8f0",
          borderRadius: 4,
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
                    i < table.headers.length - 1 ? "1px solid #e2e8f0" : "none",
                }}
              >
                {renderMathText(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "#fafbfc" }}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: "5px 10px",
                    textAlign: "center",
                    color: "#475569",
                    borderRight: ci < row.length - 1 ? "1px solid #e2e8f0" : "none",
                    borderBottom:
                      ri < table.rows.length - 1 ? "1px solid #f1f5f9" : "none",
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

// ── Subjects & Classes ──────────────────────────────────────────
const CLASS_OPTIONS = ["6", "7", "8", "9", "10", "11", "12"];
const SUBJECT_OPTIONS = [
  "Science",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "English",
  "History",
  "Geography",
  "Political Science",
  "Economics",
  "Accountancy",
  "Business Studies",
];

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

function DiagramBadge({ figRef }: { figRef?: string | null }) {
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

// ── Question Content (shared) ───────────────────────────────────

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
            maxWidth: 280,
            maxHeight: 200,
            marginTop: 6,
            borderRadius: 4,
            border: "1px solid #e2e8f0",
          }}
          loading="lazy"
        />
      )}
    </div>
  );
}

// ── Draggable Question Card (Library) ───────────────────────────

function DraggableQuestion({
  question,
  onAdd,
  isAdded,
}: {
  question: NCERTQuestion;
  onAdd: (q: NCERTQuestion) => void;
  isAdded: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({ id: `lib-${question.id}` });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.4 : isAdded ? 0.55 : 1,
    padding: "10px 12px",
    marginBottom: 6,
    background: isAdded ? "#f8fafc" : "#fff",
    border: `1px solid ${isAdded ? "#cbd5e1" : "#e2e8f0"}`,
    borderRadius: 8,
    cursor: isAdded ? "default" : "grab",
    fontSize: 13,
    lineHeight: 1.55,
    transition: "opacity 0.15s, box-shadow 0.15s",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
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
                color: "#6366f1",
                background: "#eef2ff",
                padding: "1px 6px",
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
                  padding: "1px 6px",
                  borderRadius: 4,
                }}
              >
                {question.section}
              </span>
            )}
            {question.question_type === "diagram" && (
              <DiagramBadge figRef={question.figure_ref} />
            )}
          </div>

          <QuestionContent question={question} truncateAt={200} />
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isAdded) onAdd(question);
          }}
          disabled={isAdded}
          style={{
            flexShrink: 0,
            border: "none",
            borderRadius: 6,
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 500,
            cursor: isAdded ? "default" : "pointer",
            background: isAdded ? "#e2e8f0" : "#6366f1",
            color: isAdded ? "#94a3b8" : "#fff",
          }}
        >
          {isAdded ? "✓ Added" : "+ Add"}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 6,
          fontSize: 11,
          color: "#94a3b8",
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
        <span>{TYPE_LABELS[question.question_type] || question.question_type}</span>
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

// ── Sortable Test Question (Paper Panel) ────────────────────────

function SortableTestQuestion({
  question,
  index,
  onRemove,
  onEditMarks,
}: {
  question: TestQuestion;
  index: number;
  onRemove: (paperId: string) => void;
  onEditMarks: (paperId: string, marks: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: question.paperId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    padding: "10px 12px",
    marginBottom: 6,
    background: isDragging ? "#eef2ff" : "#fff",
    border: `1px solid ${isDragging ? "#6366f1" : "#e2e8f0"}`,
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.55,
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
          <span
            {...listeners}
            style={{
              cursor: "grab",
              color: "#94a3b8",
              fontSize: 16,
              marginTop: 2,
              flexShrink: 0,
              userSelect: "none",
            }}
            title="Drag to reorder"
          >
            ⠿
          </span>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 600, color: "#6366f1", fontSize: 12 }}>
              Q{index + 1}.
            </span>{" "}
            <QuestionContent question={question} truncateAt={250} />
            {question.question_type === "diagram" && (
              <DiagramBadge figRef={question.figure_ref} />
            )}
          </div>
        </div>

        <div
          style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}
        >
          <select
            value={question.marks}
            onChange={(e) => onEditMarks(question.paperId, Number(e.target.value))}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 4,
              padding: "2px 4px",
              fontSize: 11,
              cursor: "pointer",
              background: "#fff",
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
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 11,
              cursor: "pointer",
            }}
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
          marginLeft: 28,
          fontSize: 11,
          color: "#94a3b8",
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

// ── Main Component ──────────────────────────────────────────────
export default function TestBuilderPage() {
  // Filters
  const [classGrade, setClassGrade] = useState("10");
  const [subject, setSubject] = useState("Science");
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [questionType, setQuestionType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Data
  const [chapterStats, setChapterStats] = useState<ChapterStat[]>([]);
  const [libraryQuestions, setLibraryQuestions] = useState<NCERTQuestion[]>([]);
  const [testQuestions, setTestQuestions] = useState<TestQuestion[]>([]);
  const [examTitle, setExamTitle] = useState("Untitled Test");
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track added question IDs
  const addedIds = useMemo(
    () => new Set(testQuestions.map((q) => q.id)),
    [testQuestions]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
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
          setChapterStats(data.chapters || []);
          setSelectedChapter(null);
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

          if (append) {
            setLibraryQuestions((prev) => [...prev, ...questions]);
          } else {
            setLibraryQuestions(questions);
          }
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

  // Reset and fetch on filter change
  useEffect(() => {
    if (selectedChapter) {
      setOffset(0);
      setLibraryQuestions([]);
      fetchQuestions(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChapter, questionType, debouncedSearch]);

  // ── Add / Remove / Edit ───────────────────────────────────────
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

  // ── Drag handlers ────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) =>
    setActiveId(event.active.id as string);

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeStr = String(active.id);
    const overStr = String(over.id);

    if (activeStr.startsWith("lib-") && overStr.startsWith("paper-")) {
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
  const handleExport = async (format: "pdf" | "docx") => {
    if (testQuestions.length === 0) return;
    setExporting(true);

    try {
      const payload = {
        examTitle,
        board: "CBSE",
        classGrade: `Class ${classGrade}`,
        subject,
        format,
        includeAnswers: true,
        includeExplanations: false,
        template: "modern",
        questions: testQuestions.map((q) => ({
          id: String(q.id),
          text: q.question_text,
          options: q.options || [],
          correctAnswer: q.answer || "",
          explanation: "",
          marks: q.marks,
          difficulty: q.difficulty,
          chapter: q.chapter,
          format: q.options?.length > 0 ? "mcq" : "short_answer",
          section: q.section,
          isManual: false,
          validationStatus: "valid",
          questionTable: q.question_table || null,
          figureRef: q.figure_ref || null,
        })),
      };

      const res = await fetch(`${API_BASE}${API_PREFIX}/test-generator/export`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${examTitle
        .replace(/[^a-zA-Z0-9_\-\s]/g, "")
        .replace(/\s+/g, "_")}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Export failed. Please try again.");
    }
    setExporting(false);
  };

  // ── Computed ──────────────────────────────────────────────────
  const totalMarks = testQuestions.reduce((sum, q) => sum + q.marks, 0);
  const totalChapterQuestions = chapterStats.reduce(
    (sum, ch) => sum + ch.total,
    0
  );

  // ── Render ────────────────────────────────────────────────────
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 16px" }}>
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "#0f172a",
              margin: 0,
            }}
          >
            Test Builder
          </h1>
          <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0" }}>
            Browse {totalChapterQuestions.toLocaleString()} NCERT questions across{" "}
            {chapterStats.length} chapters — drag or click to build your test
            paper.
          </p>
        </div>

        {/* Filters */}
        <div
          style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}
        >
          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "#64748b",
                display: "block",
                marginBottom: 3,
              }}
            >
              Class
            </label>
            <select
              value={classGrade}
              onChange={(e) => setClassGrade(e.target.value)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                fontSize: 13,
                minWidth: 90,
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
                fontWeight: 500,
                color: "#64748b",
                display: "block",
                marginBottom: 3,
              }}
            >
              Subject
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                fontSize: 13,
                minWidth: 140,
              }}
            >
              {SUBJECT_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "#64748b",
                display: "block",
                marginBottom: 3,
              }}
            >
              Test Title
            </label>
            <input
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              placeholder="Enter test title…"
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                fontSize: 13,
                width: "100%",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div
            style={{
              padding: "8px 14px",
              marginBottom: 12,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              color: "#dc2626",
              fontSize: 13,
            }}
          >
            {error}
            <button
              onClick={() => setError(null)}
              style={{
                float: "right",
                background: "none",
                border: "none",
                color: "#dc2626",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Two-panel layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          {/* ── LEFT: NCERT Library ─────────────────────────── */}
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              background: "#fafbfc",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "10px 16px",
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
                gridTemplateColumns: "200px 1fr",
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
                    No questions found for {subject} Class {classGrade}. Run
                    extraction script first.
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
                        fontWeight:
                          selectedChapter === ch.chapter ? 600 : 400,
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

              {/* Questions list */}
              <div style={{ padding: 10, maxHeight: 600, overflowY: "auto" }}>
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
                          borderRadius: 6,
                          border: "1px solid #e2e8f0",
                          fontSize: 12,
                        }}
                      />
                      <select
                        value={questionType}
                        onChange={(e) => setQuestionType(e.target.value)}
                        style={{
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid #e2e8f0",
                          fontSize: 12,
                        }}
                      >
                        {Object.entries(TYPE_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

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
                      <p
                        style={{
                          color: "#94a3b8",
                          fontSize: 13,
                          textAlign: "center",
                          paddingTop: 40,
                        }}
                      >
                        No questions match this filter.
                      </p>
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
                              padding: "8px",
                              marginTop: 8,
                              background: "#f1f5f9",
                              border: "1px solid #e2e8f0",
                              borderRadius: 6,
                              fontSize: 12,
                              color: "#6366f1",
                              cursor: loadingMore ? "wait" : "pointer",
                              fontWeight: 500,
                            }}
                          >
                            {loadingMore
                              ? "Loading…"
                              : "Load more questions"}
                          </button>
                        )}
                      </>
                    )}
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

          {/* ── RIGHT: Test Paper ───────────────────────────── */}
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              background: "#fafbfc",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "10px 16px",
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
                    borderRadius: 6,
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

            <div
              style={{
                padding: 10,
                minHeight: 500,
                maxHeight: 600,
                overflowY: "auto",
              }}
            >
              {testQuestions.length === 0 ? (
                <div
                  style={{
                    border: "2px dashed #e2e8f0",
                    borderRadius: 10,
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
                  <p style={{ fontSize: 14, fontWeight: 500 }}>
                    Drop questions here to build your test
                  </p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>
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
                      onRemove={removeFromTest}
                      onEditMarks={editMarks}
                    />
                  ))}
                </SortableContext>
              )}
            </div>

            {testQuestions.length > 0 && (
              <div
                style={{
                  padding: "10px 16px",
                  borderTop: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                  alignItems: "center",
                }}
              >
                {exporting && (
                  <span style={{ fontSize: 12, color: "#6366f1" }}>
                    Generating…
                  </span>
                )}
                <button
                  onClick={() => handleExport("pdf")}
                  disabled={exporting}
                  style={{
                    background: exporting ? "#a5b4fc" : "#6366f1",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 20px",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: exporting ? "wait" : "pointer",
                  }}
                >
                  PDF
                </button>
                <button
                  onClick={() => handleExport("docx")}
                  disabled={exporting}
                  style={{
                    background: "#fff",
                    color: "#6366f1",
                    border: "1px solid #6366f1",
                    borderRadius: 8,
                    padding: "8px 20px",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: exporting ? "wait" : "pointer",
                    opacity: exporting ? 0.6 : 1,
                  }}
                >
                  DOCX
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeId ? (
          <div
            style={{
              padding: "8px 12px",
              background: "#eef2ff",
              border: "1px solid #6366f1",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              maxWidth: 300,
            }}
          >
            Dragging question…
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}