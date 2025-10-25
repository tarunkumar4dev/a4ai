/// <reference lib="deno.unstable" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { z } from "https://esm.sh/zod@3.23.8";
import JSZip from "https://esm.sh/jszip@3.10.1";

// ==================== UTILITY FUNCTIONS ====================
const safeNumber = z.union([
  z.number(),
  z.string().transform((val, ctx) => {
    if (val === '' || val === null || val === undefined) {
      return 0;
    }
    const parsed = Number(val);
    if (isNaN(parsed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Expected number, received NaN: ${val}`,
      });
      return z.NEVER;
    }
    return parsed;
  })
]);

// ==================== SCHEMAS ====================
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

/* -------------------- CORS & Utils -------------------- */
const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000", "http://localhost:5173", "http://localhost:8080",
  "https://a4ai.in", "https://www.a4ai.in",
]);

function corsHeadersFor(req: Request) {
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
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

const now = () => performance.now();
const dur = (ms: number) => Math.round(ms);

/* -------------------- Text Utils -------------------- */
function cleanOption(opt: unknown) {
  return String(opt || "").trim().replace(/^[A-D]\s*[\)\.\:\-]\s*/i, "").trim();
}

function looksLikePlaceholderOptions(opts: unknown) {
  if (!Array.isArray(opts) || opts.length < 3) return true;
  const plain = opts.map((o) => cleanOption(String(o)).toLowerCase());
  if (plain.every((t) => t.length <= 2)) return true;
  if (new Set(plain).size < Math.ceil(opts.length / 2)) return true;
  return false;
}

function sanitizeText(s?: string) {
  if (!s) return s;
  return s
    .replace(/[→⟶➝➔⇒⟹]/g, "->").replace(/[←⟵⇐⟸]/g, "<-").replace(/[↔⇄⇆⇌⇋]/g, "<->")
    .replace(/√/g, "sqrt").replace(/[×✕✖]/g, "x").replace(/÷/g, "/").replace(/π/g, "pi")
    .replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/≠/g, "!=").replace(/≈/g, "~")
    .replace(/“|”/g, '"').replace(/‘|'|'/g, "'").replace(/[–—]/g, "-")
    .replace(/\u00A0/g, " ").replace(/\t/g, " ").replace(/[^\S\r\n]+/g, " ").trim();
}

/* -------------------- References Loader -------------------- */
async function loadRefs(refs?: Array<{ name: string; path: string }>) {
  if (!refs?.length) return "";
  const texts: string[] = [];
  for (const r of refs) {
    if (!r.path.match(/\.(txt|csv|md)$/i)) continue;
    const { data, error } = await supabase.storage.from(REFS_BUCKET).download(r.path);
    if (error || !data) continue;
    const t = await data.text();
    texts.push(t.slice(0, 4000));
  }
  return texts.join("\n---\n").slice(0, 12000);
}

/* ==================== BUCKET CREATION ==================== */
function createBuckets(input: z.infer<typeof Input>): any[] {
  if (input.buckets && input.buckets.length > 0) {
    return input.buckets;
  }

  const buckets: any[] = [];
  const defaultCognitive = input.cognitiveLevels.length > 0 ? input.cognitiveLevels[0] : "understand";

  if (input.patternMode === "simple") {
    buckets.push({
      type: "mcq",
      difficulty: input.difficulty.toLowerCase(),
      cognitive: defaultCognitive,
      count: input.qCount,
      marks: input.marksPerQuestion,
      negativeMarking: input.negativeMarking || 0
    });
  } else if (input.patternMode === "blueprint" && input.sections.length > 0) {
    for (const section of input.sections) {
      const typeMap: Record<string, string> = {
        "Multiple Choice": "mcq", 
        "Very Short Answer": "short", 
        "Short Answer": "short", 
        "Long Answer": "long", 
        "Case-based": "case_based"
      };
      buckets.push({
        type: typeMap[section.questionType] || "mcq",
        difficulty: input.difficulty.toLowerCase(),
        cognitive: defaultCognitive,
        count: section.count,
        marks: section.marksPerQuestion,
        negativeMarking: input.negativeMarking || 0
      });
    }
  } else {
    // Fallback: create at least one bucket
    buckets.push({
      type: "mcq",
      difficulty: input.difficulty.toLowerCase(),
      cognitive: defaultCognitive,
      count: input.qCount || 5,
      marks: input.marksPerQuestion || 1,
      negativeMarking: input.negativeMarking || 0
    });
  }

  return buckets;
}

/* ==================== ENHANCED PROMPTS ==================== */
function buildEnhancedPrompt(bucket: any, input: any, refsText: string = "") {
  const lang = input.language;
  const chapters = (input.chapters?.length ? input.chapters : input.topics)?.join(", ") || "relevant topics";
  const refNote = refsText ? `\nReference extracts:\n${refsText.slice(0, 2000)}\n` : "";

  return `
Generate ${bucket.count} ${lang} questions for ${input.board} Class ${input.classNum} ${input.subject}.
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
No extra keys. No commentary.${refNote}
`.trim();
}

/* ==================== LLM LAYER ==================== */
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

function safeParseArray(s: string): GenQuestion[] {
  try {
    const trimmed = s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
    const json = JSON.parse(trimmed);
    if (Array.isArray(json)) return json;
    if (Array.isArray((json as any)?.questions)) return (json as any).questions;
    return [];
  } catch {
    return [];
  }
}

async function callOpenAI(prompt: string, rid: string): Promise<GenQuestion[]> {
  if (!OPENAI_API_KEY) {
    console.log(`rid=${rid} OpenAI API key missing`);
    return [];
  }
  
  const t0 = now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.35,
        messages: [
          { role: "system", content: "Return valid JSON ONLY, no markdown fences." },
          { role: "user", content: prompt },
        ],
        max_tokens: 4000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`rid=${rid} OpenAI API error: ${res.status} ${res.statusText}`);
      return [];
    }

    const j = await res.json().catch(() => ({}));
    const content = j?.choices?.[0]?.message?.content ?? "[]";
    const out = safeParseArray(content);
    console.log(`rid=${rid} openai ms=${dur(now() - t0)} q=${out.length}`);
    return out;
  } catch (e) {
    console.error(`rid=${rid} openai error`, e);
    return [];
  }
}

async function callDeepSeek(prompt: string, rid: string): Promise<GenQuestion[]> {
  if (!DEEPSEEK_API_KEY) {
    console.log(`rid=${rid} DeepSeek API key missing`);
    return [];
  }
  
  const t0 = now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.45,
        messages: [
          { role: "system", content: "Return valid JSON ONLY, no markdown fences." },
          { role: "user", content: prompt },
        ],
        max_tokens: 4000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`rid=${rid} DeepSeek API error: ${res.status} ${res.statusText}`);
      return [];
    }

    const j = await res.json().catch(() => ({}));
    const content = j?.choices?.[0]?.message?.content ?? "[]";
    const out = safeParseArray(content);
    console.log(`rid=${rid} deepseek ms=${dur(now() - t0)} q=${out.length}`);
    return out;
  } catch (e) {
    console.error(`rid=${rid} deepseek error`, e);
    return [];
  }
}

/* ==================== ENHANCED BUCKET GENERATION ==================== */
async function generateWithBuckets(input: z.infer<typeof Input>, rid: string, refsText: string) {
  const buckets = createBuckets(input);
  const allQuestions: GenQuestion[] = [];
  
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

    const keyWords = (input.chapters?.length ? input.chapters : input.topics).join(" ").toLowerCase().split(/\W+/).filter(Boolean);
    const uniq = new Set<string>();
    const scored: { q: GenQuestion; s: number }[] = [];
    
    for (const q of merged) {
      if (!q?.text) continue;
      if (q.marks !== bucket.marks) continue;
      
      // Type matching with flexibility
      const qType = q.type?.toLowerCase();
      const bucketType = bucket.type.toLowerCase();
      if (qType !== bucketType) {
        // Allow some type flexibility for similar question types
        const typeMap: Record<string, string[]> = {
          'mcq': ['mcq', 'multiple choice'],
          'short': ['short', 'very short answer', 'vsa'],
          'long': ['long', 'long answer', 'la'],
          'case_based': ['case', 'case-based', 'case_based']
        };
        if (!typeMap[bucketType]?.includes(qType)) continue;
      }
      
      if (q.difficulty !== bucket.difficulty) continue;
      if (q.type === "MCQ" && looksLikePlaceholderOptions(q.options)) continue;

      const key = q.text.toLowerCase().replace(/\s+/g, " ").slice(0, 200);
      if (uniq.has(key)) continue;
      uniq.add(key);

      let score = 0;
      if (q.text.length > 20) score++;
      if (keyWords.some((k) => key.includes(k))) score++;
      if (q.type === "MCQ" && Array.isArray(q.options) && q.options.length >= 4 && q.answer) score++;
      if (q.solution && q.solution.length > 10) score++;
      if (q.cognitive === bucket.cognitive) score += 2;

      scored.push({ q, s: score });
    }
    
    scored.sort((a, b) => b.s - a.s);
    const bestQuestions = scored.slice(0, bucket.count).map(x => x.q);
    console.log(`rid=${rid} Bucket ${bucket.type} filtered to ${bestQuestions.length} questions`);
    allQuestions.push(...bestQuestions);
  }
  
  // Group by sections
  const sections: Record<string, GenQuestion[]> = {};
  let currentSection = 'A';
  
  for (const bucket of buckets) {
    const bucketQuestions = allQuestions.filter(q => 
      q.marks === bucket.marks && 
      q.difficulty === bucket.difficulty
    ).slice(0, bucket.count);
    
    if (bucketQuestions.length > 0) {
      sections[currentSection] = bucketQuestions;
      currentSection = String.fromCharCode(currentSection.charCodeAt(0) + 1);
    }
  }
  
  console.log(`rid=${rid} Created ${Object.keys(sections).length} sections with ${allQuestions.length} total questions`);
  return sections;
}

/* ==================== PDF RENDERER ==================== */
async function renderPdf(i: z.infer<typeof Input>, sections: Record<string, GenQuestion[]>) {
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
  const newPage = () => {
    page = pdf.addPage([595.28, 841.89]);
    drawFrame();
    y = height - 60;
  };

  let y = height - 60;
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
  write(i.institute || "a4ai — Test Paper", 16, true);
  write(i.examTitle || `${i.subject} • Class ${i.classNum} • ${i.board}`, 12);
  const maxMarks = i.computedTotalMarks || Object.values(sections).flat().reduce((s, q) => s + (Number(q.marks) || 0), 0).toString();
  write(`Time: ${i.timeLimit ? `${i.timeLimit} minutes` : 'As per exam'} • Max Marks: ${maxMarks}`, 11);
  if (i.teacherName || i.examDate) write(`Teacher: ${i.teacherName || "-"} | Date: ${i.examDate || "-"}`, 10);
  write("", 10); // Empty line

  // Instructions
  if (i.notes) {
    write("General Instructions:", 12, true);
    i.notes.split(/\n+/).filter(Boolean).slice(0, 12).forEach((ln, idx) => write(`(${idx + 1}) ${ln}`, 10));
    write("", 10); // Empty line
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
        q.options.slice(0, 4).forEach((opt, j) => write(`   ${abc[j]}. ${cleanOption(opt)}`, 10));
      }
      write("", 10); // Space between questions
    });
    y -= 6;
  }

  // Answer Key
  if (i.includeAnswerKey) {
    write("", 10); // Empty line
    write("Answer Key:", 12, true);
    for (const sid of order) {
      const list = sections[sid] || [];
      list.forEach((q, idx) => write(`Section ${sid}, Q${idx + 1}: ${q.answer || "-"}`, 10));
    }
  }

  return await pdf.save();
}

/* ==================== CSV & DOCX EXPORTS ==================== */
function buildFlatRows(sections: Record<string, GenQuestion[]>) {
  const rows: Array<{
    section: string; index: number; marks: number; type: string; difficulty: string; cognitive?: string;
    text: string; optionA?: string; optionB?: string; optionC?: string; optionD?: string; answer?: string;
  }> = [];

  const order = Object.keys(sections).sort();
  for (const sid of order) {
    const list = sections[sid] || [];
    list.forEach((q, idx) => {
      const opts = (q.options || []).slice(0, 4).map((o) => cleanOption(o));
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
}

function createCsv(sections: Record<string, GenQuestion[]>) {
  const rows = buildFlatRows(sections);
  const header = ["Section", "Index", "Marks", "Type", "Difficulty", "Cognitive", "Text", "OptionA", "OptionB", "OptionC", "OptionD", "Answer"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const vals = [
      r.section, String(r.index), String(r.marks), r.type, r.difficulty, r.cognitive || "",
      r.text.replace(/"/g, '""'), (r.optionA || "").replace(/"/g, '""'), (r.optionB || "").replace(/"/g, '""'),
      (r.optionC || "").replace(/"/g, '""'), (r.optionD || "").replace(/"/g, '""'), (r.answer || "").replace(/"/g, '""'),
    ];
    lines.push(vals.map((v) => `"${v}"`).join(","));
  }
  return new TextEncoder().encode(lines.join("\n"));
}

async function createDocx(i: z.infer<typeof Input>, sections: Record<string, GenQuestion[]>) {
  const zip = new JSZip();

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  // _rels/.rels
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="R1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  // word/_rels/document.xml.rels (empty ok)
  zip.folder("word")?.folder("_rels")?.file(
    "document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
  );

  // Build simple paragraphs
  const para = (text: string, bold = false) =>
    `<w:p><w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t>${text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</w:t></w:r></w:p>`;

  const order = Object.keys(sections).sort();
  const parts: string[] = [];

  parts.push(para(sanitizeText(i.institute || "a4ai — Test Paper"), true));
  parts.push(para(sanitizeText(i.examTitle || `${i.subject} • Class ${i.classNum} • ${i.board}`)));
  const maxMarks =
    i.computedTotalMarks ||
    String(
      Object.values(sections)
        .flat()
        .reduce((s, q) => s + (Number(q.marks) || 0), 0)
    );
  parts.push(para(`Time: ${i.timeLimit ? `${i.timeLimit} minutes` : 'As per exam'} • Max Marks: ${maxMarks}`));
  if (i.teacherName || i.examDate) parts.push(para(`Teacher: ${i.teacherName || "-"} | Date: ${i.examDate || "-"}`));
  parts.push(para("")); // Empty line

  if (i.notes) {
    parts.push(para("General Instructions:", true));
    i.notes
      .split(/\n+/)
      .filter(Boolean)
      .slice(0, 12)
      .forEach((ln, idx) => parts.push(para(`(${idx + 1}) ${sanitizeText(ln)}`)));
    parts.push(para("")); // Empty line
  }

  for (const sid of order) {
    parts.push(para(`SECTION – ${sid}`, true));
    const list = sections[sid] || [];
    list.forEach((q, idx) => {
      parts.push(para(`${idx + 1}. (${q.marks}) ${sanitizeText(q.text)}`));
      if (q.type === "MCQ" && q.options?.length) {
        const abc = ["A", "B", "C", "D"];
        q.options.slice(0, 4).forEach((opt, j) => parts.push(para(`   ${abc[j]}. ${sanitizeText(cleanOption(opt))}`)));
      }
      parts.push(para("")); // Space between questions
    });
  }

  if (i.includeAnswerKey) {
    parts.push(para("")); // Empty line
    parts.push(para("Answer Key:", true));
    for (const sid of order) {
      const list = sections[sid] || [];
      list.forEach((q, idx) => parts.push(para(`Section ${sid}, Q${idx + 1}: ${sanitizeText(q.answer || "-")}`)));
    }
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">
  <w:body>
    ${parts.join("\n")}
    <w:sectPr/>
  </w:body>
</w:document>`;

  zip.folder("word")?.file("document.xml", documentXml);

  const blob = await zip.generateAsync({ type: "uint8array" });
  return blob as Uint8Array;
}

/* ==================== DATA PREPROCESSOR ==================== */
function preprocessData(obj: any, key?: string): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return obj.map(item => preprocessData(item));
    }
    
    const processed: any = {};
    for (const [k, value] of Object.entries(obj)) {
      // Handle empty arrays and objects
      if (Array.isArray(value) && value.length === 0) {
        processed[k] = [];
        continue;
      }
      
      if (value && typeof value === 'object' && Object.keys(value).length === 0) {
        processed[k] = {};
        continue;
      }
      
      processed[k] = preprocessData(value, k);
    }
    return processed;
  }
  
  // Convert empty strings to appropriate defaults
  if (typeof obj === 'string') {
    if (obj === '') {
      // For number-like fields, return 0, otherwise return empty string
      const numberFields = ['qCount', 'marksPerQuestion', 'negativeMarking', 'ncertWeight', 'classNum', 'timeLimit', 'count'];
      if (key && numberFields.some(field => key.includes(field))) {
        return 0;
      }
      return '';
    }
    
    // Try to parse numeric strings for known number fields
    const numericValue = Number(obj);
    if (!isNaN(numericValue) && obj.trim() !== '') {
      return numericValue;
    }
  }
  
  return obj;
}

/* ======================================================================
   MAIN HANDLER
====================================================================== */
Deno.serve(async (req) => {
  const CORS = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/functions\/v[0-9]+/, "").replace(/^\/generate-test/, "").replace(/\/+$/, "") || "/";

  if (path === "/health") {
    return json(
      {
        ok: true,
        keys: {
          openai: !!OPENAI_API_KEY,
          deepseek: !!DEEPSEEK_API_KEY,
          supabaseUrl: !!SUPABASE_URL,
          serviceRole: !!SUPABASE_SERVICE_ROLE_KEY,
        },
        models: { openai: "gpt-4o-mini", deepseek: "deepseek-chat" },
      },
      200,
      CORS,
    );
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

    // Pre-process data to handle type inconsistencies
    const processedData = preprocessData(data);
    console.log(`rid=${rid} Processed data keys:`, Object.keys(processedData));

    // Validate input with enhanced error reporting
    let input;
    try {
      input = Input.parse(processedData);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        console.error(`rid=${rid} Zod validation errors:`, JSON.stringify(validationError.errors, null, 2));
        console.error(`rid=${rid} Input data that failed:`, JSON.stringify(processedData, null, 2));
        
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

    // Load references (optional)
    const refsText = await loadRefs(input.ref_files);
    const refsShort = refsText ? refsText.slice(0, 1200) : "";

    console.log(`rid=${rid} Starting generation with ${input.buckets?.length || 0} buckets`);

    // Generate questions using enhanced bucket mode
    let sectionsOut: Record<string, GenQuestion[]> = {};
    
    if (input.buckets && input.buckets.length > 0) {
      sectionsOut = await generateWithBuckets(input, rid, refsShort);
    } else {
      // Create default buckets if none provided
      const defaultBuckets = createBuckets(input);
      if (defaultBuckets.length > 0) {
        sectionsOut = await generateWithBuckets({ ...input, buckets: defaultBuckets }, rid, refsShort);
      }
    }
    
    const totalQuestions = Object.values(sectionsOut).flat().length;

    if (totalQuestions === 0) {
      console.error(`rid=${rid} No questions generated`);
      if (input.requestId) {
        await supabase
          .from("paper_requests")
          .update({
            status: "failed",
            meta: { error: "no questions generated", rid },
          })
          .eq("id", input.requestId);
      }
      return json({ error: "No questions could be generated. Please try again with different parameters.", rid }, 500, CORS);
    }

    console.log(`rid=${rid} Generated ${totalQuestions} questions across ${Object.keys(sectionsOut).length} sections`);

    // Render outputs: PDF, DOCX, CSV
    const pdfBytes = await renderPdf(input, sectionsOut);
    const docxBytes = await createDocx(input, sectionsOut);
    const csvBytes = createCsv(sectionsOut);

    // Upload to storage
    const base = `${input.userId}/${input.requestId ?? crypto.randomUUID()}`;
    const pdfPath = `${base}/paper.pdf`;
    const docxPath = `${base}/paper.docx`;
    const csvPath = `${base}/paper.csv`;

    const [upPdf, upDocx, upCsv] = await Promise.all([
      supabase.storage.from(TESTS_BUCKET).upload(pdfPath, pdfBytes, {
        upsert: true,
        contentType: "application/pdf",
      }),
      supabase.storage.from(TESTS_BUCKET).upload(docxPath, docxBytes, {
        upsert: true,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      supabase.storage.from(TESTS_BUCKET).upload(csvPath, csvBytes, {
        upsert: true,
        contentType: "text/csv",
      })
    ]);

    if (upPdf.error) throw upPdf.error;
    if (upDocx.error) throw upDocx.error;
    if (upCsv.error) throw upCsv.error;

    const pdfUrl = IS_PUBLIC_BUCKET
      ? supabase.storage.from(TESTS_BUCKET).getPublicUrl(pdfPath).data.publicUrl
      : (await supabase.storage.from(TESTS_BUCKET).createSignedUrl(pdfPath, 60 * 60 * 24 * 7)).data?.signedUrl;

    const docxUrl = IS_PUBLIC_BUCKET
      ? supabase.storage.from(TESTS_BUCKET).getPublicUrl(docxPath).data.publicUrl
      : (await supabase.storage.from(TESTS_BUCKET).createSignedUrl(docxPath, 60 * 60 * 24 * 7)).data?.signedUrl;

    const csvUrl = IS_PUBLIC_BUCKET
      ? supabase.storage.from(TESTS_BUCKET).getPublicUrl(csvPath).data.publicUrl
      : (await supabase.storage.from(TESTS_BUCKET).createSignedUrl(csvPath, 60 * 60 * 24 * 7)).data?.signedUrl;

    // Update audit record
    if (input.requestId) {
      await supabase
        .from("paper_requests")
        .update({
          status: "success",
          paper_url: pdfUrl,
          answer_key_url: null,
          ref_files: input.ref_files,
          meta: { 
            rid, 
            total_questions: totalQuestions, 
            mode: "enhanced_bucket", 
            pdfPath, 
            docxPath, 
            csvPath,
            cognitiveLevels: input.cognitiveLevels,
            ncertWeight: input.ncertWeight,
            sections: Object.keys(sectionsOut)
          },
        })
        .eq("id", input.requestId);
    }

    console.log(`rid=${rid} Successfully completed generation`);

    return json(
      {
        ok: true,
        rid,
        storagePath: { pdfPath, docxPath, csvPath },
        pdfUrl,
        docxUrl,
        csvUrl,
        meta: { 
          mode: "enhanced_bucket", 
          totalQuestions,
          cognitiveLevels: input.cognitiveLevels,
          ncertWeight: input.ncertWeight,
          sections: Object.keys(sectionsOut)
        },
      },
      200,
      CORS,
    );
  } catch (e: any) {
    const msg = e?.message || String(e);
    const errRid = crypto.randomUUID();
    console.error(`rid=${errRid} generate-test fatal:`, msg);
    
    // Update request status if it exists
    try {
      const rawBody = await req.text();
      const data = JSON.parse(rawBody);
      const processedData = preprocessData(data);
      
      if (processedData.requestId) {
        await supabase
          .from("paper_requests")
          .update({
            status: "failed",
            meta: { error: msg, rid: errRid },
          })
          .eq("id", processedData.requestId);
      }
    } catch (parseError) {
      console.error(`rid=${errRid} Failed to parse input for error reporting:`, parseError);
    }
    
    return json({ error: "Internal server error", rid: errRid }, 500, CORS);
  }
});