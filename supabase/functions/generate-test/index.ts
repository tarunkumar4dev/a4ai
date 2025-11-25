/// <reference lib="deno.unstable" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { z } from "https://esm.sh/zod@3.23.8";
import JSZip from "https://esm.sh/jszip@3.10.1";

// ==================== OPTIMIZED UTILITY FUNCTIONS ====================
const safeNumber = z.union([
  z.number(),
  z.string().transform((val, ctx) => {
    if (val === '' || val === null || val === undefined) return 0;
    const parsed = Number(val);
    if (isNaN(parsed)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Expected number, received NaN: ${val}` });
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

const SectionNew = z.object({
  id: z.string(),
  marksPerQuestion: safeNumber.pipe(z.number().min(1).max(10)),
  count: safeNumber.pipe(z.number().int().min(1).max(100)),
  difficultyMix: z.object({
    easy: safeNumber.pipe(z.number().min(0)),
    medium: safeNumber.pipe(z.number().min(0)),
    hard: safeNumber.pipe(z.number().min(0)),
  }).default({ easy: 40, medium: 40, hard: 20 }),
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
  watermarkText: z.union([z.string(), z.number()]).optional().transform(val => val?.toString()),
  useLogo: z.boolean().default(true),
  sectionsJSON: z.string().optional(),
  computedTotalMarks: z.union([z.string(), z.number()]).optional().transform(val => val?.toString()),
  ref_files: z.array(z.object({ name: z.string(), path: z.string().min(1) })).default([]),
  institute: z.string().optional(),
  teacherName: z.string().optional(),
  examTitle: z.string().optional(),
  examDate: z.string().optional(),
  chapters: z.array(z.string()).default([]),
  buckets: z.array(QuestionBucket).default([]),
  cognitiveLevels: z.array(CognitiveLevel).default(["understand", "apply"]),
  avoidDuplicates: z.boolean().default(true),
  ncertWeight: safeNumber.pipe(z.number().min(0).max(1)).default(0.6),
  requireUnits: z.boolean().default(true),
  timeLimit: safeNumber.pipe(z.number().min(5)).optional(),
  shareable: z.boolean().default(false),
}).refine((d) => (d.mode === "mix" ? d.mix.easy + d.mix.medium + d.mix.hard === 100 : true), {
  path: ["mix"],
  message: "Mix must sum to 100%",
});

/* -------------------- Env & Setup -------------------- */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";
const FAST_MODE = Deno.env.get("FAST_MODE") === "true";

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
    Vary: "Origin",
    "Content-Type": "application/json",
  };
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => 
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...extra } });

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
  if (!s) return s || "";
  return s
    .replace(/[→⟶➝➔⇒⟹]/g, "->").replace(/[←⟵⇐⟸]/g, "<-").replace(/[↔⇄⇆⇌⇋]/g, "<->")
    .replace(/√/g, "sqrt").replace(/[×✕✖]/g, "x").replace(/÷/g, "/").replace(/π/g, "pi")
    .replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/≠/g, "!=").replace(/≈/g, "~")
    .replace(/["""]/g, '"').replace(/[''']/g, "'").replace(/[–—]/g, "-")
    .replace(/\u00A0/g, " ").replace(/\t/g, " ").replace(/[^\S\r\n]+/g, " ").trim();
};

/* -------------------- OPTIMIZED REFERENCES LOADER -------------------- */
const loadRefs = async (refs?: Array<{ name: string; path: string }>): Promise<string> => {
  if (!refs?.length) return "";
  
  const textPromises = refs
    .filter(r => r.path.match(/\.(txt|csv|md)$/i))
    .map(async (r) => {
      const { data } = await supabase.storage.from(REFS_BUCKET).download(r.path);
      return data ? (await data.text()).slice(0, 4000) : "";
    });

  const texts = await Promise.all(textPromises);
  return texts.filter(Boolean).join("\n---\n").slice(0, 12000);
};

/* ==================== OPTIMIZED BUCKET CREATION ==================== */
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

/* ==================== OPTIMIZED PROMPT BUILDER ==================== */
const buildEnhancedPrompt = (bucket: any, input: any, refsText: string = ""): string => {
  const lang = input.language;
  const chapters = (input.chapters?.length ? input.chapters : input.topics)?.join(", ") || "relevant topics";
  const refNote = refsText ? `\nReference extracts:\n${refsText.slice(0, 2000)}\n` : "";

  return `Generate ${bucket.count} ${lang} questions for ${input.board} Class ${input.classNum} ${input.subject}.
Question Type: ${bucket.type.toUpperCase()}
Marks: ${bucket.marks}
Difficulty: ${bucket.difficulty}
Cognitive Level: ${bucket.cognitive}
Topics: ${chapters}
NCERT Alignment: ${Math.round(input.ncertWeight * 100)}%

Return JSON array with ${bucket.count} questions:
[
 {
   "type": "${bucket.type}",
   "difficulty": "${bucket.difficulty}",
   "cognitive": "${bucket.cognitive}",
   "marks": ${bucket.marks},
   "text": "question text in ${lang}",
   "options": ["A","B","C","D"],
   "answer": "correct answer",
   "solution": "stepwise explanation"
 }
]
No extra keys. No commentary.${refNote}`.trim();
};

/* ==================== OPTIMIZED LLM LAYER ==================== */
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
    const trimmed = s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
    const json = JSON.parse(trimmed);
    return Array.isArray(json) ? json : 
           Array.isArray((json as any)?.questions) ? (json as any).questions : [];
  } catch {
    return [];
  }
};

const callLLM = async (url: string, apiKey: string, body: any, rid: string, provider: string): Promise<GenQuestion[]> => {
  if (!apiKey) {
    console.log(`rid=${rid} ${provider} API key missing`);
    return [];
  }

  const t0 = now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`rid=${rid} ${provider} API error: ${res.status} ${res.statusText}`);
      return [];
    }

    const j = await res.json().catch(() => ({}));
    const content = j?.choices?.[0]?.message?.content ?? "[]";
    const out = safeParseArray(content);
    console.log(`rid=${rid} ${provider} ms=${dur(now() - t0)} q=${out.length}`);
    return out;
  } catch (e) {
    console.error(`rid=${rid} ${provider} error`, e);
    return [];
  }
};

const callOpenAI = (prompt: string, rid: string): Promise<GenQuestion[]> => 
  callLLM("https://api.openai.com/v1/chat/completions", OPENAI_API_KEY, {
    model: "gpt-4o-mini",
    temperature: 0.35,
    messages: [
      { role: "system", content: "Return valid JSON ONLY, no markdown fences." },
      { role: "user", content: prompt },
    ],
    max_tokens: 4000,
  }, rid, "openai");

const callDeepSeek = (prompt: string, rid: string): Promise<GenQuestion[]> => 
  callLLM("https://api.deepseek.com/chat/completions", DEEPSEEK_API_KEY, {
    model: "deepseek-chat",
    temperature: 0.45,
    messages: [
      { role: "system", content: "Return valid JSON ONLY, no markdown fences." },
      { role: "user", content: prompt },
    ],
    max_tokens: 4000,
  }, rid, "deepseek");

/* ==================== OPTIMIZED QUESTION PROCESSING ==================== */
const processQuestionsForBucket = (questions: GenQuestion[], bucket: any, keyWords: string[]): GenQuestion[] => {
  const typeMap: Record<string, string[]> = {
    'mcq': ['mcq', 'multiple choice'],
    'short': ['short', 'very short answer', 'vsa'],
    'long': ['long', 'long answer', 'la'],
    'case_based': ['case', 'case-based', 'case_based']
  };

  const uniq = new Set<string>();
  const scored: { q: GenQuestion; s: number }[] = [];

  for (const q of questions) {
    if (!q?.text) continue;
    if (q.marks !== bucket.marks) continue;

    // Type matching with flexibility
    const qType = q.type?.toLowerCase();
    const bucketType = bucket.type.toLowerCase();
    if (qType !== bucketType && !typeMap[bucketType]?.includes(qType)) continue;
    
    if (q.difficulty !== bucket.difficulty) continue;
    if (q.type === "MCQ" && looksLikePlaceholderOptions(q.options)) continue;

    const key = q.text.toLowerCase().replace(/\s+/g, " ").slice(0, 200);
    if (uniq.has(key)) continue;
    uniq.add(key);

    let score = 0;
    if (q.text.length > 20) score++;
    if (keyWords.some(k => key.includes(k))) score++;
    if (q.type === "MCQ" && Array.isArray(q.options) && q.options.length >= 4 && q.answer) score++;
    if (q.solution && q.solution.length > 10) score++;
    if (q.cognitive === bucket.cognitive) score += 2;

    scored.push({ q, s: score });
  }

  return scored.sort((a, b) => b.s - a.s).slice(0, bucket.count).map(x => x.q);
};

/* ==================== OPTIMIZED BUCKET GENERATION ==================== */
const generateWithBuckets = async (input: z.infer<typeof Input>, rid: string, refsText: string): Promise<Record<string, GenQuestion[]>> => {
  const buckets = createBuckets(input);
  const allQuestions: GenQuestion[] = [];
  const keyWords = (input.chapters?.length ? input.chapters : input.topics).join(" ").toLowerCase().split(/\W+/).filter(Boolean);
  
  console.log(`rid=${rid} Processing ${buckets.length} buckets`);

  for (const bucket of buckets) {
    console.log(`rid=${rid} Generating bucket: ${bucket.type} x${bucket.count}`);
    
    const prompt = buildEnhancedPrompt(bucket, input, refsText);
    const [openAIResults, deepSeekResults] = await Promise.all([
      callOpenAI(prompt, rid),
      FAST_MODE ? [] : callDeepSeek(prompt, rid)
    ]);
    
    const merged = [...openAIResults, ...deepSeekResults];
    console.log(`rid=${rid} Bucket ${bucket.type} got ${merged.length} raw questions`);

    if (merged.length === 0) {
      console.warn(`rid=${rid} No questions generated for bucket ${bucket.type}`);
      continue;
    }

    const bestQuestions = processQuestionsForBucket(merged, bucket, keyWords);
    console.log(`rid=${rid} Bucket ${bucket.type} filtered to ${bestQuestions.length} questions`);
    allQuestions.push(...bestQuestions);
  }

  // Group by sections
  const sections: Record<string, GenQuestion[]> = {};
  let currentSection = 'A';
  
  for (const bucket of buckets) {
    const bucketQuestions = allQuestions
      .filter(q => q.marks === bucket.marks && q.difficulty === bucket.difficulty)
      .slice(0, bucket.count);
    
    if (bucketQuestions.length > 0) {
      sections[currentSection] = bucketQuestions;
      currentSection = String.fromCharCode(currentSection.charCodeAt(0) + 1);
    }
  }

  console.log(`rid=${rid} Created ${Object.keys(sections).length} sections with ${allQuestions.length} total questions`);
  return sections;
};

/* ==================== OPTIMIZED PDF RENDERER ==================== */
const renderPdf = async (input: z.infer<typeof Input>, sections: Record<string, GenQuestion[]>): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);

  const drawFrame = () => page.drawRectangle({ 
    x: 24, y: 24, width: width - 48, height: height - 48, 
    borderWidth: 1, borderColor: rgb(0.82, 0.82, 0.82) 
  });

  drawFrame();

  const marginX = 48;
  const lineH = 14;
  let y = height - 60;

  const newPage = () => {
    page = pdf.addPage([595.28, 841.89]);
    drawFrame();
    y = height - 60;
  };

  const write = (txt: string, size = 12, useBold = false) => {
    if (y < 80) newPage();
    page.drawText(sanitizeText(txt) || "", {
      x: marginX, y, size,
      font: useBold ? bold : font,
      color: rgb(0, 0, 0),
    });
    y -= lineH + (size >= 13 ? 2 : 0);
  };

  // Header
  write(input.institute || "a4ai — Test Paper", 16, true);
  write(input.examTitle || `${input.subject} • Class ${input.classNum} • ${input.board}`, 12);
  const maxMarks = input.computedTotalMarks || 
    Object.values(sections).flat().reduce((s, q) => s + (Number(q.marks) || 0), 0).toString();
  write(`Time: ${input.timeLimit ? `${input.timeLimit} minutes` : 'As per exam'} • Max Marks: ${maxMarks}`, 11);
  if (input.teacherName || input.examDate) {
    write(`Teacher: ${input.teacherName || "-"} | Date: ${input.examDate || "-"}`, 10);
  }
  write("", 10);

  // Instructions
  if (input.notes) {
    write("General Instructions:", 12, true);
    input.notes.split(/\n+/).filter(Boolean).slice(0, 12).forEach((ln, idx) => 
      write(`(${idx + 1}) ${ln}`, 10)
    );
    write("", 10);
  }

  // Sections
  const order = Object.keys(sections).sort();
  for (const sid of order) {
    const list = sections[sid] || [];
    if (!list.length) continue;
    
    write(`SECTION – ${sid}`, 12, true);
    list.forEach((q, idx) => {
      write(`${idx + 1}. (${q.marks}) ${q.text}`, 10);
      if (q.type === "MCQ" && q.options?.length) {
        const abc = ["A", "B", "C", "D"];
        q.options.slice(0, 4).forEach((opt, j) => 
          write(`   ${abc[j]}. ${cleanOption(opt)}`, 10)
        );
      }
      write("", 10);
    });
    y -= 6;
  }

  // Answer Key
  if (input.includeAnswerKey) {
    write("", 10);
    write("Answer Key:", 12, true);
    for (const sid of order) {
      const list = sections[sid] || [];
      list.forEach((q, idx) => 
        write(`Section ${sid}, Q${idx + 1}: ${q.answer || "-"}`, 10)
      );
    }
  }

  return await pdf.save();
};

/* ==================== OPTIMIZED CSV & DOCX EXPORTS ==================== */
const buildFlatRows = (sections: Record<string, GenQuestion[]>) => {
  const rows: Array<{
    section: string; index: number; marks: number; type: string; difficulty: string; cognitive?: string;
    text: string; optionA?: string; optionB?: string; optionC?: string; optionD?: string; answer?: string;
  }> = [];

  const order = Object.keys(sections).sort();
  for (const sid of order) {
    const list = sections[sid] || [];
    list.forEach((q, idx) => {
      const opts = (q.options || []).slice(0, 4).map(cleanOption);
      rows.push({
        section: sid, index: idx + 1, marks: Number(q.marks) || 0,
        type: q.type || "", difficulty: q.difficulty || "", cognitive: q.cognitive,
        text: sanitizeText(q.text || ""),
        optionA: opts[0], optionB: opts[1], optionC: opts[2], optionD: opts[3],
        answer: q.answer || "",
      });
    });
  }
  return rows;
};

const createCsv = (sections: Record<string, GenQuestion[]>): Uint8Array => {
  const rows = buildFlatRows(sections);
  const header = ["Section", "Index", "Marks", "Type", "Difficulty", "Cognitive", "Text", "OptionA", "OptionB", "OptionC", "OptionD", "Answer"];
  const lines = [header.join(",")];
  
  for (const r of rows) {
    const vals = [
      r.section, String(r.index), String(r.marks), r.type, r.difficulty, r.cognitive || "",
      r.text.replace(/"/g, '""'), (r.optionA || "").replace(/"/g, '""'), (r.optionB || "").replace(/"/g, '""'),
      (r.optionC || "").replace(/"/g, '""'), (r.optionD || "").replace(/"/g, '""'), (r.answer || "").replace(/"/g, '""'),
    ];
    lines.push(vals.map(v => `"${v}"`).join(","));
  }
  
  return new TextEncoder().encode(lines.join("\n"));
};

const createDocx = async (input: z.infer<typeof Input>, sections: Record<string, GenQuestion[]>): Promise<Uint8Array> => {
  const zip = new JSZip();

  // Content Types
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  // Relationships
  zip.folder("_rels")?.file(".rels", `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="R1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  zip.folder("word")?.folder("_rels")?.file("document.xml.rels", `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);

  // Document content
  const para = (text: string, bold = false) =>
    `<w:p><w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t>${
      text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    }</w:t></w:r></w:p>`;

  const parts: string[] = [];
  const order = Object.keys(sections).sort();

  // Header
  parts.push(para(sanitizeText(input.institute || "a4ai — Test Paper"), true));
  parts.push(para(sanitizeText(input.examTitle || `${input.subject} • Class ${input.classNum} • ${input.board}`)));
  const maxMarks = input.computedTotalMarks || 
    String(Object.values(sections).flat().reduce((s, q) => s + (Number(q.marks) || 0), 0));
  parts.push(para(`Time: ${input.timeLimit ? `${input.timeLimit} minutes` : 'As per exam'} • Max Marks: ${maxMarks}`));
  if (input.teacherName || input.examDate) {
    parts.push(para(`Teacher: ${input.teacherName || "-"} | Date: ${input.examDate || "-"}`));
  }
  parts.push(para(""));

  // Instructions
  if (input.notes) {
    parts.push(para("General Instructions:", true));
    input.notes.split(/\n+/).filter(Boolean).slice(0, 12).forEach((ln, idx) =>
      parts.push(para(`(${idx + 1}) ${sanitizeText(ln)}`))
    );
    parts.push(para(""));
  }

  // Sections
  for (const sid of order) {
    parts.push(para(`SECTION – ${sid}`, true));
    const list = sections[sid] || [];
    list.forEach((q, idx) => {
      parts.push(para(`${idx + 1}. (${q.marks}) ${sanitizeText(q.text)}`));
      if (q.type === "MCQ" && q.options?.length) {
        const abc = ["A", "B", "C", "D"];
        q.options.slice(0, 4).forEach((opt, j) =>
          parts.push(para(`   ${abc[j]}. ${sanitizeText(cleanOption(opt))}`))
        );
      }
      parts.push(para(""));
    });
  }

  // Answer Key
  if (input.includeAnswerKey) {
    parts.push(para(""));
    parts.push(para("Answer Key:", true));
    for (const sid of order) {
      const list = sections[sid] || [];
      list.forEach((q, idx) =>
        parts.push(para(`Section ${sid}, Q${idx + 1}: ${sanitizeText(q.answer || "-")}`))
      );
    }
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${parts.join("\n")}<w:sectPr/></w:body>
</w:document>`;

  zip.folder("word")?.file("document.xml", documentXml);
  return await zip.generateAsync({ type: "uint8array" }) as Uint8Array;
};

/* ==================== OPTIMIZED DATA PREPROCESSOR ==================== */
const preprocessData = (obj: any, key?: string): any => {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'object') {
    if (Array.isArray(obj)) return obj.map(item => preprocessData(item));
    
    const processed: any = {};
    for (const [k, value] of Object.entries(obj)) {
      if (Array.isArray(value) && value.length === 0) {
        processed[k] = [];
      } else if (value && typeof value === 'object' && Object.keys(value).length === 0) {
        processed[k] = {};
      } else {
        processed[k] = preprocessData(value, k);
      }
    }
    return processed;
  }
  
  if (typeof obj === 'string' && obj === '') {
    const numberFields = ['qCount', 'marksPerQuestion', 'negativeMarking', 'ncertWeight', 'classNum', 'timeLimit', 'count'];
    return (key && numberFields.some(field => key.includes(field))) ? 0 : '';
  }
  
  if (typeof obj === 'string' && obj.trim() !== '') {
    const numericValue = Number(obj);
    return !isNaN(numericValue) ? numericValue : obj;
  }
  
  return obj;
};

/* ==================== OPTIMIZED STORAGE UPLOAD ==================== */
const uploadToStorage = async (basePath: string, files: Array<{ path: string; data: Uint8Array; contentType: string }>) => {
  const uploadPromises = files.map(({ path, data, contentType }) =>
    supabase.storage.from(TESTS_BUCKET).upload(path, data, {
      upsert: true,
      contentType,
    })
  );

  const results = await Promise.all(uploadPromises);
  const errors = results.filter(r => r.error).map(r => r.error);
  if (errors.length > 0) throw errors[0];

  return results.map(r => r.data?.path || '');
};

const getPublicUrls = async (paths: string[]): Promise<Record<string, string>> => {
  if (IS_PUBLIC_BUCKET) {
    const urls: Record<string, string> = {};
    paths.forEach(path => {
      urls[path.split('/').pop() || ''] = supabase.storage.from(TESTS_BUCKET).getPublicUrl(path).data.publicUrl;
    });
    return urls;
  }

  const signedUrls: Record<string, string> = {};
  for (const path of paths) {
    const signed = await supabase.storage.from(TESTS_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
    signedUrls[path.split('/').pop() || ''] = signed.data?.signedUrl || '';
  }
  return signedUrls;
};

/* ======================================================================
   OPTIMIZED MAIN HANDLER
====================================================================== */
Deno.serve(async (req) => {
  const CORS = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/functions\/v[0-9]+/, "").replace(/^\/generate-test/, "").replace(/\/+$/, "") || "/";

  if (path === "/health") {
    return json({
      ok: true,
      keys: {
        openai: !!OPENAI_API_KEY,
        deepseek: !!DEEPSEEK_API_KEY,
        supabaseUrl: !!SUPABASE_URL,
        serviceRole: !!SUPABASE_SERVICE_ROLE_KEY,
      },
      models: { openai: "gpt-4o-mini", deepseek: "deepseek-chat" },
    }, 200, CORS);
  }

  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405, CORS);

  const rid = crypto.randomUUID();

  try {
    const rawBody = await req.text();
    console.log(`rid=${rid} Raw request body length:`, rawBody.length);
    
    let data;
    try {
      data = JSON.parse(rawBody);
    } catch (parseError) {
      console.error(`rid=${rid} JSON parse error:`, parseError);
      return json({ error: "Invalid JSON in request body", rid }, 400, CORS);
    }
    
    console.log(`rid=${rid} Parsed data keys:`, Object.keys(data));

    // Pre-process and validate input
    const processedData = preprocessData(data);
    let input: z.infer<typeof Input>;
    
    try {
      input = Input.parse(processedData);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const errorDetails = validationError.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
          received: err.received
        }));
        
        return json({ 
          error: "Validation failed", 
          details: errorDetails,
          rid 
        }, 400, CORS);
      }
      throw validationError;
    }
    
    console.log(`rid=${rid} Validated input successfully`);

    // Update request status if exists
    if (input.requestId) {
      await supabase.from("paper_requests").update({ status: "generating" }).eq("id", input.requestId);
    }

    // Load references and generate questions
    const refsText = await loadRefs(input.ref_files);
    const buckets = input.buckets?.length ? input.buckets : createBuckets(input);
    const sectionsOut = await generateWithBuckets({ ...input, buckets }, rid, refsText.slice(0, 1200));
    const totalQuestions = Object.values(sectionsOut).flat().length;

    if (totalQuestions === 0) {
      console.error(`rid=${rid} No questions generated`);
      if (input.requestId) {
        await supabase.from("paper_requests").update({
          status: "failed",
          meta: { error: "no questions generated", rid },
        }).eq("id", input.requestId);
      }
      return json({ error: "No questions could be generated. Please try again with different parameters.", rid }, 500, CORS);
    }

    console.log(`rid=${rid} Generated ${totalQuestions} questions across ${Object.keys(sectionsOut).length} sections`);

    // Generate outputs in parallel
    const [pdfBytes, docxBytes, csvBytes] = await Promise.all([
      renderPdf(input, sectionsOut),
      createDocx(input, sectionsOut),
      Promise.resolve(createCsv(sectionsOut))
    ]);

    // Upload to storage
    const base = `${input.userId}/${input.requestId ?? crypto.randomUUID()}`;
    const files = [
      { path: `${base}/paper.pdf`, data: pdfBytes, contentType: "application/pdf" },
      { path: `${base}/paper.docx`, data: docxBytes, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      { path: `${base}/paper.csv`, data: csvBytes, contentType: "text/csv" }
    ];

    await uploadToStorage(base, files);
    const urls = await getPublicUrls(files.map(f => f.path));

    // Update audit record
    if (input.requestId) {
      await supabase.from("paper_requests").update({
        status: "success",
        paper_url: urls['paper.pdf'],
        answer_key_url: null,
        ref_files: input.ref_files,
        meta: { 
          rid, 
          total_questions: totalQuestions, 
          mode: "enhanced_bucket", 
          cognitiveLevels: input.cognitiveLevels,
          ncertWeight: input.ncertWeight,
          sections: Object.keys(sectionsOut)
        },
      }).eq("id", input.requestId);
    }

    console.log(`rid=${rid} Successfully completed generation`);

    return json({
      ok: true,
      rid,
      pdfUrl: urls['paper.pdf'],
      docxUrl: urls['paper.docx'],
      csvUrl: urls['paper.csv'],
      meta: { 
        mode: "enhanced_bucket", 
        totalQuestions,
        cognitiveLevels: input.cognitiveLevels,
        ncertWeight: input.ncertWeight,
        sections: Object.keys(sectionsOut)
      },
    }, 200, CORS);
  } catch (e: any) {
    const msg = e?.message || String(e);
    const errRid = crypto.randomUUID();
    console.error(`rid=${errRid} generate-test fatal:`, msg);
    
    // Update request status if it exists
    try {
      const data = JSON.parse(await req.text());
      const processedData = preprocessData(data);
      
      if (processedData.requestId) {
        await supabase.from("paper_requests").update({
          status: "failed",
          meta: { error: msg, rid: errRid },
        }).eq("id", processedData.requestId);
      }
    } catch (parseError) {
      console.error(`rid=${errRid} Failed to parse input for error reporting:`, parseError);
    }
    
    return json({ error: "Internal server error", rid: errRid }, 500, CORS);
  }
});