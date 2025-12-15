import { FormSchema } from "./schema";
import type { GenerateTestRequest } from "@/types/testgen";

// Helper to extract number from "Class 10" -> 10
const extractClassNumber = (val: string | number): number => {
  if (typeof val === "number") return val;
  const match = val.match(/\d+/);
  return match ? parseInt(match[0]) : 10;
};

export const transformFormForAPI = (data: FormSchema): GenerateTestRequest => {
  const classNum = extractClassNumber(data.classGrade);

  // 1. Calculate Total Questions from the Table
  const totalQuestions = data.simpleData.reduce((acc, row) => acc + row.quantity, 0);

  // 2. Smart Chapter Selection
  // If user selected chapters in dropdown, use those. 
  // If not, grab topics from the table rows so RAG knows what to look for.
  const primaryChapters = data.ncertChapters.length > 0 
    ? data.ncertChapters 
    : data.simpleData.map(r => r.topic).filter(Boolean);

  return {
    // --- Core Meta Data ---
    requestId: crypto.randomUUID(),
    userId: data.userId || "anon",
    examTitle: data.examTitle,
    board: data.board,
    classNum: classNum, // ✅ CORRECT: Backend expects 'classNum'
    subject: data.subject,
    
    // --- Global Settings ---
    mode: "simple", 
    patternMode: "simple",
    qCount: totalQuestions || 5, // Fallback if table is empty
    difficulty: "Medium", // Global fallback
    
    // --- NCERT Brain Configuration ---
    useNCERT: data.useNCERT,
    ncertClass: data.ncertClass || classNum, 
    ncertSubject: data.ncertSubject || data.subject,
    ncertChapters: primaryChapters, // ✅ Passes chapters for strict filtering
    
    // --- ✅ CRITICAL: Map Table Rows to Backend 'Buckets' ---
    // This ensures the backend generates exactly what is in your table
    buckets: data.simpleData.map(row => ({
      type: "mcq", // MVP: Default to MCQ
      difficulty: row.difficulty.toLowerCase(),
      count: row.quantity,
      marks: 1, 
      cognitive: "understand"
    })),

    // --- Extras ---
    watermark: data.enableWatermark,
    shuffleQuestions: data.shuffleQuestions,
    outputFormat: "PDF"
  };
};