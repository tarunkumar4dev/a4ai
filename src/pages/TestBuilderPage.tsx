/**
 * TestBuilderPage.tsx — NCERT Drag & Drop Test Builder with LaTeX Support
 * 
 * Two-panel layout:
 *   Left  = NCERT Content Library (browse chapters, search questions)
 *   Right = Your Test Paper (drop zone, reorder, edit, delete)
 * 
 * Dependencies: @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, react-katex, katex
 * Install: npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-katex katex
 * 
 * API endpoints used:
 *   GET /test-generator/chapters?subject=X&class_grade=Y
 *   GET /test-generator/ncert-questions?subject=X&class_grade=Y&chapter=Z
 *   GET /test-generator/ncert-question-stats?subject=X&class_grade=Y
 *   POST /test-generator/export
 */

import React, { useState, useEffect, useCallback } from "react";
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
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// ── Config ──────────────────────────────────────────────────────
const API_BASE = "http://localhost:8000/api/v1";

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
  options: string[];
  marks: number;
  difficulty: string;
}

interface TestQuestion extends NCERTQuestion {
  paperId: string; // unique ID for the test paper instance
}

interface ChapterStat {
  chapter: string;
  total: number;
  sections: { name: string; count: number }[];
  types: { name: string; count: number }[];
}

// ── LaTeX Render Function ──────────────────────────────────────
function renderMathText(text: string) {
  if (!text) return null;
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          return <BlockMath key={i} math={part.slice(2, -2)} />;
        } else if (part.startsWith('$') && part.endsWith('$')) {
          return <InlineMath key={i} math={part.slice(1, -1)} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Subjects & Classes ──────────────────────────────────────────
const CLASS_OPTIONS = ["9", "10", "11", "12"];
const SUBJECT_OPTIONS = [
  "Science", "Mathematics", "Physics", "Chemistry", "Biology",
  "English", "History", "Geography", "Political Science",
  "Economics", "Accountancy",
];

const TYPE_LABELS: Record<string, string> = {
  exercise: "Exercise",
  example: "Examples",
  intext: "In-Text",
  activity: "Activities",
  hots: "HOTS",
  diagram: "Diagrams",
  all: "All",
};

// ── Draggable Question Card (Library) ───────────────────────────
function DraggableQuestion({
  question,
  onAdd,
}: {
  question: NCERTQuestion;
  onAdd: (q: NCERTQuestion) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({ id: `lib-${question.id}` });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    padding: "10px 12px",
    marginBottom: 6,
    background: "var(--card-bg, #fff)",
    border: "1px solid var(--border, #e2e8f0)",
    borderRadius: 8,
    cursor: "grab",
    fontSize: 13,
    lineHeight: 1.5,
    transition: "box-shadow 0.15s",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <span style={{
            display: "inline-block",
            fontSize: 10,
            fontWeight: 600,
            color: "#6366f1",
            background: "#eef2ff",
            padding: "1px 6px",
            borderRadius: 4,
            marginBottom: 4,
            marginRight: 4,
          }}>
            {question.question_number || question.question_type}
          </span>
          {question.section && (
            <span style={{
              fontSize: 10,
              color: "#64748b",
              background: "#f1f5f9",
              padding: "1px 6px",
              borderRadius: 4,
            }}>
              {question.section}
            </span>
          )}
          <div style={{ margin: "4px 0 0", color: "#1e293b" }}>
            {question.question_text.length > 180
              ? renderMathText(question.question_text.slice(0, 180) + "...")
              : renderMathText(question.question_text)}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(question); }}
          style={{
            flexShrink: 0,
            background: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "4px 10px",
            fontSize: 12,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          + Add
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 11, color: "#94a3b8" }}>
        <span>{question.marks} marks</span>
        <span>|</span>
        <span>{question.difficulty}</span>
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
    background: isDragging ? "#f0f9ff" : "var(--card-bg, #fff)",
    border: `1px solid ${isDragging ? "#6366f1" : "var(--border, #e2e8f0)"}`,
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.5,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flex: 1 }}>
          <span
            {...listeners}
            style={{ cursor: "grab", color: "#94a3b8", fontSize: 16, marginTop: 2, flexShrink: 0 }}
            title="Drag to reorder"
          >
            ⠿
          </span>
          <div>
            <span style={{ fontWeight: 600, color: "#6366f1", fontSize: 12 }}>
              Q{index + 1}.
            </span>{" "}
            <span style={{ color: "#1e293b" }}>
              {question.question_text.length > 200
                ? renderMathText(question.question_text.slice(0, 200) + "...")
                : renderMathText(question.question_text)}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <select
            value={question.marks}
            onChange={(e) => onEditMarks(question.paperId, Number(e.target.value))}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 4,
              padding: "2px 4px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {[1, 2, 3, 4, 5].map((m) => (
              <option key={m} value={m}>{m}m</option>
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
            Remove
          </button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4, marginLeft: 28, fontSize: 11, color: "#94a3b8" }}>
        <span>{question.chapter}</span>
        <span>|</span>
        <span>{question.difficulty}</span>
        <span>|</span>
        <span>{TYPE_LABELS[question.question_type] || question.question_type}</span>
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

  // Data
  const [chapterStats, setChapterStats] = useState<ChapterStat[]>([]);
  const [libraryQuestions, setLibraryQuestions] = useState<NCERTQuestion[]>([]);
  const [testQuestions, setTestQuestions] = useState<TestQuestion[]>([]);
  const [examTitle, setExamTitle] = useState("Untitled Test");

  // UI state
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // ── Fetch chapter stats ───────────────────────────────────────
  useEffect(() => {
    async function fetchStats() {
      setStatsLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/test-generator/ncert-question-stats?subject=${subject}&class_grade=${classGrade}`
        );
        const data = await res.json();
        if (data.ok) {
          setChapterStats(data.chapters || []);
          setSelectedChapter(null);
          setLibraryQuestions([]);
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      }
      setStatsLoading(false);
    }
    fetchStats();
  }, [classGrade, subject]);

  // ── Fetch questions for selected chapter ──────────────────────
  const fetchQuestions = useCallback(async () => {
    if (!selectedChapter) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        subject,
        class_grade: classGrade,
        chapter: selectedChapter,
        limit: "100",
      });
      if (questionType !== "all") params.set("question_type", questionType);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`${API_BASE}/test-generator/ncert-questions?${params}`);
      const data = await res.json();
      if (data.ok) {
        setLibraryQuestions(data.questions || []);
      }
    } catch (err) {
      console.error("Failed to fetch questions:", err);
    }
    setLoading(false);
  }, [selectedChapter, questionType, searchQuery, classGrade, subject]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // ── Add question to test paper ────────────────────────────────
  const addToTest = (q: NCERTQuestion) => {
    // Check if already added
    if (testQuestions.some((tq) => tq.id === q.id)) return;
    const testQ: TestQuestion = {
      ...q,
      paperId: `paper-${q.id}-${Date.now()}`,
    };
    setTestQuestions((prev) => [...prev, testQ]);
  };

  // ── Remove from test paper ────────────────────────────────────
  const removeFromTest = (paperId: string) => {
    setTestQuestions((prev) => prev.filter((q) => q.paperId !== paperId));
  };

  // ── Edit marks ────────────────────────────────────────────────
  const editMarks = (paperId: string, marks: number) => {
    setTestQuestions((prev) =>
      prev.map((q) => (q.paperId === paperId ? { ...q, marks } : q))
    );
  };

  // ── Drag handlers ────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    // If dragging from library to paper
    if (String(active.id).startsWith("lib-") && String(over.id).startsWith("paper-")) {
      const libId = Number(String(active.id).replace("lib-", ""));
      const q = libraryQuestions.find((q) => q.id === libId);
      if (q) addToTest(q);
      return;
    }

    // Reorder within paper
    if (String(active.id).startsWith("paper-") && String(over.id).startsWith("paper-")) {
      const oldIndex = testQuestions.findIndex((q) => q.paperId === active.id);
      const newIndex = testQuestions.findIndex((q) => q.paperId === over.id);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        setTestQuestions(arrayMove(testQuestions, oldIndex, newIndex));
      }
    }
  };

  // ── Generate / Export ─────────────────────────────────────────
  const handleExport = async (format: "pdf" | "docx") => {
    if (testQuestions.length === 0) {
      alert("Add questions to the test paper first!");
      return;
    }

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
        questions: testQuestions.map((q, i) => ({
          id: String(q.id),
          text: q.question_text,
          options: q.options || [],
          correctAnswer: q.answer || "",
          explanation: "",
          marks: q.marks,
          difficulty: q.difficulty,
          chapter: q.chapter,
          format: q.options && q.options.length > 0 ? "mcq" : "short_answer",
          section: q.section,
          isManual: false,
          validationStatus: "valid",
        })),
      };

      const res = await fetch(`${API_BASE}/test-generator/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${examTitle.replace(/\s+/g, "_")}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Export failed. Please try again.");
    }
  };

  // ── Computed ──────────────────────────────────────────────────
  const totalMarks = testQuestions.reduce((sum, q) => sum + q.marks, 0);

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
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "#0f172a", margin: 0 }}>
            Test Builder
          </h1>
          <p style={{ color: "#64748b", fontSize: 14, margin: "4px 0 0" }}>
            Browse NCERT questions and drag them to build your test paper
          </p>
        </div>

        {/* Class & Subject selectors */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#64748b", display: "block", marginBottom: 4 }}>
              Class
            </label>
            <select
              value={classGrade}
              onChange={(e) => setClassGrade(e.target.value)}
              style={{
                padding: "6px 12px", borderRadius: 6, border: "1px solid #e2e8f0",
                fontSize: 13, minWidth: 80,
              }}
            >
              {CLASS_OPTIONS.map((c) => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#64748b", display: "block", marginBottom: 4 }}>
              Subject
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{
                padding: "6px 12px", borderRadius: 6, border: "1px solid #e2e8f0",
                fontSize: 13, minWidth: 140,
              }}
            >
              {SUBJECT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#64748b", display: "block", marginBottom: 4 }}>
              Test Title
            </label>
            <input
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              placeholder="Enter test title..."
              style={{
                padding: "6px 12px", borderRadius: 6, border: "1px solid #e2e8f0",
                fontSize: 13, width: "100%", boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Two-panel layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
          {/* ── LEFT: NCERT Library ─────────────────────────── */}
          <div style={{
            border: "1px solid #e2e8f0", borderRadius: 10,
            background: "#fafbfc", overflow: "hidden",
          }}>
            <div style={{
              padding: "12px 16px", borderBottom: "1px solid #e2e8f0",
              background: "#f8fafc", fontWeight: 600, fontSize: 14, color: "#0f172a",
            }}>
              NCERT Content Library
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", minHeight: 500 }}>
              {/* Chapter sidebar */}
              <div style={{
                borderRight: "1px solid #e2e8f0", padding: "8px 0",
                maxHeight: 600, overflowY: "auto", background: "#f1f5f9",
              }}>
                {statsLoading ? (
                  <p style={{ padding: 12, color: "#94a3b8", fontSize: 13 }}>Loading chapters...</p>
                ) : chapterStats.length === 0 ? (
                  <p style={{ padding: 12, color: "#94a3b8", fontSize: 13 }}>No questions found. Run extraction first.</p>
                ) : (
                  chapterStats.map((ch) => (
                    <button
                      key={ch.chapter}
                      onClick={() => {
                        setSelectedChapter(ch.chapter);
                        setQuestionType("all");
                        setSearchQuery("");
                      }}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "8px 12px", border: "none", cursor: "pointer",
                        fontSize: 12, lineHeight: 1.4,
                        background: selectedChapter === ch.chapter ? "#e0e7ff" : "transparent",
                        color: selectedChapter === ch.chapter ? "#4338ca" : "#334155",
                        fontWeight: selectedChapter === ch.chapter ? 600 : 400,
                        borderLeft: selectedChapter === ch.chapter ? "3px solid #6366f1" : "3px solid transparent",
                      }}
                    >
                      {ch.chapter}
                      <span style={{
                        display: "block", fontSize: 10,
                        color: selectedChapter === ch.chapter ? "#6366f1" : "#94a3b8",
                      }}>
                        {ch.total} questions
                      </span>
                    </button>
                  ))
                )}
              </div>

              {/* Questions list */}
              <div style={{ padding: 12, maxHeight: 600, overflowY: "auto" }}>
                {selectedChapter ? (
                  <>
                    {/* Search + Type filter */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search questions..."
                        style={{
                          flex: 1, padding: "6px 10px", borderRadius: 6,
                          border: "1px solid #e2e8f0", fontSize: 12,
                        }}
                      />
                      <select
                        value={questionType}
                        onChange={(e) => setQuestionType(e.target.value)}
                        style={{
                          padding: "6px 8px", borderRadius: 6,
                          border: "1px solid #e2e8f0", fontSize: 12,
                        }}
                      >
                        {Object.entries(TYPE_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </div>

                    {loading ? (
                      <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", paddingTop: 40 }}>
                        Loading questions...
                      </p>
                    ) : libraryQuestions.length === 0 ? (
                      <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", paddingTop: 40 }}>
                        No questions found for this filter.
                      </p>
                    ) : (
                      <SortableContext
                        items={libraryQuestions.map((q) => `lib-${q.id}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        {libraryQuestions.map((q) => (
                          <DraggableQuestion key={q.id} question={q} onAdd={addToTest} />
                        ))}
                      </SortableContext>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: "center", paddingTop: 60, color: "#94a3b8" }}>
                    <p style={{ fontSize: 32, marginBottom: 8 }}>&#128218;</p>
                    <p style={{ fontSize: 14 }}>Select a chapter from the sidebar</p>
                    <p style={{ fontSize: 12 }}>to browse NCERT questions</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Test Paper ───────────────────────────── */}
          <div style={{
            border: "1px solid #e2e8f0", borderRadius: 10,
            background: "#fafbfc", overflow: "hidden",
          }}>
            <div style={{
              padding: "12px 16px", borderBottom: "1px solid #e2e8f0",
              background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>
                  Your Test Paper
                </span>
                <span style={{ fontSize: 12, color: "#64748b", marginLeft: 8 }}>
                  {testQuestions.length} questions | {totalMarks} marks
                </span>
              </div>
              {testQuestions.length > 0 && (
                <button
                  onClick={() => setTestQuestions([])}
                  style={{
                    background: "none", border: "1px solid #e2e8f0", borderRadius: 6,
                    padding: "4px 10px", fontSize: 11, color: "#64748b", cursor: "pointer",
                  }}
                >
                  Reset
                </button>
              )}
            </div>

            <div style={{ padding: 12, minHeight: 500, maxHeight: 600, overflowY: "auto" }}>
              {testQuestions.length === 0 ? (
                <div style={{
                  border: "2px dashed #e2e8f0", borderRadius: 10,
                  padding: "60px 20px", textAlign: "center", color: "#94a3b8",
                  minHeight: 300, display: "flex", flexDirection: "column",
                  justifyContent: "center", alignItems: "center",
                }}>
                  <p style={{ fontSize: 32, marginBottom: 8 }}>&#128196;</p>
                  <p style={{ fontSize: 14, fontWeight: 500 }}>Drop questions here to build your test</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>
                    Or click "Add" on any question from the library
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

            {/* Action buttons */}
            {testQuestions.length > 0 && (
              <div style={{
                padding: "12px 16px", borderTop: "1px solid #e2e8f0",
                background: "#f8fafc", display: "flex", gap: 8, justifyContent: "flex-end",
              }}>
                <button
                  onClick={() => handleExport("pdf")}
                  style={{
                    background: "#6366f1", color: "#fff", border: "none",
                    borderRadius: 8, padding: "8px 20px", fontSize: 13,
                    fontWeight: 500, cursor: "pointer",
                  }}
                >
                  Generate PDF
                </button>
                <button
                  onClick={() => handleExport("docx")}
                  style={{
                    background: "#fff", color: "#6366f1", border: "1px solid #6366f1",
                    borderRadius: 8, padding: "8px 20px", fontSize: 13,
                    fontWeight: 500, cursor: "pointer",
                  }}
                >
                  Generate DOCX
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeId ? (
          <div style={{
            padding: "8px 12px", background: "#eef2ff", border: "1px solid #6366f1",
            borderRadius: 8, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            maxWidth: 300,
          }}>
            Dragging question...
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}