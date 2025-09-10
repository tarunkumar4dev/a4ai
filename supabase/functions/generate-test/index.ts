/// <reference lib="deno.unstable" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { z } from "https://esm.sh/zod@3.23.8";

/* ---------- Env ---------- */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/* ---------- CORS ---------- */
const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "https://a4ai.in",
  "https://www.a4ai.in",
]);
function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
function json(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

/* ---------- Input Schema ---------- */
const Input = z.object({
  userId: z.string().uuid(),
  subject: z.string().min(2),
  topic: z.string().optional().default(""),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  questionType: z.enum(["Multiple Choice", "Short Answer", "Mixed"]),
  qCount: z.number().int().min(5).max(50),
  outputFormat: z.enum(["PDF"]).default("PDF"),
  notes: z.string().max(1200).optional().default(""),
});
type InputT = z.infer<typeof Input>;

/* ---------- LLM Helpers ---------- */
const SYS_PROMPT = (i: InputT) => `
You're an expert ${i.subject} teacher. Create ${i.qCount} ${i.questionType} questions (difficulty: ${i.difficulty})
${i.topic ? `on topic: "${i.topic}"` : ""}.
Return STRICT JSON:

{
  "questions": [
    {
      "text": "string",
      "options": ["A","B","C","D"]?  // only if MCQ
      "answer": "string",
      "explanation": "string?"
    }
  ]
}

Constraints:
- No duplicates, no ambiguous keys.
- Keep answers concise; explanations 1–2 lines max.
`;

async function callOpenAI(i: InputT) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: "Return only valid JSON. Do not add markdown fences." },
        { role: "user", content: SYS_PROMPT(i) },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "{}";
  return safeParse(content);
}

async function callDeepSeek(i: InputT) {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.5,
      messages: [
        { role: "system", content: "Return only valid JSON. Do not add markdown fences." },
        { role: "user", content: SYS_PROMPT(i) },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "{}";
  return safeParse(content);
}

function safeParse(s: string) {
  try {
    const trimmed = s.trim().replace(/^```(json)?/i, "").replace(/```$/, "");
    const j = JSON.parse(trimmed);
    if (!Array.isArray(j.questions)) throw new Error("no questions[]");
    return j as { questions: any[] };
  } catch {
    return { questions: [] as any[] };
  }
}

function normalize(i: InputT, draft: { questions: any[] }) {
  const isMCQ = i.questionType === "Multiple Choice" || i.questionType === "Mixed";
  const Q = draft.questions.map((q, idx) => ({
    idx: idx + 1,
    text: String(q.text ?? "").trim(),
    options: isMCQ ? (Array.isArray(q.options) ? q.options.slice(0, 4).map(String) : undefined) : undefined,
    answer: String(q.answer ?? "").trim(),
    explanation: q.explanation ? String(q.explanation) : undefined,
  }));
  return Q;
}

function scoreQuestions(i: InputT, qs: ReturnType<typeof normalize>) {
  // penalize empties, reward topic keywords, enforce MCQ completeness
  const kw = (i.topic || i.subject).toLowerCase().split(/\W+/).filter(Boolean);
  const uniq = new Set<string>();
  const deduped: typeof qs = [];
  for (const q of qs) {
    const key = q.text.toLowerCase().replace(/\s+/g, " ").slice(0, 140);
    if (uniq.has(key)) continue;
    uniq.add(key);
    deduped.push(q);
  }
  const scored = deduped.map((q) => {
    let s = 0;
    if (q.text.length > 20) s += 1;
    if (kw.some((k) => q.text.toLowerCase().includes(k))) s += 1;
    if (i.questionType !== "Multiple Choice") s += 1;
    else if (q.options && q.options.length >= 3) s += 1;
    if (q.answer) s += 1;
    return { ...q, _score: s };
  });
  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, i.qCount).map(({ _score, ...rest }) => rest);
}

async function refine(i: InputT, qs: any[]) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You tidy JSON. Keep the same schema and count; fix grammar; ensure MCQ options align with the answer.",
        },
        { role: "user", content: JSON.stringify({ questions: qs }) },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  });
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "{}";
  return safeParse(content).questions.length ? safeParse(content).questions : qs;
}

/* ---------- PDF Builder ---------- */
async function buildPdf(i: InputT, qs: any[]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 56;
  const lineH = 16;
  const pageWidth = 595.28,
    pageHeight = 841.89;

  function addPage(title: string) {
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawText("a4ai — Test Generator", {
      x: margin,
      y: pageHeight - margin,
      size: 12,
      font: fontBold,
      color: rgb(0.4, 0.2, 0.9),
    });
    page.drawText(title, {
      x: margin,
      y: pageHeight - margin - 18,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });
    return page;
  }

  let page = addPage(`${i.subject} • ${i.topic || "General"} • ${i.difficulty}`);
  let y = page.getHeight() - margin - 48;

  const wrap = (text: string, size = 11, maxWidth = page.getWidth() - 2 * margin) => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? cur + " " + w : w;
      if (font.widthOfTextAtSize(next, size) > maxWidth) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  // Questions
  qs.forEach((q: any, idx: number) => {
    const header = `${idx + 1}. ${q.text}`;
    const lines = wrap(header);
    for (const ln of lines) {
      if (y < margin + 80) {
        page = addPage("Questions (cont.)");
        y = page.getHeight() - margin - 24;
      }
      page.drawText(ln, { x: margin, y, size: 11, font });
      y -= lineH;
    }
    if (q.options) {
      q.options.forEach((op: string, oi: number) => {
        const opt = `   ${String.fromCharCode(65 + oi)}. ${op}`;
        const olines = wrap(opt, 10);
        for (const ln of olines) {
          if (y < margin + 80) {
            page = addPage("Questions (cont.)");
            y = page.getHeight() - margin - 24;
          }
          page.drawText(ln, { x: margin + 8, y, size: 10, font });
          y -= lineH;
        }
      });
    }
    y -= 6;
  });

  // Answer Key
  page = addPage("Answer Key");
  y = page.getHeight() - margin - 28;
  qs.forEach((q: any, idx: number) => {
    const ans = `${idx + 1}. ${q.answer}${q.explanation ? ` — ${q.explanation}` : ""}`;
    const lines = wrap(ans, 10);
    for (const ln of lines) {
      if (y < margin + 40) {
        page = addPage("Answer Key (cont.)");
        y = page.getHeight() - margin - 24;
      }
      page.drawText(ln, { x: margin, y, size: 10, font });
      y -= lineH;
    }
  });

  return await pdf.save();
}

/* ---------- Handler (with CORS) ---------- */
Deno.serve(async (req: Request) => {
  const CORS = corsHeadersFor(req);

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  // Only POST
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS });
  }

  try {
    const data = await req.json();
    const input = Input.parse(data) as InputT;

    // 1) Parallel drafts
    const [o, d] = await Promise.allSettled([callOpenAI(input), callDeepSeek(input)]);
    const draftA = o.status === "fulfilled" ? o.value : { questions: [] };
    const draftB = d.status === "fulfilled" ? d.value : { questions: [] };

    // 2) Normalize + score + merge
    const normA = scoreQuestions(input, normalize(input, draftA));
    const normB = scoreQuestions(input, normalize(input, draftB));
    const merged = [...normA, ...normB].slice(0, input.qCount);

    if (merged.length < input.qCount) {
      return json(
        { error: "Generation failed: insufficient questions", stage: "draft" },
        400,
        CORS
      );
    }

    // 3) Refine
    const refined = await refine(input, merged);

    // 4) PDF
    const pdfBytes = await buildPdf(input, refined);

    // 5) Persist to storage
    const testId = crypto.randomUUID();
    const now = new Date();
    const path = `tests/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(
      now.getDate()
    ).padStart(2, "0")}/${testId}.pdf`;

    const { error: upErr } = await supabase.storage
      .from("tests")
      .upload(path, new Blob([pdfBytes], { type: "application/pdf" }), { upsert: false });
    if (upErr) throw upErr;

    const { data: signed } = await supabase.storage.from("tests").createSignedUrl(path, 60 * 60 * 24 * 7);

    // 6) Save DB rows
    const { error: insErr } = await supabase.from("tests").insert({
      id: testId,
      user_id: input.userId,
      subject: input.subject,
      topic: input.topic,
      difficulty: input.difficulty,
      question_type: input.questionType,
      q_count: input.qCount,
      output_format: input.outputFormat,
      storage_path: path,
      signed_url: signed?.signedUrl ?? null,
      cost_cents: 2,
      status: "done",
    });
    if (insErr) throw insErr;

    const rows = refined.map((q: any, idx: number) => ({ test_id: testId, idx: idx + 1, question: q }));
    const { error: qErr } = await supabase.from("test_questions").insert(rows);
    if (qErr) console.warn("question insert warning:", qErr.message);

    return json(
      {
        testId,
        downloadUrl: signed?.signedUrl,
        storagePath: path,
        meta: {
          subject: input.subject,
          topic: input.topic,
          difficulty: input.difficulty,
          questionType: input.questionType,
          qCount: input.qCount,
        },
      },
      200,
      CORS
    );
  } catch (e: any) {
    console.error(e);
    return json({ error: String(e?.message ?? e) }, 500, CORS);
  }
});
