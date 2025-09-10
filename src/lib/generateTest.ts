// src/lib/generateTest.ts
import { supabase } from "./supabaseClient";

// ---- Types ---------------------------------------------------------------
export type Difficulty = "Easy" | "Medium" | "Hard";
export type QuestionType = "Multiple Choice" | "Short Answer" | "Mixed";
export type OutputFormat = "PDF" | "JSON";

export interface GenerateTestParams {
  userId: string;
  subject: string;
  difficulty: Difficulty;
  questionType: QuestionType;
  qCount: number;              // >= 5
  outputFormat: OutputFormat;
}

export type GenerateTestResponse =
  | { kind: "json"; json: any }            // e.g. { testId, downloadUrl }
  | { kind: "pdf"; blob: Blob; filename?: string };

// ---- Helpers -------------------------------------------------------------
function getFunctionsBaseUrl(): string {
  const supaUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supaUrl) throw new Error("VITE_SUPABASE_URL is missing");
  const url = new URL(supaUrl);
  const [ref] = url.hostname.split(".");
  return `https://${ref}.functions.supabase.co`;
}

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!session?.access_token && !anon) {
    throw new Error("No auth token found (user not logged in and anon key missing).");
  }
  return session?.access_token ?? anon!;
}

function sanitizeFilename(base: string) {
  return base.replace(/[^\w\- ]+/g, "_").slice(0, 60);
}

// tiny client-side guard (matches your server zod constraints)
function assertParams(p: GenerateTestParams) {
  if (p.qCount < 5) throw new Error("qCount must be >= 5");
  // add more if needed…
}

// ---- Main call -----------------------------------------------------------
export async function generateTest(
  params: GenerateTestParams,
  options?: { timeoutMs?: number }
): Promise<GenerateTestResponse> {
  assertParams(params);

  const token = await getAuthToken();
  const url = `${getFunctionsBaseUrl()}/generate-test`;

  // optional timeout
  const ctrl = new AbortController();
  const t = options?.timeoutMs
    ? setTimeout(() => ctrl.abort(), options.timeoutMs)
    : null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      let detail: unknown;
      try { detail = await res.json(); } catch { detail = await res.text(); }
      throw new Error(
        `generate-test failed (${res.status}): ${
          typeof detail === "string" ? detail : JSON.stringify(detail)
        }`
      );
    }

    const ctype = res.headers.get("content-type") ?? "";

    if (ctype.includes("application/json")) {
      const json = await res.json();
      return { kind: "json", json };
    }

    // PDF bytes
    const blob = await res.blob();
    let filename = `test-${Date.now()}.pdf`;

    if (ctype.includes("application/pdf")) {
      const disp = res.headers.get("content-disposition") || "";
      const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i.exec(disp);
      filename =
        decodeURIComponent(match?.[1] || match?.[2] || filename) ||
        `${sanitizeFilename(params.subject)}-${Date.now()}.pdf`;
    }

    return { kind: "pdf", blob, filename };
  } finally {
    if (t) clearTimeout(t);
  }
}
