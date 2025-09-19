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
const TESTS_BUCKET = "tests";
const IS_PUBLIC_BUCKET = false;

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
function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}
const now = () => performance.now();
const dur = (ms: number) => Math.round(ms);

/* -------------------- Schema -------------------- */
const Input = z.object({
  userId: z.string().uuid(),
  subject: z.string().min(2),
  board: z.string().optional().default(""),
  grade: z.string().optional().default(""),
  topic: z.string().optional().default(""),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  questionType: z.enum(["Multiple Choice", "Short Answer", "Mixed"]),
  qCount: z.number().int().min(5).max(50),
  outputFormat: z.enum(["PDF"]).default("PDF"),
  notes: z.string().max(1200).optional().default(""),
});

/* -------------------- Option helpers -------------------- */
// Remove leading A) / B. / C: etc
function cleanOption(opt: string) {
  return String(opt || "").trim().replace(/^[A-D]\s*[\)\.\:\-]\s*/i, "").trim();
}
function looksLikePlaceholderOptions(opts?: string[]) {
  if (!Array.isArray(opts) || opts.length < 3) return true;
  const plain = opts.map((o) => cleanOption(o).toLowerCase());
  if (plain.every((t) => t.length <= 2)) return true;                // just letters
  if (new Set(plain).size < Math.ceil(opts.length / 2)) return true; // many dups
  return false;
}

/* -------------------- Unicode → ASCII sanitizer -------------------- */
function sanitizeText(s: string) {
  if (!s) return s;
  return s
    // math symbols
    .replace(/√/g, "sqrt")
    .replace(/[×✕✖]/g, "x")
    .replace(/÷/g, "/")
    .replace(/π/g, "pi")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/≠/g, "!=")
    .replace(/≈/g, "~")
    .replace(/¹/g, "^1").replace(/²/g, "^2").replace(/³/g, "^3")
    .replace(/[⁴-⁹]/g, (m) => `^${"⁴⁵⁶⁷⁸⁹".indexOf(m) + 4}`)
    // dashes & quotes
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    // misc
    .replace(/\u00A0/g, " ")   // nbsp
    .replace(/\t/g, " ")
    .trim();
}

/* -------------------- LLM helpers -------------------- */
const SYS_PROMPT = (i: any, count: number) => `
You're an expert ${i.subject} teacher. Create exactly ${count} ${i.questionType} questions (difficulty: ${i.difficulty})
${i.topic ? `on topic: "${i.topic}"` : ""}.
Return STRICT JSON:
{
  "questions": [
    {
      "text": "string",
      "options": ["...", "...", "...", "..."]?, // only if MCQ; NO A/B/C labels
      "answer": "string", // for MCQ, MUST be exactly one of the options
      "explanation": "string?"
    }
  ]
}
Constraints:
- No duplicates, no ambiguous keys.
- For MCQ: options are full phrases with no A/B/C/D labels; single correct answer equals one option.
- Keep answers concise; explanations 1–2 lines max.
`;

function safeParse(s: string) {
  try {
    const trimmed = s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
    const j = JSON.parse(trimmed);
    if (!Array.isArray(j.questions)) throw new Error("no questions[]");
    return j;
  } catch {
    return { questions: [] as any[] };
  }
}

async function callOpenAI(i: any, count: number, rid: string) {
  if (!OPENAI_API_KEY) return { questions: [] };
  const t0 = now();
  console.log(`rid=${rid} start callOpenAI count=${count}`);
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
          { role: "user", content: SYS_PROMPT(i, count) },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const j = await res.json().catch(() => ({}));
    const content = j?.choices?.[0]?.message?.content ?? "{}";
    const out = safeParse(content);
    console.log(`rid=${rid} end callOpenAI ms=${dur(now() - t0)} q=${out.questions.length}`);
    return out;
  } catch (e) {
    console.error(`rid=${rid} callOpenAI error:`, e);
    return { questions: [] };
  }
}

async function callDeepSeek(i: any, count: number, rid: string) {
  if (!DEEPSEEK_API_KEY) return { questions: [] };
  const t0 = now();
  console.log(`rid=${rid} start callDeepSeek count=${count}`);
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
          { role: "user", content: SYS_PROMPT(i, count) },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const j = await res.json().catch(() => ({}));
    const content = j?.choices?.[0]?.message?.content ?? "{}";
    const out = safeParse(content);
    console.log(`rid=${rid} end callDeepSeek ms=${dur(now() - t0)} q=${out.questions.length}`);
    return out;
  } catch (e) {
    console.error(`rid=${rid} callDeepSeek error:`, e);
    return { questions: [] };
  }
}

function normalize(i: any, draft: any) {
  const wantsMCQ = i.questionType === "Multiple Choice" || i.questionType === "Mixed";
  return draft.questions.map((q: any, idx: number) => ({
    idx: idx + 1,
    text: String(q.text ?? "").trim(),
    options: wantsMCQ
      ? Array.isArray(q.options)
        ? q.options.slice(0, 4).map((o: string) => cleanOption(String(o)))
        : undefined
      : undefined,
    answer: String(q.answer ?? "").trim(),
    explanation: q.explanation ? String(q.explanation) : undefined,
  }));
}

function scoreQuestions(i: any, qs: any[]) {
  const kw = (i.topic || i.subject).toLowerCase().split(/\W+/).filter(Boolean);
  const uniq = new Set<string>();
  const dedup: any[] = [];

  for (const q of qs) {
    if ((i.questionType === "Multiple Choice" || i.questionType === "Mixed") && looksLikePlaceholderOptions(q.options)) {
      continue;
    }
    const key = q.text.toLowerCase().replace(/\s+/g, " ").slice(0, 140);
    if (uniq.has(key)) continue;
    uniq.add(key);
    dedup.push(q);
  }

  const scored = dedup.map((q) => {
    let s = 0;
    if (q.text.length > 20) s += 1;
    if (kw.some((k) => q.text.toLowerCase().includes(k))) s += 1;
    if (i.questionType !== "Multiple Choice") s += 1;
    else if (q.options && q.options.length >= 3) s += 1;
    if (q.answer) {
      s += 1;
      if (Array.isArray(q.options)) {
        const ix = q.options.findIndex(
          (o: string) => cleanOption(o).toLowerCase() === String(q.answer || "").toLowerCase(),
        );
        if (ix >= 0) s += 1;
      }
    }
    return { ...q, _score: s };
  });

  scored.sort((a, b) => b._score - a._score);
  return scored;
}

async function refine(i: any, qs: any[], rid: string) {
  if (!OPENAI_API_KEY || i.qCount > 12) return qs;
  const t0 = now();
  console.log(`rid=${rid} start refine count=${qs.length}`);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You tidy JSON. Keep the same schema and count; fix grammar; ensure MCQ options include the answer." },
          { role: "user", content: JSON.stringify({ questions: qs }) },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const j = await res.json().catch(() => ({}));
    const content = j?.choices?.[0]?.message?.content ?? "{}";
    const parsed = safeParse(content);
    const out = parsed.questions.length ? parsed.questions : qs;
    console.log(`rid=${rid} end refine ms=${dur(now() - t0)} q=${out.length}`);
    return out;
  } catch (e) {
    console.error(`rid=${rid} refine error:`, e);
    return qs;
  }
}

/* -------------------- PDF builder -------------------- */
async function buildPdf(input: any, questions: any[], rid: string) {
  const t0 = now();
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // border
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderWidth: 1,
    borderColor: rgb(0.85, 0.85, 0.85),
    color: rgb(1, 1, 1),
  });

  // header
  page.drawText("a4ai — Test Paper", { x: 48, y: height - 60, size: 16, font: bold });
  page.drawText(sanitizeText(`${input.subject} • ${input.grade || ""} ${input.board ? "• " + input.board : ""}`), {
    x: 48,
    y: height - 80,
    size: 10,
    font,
  });

  // body
  const marginX = 48;
  let cursorY = height - 110;
  const lineH = 14;

  const wrap = (text: string, maxChars = 90) => {
    const words = sanitizeText(text).split(" ");
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
    if (cursorY < 120) {
      page = pdf.addPage([595.28, 841.89]);
      cursorY = 780;
    }

    page.drawText(`${qNo}.`, { x: marginX, y: cursorY, size: 10, font: bold });

    const lines = wrap(String(q.text || ""));
    cursorY -= lineH;
    for (const ln of lines) {
      if (cursorY < 80) {
        page = pdf.addPage([595.28, 841.89]);
        cursorY = 780;
      }
      page.drawText(sanitizeText(ln), { x: marginX + 14, y: cursorY, size: 10, font });
      cursorY -= lineH;
    }

    if (Array.isArray(q.options)) {
      const abc = ["A", "B", "C", "D"];
      for (let i = 0; i < Math.min(4, q.options.length); i++) {
        const text = cleanOption(String(q.options[i]));
        const optLines = wrap(`${abc[i]}. ${text}`, 85);
        for (const ln of optLines) {
          if (cursorY < 80) {
            page = pdf.addPage([595.28, 841.89]);
            cursorY = 780;
          }
          page.drawText(sanitizeText(ln), { x: marginX + 24, y: cursorY, size: 10, font });
          cursorY -= lineH;
        }
      }
    }

    cursorY -= lineH * 0.75;
    qNo++;
  }

  // Answer Key
  if (cursorY < 120) {
    page = pdf.addPage([595.28, 841.89]);
    cursorY = 780;
  }
  page.drawText("Answer Key:", { x: marginX, y: cursorY, size: 11, font: bold });
  cursorY -= lineH;

  let idx = 1;
  for (const q of questions) {
    let ans = "-";
    const rawAnswer = String(q.answer || "").trim();
    if (Array.isArray(q.options)) {
      const ix = q.options.findIndex((o: string) => cleanOption(o).toLowerCase() === rawAnswer.toLowerCase());
      ans = ix >= 0 ? String.fromCharCode(65 + ix) : rawAnswer || "-";
    } else {
      ans = rawAnswer || "-";
    }
    page.drawText(sanitizeText(`${idx}. ${ans}`), { x: marginX + 14, y: cursorY, size: 10, font });
    cursorY -= lineH;
    idx++;
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
  const trace = url.searchParams.get("trace") === "1";
  const rawPath = url.pathname;
  const path = rawPath.replace(/^\/functions\/v[0-9]+/, "").replace(/^\/generate-test/, "").replace(/\/+$/, "") || "/";
  const rid = crypto.randomUUID();

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

  if (path === "/_debug") {
    return json({ ok: true, rid, method: req.method, rawPath, normalizedPath: path, href: url.href }, 200, CORS);
  }

  if (req.method !== "POST") return json({ error: "Method Not Allowed", hint: "Use GET /health or POST /" }, 405, CORS);

  try {
    const data = await req.json();
    const input = Input.parse(data);
    console.log(`rid=${rid} input qCount=${input.qCount} qt=${input.questionType} diff=${input.difficulty}`);

    const perModel = Math.max(3, Math.ceil(input.qCount / 2));
    const capPerCall = Math.min(perModel, 10);

    const [o, d] = await Promise.allSettled([callOpenAI(input, capPerCall, rid), callDeepSeek(input, capPerCall, rid)]);
    const draftA = o.status === "fulfilled" ? o.value : { questions: [] };
    const draftB = d.status === "fulfilled" ? d.value : { questions: [] };
    if (!draftA.questions.length && !draftB.questions.length) {
      return json({ error: "Question generation failed from providers", rid }, 502, CORS);
    }

    let scored = [
      ...scoreQuestions(input, normalize(input, draftA)),
      ...scoreQuestions(input, normalize(input, draftB)),
    ];
    let merged = scored.slice(0, input.qCount).map(({ _score, ...rest }) => rest);

    // top-up attempts
    let attempts = 0;
    while (merged.length < input.qCount && attempts < 3) {
      const remaining = Math.min(8, input.qCount - merged.length);
      console.log(`rid=${rid} topup attempt=${attempts + 1} remaining=${remaining}`);
      let topup = await callDeepSeek(input, remaining, rid);
      if (!topup.questions.length) topup = await callOpenAI(input, remaining, rid);
      if (topup.questions.length) {
        const extra = scoreQuestions(input, normalize(input, topup));
        scored = [...scored, ...extra];
        merged = scored.slice(0, input.qCount).map(({ _score, ...rest }) => rest);
      }
      attempts++;
    }

    if (merged.length < input.qCount) {
      return json({ error: "Generation failed: insufficient questions", stage: "draft", got: merged.length, want: input.qCount, rid }, 400, CORS);
    }

    const refined = await refine(input, merged, rid);
    const pdfBytes = await buildPdf(input, refined, rid);

    const tUp = now();
    const testId = crypto.randomUUID();
    const nowD = new Date();
    const filePath = `users/${input.userId}/tests/${nowD.getFullYear()}/${String(nowD.getMonth() + 1).padStart(2, "0")}/${String(
      nowD.getDate(),
    ).padStart(2, "0")}/${testId}.pdf`;

    const uploadRes = await supabase.storage.from(TESTS_BUCKET).upload(
      filePath,
      new Blob([pdfBytes], { type: "application/pdf" }),
      { upsert: false, contentType: "application/pdf" },
    );
    if (uploadRes.error) {
      console.error(`rid=${rid} upload error:`, uploadRes.error);
      return json({ error: "Upload failed", rid }, 500, CORS);
    }
    console.log(`rid=${rid} upload ms=${dur(now() - tUp)} path=${filePath}`);

    let publicUrl: string;
    if (IS_PUBLIC_BUCKET) {
      const { data } = supabase.storage.from(TESTS_BUCKET).getPublicUrl(filePath);
      publicUrl = data.publicUrl;
    } else {
      const { data, error } = await supabase.storage.from(TESTS_BUCKET).createSignedUrl(filePath, 60 * 60 * 24 * 7);
      if (error || !data?.signedUrl) {
        console.error(`rid=${rid} signed url error:`, error);
        return json({ error: "URL generation failed", rid }, 500, CORS);
      }
      publicUrl = data.signedUrl;
    }

    (async () => {
      try {
        const rest = await fetch(`${SUPABASE_URL}/rest/v1/test_papers`, {
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
            grade: input.grade,
            difficulty: input.difficulty,
            question_type: input.questionType,
            q_count: input.qCount,
            pdf_url: publicUrl,
            meta: { topic: input.topic, notes: input.notes, outputFormat: input.outputFormat, rid },
          }),
        });
        if (!rest.ok) console.error(`rid=${rid} telemetry insert failed:`, rest.status, await rest.text().catch(() => ""));
      } catch (e) {
        console.error(`rid=${rid} telemetry insert error:`, e);
      }
    })();

    return json(
      {
        rid,
        testId,
        filePath,
        storagePath: filePath,
        publicUrl,
        downloadUrl: publicUrl,
        meta: {
          subject: input.subject,
          board: input.board,
          grade: input.grade,
          topic: input.topic,
          difficulty: input.difficulty,
          questionType: input.questionType,
          qCount: input.qCount,
        },
        ...(trace ? { trace: { stages: "ok" } } : {}),
      },
      200,
      CORS,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const rid = crypto.randomUUID();
    console.error(`rid=${rid} generate-test fatal:`, msg);
    return json({ error: msg, rid }, 500, CORS);
  }
});
