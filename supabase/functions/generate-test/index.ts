/// <reference lib="deno.unstable" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { z } from "https://esm.sh/zod@3.23.8";

/* -------------------- Env -------------------- */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}
if (!OPENAI_API_KEY && !DEEPSEEK_API_KEY) {
  console.warn("WARNING: Both OPENAI_API_KEY and DEEPSEEK_API_KEY are missing. Generation may fail.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// buckets
const TESTS_BUCKET = "tests";                   // your tests bucket is Public
const IS_PUBLIC_BUCKET = true;
const REFS_BUCKET = Deno.env.get("REFS_BUCKET") || "papers"; // use a private `references` if you later create it

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
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...extra } });
}
const now = () => performance.now();
const dur = (ms: number) => Math.round(ms);

/* -------------------- Schema (aligned with Step-1) -------------------- */
const Section = z.object({
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

const Input = z.object({
  // optional request row (paper_requests.id). If provided we'll update status/urls.
  requestId: z.string().uuid().optional(),
  userId: z.string().uuid(),

  // basic
  board: z.enum(["CBSE", "ICSE", "State"]).default("CBSE"),
  classNum: z.number().int().min(1).max(12).default(10),
  subject: z.string().min(2),

  topics: z.array(z.string()).default([]),
  subtopics: z.array(z.string()).default([]),

  questionType: z.enum(["Multiple Choice", "Short Answer", "Long Answer", "Mixed"]).default("Multiple Choice"),

  // difficulty
  mode: z.enum(["single", "mix"]).default("single"),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).default("Easy"),
  mix: z.object({ easy: z.number().min(0).max(100), medium: z.number().min(0).max(100), hard: z.number().min(0).max(100) })
      .default({ easy: 50, medium: 30, hard: 20 }),

  // pattern
  patternMode: z.enum(["simple", "blueprint", "matrix"]).default("simple"),
  qCount: z.number().int().min(1).default(5),
  marksPerQuestion: z.number().min(0).default(1),
  sections: z.array(Section).default([]),
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

  // storage paths of uploaded refs (from frontend)
  ref_files: z.array(z.object({ name: z.string(), path: z.string().min(1) })).default([]),
}).refine((d) => (d.mode === "mix" ? d.mix.easy + d.mix.medium + d.mix.hard === 100 : true), {
  path: ["mix"],
  message: "Mix must sum to 100%",
});

/* -------------------- Helpers -------------------- */
// Remove leading A) / B. etc
function cleanOption(opt: string) {
  return String(opt || "").trim().replace(/^[A-D]\s*[\)\.\:\-]\s*/i, "").trim();
}
function looksLikePlaceholderOptions(opts?: string[]) {
  if (!Array.isArray(opts) || opts.length < 3) return true;
  const plain = opts.map((o) => cleanOption(o).toLowerCase());
  if (plain.every((t) => t.length <= 2)) return true;
  if (new Set(plain).size < Math.ceil(opts.length / 2)) return true;
  return false;
}
function sanitizeText(s?: string) {
  if (!s) return s;
  return s
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
    .trim();
}

/* -------------------- Prompt builder -------------------- */
function buildPatternBlock(i: z.infer<typeof Input>) {
  if (i.patternMode === "simple") {
    return `Create exactly ${i.qCount} questions.
Each question carries ${i.marksPerQuestion} marks.`;
  }
  if (i.patternMode === "blueprint") {
    const lines = i.sections.map(
      (s) => `- ${s.title}: ${s.questionType} × ${s.count} (${s.marksPerQuestion} marks each)`
    );
    return `Follow this section blueprint strictly:\n${lines.join("\n")}`;
  }
  // matrix
  const rows = i.markingMatrix.map(
    (r) => `- ${r.questionType}: ${r.count} questions, ${r.marksPerQuestion} marks each`
  );
  return `Follow this type-wise marking matrix strictly:\n${rows.join("\n")}`;
}

function SYS_PROMPT(i: z.infer<typeof Input>) {
  const topics = i.topics.length ? i.topics.join(", ") : "teacher-specified topics";
  const subs = i.subtopics.length ? i.subtopics.join(", ") : "relevant subtopics";
  const diff = i.mode === "single"
    ? `Overall difficulty: ${i.difficulty}.`
    : `Distribute difficulty approximately: ${i.mix.easy}% Easy, ${i.mix.medium}% Medium, ${i.mix.hard}% Hard.`;

  return `
You are an experienced ${i.board} Class ${i.classNum} ${i.subject} paper setter.
Language: ${i.language}. Style: ${i.solutionStyle}. Shuffle options: ${i.shuffleOptions}.
Topics: ${topics}. Subtopics: ${subs}.
${buildPatternBlock(i)}
${diff}
${i.notes ? `Teacher notes: ${i.notes}` : ""}

Return STRICT JSON ONLY (no markdown) with:
{
  "questions": [
    { "text": "string", "type": "MCQ|VSA|SA|LA|CASE", "marks": number,
      "options": ["...", "...", "...", "..."]?,  // only for MCQ
      "answer": "string"                          // if MCQ, it MUST match exactly one option
    }
  ]
}
Ensure the counts and marks exactly match the pattern. No commentary.`;
}

function safeParse(s: string) {
  try {
    const trimmed = s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
    const j = JSON.parse(trimmed);
    if (!Array.isArray(j.questions)) throw new Error("no questions[]");
    return j;
  } catch {
    return { questions: [] };
  }
}

/* -------------------- LLM calls -------------------- */
async function callOpenAI(i: z.infer<typeof Input>, rid: string) {
  if (!OPENAI_API_KEY) return { questions: [] };
  const t0 = now();
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return only valid JSON. Do not add markdown fences." },
          { role: "user", content: SYS_PROMPT(i) },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const j = await res.json().catch(() => ({}));
    const content = j?.choices?.[0]?.message?.content ?? "{}";
    const out = safeParse(content);
    console.log(`rid=${rid} openai ms=${dur(now() - t0)} q=${out.questions.length}`);
    return out;
  } catch (e) {
    console.error(`rid=${rid} openai error`, e);
    return { questions: [] };
  }
}
async function callDeepSeek(i: z.infer<typeof Input>, rid: string) {
  if (!DEEPSEEK_API_KEY) return { questions: [] };
  const t0 = now();
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.45,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return only valid JSON. Do not add markdown fences." },
          { role: "user", content: SYS_PROMPT(i) },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const j = await res.json().catch(() => ({}));
    const content = j?.choices?.[0]?.message?.content ?? "{}";
    const out = safeParse(content);
    console.log(`rid=${rid} deepseek ms=${dur(now() - t0)} q=${out.questions.length}`);
    return out;
  } catch (e) {
    console.error(`rid=${rid} deepseek error`, e);
    return { questions: [] };
  }
}

function normalize(i: z.infer<typeof Input>, draft: any) {
  const wantsMCQ = i.questionType === "Multiple Choice" || i.questionType === "Mixed";
  return (draft.questions || []).map((q: any, idx: number) => ({
    idx: idx + 1,
    text: String(q.text ?? "").trim(),
    type: String(q.type ?? ""),
    marks: typeof q.marks === "number" ? q.marks : i.marksPerQuestion,
    options: wantsMCQ ? (Array.isArray(q.options) ? q.options.slice(0, 4).map((o: string) => cleanOption(String(o))) : undefined) : undefined,
    answer: String(q.answer ?? "").trim(),
  }));
}

function scoreQuestions(i: z.infer<typeof Input>, qs: any[]) {
  const kw = [i.subject, ...i.topics, ...i.subtopics].join(" ").toLowerCase().split(/\W+/).filter(Boolean);
  const uniq = new Set<string>();
  const dedup: any[] = [];
  for (const q of qs) {
    if ((i.questionType === "Multiple Choice" || i.questionType === "Mixed") && looksLikePlaceholderOptions(q.options)) {
      continue;
    }
    const key = q.text.toLowerCase().replace(/\s+/g, " ").slice(0, 160);
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
    if (q.answer) {
      s++;
      if (Array.isArray(q.options)) {
        const ix = q.options.findIndex((o: string) => cleanOption(o).toLowerCase() === String(q.answer || "").toLowerCase());
        if (ix >= 0) s++;
      }
    }
    return { ...q, _score: s };
  });
  scored.sort((a, b) => b._score - a._score);
  return scored;
}

/* -------------------- References loader (txt/csv/md) -------------------- */
async function loadRefs(refs: { path: string }[]) {
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

/* -------------------- PDF builder -------------------- */
async function buildPdf(input: z.infer<typeof Input>, questions: any[], rid: string) {
  const t0 = now();
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // border
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderWidth: 1, borderColor: rgb(0.85, 0.85, 0.85), color: rgb(1, 1, 1) });

  // header
  page.drawText("a4ai — Test Paper", { x: 48, y: height - 60, size: 16, font: bold });
  page.drawText(sanitizeText(`${input.subject} • Class ${input.classNum} • ${input.board}`)!, { x: 48, y: height - 80, size: 10, font });

  // body
  const marginX = 48;
  let cursorY = height - 110;
  const lineH = 14;

  const wrap = (text: string, maxChars = 90) => {
    const words = sanitizeText(text)!.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length > maxChars) {
        lines.push(cur.trim());
        cur = w;
      } else cur += " " + w;
    }
    if (cur.trim()) lines.push(cur.trim());
    return lines;
  };

  let qNo = 1;
  for (const q of questions) {
    if (cursorY < 120) { page = pdf.addPage([595.28, 841.89]); cursorY = 780; }
    page.drawText(`${qNo}. (${q.marks ?? input.marksPerQuestion})`, { x: marginX, y: cursorY, size: 10, font: bold });
    cursorY -= lineH;
    for (const ln of wrap(String(q.text || ""))) {
      if (cursorY < 80) { page = pdf.addPage([595.28, 841.89]); cursorY = 780; }
      page.drawText(sanitizeText(ln)!, { x: marginX + 14, y: cursorY, size: 10, font });
      cursorY -= lineH;
    }
    if (Array.isArray(q.options)) {
      const abc = ["A", "B", "C", "D"];
      for (let i = 0; i < Math.min(4, q.options.length); i++) {
        const txt = cleanOption(String(q.options[i]));
        for (const ln of wrap(`${abc[i]}. ${txt}`, 85)) {
          if (cursorY < 80) { page = pdf.addPage([595.28, 841.89]); cursorY = 780; }
          page.drawText(sanitizeText(ln)!, { x: marginX + 24, y: cursorY, size: 10, font });
          cursorY -= lineH;
        }
      }
    }
    cursorY -= lineH * 0.75;
    qNo++;
  }

  // Answer Key (optional)
  if (input.includeAnswerKey) {
    if (cursorY < 120) { page = pdf.addPage([595.28, 841.89]); cursorY = 780; }
    page.drawText("Answer Key:", { x: marginX, y: cursorY, size: 11, font: bold });
    cursorY -= lineH;
    let idx = 1;
    for (const q of questions) {
      let ans = "-";
      const raw = String(q.answer || "").trim();
      if (Array.isArray(q.options)) {
        const ix = q.options.findIndex((o: string) => cleanOption(o).toLowerCase() === raw.toLowerCase());
        ans = ix >= 0 ? String.fromCharCode(65 + ix) : raw || "-";
      } else ans = raw || "-";
      page.drawText(sanitizeText(`${idx}. ${ans}`)!, { x: marginX + 14, y: cursorY, size: 10, font });
      cursorY -= lineH;
      idx++;
    }
  }

  const out = await pdf.save();
  console.log(`rid=${rid} pdf ms=${dur(now() - t0)} bytes=${out.length}`);
  return out;
}

/* -------------------- Handler -------------------- */
Deno.serve(async (req) => {
  const CORS = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const rawPath = url.pathname;
  const path = rawPath.replace(/^\/functions\/v[0-9]+/, "").replace(/^\/generate-test/, "").replace(/\/+$/, "") || "/";

  if (path === "/health") {
    return json(
      {
        ok: true,
        keys: { openai: !!OPENAI_API_KEY, deepseek: !!DEEPSEEK_API_KEY, supabaseUrl: !!SUPABASE_URL, serviceRole: !!SUPABASE_SERVICE_ROLE_KEY },
        models: { openai: "gpt-4o-mini", deepseek: "deepseek-chat" },
      },
      200,
      CORS
    );
  }
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405, CORS);

  const rid = crypto.randomUUID();

  try {
    const data = await req.json();
    const input = Input.parse(data);

    // If a paper_requests row was created on client, mark generating
    if (input.requestId) {
      await supabase.from("paper_requests").update({ status: "generating" }).eq("id", input.requestId);
    }

    // Optionally load references (text-only to keep fast)
    const refsText = await loadRefs(input.ref_files);
    if (refsText) {
      // Attach a shortened version to notes to bias the model (keeps code changes minimal)
      input.notes = (input.notes || "") + "\n\nRef extracts:\n" + refsText.slice(0, 4000);
    }

    // Parallel providers with 25s each (overall ~45s with upload)
    const [a, b] = await Promise.allSettled([callOpenAI(input, rid), callDeepSeek(input, rid)]);
    const A = a.status === "fulfilled" ? a.value : { questions: [] };
    const B = b.status === "fulfilled" ? b.value : { questions: [] };

    if (!A.questions.length && !B.questions.length) {
      if (input.requestId) await supabase.from("paper_requests").update({ status: "failed", meta: { error: "no provider output" } }).eq("id", input.requestId);
      return json({ error: "Question generation failed from providers", rid }, 502, CORS);
    }

    let scored = [...scoreQuestions(input, normalize(input, A)), ...scoreQuestions(input, normalize(input, B))];

    // Desired total questions based on pattern
    const wantCount =
      input.patternMode === "simple"
        ? input.qCount
        : input.patternMode === "blueprint"
        ? input.sections.reduce((s, x) => s + x.count, 0)
        : input.markingMatrix.reduce((s, x) => s + x.count, 0);

    let merged = scored.slice(0, wantCount).map(({ _score, ...rest }) => rest);

    // Top-up if short (1–2 more calls within time budget)
    let attempts = 0;
    while (merged.length < wantCount && attempts < 2) {
      const remaining = Math.min(8, wantCount - merged.length);
      let topup = await callDeepSeek(input, rid);
      if (!topup.questions.length) topup = await callOpenAI(input, rid);
      if (topup.questions.length) {
        const extra = scoreQuestions(input, normalize(input, topup));
        scored = [...scored, ...extra];
        merged = scored.slice(0, wantCount).map(({ _score, ...rest }) => rest);
      }
      attempts++;
    }
    if (merged.length < wantCount) {
      if (input.requestId) await supabase.from("paper_requests").update({ status: "failed", meta: { error: "insufficient questions", got: merged.length, want: wantCount } }).eq("id", input.requestId);
      return json({ error: "Generation failed: insufficient questions", got: merged.length, want: wantCount, rid }, 400, CORS);
    }

    const pdfBytes = await buildPdf(input, merged, rid);

    // Upload
    const base = `${input.userId}/${input.requestId ?? crypto.randomUUID()}`;
    const filePath = `${base}/paper.pdf`;
    const uploadRes = await supabase.storage.from(TESTS_BUCKET).upload(filePath, new Blob([pdfBytes], { type: "application/pdf" }), {
      upsert: true,
      contentType: "application/pdf",
    });
    if (uploadRes.error) {
      if (input.requestId) await supabase.from("paper_requests").update({ status: "failed", meta: { error: String(uploadRes.error) } }).eq("id", input.requestId);
      return json({ error: "Upload failed", rid }, 500, CORS);
    }
    const publicUrl = IS_PUBLIC_BUCKET
      ? supabase.storage.from(TESTS_BUCKET).getPublicUrl(filePath).data.publicUrl
      : (await supabase.storage.from(TESTS_BUCKET).createSignedUrl(filePath, 60 * 60 * 24 * 7)).data?.signedUrl;

    // Update paper_requests if present; else keep your previous test_papers audit
    if (input.requestId) {
      await supabase
        .from("paper_requests")
        .update({ status: "success", paper_url: publicUrl, answer_key_url: null, ref_files: input.ref_files, meta: { rid, total_questions: merged.length } })
        .eq("id", input.requestId);
    } else {
      // Back-compat: write to test_papers (your existing table)
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
          q_count: wantCount,
          pdf_url: publicUrl,
          meta: { patternMode: input.patternMode, rid },
        }),
      }).catch((e) => console.error("audit insert failed", e));
    }

    return json(
      {
        ok: true,
        rid,
        storagePath: filePath,
        publicUrl,
        meta: { patternMode: input.patternMode, totalQuestions: merged.length },
      },
      200,
      CORS
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const errRid = crypto.randomUUID();
    console.error(`rid=${errRid} generate-test fatal:`, msg);
    return json({ error: msg, rid: errRid }, 500, CORS);
  }
});
