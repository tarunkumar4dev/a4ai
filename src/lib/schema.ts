import { z } from "zod";

export const questionTypeEnum = z.enum(["MCQ", "Short", "Long", "Essay"]);
export const difficultyEnum = z.enum(["Easy", "Medium", "Hard", "Mixed"]);
export const bloomEnum = z.enum(["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]);

// 1. Simple Mode Row
export const simpleRowSchema = z.object({
  id: z.string(),
  topic: z.string().min(1, "Topic is required"),
  subtopic: z.string().optional(),
  quantity: z.number().min(1).default(5),
  difficulty: difficultyEnum.default("Medium"),
  format: z.enum(["PDF", "DOC"]).default("PDF"),
  refFile: z.any().optional(),
});

// 2. Blueprint Mode Row
export const blueprintItemSchema = z.object({
  id: z.string(),
  lo: z.string().optional(),
  bloom: bloomEnum.default("Apply"),
  weight: z.number().optional(),
  chapter: z.string().optional(),
});

// 3. Main Form Schema
export const formSchema = z.object({
  // Metadata
  examTitle: z.string().min(3, "Exam title is required"),
  board: z.string().min(1, "Board is required"),
  classGrade: z.string().min(1, "Class is required"),
  subject: z.string().min(1, "Subject is required"),
  logo: z.any().optional(),

  // Global Settings
  mode: z.enum(["Simple", "Blueprint", "Matrix", "Buckets"]).default("Simple"),
  enableWatermark: z.boolean().default(true),
  shuffleQuestions: z.boolean().default(false),
  
  // Data Arrays
  simpleData: z.array(simpleRowSchema),
  blueprintData: z.array(blueprintItemSchema).optional(),

  // ✅ NCERT FIELDS (AS PER YOUR POWERShell REQUEST)
  useMCERT: z.boolean().default(true),
  ncertClass: z.string().optional(),
  ncertSubject: z.string().optional(),
  ncertChapters: z.array(z.string()).default([]),
  qCount: z.number().min(1).max(100).default(10),
  
  // User ID (from auth)
  userId: z.string().uuid().optional(),
});

export type FormSchema = z.infer<typeof formSchema>;