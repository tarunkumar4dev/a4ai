/// <reference lib="deno.unstable" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { z } from "https://esm.sh/zod@3.23.8";
import JSZip from "https://esm.sh/jszip@3.10.1";

/* -------------------- Env -------------------- */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";
// Optional perf toggle: set FAST_MODE=true to skip DeepSeek
const FAST_MODE = Deno.env.get("FAST_MODE") === "true";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}
if (!OPENAI_API_KEY && !DEEPSEEK_API_KEY) {
  console.warn("WARNING: Both OPENAI_API_KEY and DEEPSEEK_API_KEY are missing. Generation may fail.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// buckets
const TESTS_BUCKET = "tests"; // Public bucket
const IS_PUBLIC_BUCKET = true;
const REFS_BUCKET = Deno.env.get("REFS_BUCKET") || "papers";

/* -------------------- CORS & utils -------------------- */
const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "https://a4ai.in",
  "https://www.a4ai.in",
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
    headers: {
      "Content-Type": "application/json",
      ...extra,
    },
  });
}
const now = () => performance.now();
const dur = (ms: number) => Math.round(ms);

/* -------------------- Shared text utils -------------------- */
function cleanOption(opt: unknown) {
  return String(opt || "")
    .trim()
    .replace(/^[A-D]\s*[\)\.\:\-]\s*/i, "")
    .trim();
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
    // --- arrows to ASCII so pdf-lib WinAnsi can render ---
    .replace(/[→⟶➝➔⇒⟹]/g, "->")
    .replace(/[←⟵⇐⟸]/g, "<-")
    .replace(/[↔⇄⇆⇌⇋]/g, "<->")
    // --- existing symbols cleanup ---
    .replace(/√/g, "sqrt")
    .replace(/[×✕✖]/g, "x")
    .replace(/÷/g, "/")
    .replace(/π/g, "pi")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/≠/g, "!=")
    .replace(/≈/g, "~")
    .replace(/“|”/g, '"')
    .replace(/‘|’/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/\t/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();
}

/* ======================================================================
   INPUT SCHEMA (BACK-COMPAT + NEW SECTIONED MODE)
====================================================================== */

// Old sections (blueprint)
const SectionLegacy = z.object({
  title: z.string(),
  questionType: z.enum(["Multiple Choice", "Very Short Answer", "Short Answer", "Long Answer", "Case-based"]),
  count: z.number().int().min(1),
  marksPerQuestion: z.number().min(0),
});

const MatrixRow = z.object({
  questionType: z.enum(["Multiple Choice", "Very Short Answer", "Short Answer", "Long Answer", "Case-based"]),
  marksPerQuestion: z.number().min(0),
  count: z.number().int().min(0),
});

// NEW section spec (from sectionsJSON UI)
const SectionNew = z.object({
  id: z.string(),
  marksPerQuestion: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  count: z.number().int().min(1).max(100),
  difficultyMix: z
    .object({
      easy: z.number().min(0),
      medium: z.number().min(0),
      hard: z.number().min(0),
    })
    .default({ easy: 40, medium: 40, hard: 20 }),
});

const Input = z
  .object({
    // optional request row id
    requestId: z.string().uuid().optional(),
    userId: z.string().uuid(),

    // basics
    board: z.enum(["CBSE", "ICSE", "State"]).default("CBSE"),
    classNum: z.number().int().min(1).max(12).default(10),
    subject: z.string().min(2),
    topics: z.array(z.string()).default([]),
    subtopics: z.array(z.string()).default([]),

    // legacy mode controls
    questionType: z.enum(["Multiple Choice", "Short Answer", "Long Answer", "Mixed"]).default("Multiple Choice"),
    mode: z.enum(["single", "mix"]).default("single"),
    difficulty: z.enum(["Easy", "Medium", "Hard"]).default("Easy"),
    mix: z
      .object({ easy: z.number().min(0).max(100), medium: z.number().min(0).max(100), hard: z.number().min(0).max(100) })
      .default({ easy: 50, medium: 30, hard: 20 }),

    // legacy patterns
    patternMode: z.enum(["simple", "blueprint", "matrix"]).default("simple"),
    qCount: z.number().int().min(1).default(5),
    marksPerQuestion: z.number().min(0).default(1),
    sections: z.array(SectionLegacy).default([]),
    markingMatrix: z.array(MatrixRow).default([]),

    // presentation
    language: z.enum(["English", "Hindi"]).default("English"),
    solutionStyle: z.enum(["Steps", "Concise"]).default("Steps"),
    includeAnswerKey: z.boolean().default(true),
    negativeMarking: z.number().default(0),
    shuffleQuestions: z.boolean().default(true),
    shuffleOptions: z.boolean().default(true),
    notes: z.string().max(2000).optional(),
    outputFormat: z.enum(["PDF", "DOCX", "CSV", "JSON"]).default("PDF"),
    watermark: z.boolean().default(false),
    watermarkText: z.string().optional(),
    useLogo: z.boolean().default(true),

    // NEW from UI for sectioned mode
    sectionsJSON: z.string().optional(), // JSON.stringify of SectionNew[]
    computedTotalMarks: z.string().optional(),

    // storage refs
    ref_files: z.array(z.object({ name: z.string(), path: z.string().min(1) })).default([]),

    // header meta (optional)
    institute: z.string().optional(),
    teacherName: z.string().optional(),
    examTitle: z.string().optional(),
    examDate: z.string().optional(),
  })
  .refine((d) => (d.mode === "mix" ? d.mix.easy + d.mix.medium + d.mix.hard === 100 : true), {
    path: ["mix"],
    message: "Mix must sum to 100%",
  });

/* -------------------- References loader (txt/csv/md) -------------------- */
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

/* ======================================================================
   LLM LAYER (returns GenQuestion[])
====================================================================== */
type GenQuestion = {
  type: string;
  difficulty: "easy" | "medium" | "hard";
  marks: 1 | 2 | 3 | 4 | number;
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
  if (!OPENAI_API_KEY) return [];
  const t0 = now();
  try {
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
      }),
      signal: AbortSignal.timeout(25_000),
    });
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
  if (!DEEPSEEK_API_KEY) return [];
  const t0 = now();
  try {
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
      }),
      signal: AbortSignal.timeout(25_000),
    });
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

/* -------------------- Prompts -------------------- */
// NEW: multi-question batch prompt (replaces old single-question prompt)
function buildMultiQuestionPrompt(
  i: z.infer<typeof Input>,
  sec: z.infer<typeof SectionNew>,
  diffs: ("easy" | "medium" | "hard")[],
  refsChunk = ""
) {
  const lang = i.language === "Hindi" ? "Hindi" : "English";
  const chapters = (i.topics?.length ? i.topics : i.subtopics)?.join(", ") || "relevant NCERT concepts";
  const typeHint =
    sec.marksPerQuestion === 1 ? "MCQ or VSA" : sec.marksPerQuestion === 2 ? "VSA or SA" : sec.marksPerQuestion === 3 ? "SA" : "LA";

  const counts = diffs.reduce((m, d) => ((m[d] = (m[d] || 0) + 1), m), {} as Record<string, number>);
  const refNote = refsChunk ? `\nReference extracts (if relevant, align concepts):\n${refsChunk}\n` : "";

  return `
Generate EXACTLY ${diffs.length} ${lang} questions for ${i.board} Class ${i.classNum} ${i.subject}.
Marks: ${sec.marksPerQuestion}. Prefer types: ${typeHint}. Topics: ${chapters}.
Difficulty distribution in this batch:
${Object.entries(counts)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}
Be exam-ready, concise, NCERT-aligned. Avoid repeats and ambiguity.

Return a JSON array of length ${diffs.length} with objects:
[
 { "type": "MCQ|VSA|SA|LA|CASE|ASSERTION",
   "difficulty": "easy|medium|hard",
   "marks": ${sec.marksPerQuestion},
   "text": "question text in ${lang}",
   "options": ["A","B","C","D"],
   "answer": "final answer or option key",
   "solution": "stepwise solution (optional)"
 }
]
No extra keys. No commentary.${refNote}
`.trim();
}

/* -------------------- Ranking / merging -------------------- */
function scoreAndFilter(i: z.infer<typeof Input>, sec: z.infer<typeof SectionNew>, arr: GenQuestion[]) {
  const keyWords = (i.topics.length ? i.topics : i.subtopics).join(" ").toLowerCase().split(/\W+/).filter(Boolean);

  const uniq = new Set<string>();
  const out: { q: GenQuestion; s: number }[] = [];

  for (const q of arr) {
    if (!q?.text) continue;
    if (q.marks !== sec.marksPerQuestion) continue;
    if (q.type === "MCQ" && looksLikePlaceholderOptions(q.options)) continue;

    const key = q.text.toLowerCase().replace(/\s+/g, " ").slice(0, 200);
    if (uniq.has(key)) continue;
    uniq.add(key);

    let s = 0;
    if (q.text.length > 20) s++;
    if (keyWords.some((k) => key.includes(k))) s++;
    if (q.type === "MCQ" && Array.isArray(q.options) && q.options.length >= 4 && q.answer) s++;
    if (q.solution && q.solution.length > 10) s++;

    out.push({ q, s });
  }
  out.sort((a, b) => b.s - a.s);
  return out.map((x) => x.q);
}

/* ======================================================================
   SECTION ORCHESTRATOR (NEW MODE)
====================================================================== */
function splitDifficultyTargets(count: number, mix: { easy: number; medium: number; hard: number }) {
  const total = Math.max(1, mix.easy + mix.medium + mix.hard);
  const e = Math.round((mix.easy / total) * count);
  const m = Math.round((mix.medium / total) * count);
  let h = count - e - m;
  if (h < 0) h = 0;
  return { easy: e, medium: m, hard: h };
}

function pickBatch(want: { easy: number; medium: number; hard: number }, got: GenQuestion[], take: number) {
  const c = { easy: 0, medium: 0, hard: 0 } as Record<"easy" | "medium" | "hard", number>;
  for (const q of got) c[q.difficulty]++;
  const need = {
    easy: Math.max(0, want.easy - c.easy),
    medium: Math.max(0, want.medium - c.medium),
    hard: Math.max(0, want.hard - c.hard),
  } as Record<"easy" | "medium" | "hard", number>;

  const arr: ("easy" | "medium" | "hard")[] = [];
  while (arr.length < take) {
    const pool: ("easy" | "medium" | "hard")[] = [];
    if (need.easy) pool.push("easy");
    if (need.medium) pool.push("medium");
    if (need.hard) pool.push("hard");
    const pick = pool.length
      ? pool[Math.floor(Math.random() * pool.length)]
      : (["easy", "medium", "hard"] as const)[Math.floor(Math.random() * 3)];
    arr.push(pick);
    need[pick] = Math.max(0, need[pick] - 1);
  }
  return arr;
}

async function genSection(i: z.infer<typeof Input>, sec: z.infer<typeof SectionNew>, rid: string, refsShort: string) {
  const out: GenQuestion[] = [];
  const targets = splitDifficultyTargets(sec.count, sec.difficultyMix);
  const batchSize = 6; // safe for tokens

  while (out.length < sec.count) {
    const remaining = sec.count - out.length;
    const take = Math.min(batchSize, remaining);
    const wants = pickBatch(targets, out, take);

    // Single prompt per provider for the whole batch
    const prompt = buildMultiQuestionPrompt(i, sec, wants, refsShort);

    const [a, b] = await Promise.all([callOpenAI(prompt, rid), FAST_MODE ? Promise.resolve([]) : callDeepSeek(prompt, rid)]);

    // Merge + score
    const merged = scoreAndFilter(i, sec, [...a, ...b]).slice(0, take);

    // de-dup into out
    const existingKeys = new Set(out.map((q) => q.text.toLowerCase().replace(/\s+/g, " ").slice(0, 200)));
    for (const q of merged) {
      const key = q.text.toLowerCase().replace(/\s+/g, " ").slice(0, 200);
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        out.push(q as GenQuestion);
        if (out.length >= sec.count) break;
      }
    }
  }
  return out;
}

/* ======================================================================
   PDF (Sections A–D + instructions + header)
====================================================================== */
async function renderPdf(i: z.infer<typeof Input>, sections: Record<string, GenQuestion[]>) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);

  // frame
  const drawFrame = () =>
    page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderWidth: 1, borderColor: rgb(0.82, 0.82, 0.82) });
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
      x: marginX,
      y,
      size,
      font: useBold ? bold : font,
      color: rgb(0, 0, 0),
    });
    y -= lineH + (size >= 13 ? 2 : 0);
  };

  // header
  write(i.institute || "a4ai — Test Paper", 16, true);
  write(i.examTitle || `${i.subject} • Class ${i.classNum} • ${i.board}`, 12);
  const maxMarks =
    i.computedTotalMarks ||
    Object.values(sections)
      .flat()
      .reduce((s, q) => s + (Number(q.marks) || 0), 0)
      .toString();
  write(`Time: ${i.language} • Max Marks: ${maxMarks}`, 11);
  if (i.teacherName || i.examDate) write(`Teacher: ${i.teacherName || "-"} | Date: ${i.examDate || "-"}`, 10);

  // instructions
  if (i.notes) {
    write("General Instructions:", 12, true);
    i.notes
      .split(/\n+/)
      .filter(Boolean)
      .slice(0, 12)
      .forEach((ln, idx) => write(`(${idx + 1}) ${ln}`, 10));
  }

  // sections
  const order = Object.keys(sections).sort(); // A,B,C,D...
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
    });
    y -= 6;
  }

  // Answer Key
  if (i.includeAnswerKey) {
    write("Answer Key:", 12, true);
    for (const sid of order) {
      const list = sections[sid] || [];
      list.forEach((q, idx) => write(`Section ${sid}, Q${idx + 1}: ${q.answer || "-"}`, 10));
    }
  }

  return await pdf.save();
}

/* ======================================================================
   CSV & DOCX EXPORTS
====================================================================== */
function buildFlatRows(sections: Record<string, GenQuestion[]>) {
  const rows: Array<{
    section: string;
    index: number;
    marks: number;
    type: string;
    difficulty: string;
    text: string;
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    answer?: string;
  }> = [];

  const order = Object.keys(sections).sort();
  for (const sid of order) {
    const list = sections[sid] || [];
    list.forEach((q, idx) => {
      const opts = (q.options || []).slice(0, 4).map((o) => cleanOption(o));
      rows.push({
        section: sid,
        index: idx + 1,
        marks: Number(q.marks) || 0,
        type: q.type || "",
        difficulty: q.difficulty || "",
        text: sanitizeText(q.text || ""),
        optionA: opts[0],
        optionB: opts[1],
        optionC: opts[2],
        optionD: opts[3],
        answer: q.answer || "",
      });
    });
  }
  return rows;
}

function createCsv(sections: Record<string, GenQuestion[]>) {
  const rows = buildFlatRows(sections);
  const header = ["Section", "Index", "Marks", "Type", "Difficulty", "Text", "OptionA", "OptionB", "OptionC", "OptionD", "Answer"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const vals = [
      r.section,
      String(r.index),
      String(r.marks),
      r.type,
      r.difficulty,
      r.text.replace(/"/g, '""'),
      (r.optionA || "").replace(/"/g, '""'),
      (r.optionB || "").replace(/"/g, '""'),
      (r.optionC || "").replace(/"/g, '""'),
      (r.optionD || "").replace(/"/g, '""'),
      (r.answer || "").replace(/"/g, '""'),
    ];
    lines.push(vals.map((v) => `"${v}"`).join(","));
  }
  return new TextEncoder().encode(lines.join("\n"));
}

async function createDocx(i: z.infer<typeof Input>, sections: Record<string, GenQuestion[]>) {
  // Minimal WordprocessingML using JSZip
  const zip = new JSZip();

  // [Content_Types].xml
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );

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
  parts.push(para(`Time: ${i.language} • Max Marks: ${maxMarks}`));
  if (i.teacherName || i.examDate) parts.push(para(`Teacher: ${i.teacherName || "-"} | Date: ${i.examDate || "-"}`));
  if (i.notes) {
    parts.push(para("General Instructions:", true));
    i.notes
      .split(/\n+/)
      .filter(Boolean)
      .slice(0, 12)
      .forEach((ln, idx) => parts.push(para(`(${idx + 1}) ${sanitizeText(ln)}`)));
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
    });
  }

  if (i.includeAnswerKey) {
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

/* ======================================================================
   LEGACY (fallback)
====================================================================== */

// legacy system prompt (unchanged) for batch generation
function buildLegacyPrompt(i: z.infer<typeof Input>) {
  const topics = i.topics.length ? i.topics.join(", ") : "teacher-specified topics";
  const subs = i.subtopics.length ? i.subtopics.join(", ") : "relevant subtopics";
  const diff = i.mode === "single" ? `Overall difficulty: ${i.difficulty}.` : `Distribute difficulty approximately: ${i.mix.easy}% Easy, ${i.mix.medium}% Medium, ${i.mix.hard}% Hard.`;
  const pattern =
    i.patternMode === "simple"
      ? `Create exactly ${i.qCount} questions.\nEach question carries ${i.marksPerQuestion} marks.`
      : i.patternMode === "blueprint"
      ? `Follow this section blueprint strictly:\n${i.sections.map((s) => `- ${s.title}: ${s.questionType} × ${s.count} (${s.marksPerQuestion} marks each)`).join("\n")}`
      : `Follow this type-wise marking matrix strictly:\n${i.markingMatrix.map((r) => `- ${r.questionType}: ${r.count} questions, ${r.marksPerQuestion} marks each`).join("\n")}`;

  return `
You are an experienced ${i.board} Class ${i.classNum} ${i.subject} paper setter.
Language: ${i.language}. Style: ${i.solutionStyle}. Shuffle options: ${i.shuffleOptions}.
Topics: ${topics}. Subtopics: ${subs}.
${pattern}
${diff}
${i.notes ? `Teacher notes: ${i.notes}` : ""}

Return STRICT JSON ONLY (no markdown) with:
{
  "questions": [
    { "text": "string", "type": "MCQ|VSA|SA|LA|CASE", "marks": number,
      "options": ["...", "...", "...", "..."]?,  // only for MCQ
      "answer": "string"
    }
  ]
}
Ensure the counts and marks exactly match the pattern. No commentary.
`.trim();
}

function normalizeLegacy(i: z.infer<typeof Input>, draft: any) {
  const wantsMCQ = i.questionType === "Multiple Choice" || i.questionType === "Mixed";
  return (draft.questions || []).map((q: any, idx: number) => ({
    idx: idx + 1,
    text: String(q.text ?? "").trim(),
    type: String(q.type ?? ""),
    marks: typeof q.marks === "number" ? q.marks : i.marksPerQuestion,
    options: wantsMCQ ? (Array.isArray(q.options) ? q.options.slice(0, 4).map((o) => cleanOption(String(o))) : undefined) : undefined,
    answer: String(q.answer ?? "").trim(),
  }));
}
function scoreLegacy(i: z.infer<typeof Input>, qs: any[]) {
  const kw = [i.subject, ...i.topics, ...i.subtopics].join(" ").toLowerCase().split(/\W+/).filter(Boolean);
  const uniq = new Set<string>();
  const dedup: any[] = [];
  for (const q of qs) {
    if ((i.questionType === "Multiple Choice" || i.questionType === "Mixed") && looksLikePlaceholderOptions(q.options)) {
      continue;
    }
    const key = q.text.toLowerCase().replace(/\s+/g, " ").slice(0, 200);
    if (uniq.has(key)) continue;
    uniq.add(key);
    dedup.push(q);
  }
  const scored = dedup.map((q) => {
    let s = 0;
    if (q.text.length > 20) s++;
    if (kw.some((k) => q.text.toLowerCase().includes(k))) s++;
    if (i.questionType !== "Multiple Choice") s++;
    else if (q.options && q.options.length >= 3) s++;
    if (q.answer) s++;
    return { ...q, _score: s };
  });
  scored.sort((a, b) => b._score - a._score);
  return scored;
}

/* ======================================================================
   HANDLER
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
    const data = await req.json();
    const input = Input.parse(data);

    // mark generating
    if (input.requestId) {
      await supabase.from("paper_requests").update({ status: "generating" }).eq("id", input.requestId);
    }

    // refs load (optional)
    const refsText = await loadRefs(input.ref_files);
    const refsShort = refsText ? refsText.slice(0, 1200) : "";

    // ---------- NEW SECTIONED MODE ----------
    let sectionsOut: Record<string, GenQuestion[]> | null = null;
    let totalQuestions = 0;

    if (input.sectionsJSON) {
      let parsed: unknown = [];
      try {
        parsed = JSON.parse(input.sectionsJSON);
      } catch {
        parsed = [];
      }

      if (Array.isArray(parsed) && parsed.length) {
        sectionsOut = {};
        for (const sec of parsed) {
          const secParsed = SectionNew.parse(sec); // validate each
          const list = await genSection(input, secParsed, rid, refsShort);
          sectionsOut[secParsed.id] = list;
          totalQuestions += list.length;
        }
      }
    }

    // ---------- LEGACY FALLBACK ----------
    let legacyQuestions: any[] | null = null;
    if (!sectionsOut) {
      const prompt = buildLegacyPrompt(input);
      const [aR, bR] = await Promise.allSettled([callOpenAI(prompt, rid), FAST_MODE ? Promise.resolve([]) : callDeepSeek(prompt, rid)]);
      const A = aR.status === "fulfilled" ? aR.value : [];
      const B = bR.status === "fulfilled" ? bR.value : [];

      if (!A.length && !B.length) {
        if (input.requestId) {
          await supabase
            .from("paper_requests")
            .update({
              status: "failed",
              meta: { error: "no provider output" },
            })
            .eq("id", input.requestId);
        }
        return json({ error: "Question generation failed from providers", rid }, 502, CORS);
      }

      // Normalize to legacy shape
      const normalized = scoreLegacy(input, normalizeLegacy(input, { questions: [...A, ...B] }));
      const wantCount =
        input.patternMode === "simple"
          ? input.qCount
          : input.patternMode === "blueprint"
          ? input.sections.reduce((s, x) => s + x.count, 0)
          : input.markingMatrix.reduce((s, x) => s + x.count, 0);

      legacyQuestions = normalized.slice(0, wantCount).map(({ _score, ...rest }) => rest);
      totalQuestions = legacyQuestions.length;

      // convert legacy → section map
      sectionsOut = {
        A: (legacyQuestions || []).map((q: any) => ({
          type: q.type || "MCQ",
          difficulty: "easy",
          marks: q.marks,
          text: q.text,
          options: q.options,
          answer: q.answer,
        })),
      };
    }

    // safety
    if (!sectionsOut) sectionsOut = {};

    // ---------- RENDER: PDF, DOCX, CSV ----------
    const pdfBytes = await renderPdf(input, sectionsOut);
    const docxBytes = await createDocx(input, sectionsOut);
    const csvBytes = createCsv(sectionsOut);

    // ---------- Upload ----------
    const base = `${input.userId}/${input.requestId ?? crypto.randomUUID()}`;
    const pdfPath = `${base}/paper.pdf`;
    const docxPath = `${base}/paper.docx`;
    const csvPath = `${base}/paper.csv`;

    const upPdf = await supabase.storage.from(TESTS_BUCKET).upload(pdfPath, new Blob([pdfBytes], { type: "application/pdf" }), {
      upsert: true,
      contentType: "application/pdf",
    });
    if (upPdf.error) throw upPdf.error;

    const upDocx = await supabase.storage
      .from(TESTS_BUCKET)
      .upload(docxPath, new Blob([docxBytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), {
        upsert: true,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
    if (upDocx.error) throw upDocx.error;

    const upCsv = await supabase.storage.from(TESTS_BUCKET).upload(csvPath, new Blob([csvBytes], { type: "text/csv" }), {
      upsert: true,
      contentType: "text/csv",
    });
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

    // ---------- Audit ----------
    if (input.requestId) {
      await supabase
        .from("paper_requests")
        .update({
          status: "success",
          paper_url: pdfUrl,
          answer_key_url: null,
          ref_files: input.ref_files,
          meta: { rid, total_questions: totalQuestions, mode: "sectioned", pdfPath, docxPath, csvPath },
        })
        .eq("id", input.requestId);
    } else {
      // back-compat: write to test_papers
      await fetch(`${SUPABASE_URL}/rest/v1/test_papers`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          user_id: input.userId,
          subject: input.subject,
          board: input.board,
          grade: String(input.classNum),
          difficulty: input.difficulty,
          question_type: input.questionType,
          q_count: totalQuestions,
          pdf_url: pdfUrl,
          meta: { rid, mode: "sectioned", docxUrl, csvUrl },
        }),
      }).catch((e) => console.error("audit insert failed", e));
    }

    return json(
      {
        ok: true,
        rid,
        storagePath: { pdfPath, docxPath, csvPath },
        pdfUrl,
        docxUrl,
        csvUrl,
        meta: { mode: "sectioned", totalQuestions },
      },
      200,
      CORS,
    );
  } catch (e: any) {
    const msg = e?.message || String(e);
    const errRid = crypto.randomUUID();
    console.error(`rid=${errRid} generate-test fatal:`, msg);
    return json({ error: msg, rid: errRid }, 500, CORS);
  }
});
