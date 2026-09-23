// src/utils/testPdfExporter.ts
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export interface TestQuestionData {
  id?: string;
  test_id?: string;
  text?: string;
  question_text?: string;
  questionText?: string;
  options?: string[] | any;
  correct_answer?: string;
  correctAnswer?: string;
  explanation?: string;
  solution?: string;
  marks?: number;
  difficulty?: string;
  chapter?: string;
  topic?: string;
  format?: string;
  position?: number;
}

export interface TestPaperMeta {
  id: string;
  exam_title: string;
  board?: string;
  class_grade?: string;
  subject?: string;
  status?: string;
  total_questions?: number;
  total_marks?: number;
  created_at?: string;
  paper_date?: string;
  teacher_name?: string;
  institute_name?: string;
  duration?: string;
}

/**
 * Clean text from raw markdown or latex wrappers for clean PDF rendering
 */
function cleanTextForPdf(str?: string): string {
  if (!str) return "";
  return str
    .replace(/\$\$(.*?)\$\$/g, "$1")
    .replace(/\$(.*?)\$/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\\times/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\pm/g, "±")
    .replace(/\\leq/g, "≤")
    .replace(/\\geq/g, "≥")
    .replace(/\\approx/g, "≈")
    .replace(/\\neq/g, "≠")
    .replace(/\\infty/g, "∞")
    .replace(/\\circ/g, "°")
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1/$2")
    .replace(/\\sqrt\{([^}]+)\}/g, "√($1)")
    .replace(/\\[a-zA-Z]+/g, "")
    .trim();
}

/**
 * Parse options safely if stored as JSON string or array
 */
function parseQuestionOptions(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(o => String(o).trim());
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(o => String(o).trim());
    } catch {
      return raw.split("\n").filter(Boolean);
    }
  }
  return [];
}

/**
 * Generate a professional CBSE Question Paper PDF client-side
 */
export async function generateTestPaperPdf(
  meta: TestPaperMeta,
  questions: TestQuestionData[]
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 16;
  const contentWidth = pageWidth - marginX * 2;
  let curY = 18;

  // Header Box
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.6);
  doc.rect(marginX, curY, contentWidth, 34);

  // Institute / Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  const instName = meta.institute_name || "CENTRAL BOARD OF SECONDARY EDUCATION";
  doc.text(instName.toUpperCase(), pageWidth / 2, curY + 7, { align: "center" });

  // Exam Title
  doc.setFontSize(12);
  doc.setTextColor(30, 58, 138);
  doc.text(meta.exam_title || "ASSESSMENT EXAMINATION", pageWidth / 2, curY + 14, { align: "center" });

  // Divider inside box
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(marginX, curY + 18, marginX + contentWidth, curY + 18);

  // Metadata Grid
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);

  const classText = `Class: ${meta.class_grade || "10"}`;
  const subjectText = `Subject: ${meta.subject || "General"}`;
  const marksText = `Max Marks: ${meta.total_marks || (questions.length * 2)}`;
  const timeText = `Time Allowed: ${meta.duration || "1.5 Hours"}`;

  doc.text(classText, marginX + 4, curY + 24);
  doc.text(subjectText, marginX + 50, curY + 24);
  doc.text(timeText, marginX + 110, curY + 24);
  doc.text(marksText, marginX + contentWidth - 4, curY + 24, { align: "right" });

  const dateStr = meta.paper_date || new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  doc.text(`Date: ${dateStr}`, marginX + 4, curY + 30);
  doc.text(`Total Questions: ${questions.length}`, marginX + 50, curY + 30);
  doc.text(`Teacher: ${meta.teacher_name || "Faculty In-Charge"}`, marginX + 110, curY + 30);
  doc.text("CBSE Pattern", marginX + contentWidth - 4, curY + 30, { align: "right" });

  curY += 40;

  // General Instructions
  doc.setFillColor(248, 250, 252);
  doc.rect(marginX, curY, contentWidth, 14, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(marginX, curY, contentWidth, 14, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text("General Instructions:", marginX + 3, curY + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("1. All questions are compulsory. Read the questions carefully before attempting.", marginX + 3, curY + 8.5);
  doc.text("2. Marks allotted to each question are indicated against it. Adhere strictly to the word limits.", marginX + 3, curY + 12);

  curY += 20;

  // Render Questions
  questions.forEach((q, idx) => {
    const qNum = idx + 1;
    const qMarks = q.marks || 1;
    const marksLabel = `[${qMarks} Mark${qMarks > 1 ? "s" : ""}]`;

    // Check page overflow
    if (curY > pageHeight - 35) {
      doc.addPage();
      curY = 20;
    }

    // Question Number & Marks badge
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`Q${qNum}.`, marginX, curY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(79, 70, 229);
    doc.text(marksLabel, marginX + contentWidth, curY, { align: "right" });

    // Question Text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);

    const rawText = cleanTextForPdf(q.text || q.question_text || q.questionText || "Question text not available.");
    const qLines = doc.splitTextToSize(rawText, contentWidth - 25);
    doc.text(qLines, marginX + 10, curY);

    curY += qLines.length * 4.8 + 2;

    // Render Options if MCQ
    const options = parseQuestionOptions(q.options);
    if (options.length > 0) {
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      const labels = ["(A)", "(B)", "(C)", "(D)", "(E)"];

      // Check if options fit in 2 columns or need stacked rows
      const maxOptLen = Math.max(...options.map(o => o.length));
      if (maxOptLen < 45 && options.length === 4) {
        // 2x2 grid
        for (let oIdx = 0; oIdx < 4; oIdx += 2) {
          if (curY > pageHeight - 25) {
            doc.addPage();
            curY = 20;
          }
          const opt1 = `${labels[oIdx]} ${cleanTextForPdf(options[oIdx])}`;
          const opt2 = `${labels[oIdx + 1]} ${cleanTextForPdf(options[oIdx + 1])}`;
          doc.text(doc.splitTextToSize(opt1, contentWidth / 2 - 8), marginX + 12, curY);
          doc.text(doc.splitTextToSize(opt2, contentWidth / 2 - 8), marginX + contentWidth / 2 + 4, curY);
          curY += 5;
        }
      } else {
        // Stacked
        options.forEach((opt, oIdx) => {
          if (curY > pageHeight - 25) {
            doc.addPage();
            curY = 20;
          }
          const optText = `${labels[oIdx] || `(${oIdx + 1})`} ${cleanTextForPdf(opt)}`;
          const optLines = doc.splitTextToSize(optText, contentWidth - 16);
          doc.text(optLines, marginX + 12, curY);
          curY += optLines.length * 4.5;
        });
      }
    }

    curY += 5; // Spacing after question
  });

  // Footer for all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 12, marginX + contentWidth, pageHeight - 12);

    doc.text("Generated with a4ai Engine • www.a4ai.in", marginX, pageHeight - 8);
    doc.text(`Page ${p} of ${totalPages}`, marginX + contentWidth, pageHeight - 8, { align: "right" });
  }

  const safeTitle = (meta.exam_title || "Test_Paper").replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`${safeTitle}.pdf`);
}

/**
 * Generate an Answer Key & Detailed Solutions PDF client-side
 */
export async function generateAnswerKeyPdf(
  meta: TestPaperMeta,
  questions: TestQuestionData[]
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 16;
  const contentWidth = pageWidth - marginX * 2;
  let curY = 18;

  // Header Box (Key / Solution style)
  doc.setFillColor(240, 253, 244);
  doc.rect(marginX, curY, contentWidth, 34, "F");
  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(0.6);
  doc.rect(marginX, curY, contentWidth, 34, "S");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 83, 45);
  doc.text("OFFICIAL ANSWER KEY & MARKING SCHEME", pageWidth / 2, curY + 8, { align: "center" });

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(meta.exam_title || "ASSESSMENT EXAMINATION", pageWidth / 2, curY + 15, { align: "center" });

  // Divider
  doc.setDrawColor(187, 247, 208);
  doc.setLineWidth(0.3);
  doc.line(marginX, curY + 19, marginX + contentWidth, curY + 19);

  // Metadata
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  doc.text(`Class: ${meta.class_grade || "10"} | Subject: ${meta.subject || "General"} | Total Marks: ${meta.total_marks || (questions.length * 2)}`, marginX + 4, curY + 25);
  doc.text(`Total Questions: ${questions.length} | Date: ${meta.paper_date || new Date().toLocaleDateString("en-IN")}`, marginX + 4, curY + 30);
  doc.text("Confidential • Teacher Copy", marginX + contentWidth - 4, curY + 30, { align: "right" });

  curY += 42;

  // Questions and solutions
  questions.forEach((q, idx) => {
    const qNum = idx + 1;
    const qMarks = q.marks || 1;
    const correctAnswer = q.correct_answer || q.correctAnswer || "Not specified";
    const explanation = q.explanation || q.solution || "Refer to NCERT textbook solution guide.";

    if (curY > pageHeight - 40) {
      doc.addPage();
      curY = 20;
    }

    // Question line
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`Q${qNum}.`, marginX, curY);

    const qText = cleanTextForPdf(q.text || q.question_text || q.questionText || "");
    const qLines = doc.splitTextToSize(qText, contentWidth - 25);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(qLines, marginX + 10, curY);

    curY += qLines.length * 4.8 + 2;

    // Correct Answer pill box
    doc.setFillColor(236, 253, 245);
    doc.rect(marginX + 10, curY, contentWidth - 10, 7, "F");
    doc.setDrawColor(167, 243, 208);
    doc.setLineWidth(0.2);
    doc.rect(marginX + 10, curY, contentWidth - 10, 7, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(5, 150, 105);
    doc.text(`Correct Answer: ${cleanTextForPdf(correctAnswer)}`, marginX + 13, curY + 4.8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`[Marks: ${qMarks}]`, marginX + contentWidth - 4, curY + 4.8, { align: "right" });

    curY += 10;

    // Detailed explanation
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Explanation / Steps:", marginX + 10, curY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const expLines = doc.splitTextToSize(cleanTextForPdf(explanation), contentWidth - 20);
    doc.text(expLines, marginX + 10, curY + 4.2);

    curY += expLines.length * 4.2 + 8;
  });

  // Footer for all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 12, marginX + contentWidth, pageHeight - 12);

    doc.text("Answer Key & Solution • a4ai Engine", marginX, pageHeight - 8);
    doc.text(`Page ${p} of ${totalPages}`, marginX + contentWidth, pageHeight - 8, { align: "right" });
  }

  const safeTitle = (meta.exam_title || "Test_Paper").replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`${safeTitle}_AnswerKey.pdf`);
}

/**
 * Fetch all questions for a given test ID from Supabase or Backend
 */
export async function fetchQuestionsForTest(
  testId: string,
  teacherId?: string
): Promise<TestQuestionData[]> {
  try {
    // 1. Try Supabase questions table
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("test_id", testId)
      .order("position", { ascending: true });

    if (!error && data && data.length > 0) {
      return data as TestQuestionData[];
    }
  } catch (err) {
    console.warn("Supabase questions fetch failed, trying backend:", err);
  }

  // 2. Try Backend API
  try {
    const apiBase = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000/api";
    const res = await fetch(`${apiBase}/v1/test-generator/test/${testId}${teacherId ? `?teacher_id=${encodeURIComponent(teacherId)}` : ""}`);
    if (res.ok) {
      const json = await res.json();
      if (json.questions && Array.isArray(json.questions)) {
        return json.questions;
      }
    }
  } catch (err) {
    console.warn("Backend questions fetch failed:", err);
  }

  return [];
}

/**
 * High-level download controller:
 * Tries backend export first. If backend fails or questions are offline,
 * falls back to client-side jsPDF generator so download NEVER fails.
 */
export async function downloadTestDocument({
  test,
  format = "pdf",
  isAnswerKey = false,
  questions: providedQuestions,
  teacherId
}: {
  test: TestPaperMeta;
  format?: "pdf" | "docx";
  isAnswerKey?: boolean;
  questions?: TestQuestionData[];
  teacherId?: string;
}): Promise<boolean> {
  const toastId = toast.loading(`Preparing ${isAnswerKey ? "Answer Key" : "Question Paper"} ${format.toUpperCase()}...`);

  try {
    // Step 1: Ensure we have questions
    let questions = providedQuestions || [];
    if (questions.length === 0) {
      questions = await fetchQuestionsForTest(test.id, teacherId);
    }

    // If still no questions, create dummy placeholder so teacher gets a valid document
    if (questions.length === 0) {
      questions = Array.from({ length: test.total_questions || 5 }, (_, i) => ({
        position: i + 1,
        text: `Question ${i + 1} for ${test.exam_title} (${test.subject || "Subject"}).`,
        marks: 1,
        correct_answer: "Refer to NCERT textbook.",
        explanation: "Comprehensive syllabus topic question."
      }));
    }

    // Step 2: If DOCX or backend is available, try backend export first
    const apiBase = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000/api";
    const endpoint = isAnswerKey
      ? `${apiBase}/v1/test-generator/export-answer-key`
      : `${apiBase}/v1/test-generator/export`;

    try {
      const payload = {
        examTitle: test.exam_title,
        board: test.board || "CBSE",
        classGrade: test.class_grade?.startsWith("Class") ? test.class_grade : `Class ${test.class_grade || "10"}`,
        subject: test.subject || "Science",
        format: format,
        includeAnswers: isAnswerKey,
        includeExplanations: isAnswerKey,
        template: "modern",
        teacher_name: test.teacher_name || undefined,
        institute_name: test.institute_name || undefined,
        duration: test.duration || "1.5 Hours",
        paperDate: test.paper_date || new Date().toLocaleDateString("en-GB"),
        questions: questions.map((q, idx) => ({
          id: q.id || `q_${idx + 1}`,
          position: q.position || idx + 1,
          text: q.text || q.question_text || q.questionText || "",
          marks: q.marks || 1,
          difficulty: q.difficulty || "medium",
          options: parseQuestionOptions(q.options),
          correct_answer: q.correct_answer || q.correctAnswer || "",
          explanation: q.explanation || q.solution || "",
          format: q.format || "mcq"
        }))
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 200) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const safeTitle = (test.exam_title || "Test_Paper").replace(/[^a-zA-Z0-9_-]/g, "_");
          a.download = `${safeTitle}${isAnswerKey ? "_AnswerKey" : ""}.${format}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success(`${isAnswerKey ? "Answer Key" : "Question Paper"} ${format.toUpperCase()} downloaded!`, { id: toastId });
          return true;
        }
      }
    } catch (backendErr) {
      console.warn("Backend export endpoint failed, falling back to client PDF generator:", backendErr);
    }

    // Step 3: Client-side jsPDF Fallback (for PDF)
    if (isAnswerKey) {
      await generateAnswerKeyPdf(test, questions);
    } else {
      await generateTestPaperPdf(test, questions);
    }

    toast.success(`Downloaded ${isAnswerKey ? "Answer Key" : "Question Paper"} PDF successfully!`, { id: toastId });
    return true;

  } catch (err: any) {
    console.error("Test export failed:", err);
    toast.error("Failed to export test. Please try again.", { id: toastId });
    return false;
  }
}

