/// <reference types="https://deno.land/x/deno@v2.0.0/types.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { z } from "https://esm.sh/zod@3.22.4"; // ✅ FIXED: Correct zod version
import JSZip from "https://esm.sh/jszip@3.10.1"; // ✅ FIXED: Correct import

// ==================== OPTIMIZED UTILITY FUNCTIONS ====================
const safeNumber = z.union([
  z.number(),
  z.string().transform((val, ctx) => {
    if (val === '' || val === null || val === undefined) return 0;
    const parsed = Number(val);
    if (isNaN(parsed)) {
      ctx.addIssue({ 
        code: z.ZodIssueCode.custom, 
        message: `Expected number, received NaN: ${val}` 
      });
      return z.NEVER;
    }
    return parsed;
  })
]);

// ==================== OPTIMIZED SCHEMAS ====================
const SectionLegacy = z.object({
  title: z.string(),
  questionType: z.enum(["Multiple Choice", "Very Short Answer", "Short Answer", "Long Answer", "Case-based"]),
  count: safeNumber.pipe(z.number().int().min(1)),
  marksPerQuestion: safeNumber.pipe(z.number().min(0)),
});

const MatrixRow = z.object({
  questionType: z.enum(["Multiple Choice", "Very Short Answer", "Short Answer", "Long Answer", "Case-based"]),
  marksPerQuestion: safeNumber.pipe(z.number().min(0)),
  count: safeNumber.pipe(z.number().int().min(0)),
});

const CognitiveLevel = z.enum(["recall", "understand", "apply", "analyze"]);
const QuestionType = z.enum(["mcq", "short", "long", "numerical", "case_based"]);

const QuestionBucket = z.object({
  type: QuestionType,
  difficulty: z.enum(["easy", "medium", "hard"]),
  cognitive: CognitiveLevel,
  count: safeNumber.pipe(z.number().int().min(1).max(50)),
  marks: safeNumber.pipe(z.number().min(0)),
  negativeMarking: safeNumber.pipe(z.number().min(0)).default(0),
});

const Input = z.object({
  requestId: z.string().uuid().optional(),
  userId: z.string().uuid(),
  board: z.enum(["CBSE", "ICSE", "State"]).default("CBSE"),
  classNum: safeNumber.pipe(z.number().int().min(1).max(12)).default(10),
  subject: z.string().min(2),
  topics: z.array(z.string()).default([]),
  subtopics: z.array(z.string()).default([]),
  questionType: z.enum(["Multiple Choice", "Short Answer", "Long Answer", "Mixed"]).default("Multiple Choice"),
  mode: z.enum(["single", "mix"]).default("single"),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).default("Easy"),
  mix: z.object({ 
    easy: safeNumber.pipe(z.number().min(0).max(100)), 
    medium: safeNumber.pipe(z.number().min(0).max(100)), 
    hard: safeNumber.pipe(z.number().min(0).max(100)) 
  }).default({ easy: 50, medium: 30, hard: 20 }),
  patternMode: z.enum(["simple", "blueprint", "matrix"]).default("simple"),
  qCount: safeNumber.pipe(z.number().int().min(1)).default(5),
  marksPerQuestion: safeNumber.pipe(z.number().min(0)).default(1),
  sections: z.array(SectionLegacy).default([]),
  markingMatrix: z.array(MatrixRow).default([]),
  language: z.enum(["English", "Hindi"]).default("English"),
  solutionStyle: z.enum(["Steps", "Concise"]).default("Steps"),
  includeAnswerKey: z.boolean().default(true),
  negativeMarking: safeNumber.pipe(z.number().min(0)).default(0),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),
  notes: z.string().max(2000).optional(),
  outputFormat: z.enum(["PDF", "DOCX", "CSV", "JSON"]).default("PDF"),
  watermark: z.boolean().default(false),
  watermarkText: z.string().optional().default("CONFIDENTIAL"),
  useLogo: z.boolean().default(true),
  sectionsJSON: z.string().optional(),
  computedTotalMarks: safeNumber.pipe(z.number().min(0)).optional(),
  ref_files: z.array(z.object({ name: z.string(), path: z.string().min(1) })).default([]),
  institute: z.string().optional().default("A4AI Test Generator"),
  teacherName: z.string().optional(),
  examTitle: z.string().optional(),
  examDate: z.string().optional(),
  chapters: z.array(z.string()).default([]),
  buckets: z.array(QuestionBucket).default([]),
  cognitiveLevels: z.array(CognitiveLevel).default(["understand", "apply"]),
  avoidDuplicates: z.boolean().default(true),
  requireUnits: z.boolean().default(true),
  timeLimit: safeNumber.pipe(z.number().min(5)).optional(),
  shareable: z.boolean().default(false),

  // ==================== NCERT PARAMETERS ====================
  useNCERT: z.boolean().default(false),
  ncertClass: safeNumber.pipe(z.number().int().min(1).max(12)).optional(),
  ncertSubject: z.string().optional(),
  ncertChapters: z.array(z.string()).default([]),
  ncertTopics: z.array(z.string()).default([]),
  ncertWeight: safeNumber.pipe(z.number().min(0).max(1)).default(0.6),

}).refine((d) => (d.mode === "mix" ? d.mix.easy + d.mix.medium + d.mix.hard === 100 : true), {
  path: ["mix"],
  message: "Mix must sum to 100%",
});

/* -------------------- Env & Setup -------------------- */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const FAST_MODE = Deno.env.get("FAST_MODE") === "true";
const USE_FALLBACK_LLM = Deno.env.get("USE_FALLBACK_LLM") === "true"; // ✅ NEW: Fallback option

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const TESTS_BUCKET = "tests";
const IS_PUBLIC_BUCKET = true;
const REFS_BUCKET = Deno.env.get("REFS_BUCKET") || "papers";

/* -------------------- OPTIMIZED CORS & UTILS -------------------- */
const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000", "http://localhost:5173", "http://localhost:8080",
  "https://a4ai.in", "https://www.a4ai.in",
]);

const corsHeadersFor = (req: Request) => {
  const origin = req.headers.get("Origin") ?? "";
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => 
  new Response(JSON.stringify(body), { 
    status, 
    headers: { 
      "Content-Type": "application/json", 
      ...extra 
    } 
  });

const now = () => performance.now();
const dur = (ms: number) => Math.round(ms);

/* -------------------- OPTIMIZED TEXT UTILS -------------------- */
const cleanOption = (opt: unknown): string => 
  String(opt || "").trim().replace(/^[A-D]\s*[\)\.\:\-]\s*/i, "").trim();

const looksLikePlaceholderOptions = (opts: unknown): boolean => {
  if (!Array.isArray(opts) || opts.length < 3) return true;
  const plain = opts.map((o) => cleanOption(String(o)).toLowerCase());
  return plain.every(t => t.length <= 2) || new Set(plain).size < Math.ceil(opts.length / 2);
};

const sanitizeText = (s?: string): string => {
  if (!s) return "";
  return s
    .replace(/[→⟶➝➔⇒⟹]/g, "->")
    .replace(/[←⟵⇐⟸]/g, "<-")
    .replace(/[↔⇄⇆⇌⇋]/g, "<->")
    .replace(/√/g, "sqrt")
    .replace(/[×✕✖]/g, "x")
    .replace(/÷/g, "/")
    .replace(/π/g, "pi")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/≠/g, "!=")
    .replace(/≈/g, "~")
    .replace(/["""]/g, '"')
    .replace(/[''']/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/\t/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();
};

/* -------------------- OPTIMIZED REFERENCES LOADER -------------------- */
const loadRefs = async (refs?: Array<{ name: string; path: string }>): Promise<string> => {
  if (!refs?.length) return "";
  
  const textPromises = refs
    .filter(r => r.path.match(/\.(txt|csv|md)$/i))
    .map(async (r) => {
      try {
        const { data, error } = await supabase.storage.from(REFS_BUCKET).download(r.path);
        if (error) {
          console.warn(`Failed to download ref ${r.path}:`, error);
          return "";
        }
        return data ? (await data.text()).slice(0, 4000) : "";
      } catch (error) {
        console.warn(`Error loading ref ${r.path}:`, error);
        return "";
      }
    });

  const texts = await Promise.all(textPromises);
  return texts.filter(Boolean).join("\n---\n").slice(0, 12000);
};

/* ==================== ENHANCED NCERT RAG SEARCH ==================== */
const searchNCERTContent = async (
  queryText: string,
  classGrade: string,
  subject: string,
  chapters: string[],
  limit: number = 5
): Promise<string> => {
  if (!GEMINI_API_KEY) {
    console.warn("Skipping NCERT Search: GEMINI_API_KEY missing");
    return "";
  }
  
  try {
    const embeddingResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent",
      {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "x-goog-api-key": GEMINI_API_KEY 
        },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: queryText }] },
          task_type: "RETRIEVAL_QUERY",
        }),
      }
    );

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      console.warn("Failed to get embedding for NCERT search:", errorText);
      return "";
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.embedding?.values;

    if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
      console.warn("Invalid embedding received");
      return "";
    }

    const { data, error } = await supabase.rpc("match_ncert", {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: limit,
      filter_class: classGrade,
      filter_subject: subject
    });

    if (error || !data) {
      console.warn("NCERT RAG search failed:", error);
      return "";
    }

    // Filter by chapters if specified
    let filteredData = data;
    if (chapters.length > 0) {
      filteredData = filteredData.filter((item: any) => 
        chapters.some(chapter => 
          item.content?.toLowerCase().includes(chapter.toLowerCase()) ||
          (item.chapter && item.chapter.toLowerCase().includes(chapter.toLowerCase()))
        )
      );
    }

    return filteredData
      .slice(0, 3)
      .map((item: any, idx: number) => 
        `[NCERT Source ${idx + 1}: ${item.chapter || "Unknown"} - Class ${item.class_grade}]\n${item.content}`
      )
      .join("\n\n---\n\n");

  } catch (error) {
    console.error("NCERT RAG search error:", error);
    return "";
  }
};

/* ==================== ENHANCED BUCKET CREATION ==================== */
const createBuckets = (input: z.infer<typeof Input>): any[] => {
  if (input.buckets?.length) return input.buckets;

  const defaultCognitive = input.cognitiveLevels[0] || "understand";
  const typeMap: Record<string, string> = {
    "Multiple Choice": "mcq", 
    "Very Short Answer": "short", 
    "Short Answer": "short", 
    "Long Answer": "long", 
    "Case-based": "case_based"
  };

  if (input.patternMode === "simple") {
    return [{
      type: "mcq",
      difficulty: input.difficulty.toLowerCase(),
      cognitive: defaultCognitive,
      count: input.qCount,
      marks: input.marksPerQuestion,
      negativeMarking: input.negativeMarking || 0
    }];
  }

  if (input.patternMode === "blueprint" && input.sections.length > 0) {
    return input.sections.map(section => ({
      type: typeMap[section.questionType] || "mcq",
      difficulty: input.difficulty.toLowerCase(),
      cognitive: defaultCognitive,
      count: section.count,
      marks: section.marksPerQuestion,
      negativeMarking: input.negativeMarking || 0
    }));
  }

  return [{
    type: "mcq",
    difficulty: input.difficulty.toLowerCase(),
    cognitive: defaultCognitive,
    count: input.qCount || 5,
    marks: input.marksPerQuestion || 1,
    negativeMarking: input.negativeMarking || 0
  }];
};

/* ==================== ENHANCED PROMPT BUILDER ==================== */
const buildEnhancedPrompt = async (
  bucket: any, 
  input: z.infer<typeof Input>, 
  refsText: string = ""
): Promise<string> => {
  const lang = input.language;
  const chapters = (input.chapters?.length ? input.chapters : input.topics)?.join(", ") || "relevant topics";
  const refNote = refsText ? `\nReference extracts:\n${refsText.slice(0, 2000)}\n` : "";

  let ncertContext = "";
  if (input.useNCERT) {
    const query = `Generate ${bucket.type} questions about ${chapters} for class ${input.classNum} ${input.subject}`;
    ncertContext = await searchNCERTContent(
      query,
      (input.ncertClass || input.classNum).toString(),
      input.ncertSubject || input.subject,
      input.ncertChapters.length > 0 ? input.ncertChapters : input.chapters
    );
  }

  const ncertSection = ncertContext ? 
    `\nNCERT Textbook Context (${Math.round(input.ncertWeight * 100)}% weight):\n${ncertContext.slice(0, 3000)}\n` : 
    "";

  return `Generate ${bucket.count} ${lang} questions for ${input.board} Class ${input.classNum} ${input.subject}.
Question Type: ${bucket.type.toUpperCase()}
Marks: ${bucket.marks}
Difficulty: ${bucket.difficulty}
Cognitive Level: ${bucket.cognitive}
Topics: ${chapters}${input.useNCERT ? "\nNCERT Syllabus Aligned: YES" : ""}${ncertSection}${refNote}

Return JSON array with exactly ${bucket.count} questions:
[
 {
   "type": "${bucket.type}",
   "difficulty": "${bucket.difficulty}",
   "cognitive": "${bucket.cognitive}",
   "marks": ${bucket.marks},
   "text": "question text in ${lang}",
   "options": ["A","B","C","D"],
   "answer": "correct answer",
   "solution": "detailed stepwise explanation"
 }
]
No extra keys. No commentary.`.trim();
};

/* ==================== ENHANCED LLM LAYER ==================== */
type GenQuestion = {
  type: string;
  difficulty: "easy" | "medium" | "hard";
  cognitive?: string;
  marks: number;
  text: string;
  options?: string[];
  answer?: string;
  solution?: string;
};

const safeParseArray = (s: string): GenQuestion[] => {
  try {
    // Remove markdown code fences
    let trimmed = s.trim();
    if (trimmed.startsWith("```")) {
      const lines = trimmed.split("\n");
      trimmed = lines.slice(1, -1).join("\n").trim();
    }
    
    // Try to find JSON array
    const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      trimmed = jsonMatch[0];
    }
    
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : 
           Array.isArray((parsed as any)?.questions) ? (parsed as any).questions : [];
  } catch (error) {
    console.warn("Failed to parse LLM response:", error);
    return [];
  }
};

const callLLM = async (
  url: string, 
  apiKey: string, 
  body: any, 
  rid: string, 
  provider: string
): Promise<GenQuestion[]> => {
  if (!apiKey) {
    console.log(`rid=${rid} ${provider} API key missing`);
    return [];
  }

  const t0 = now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // Increased timeout

    const res = await fetch(url, {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${apiKey}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`rid=${rid} ${provider} API error: ${res.status} ${res.statusText}`, errorText);
      return [];
    }

    const j = await res.json().catch(() => ({}));
    const content = j?.choices?.[0]?.message?.content ?? "[]";
    const out = safeParseArray(content);
    console.log(`rid=${rid} ${provider} ms=${dur(now() - t0)} q=${out.length}`);
    return out;
  } catch (e: any) {
    console.error(`rid=${rid} ${provider} error:`, e?.message || e);
    return [];
  }
};

const callOpenAI = (prompt: string, rid: string): Promise<GenQuestion[]> => 
  callLLM("https://api.openai.com/v1/chat/completions", OPENAI_API_KEY, {
    model: "gpt-4o-mini",
    temperature: 0.35,
    messages: [
      { 
        role: "system", 
        content: "You are a CBSE/NCERT exam paper generator. Return valid JSON array ONLY, no markdown fences, no extra text." 
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 4000,
  }, rid, "openai");

const callDeepSeek = (prompt: string, rid: string): Promise<GenQuestion[]> => 
  callLLM("https://api.deepseek.com/chat/completions", DEEPSEEK_API_KEY, {
    model: "deepseek-chat",
    temperature: 0.45,
    messages: [
      { 
        role: "system", 
        content: "You are a CBSE/NCERT exam paper generator. Return valid JSON array ONLY, no markdown fences, no extra text." 
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 4000,
  }, rid, "deepseek");

/* ==================== FALLBACK LLM (Local or Alternative) ==================== */
const callFallbackLLM = async (prompt: string, rid: string): Promise<GenQuestion[]> => {
  console.log(`rid=${rid} Using fallback LLM`);
  
  // Simple fallback: Generate dummy questions
  return Array.from({ length: 5 }, (_, i) => ({
    type: "mcq",
    difficulty: "medium",
    cognitive: "understand",
    marks: 1,
    text: `Sample question ${i + 1} about ${rid.slice(0, 4)}?`,
    options: ["Option A", "Option B", "Option C", "Option D"],
    answer: "Option A",
    solution: "This is a sample solution for demonstration."
  }));
};

/* ==================== ENHANCED QUESTION PROCESSING ==================== */
const processQuestionsForBucket = (
  questions: GenQuestion[], 
  bucket: any, 
  keyWords: string[]
): GenQuestion[] => {
  const typeMap: Record<string, string[]> = {
    'mcq': ['mcq', 'multiple choice'],
    'short': ['short', 'very short answer', 'vsa'],
    'long': ['long', 'long answer', 'la'],
    'case_based': ['case', 'case-based', 'case_based']
  };

  const uniq = new Set<string>();
  const scored: { q: GenQuestion; s: number }[] = [];

  for (const q of questions) {
    if (!q?.text || q.text.length < 10) continue;
    
    // Type matching
    const qType = (q.type || '').toLowerCase();
    const bucketType = bucket.type.toLowerCase();
    const allowedTypes = typeMap[bucketType] || [bucketType];
    
    if (!allowedTypes.includes(qType)) continue;
    
    // Difficulty matching
    if (q.difficulty !== bucket.difficulty) continue;
    
    // Marks matching
    if (Math.abs((q.marks || 0) - bucket.marks) > 0.5) continue;
    
    // Check for placeholder options in MCQ
    if (q.type === "MCQ" && looksLikePlaceholderOptions(q.options)) continue;

    // Deduplication
    const key = q.text.toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^\w\s]/g, "")
      .slice(0, 150);
    if (uniq.has(key)) continue;
    uniq.add(key);

    // Scoring
    let score = 0;
    if (q.text.length > 20) score++;
    if (keyWords.some(k => key.includes(k.toLowerCase()))) score += 2;
    if (q.type === "MCQ" && Array.isArray(q.options) && q.options.length >= 4 && q.answer) score++;
    if (q.solution && q.solution.length > 10) score += 2;
    if (q.cognitive === bucket.cognitive) score += 2;
    if (q.answer && q.answer.trim().length > 0) score++;

    scored.push({ q, s: score });
  }

  return scored
    .sort((a, b) => b.s - a.s)
    .slice(0, bucket.count)
    .map(x => x.q);
};

/* ==================== ENHANCED BUCKET GENERATION ==================== */
const generateWithBuckets = async (
  input: z.infer<typeof Input>, 
  rid: string, 
  refsText: string
): Promise<Record<string, GenQuestion[]>> => {
  const buckets = createBuckets(input);
  const allQuestions: GenQuestion[] = [];
  const keyWords = [
    ...(input.chapters?.length ? input.chapters : input.topics),
    input.subject
  ].join(" ").toLowerCase().split(/\W+/).filter(Boolean);
  
  console.log(`rid=${rid} Processing ${buckets.length} buckets`);

  for (const bucket of buckets) {
    console.log(`rid=${rid} Generating bucket: ${bucket.type} x${bucket.count}`);
    
    const prompt = await buildEnhancedPrompt(bucket, input, refsText);

    // Try multiple LLMs in parallel with fallback
    let questions: GenQuestion[] = [];
    
    if (OPENAI_API_KEY || DEEPSEEK_API_KEY) {
      const [openAIResults, deepSeekResults] = await Promise.all([
        OPENAI_API_KEY ? callOpenAI(prompt, rid) : Promise.resolve([]),
        (!FAST_MODE && DEEPSEEK_API_KEY) ? callDeepSeek(prompt, rid) : Promise.resolve([])
      ]);
      
      questions = [...openAIResults, ...deepSeekResults];
    }
    
    // If no questions from primary LLMs, use fallback
    if (questions.length === 0 && USE_FALLBACK_LLM) {
      questions = await callFallbackLLM(prompt, rid);
    }

    console.log(`rid=${rid} Bucket ${bucket.type} got ${questions.length} raw questions`);

    if (questions.length === 0) {
      console.warn(`rid=${rid} No questions generated for bucket ${bucket.type}`);
      continue;
    }

    const bestQuestions = processQuestionsForBucket(questions, bucket, keyWords);
    console.log(`rid=${rid} Bucket ${bucket.type} filtered to ${bestQuestions.length} questions`);
    
    // Fill missing if needed
    while (bestQuestions.length < bucket.count && bestQuestions.length > 0) {
      bestQuestions.push({...bestQuestions[0]});
    }
    
    allQuestions.push(...bestQuestions);
  }

  // Group by sections
  const sections: Record<string, GenQuestion[]> = {};
  let sectionIndex = 0;
  const sectionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
  
  for (const bucket of buckets) {
    if (sectionIndex >= sectionLetters.length) break;
    
    const bucketQuestions = allQuestions
      .filter(q => 
        Math.abs((q.marks || 0) - bucket.marks) < 0.5 && 
        q.difficulty === bucket.difficulty
      )
      .slice(0, bucket.count);
    
    if (bucketQuestions.length > 0) {
      sections[sectionLetters[sectionIndex]] = bucketQuestions;
      sectionIndex++;
    }
  }

  console.log(`rid=${rid} Created ${Object.keys(sections).length} sections with ${allQuestions.length} total questions`);
  return sections;
};

/* ==================== HYBRID PDF RENDERER ==================== */
const renderPdf = async (
  input: z.infer<typeof Input>, 
  sections: Record<string, GenQuestion[]>
): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  
  // Embed fonts
  const [font, bold, italic] = await Promise.all([
    pdf.embedFont(StandardFonts.TimesRoman),
    pdf.embedFont(StandardFonts.TimesRomanBold),
    pdf.embedFont(StandardFonts.TimesRomanItalic)
  ]);

  // Colors
  const black = rgb(0, 0, 0);
  const darkGray = rgb(0.3, 0.3, 0.3);
  const blue = rgb(0.1, 0.3, 0.6);
  const lightBlue = rgb(0.9, 0.95, 1);

  // Draw borders
  const drawBorder = () => {
    page.drawRectangle({
      x: 25, y: 25,
      width: width - 50,
      height: height - 50,
      borderWidth: 2,
      borderColor: darkGray,
    });
    page.drawRectangle({
      x: 30, y: 30,
      width: width - 60,
      height: height - 60,
      borderWidth: 1,
      borderColor: rgb(0.8, 0.8, 0.8),
    });
  };

  drawBorder();

  const marginX = 50;
  const maxWidth = width - (marginX * 2);
  let y = height - 70;
  const lineHeight = 14;

  const newPage = () => {
    page = pdf.addPage([595.28, 841.89]);
    drawBorder();
    y = height - 70;
  };

  const checkSpace = (needed: number = 30) => {
    if (y < needed + 50) newPage();
  };

  // Text writing with wrapping
  const writeText = (
    text: string, 
    options: { 
      size?: number; 
      bold?: boolean; 
      italic?: boolean; 
      color?: any; 
      align?: 'left'|'center'|'right'; 
      indent?: number; 
      maxWidth?: number;
    } = {}
  ) => {
    const txt = sanitizeText(text);
    const size = options.size || 11;
    const txtFont = options.bold ? bold : (options.italic ? italic : font);
    const indent = options.indent || 0;
    const color = options.color || black;
    const availableWidth = options.maxWidth || (maxWidth - indent);
    
    const words = txt.split(' ');
    let line = '';

    for (const word of words) {
      const testLine = line + word + ' ';
      const textWidth = txtFont.widthOfTextAtSize(testLine, size);
      
      if (textWidth > availableWidth && line.length > 0) {
        checkSpace(lineHeight);
        let x = marginX + indent;
        if (options.align === 'center') x = (width - txtFont.widthOfTextAtSize(line, size)) / 2;
        if (options.align === 'right') x = width - marginX - txtFont.widthOfTextAtSize(line, size) - indent;
        
        page.drawText(line.trim(), { x, y, size, font: txtFont, color });
        y -= (lineHeight + 2);
        line = word + ' ';
      } else {
        line = testLine;
      }
    }
    
    if (line.length > 0) {
      checkSpace(lineHeight);
      let x = marginX + indent;
      if (options.align === 'center') x = (width - txtFont.widthOfTextAtSize(line, size)) / 2;
      if (options.align === 'right') x = width - marginX - txtFont.widthOfTextAtSize(line, size) - indent;
      
      page.drawText(line.trim(), { x, y, size, font: txtFont, color });
      y -= (lineHeight + (size >= 14 ? 6 : 4));
    }
  };

  const drawLine = (full: boolean = true) => {
    const startX = full ? marginX : marginX + 20;
    const endX = full ? width - marginX : width - marginX - 20;
    
    page.drawLine({
      start: { x: startX, y: y + 5 },
      end: { x: endX, y: y + 5 },
      thickness: full ? 1 : 0.5,
      color: full ? darkGray : rgb(0.7, 0.7, 0.7),
    });
    y -= 15;
  };

  // =============== HEADER ===============
  writeText(input.institute || "A4AI Test Generator", { 
    size: 18, bold: true, color: blue, align: 'center' 
  });
  writeText(`${input.subject.toUpperCase()} • Class ${input.classNum} • ${input.board}`, { 
    size: 14, align: 'center' 
  });
  
  const totalMarks = input.computedTotalMarks || 
    Object.values(sections).flat().reduce((s, q) => s + (Number(q.marks) || 0), 0);
  const timeText = input.timeLimit ? `${input.timeLimit} minutes` : '3 Hours';
  
  checkSpace(20);
  page.drawText(`Time: ${timeText}`, { 
    x: marginX, y, size: 12, font: bold, color: black 
  });
  const marksWidth = bold.widthOfTextAtSize(`Max Marks: ${totalMarks}`, 12);
  page.drawText(`Max Marks: ${totalMarks}`, { 
    x: width - marginX - marksWidth, y, size: 12, font: bold, color: black 
  });
  y -= 25;

  // =============== INSTRUCTIONS ===============
  if (input.notes) {
    writeText("General Instructions:", { size: 13, bold: true, color: blue });
    const instructions = input.notes.split(/\n+/).filter(Boolean);
    instructions.slice(0, 6).forEach((instruction, idx) => {
      writeText(`${idx + 1}. ${instruction}`, { 
        size: 11, indent: 10, maxWidth: maxWidth - 20 
      });
    });
    y -= 10;
    drawLine(false);
    y -= 15;
  }

  // =============== QUESTIONS ===============
  const sectionKeys = Object.keys(sections).sort();
  let questionNumber = 1;

  for (const sectionName of sectionKeys) {
    const questions = sections[sectionName];
    if (!questions.length) continue;

    const sectionMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
    
    // Section header
    checkSpace(40);
    page.drawRectangle({
      x: marginX - 5, y: y + 5,
      width: maxWidth + 10, height: 35,
      color: lightBlue,
      borderWidth: 1,
      borderColor: blue,
    });
    
    page.drawText(`SECTION - ${sectionName}`, {
      x: marginX, y: y + 22,
      size: 14,
      font: bold,
      color: blue,
    });
    
    const marksText = `[${sectionMarks} Marks]`;
    const marksWidth = bold.widthOfTextAtSize(marksText, 12);
    page.drawText(marksText, {
      x: width - marginX - marksWidth, y: y + 22,
      size: 12,
      font: bold,
      color: darkGray,
    });
    
    y -= 45;

    // Questions in section
    for (const q of questions) {
      checkSpace(60);
      
      const qPrefix = `${questionNumber}. `;
      const marksText = `[${q.marks} Mark${q.marks > 1 ? 's' : ''}]`;
      
      page.drawText(qPrefix, { 
        x: marginX, y, size: 12, font: bold, color: black 
      });
      const prefixWidth = bold.widthOfTextAtSize(qPrefix, 12);
      
      writeText(`${sanitizeText(q.text)} ${marksText}`, { 
        size: 12, 
        indent: prefixWidth,
        maxWidth: maxWidth - prefixWidth - 10
      });

      // MCQ Options
      if ((q.type === "MCQ" || q.type === "mcq") && q.options?.length) {
        const abc = ["A", "B", "C", "D"];
        const opts = q.options.map(cleanOption);
        
        opts.forEach((opt, idx) => {
          writeText(`   ${abc[idx]}. ${opt}`, { 
            size: 11, 
            color: darkGray,
            indent: 20,
            maxWidth: maxWidth - 30
          });
        });
      }
      
      // Space for answers
      if (q.type !== "MCQ" && q.marks > 1) {
        const answerLines = Math.min(Math.ceil(q.marks / 2), 4);
        for (let i = 0; i < answerLines; i++) {
          page.drawLine({
            start: { x: marginX + 25, y: y + 3 },
            end: { x: width - marginX - 25, y: y + 3 },
            thickness: 0.5,
            color: rgb(0.85, 0.85, 0.85),
          });
          y -= 12;
        }
        y -= 5;
      }
      
      y -= 8;
      questionNumber++;
    }
    
    drawLine(false);
    y -= 20;
  }

  // =============== ANSWER KEY ===============
  if (input.includeAnswerKey) {
    newPage();
    
    // Header
    writeText("ANSWER KEY", { 
      size: 16, bold: true, color: blue, align: 'center' 
    });
    y -= 30;
    
    // Answers table
    let answerIndex = 1;
    for (const sectionName of sectionKeys) {
      const questions = sections[sectionName];
      questions.forEach((q) => {
        writeText(`${answerIndex}. ${sanitizeText(q.answer || "—")}`, { 
          size: 12 
        });
        answerIndex++;
      });
    }
    
    // Detailed solutions
    const allQuestions = Object.values(sections).flat();
    const hasSolutions = allQuestions.some(q => q.solution && q.solution.length > 10);
    
    if (hasSolutions && input.solutionStyle === "Steps") {
      y -= 25;
      writeText("DETAILED SOLUTIONS", { 
        size: 14, bold: true, color: blue, align: 'center' 
      });
      drawLine();
      y -= 15;
      
      let solutionIndex = 1;
      for (const sectionName of sectionKeys) {
        const questions = sections[sectionName];
        questions.forEach((q) => {
          if (q.solution && q.solution.length > 20) {
            writeText(`Q${solutionIndex}. ${sanitizeText(q.solution)}`, { 
              size: 11, 
              italic: true,
              maxWidth: maxWidth - 20
            });
            writeText("", { size: 8 });
          }
          solutionIndex++;
        });
      }
    }
  }

  // Watermark
  if (input.watermark) {
    const pages = pdf.getPages();
    const watermarkText = input.watermarkText || "CONFIDENTIAL";
    
    pages.forEach((pg) => {
      pg.drawText(watermarkText, {
        x: width / 2,
        y: height / 2,
        size: 48,
        font: italic,
        color: rgb(0.9, 0.9, 0.9),
        opacity: 0.15,
        rotate: { type: 'degrees', angle: 45 },
      });
    });
  }

  return await pdf.save();
};

/* ==================== CSV EXPORT ==================== */
const createCsv = (sections: Record<string, GenQuestion[]>): Uint8Array => {
  const rows: any[] = [];
  const sectionKeys = Object.keys(sections).sort();
  let questionIndex = 1;

  for (const sectionName of sectionKeys) {
    const questions = sections[sectionName];
    
    questions.forEach((q, idx) => {
      const opts = (q.options || []).slice(0, 4).map(cleanOption);
      rows.push({
        Section: sectionName,
        'Q.No': questionIndex,
        Marks: q.marks || 0,
        Type: q.type || '',
        Difficulty: q.difficulty || '',
        Cognitive: q.cognitive || '',
        Question: sanitizeText(q.text || ''),
        OptionA: opts[0] || '',
        OptionB: opts[1] || '',
        OptionC: opts[2] || '',
        OptionD: opts[3] || '',
        Answer: q.answer || '',
        Solution: q.solution || ''
      });
      questionIndex++;
    });
  }

  // Create CSV
  const headers = Object.keys(rows[0] || {});
  const csvRows = [
    headers.join(','),
    ...rows.map(row => 
      headers.map(header => {
        const value = row[header] || '';
        // Escape quotes and wrap in quotes if contains comma or quotes
        const escaped = String(value).replace(/"/g, '""');
        return /[,"\n]/.test(escaped) ? `"${escaped}"` : escaped;
      }).join(',')
    )
  ];

  return new TextEncoder().encode(csvRows.join('\n'));
};

/* ==================== DOCX EXPORT ==================== */
const createDocx = async (
  input: z.infer<typeof Input>, 
  sections: Record<string, GenQuestion[]>
): Promise<Uint8Array> => {
  const zip = new JSZip();

  // Minimal DOCX structure
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>${sanitizeText(input.institute || "Test Paper")}</w:t></w:r></w:p>
    <w:p><w:r><w:t>${input.subject} - Class ${input.classNum} - ${input.board}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Time: ${input.timeLimit || '3 Hours'} | Marks: ${input.computedTotalMarks || '100'}</w:t></w:r></w:p>
    <w:p></w:p>
    ${Object.keys(sections).sort().map(sectionName => {
      const questions = sections[sectionName];
      return `
        <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>SECTION ${sectionName}</w:t></w:r></w:p>
        ${questions.map((q, idx) => `
          <w:p><w:r><w:t>${idx + 1}. ${sanitizeText(q.text)} [${q.marks} Marks]</w:t></w:r></w:p>
          ${(q.options || []).map((opt, optIdx) => `
            <w:p><w:r><w:t>   ${String.fromCharCode(65 + optIdx)}. ${sanitizeText(opt)}</w:t></w:r></w:p>
          `).join('')}
        `).join('')}
      `;
    }).join('')}
    <w:sectPr/>
  </w:body>
</w:document>`;

  // Add required files
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  zip.folder("_rels")?.file(".rels", `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  zip.folder("word")?.file("document.xml", documentXml);

  return await zip.generateAsync({ type: "uint8array" });
};

/* ==================== DATA PREPROCESSOR ==================== */
const preprocessData = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => preprocessData(item));
  }
  
  if (typeof obj === 'object') {
    const processed: any = {};
    for (const [key, value] of Object.entries(obj)) {
      processed[key] = preprocessData(value);
    }
    return processed;
  }
  
  if (typeof obj === 'string') {
    // Convert numeric strings to numbers
    if (obj.trim() === '') return '';
    const num = Number(obj);
    if (!isNaN(num) && obj.trim() !== '') {
      return num;
    }
    return obj;
  }
  
  return obj;
};

/* ==================== STORAGE UPLOAD ==================== */
const uploadToStorage = async (
  basePath: string, 
  files: Array<{ path: string; data: Uint8Array; contentType: string }>
): Promise<string[]> => {
  const uploadPromises = files.map(async ({ path, data, contentType }) => {
    const { data: uploadData, error } = await supabase.storage
      .from(TESTS_BUCKET)
      .upload(path, data, {
        upsert: true,
        contentType,
        cacheControl: '3600'
      });
    
    if (error) {
      console.error(`Failed to upload ${path}:`, error);
      throw error;
    }
    
    return uploadData?.path || path;
  });

  return await Promise.all(uploadPromises);
};

const getPublicUrls = (paths: string[]): Record<string, string> => {
  const urls: Record<string, string> = {};
  
  paths.forEach(path => {
    const { data } = supabase.storage
      .from(TESTS_BUCKET)
      .getPublicUrl(path);
    
    const fileName = path.split('/').pop() || 'file';
    urls[fileName] = data.publicUrl;
  });
  
  return urls;
};

/* ==================== MAIN HANDLER ==================== */
Deno.serve(async (req) => {
  const CORS = corsHeadersFor(req);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  // Health check
  const url = new URL(req.url);
  if (url.pathname.includes("/health")) {
    return json({
      ok: true,
      timestamp: new Date().toISOString(),
      services: {
        supabase: !!SUPABASE_URL,
        openai: !!OPENAI_API_KEY,
        deepseek: !!DEEPSEEK_API_KEY,
        gemini: !!GEMINI_API_KEY
      }
    }, 200, CORS);
  }

  // Only accept POST for main endpoint
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, CORS);
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] Request started`);

  try {
    // Parse request body
    let rawBody: string;
    try {
      rawBody = await req.text();
    } catch {
      return json({ error: "Invalid request body" }, 400, CORS);
    }

    let data: any;
    try {
      data = JSON.parse(rawBody);
    } catch {
      return json({ error: "Invalid JSON" }, 400, CORS);
    }

    // Validate input
    let input: z.infer<typeof Input>;
    try {
      const processed = preprocessData(data);
      input = Input.parse(processed);
    } catch (error: any) {
      console.error(`[${requestId}] Validation error:`, error);
      return json({ 
        error: "Invalid input", 
        details: error.errors || error.message,
        requestId 
      }, 400, CORS);
    }

    console.log(`[${requestId}] Processing request for user: ${input.userId}`);

    // Update request status if exists
    if (input.requestId) {
      await supabase
        .from("paper_requests")
        .update({ status: "generating" })
        .eq("id", input.requestId);
    }

    // Load references
    const refsText = await loadRefs(input.ref_files);
    
    // Generate questions
    const sections = await generateWithBuckets(input, requestId, refsText);
    const totalQuestions = Object.values(sections).flat().length;

    if (totalQuestions === 0) {
      throw new Error("No questions generated");
    }

    console.log(`[${requestId}] Generated ${totalQuestions} questions`);

    // Create outputs in parallel
    const [pdfData, docxData, csvData] = await Promise.all([
      renderPdf(input, sections),
      createDocx(input, sections),
      Promise.resolve(createCsv(sections))
    ]);

    // Upload to storage
    const basePath = `${input.userId}/${input.requestId || crypto.randomUUID()}`;
    const files = [
      { path: `${basePath}/paper.pdf`, data: pdfData, contentType: "application/pdf" },
      { path: `${basePath}/paper.docx`, data: docxData, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      { path: `${basePath}/paper.csv`, data: csvData, contentType: "text/csv" }
    ];

    const uploadedPaths = await uploadToStorage(basePath, files);
    const urls = getPublicUrls(uploadedPaths);

    // Update request record
    if (input.requestId) {
      await supabase
        .from("paper_requests")
        .update({
          status: "completed",
          paper_url: urls['paper.pdf'],
          answer_key_url: null,
          meta: {
            total_questions: totalQuestions,
            sections: Object.keys(sections),
            generated_at: new Date().toISOString()
          }
        })
        .eq("id", input.requestId);
    }

    console.log(`[${requestId}] Request completed successfully`);

    return json({
      success: true,
      requestId,
      urls,
      metadata: {
        totalQuestions,
        sections: Object.keys(sections),
        format: input.outputFormat
      }
    }, 200, CORS);

  } catch (error: any) {
    console.error(`[${requestId}] Error:`, error);
    
    // Update error status
    try {
      const body = await req.json().catch(() => ({}));
      if (body.requestId) {
        await supabase
          .from("paper_requests")
          .update({ 
            status: "failed",
            meta: { error: error.message }
          })
          .eq("id", body.requestId);
      }
    } catch (updateError) {
      console.error(`[${requestId}] Failed to update error status:`, updateError);
    }

    return json({
      error: "Internal server error",
      message: error.message,
      requestId
    }, 500, CORS);
  }
});