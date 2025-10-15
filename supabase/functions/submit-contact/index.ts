/// <reference lib="deno.unstable" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://esm.sh/zod@3.23.8";

/* ========= ENV (set via: supabase functions secrets set ...) =========
   SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   ALLOWED_ORIGINS = https://www.a4ai.in,https://a4ai.in,http://localhost:5173
====================================================================== */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "*")
  .split(",")
  .map((s) => s.trim());

/* --------- Admin client (bypasses RLS for server-side insert) --------- */
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* ----------------------- Validation schema ----------------------- */
const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  organization: z.string().min(2),
  organization_type: z.string().min(2),
  student_count: z.union([z.string(), z.number()]).optional(),
  requirements: z.array(z.string()).default([]),
  message: z.string().optional(),
  source_page: z.string().optional(),
});

/* ----------------------------- CORS ------------------------------ */
const cors = (req: Request) => {
  const origin = req.headers.get("Origin");
  const allowed =
    ALLOWED_ORIGINS.includes("*") ||
    (!!origin && ALLOWED_ORIGINS.includes(origin));
  const allowOrigin = allowed ? origin ?? "*" : "null";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "content-type, authorization, x-client-info, apikey",
    Vary: "Origin",
  };
};

/* ----------------------------- Server ---------------------------- */
Deno.serve(async (req) => {
  const headers = cors(req);

  // Preflight
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  if (req.method !== "POST") {
    return new Response("Only POST allowed", { status: 405, headers });
  }

  try {
    const ua = req.headers.get("user-agent") || "";
    const ip =
      req.headers.get("x-forwarded-for") ??
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-real-ip") ??
      "";

    const body = await req.json();
    const parsed = schema.parse(body);

    // normalize student_count
    let student_count: number | null = null;
    if (typeof parsed.student_count === "string" && parsed.student_count.trim() !== "") {
      const n = Number(parsed.student_count);
      student_count = Number.isFinite(n) ? n : null;
    } else if (typeof parsed.student_count === "number") {
      student_count = parsed.student_count;
    }

    // simple rate-limit: 3 per 5 min by email OR IP
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count, error: countErr } = await admin
      .from("contact_submissions")
      .select("*", { head: true, count: "exact" })
      .gte("created_at", fiveMinAgo)
      .or(`email.eq.${parsed.email},ip.eq.${ip}`);

    if (countErr) console.warn("rate-limit count error:", countErr.message);
    if ((count ?? 0) >= 3) {
      return new Response(
        JSON.stringify({ ok: false, error: "Too many submissions. Try again in a few minutes." }),
        { status: 429, headers: { "Content-Type": "application/json", ...headers } }
      );
    }

    // insert
    const { error } = await admin.from("contact_submissions").insert({
      name: parsed.name,
      email: parsed.email,
      organization: parsed.organization,
      organization_type: parsed.organization_type,
      student_count,
      requirements: parsed.requirements,
      message: parsed.message ?? null,
      user_agent: ua,
      ip,
      source_page: parsed.source_page ?? "/contact",
      status: "new",
    });

    if (error) {
      console.error(error);
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...headers } }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...headers },
    });
  } catch (e) {
    console.error(e);
    const msg = e?.message || "Invalid Request";
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...cors(req) },
    });
  }
});
