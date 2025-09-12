// src/lib/generateTest.ts
import { supabase } from "./supabaseClient";

/* ----------------------------- Types ----------------------------- */
export type Difficulty = "Easy" | "Medium" | "Hard";
export type QuestionType = "Multiple Choice" | "Short Answer" | "Mixed";
export type OutputFormat = "PDF" | "JSON";

export interface GenerateTestParams {
  userId: string;
  subject: string;
  difficulty: Difficulty;
  questionType: QuestionType;
  qCount: number; // >= 5
  outputFormat: OutputFormat;
}

export type GenerateTestResponse =
  | { kind: "json"; json: NormalizedJson } // normalized for UI
  | { kind: "pdf"; blob: Blob; filename?: string };

export type RawJson = {
  testId?: string;
  filePath?: string;
  storagePath?: string;
  publicUrl?: string;
  downloadUrl?: string;
  meta?: Record<string, any>;
  error?: string;
  [k: string]: any;
};

export type NormalizedJson = RawJson & {
  // always present (if available on server under any alias)
  publicUrl?: string;
  downloadUrl?: string;
  filePath?: string;
  storagePath?: string;
};

/* --------------------------- Helpers ----------------------------- */
function getFunctionsBaseUrl(): string {
  // Prefer explicit functions URL if provided
  const fn = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined;
  if (fn) return fn.replace(/\/+$/, "");

  const supaUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supaUrl) throw new Error("VITE_SUPABASE_URL is missing");
  const url = new URL(supaUrl);
  const [ref] = url.hostname.split(".");
  return `https://${ref}.functions.supabase.co`;
}

async function getAuthToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;

  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return anon ?? null; // may return null → we’ll omit Authorization header
}

function sanitizeFilename(base: string) {
  return base.replace(/[^\w\- ]+/g, "_").slice(0, 60);
}

function assertParams(p: GenerateTestParams) {
  if (!p?.userId) throw new Error("Missing userId");
  if (!p?.subject || p.subject.trim().length < 2) throw new Error("Subject is too short");
  if (p.qCount < 5) throw new Error("qCount must be >= 5");
}

/** Convert server JSON to a consistent shape for the UI */
function normalizeJson(raw: RawJson): NormalizedJson {
  const publicUrl = raw.publicUrl ?? raw.downloadUrl ?? raw.file_url ?? raw.signed_url;
  const filePath = raw.filePath ?? raw.storagePath ?? raw.path ?? raw.storage_path;

  // expose both names for compatibility
  return {
    ...raw,
    publicUrl: publicUrl ?? undefined,
    downloadUrl: publicUrl ?? undefined,
    filePath: filePath ?? undefined,
    storagePath: filePath ?? undefined,
  };
}

/* ---------------------------- Main call --------------------------- */
export async function generateTest(
  params: GenerateTestParams,
  options?: { timeoutMs?: number }
): Promise<GenerateTestResponse> {
  assertParams(params);

  const base = getFunctionsBaseUrl();
  const url = `${base}/generate-test`;

  const ctrl = new AbortController();
  const t =
    options?.timeoutMs && options.timeoutMs > 0
      ? setTimeout(() => ctrl.abort(), options.timeoutMs)
      : null;

  try {
    const token = await getAuthToken();

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      // try to read structured error
      let detail: unknown;
      try {
        detail = await res.json();
      } catch {
        try {
          detail = await res.text();
        } catch {
          detail = null;
        }
      }
      throw new Error(
        `generate-test failed (${res.status})${
          detail ? `: ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""
        }`
      );
    }

    const ctype = res.headers.get("content-type") ?? "";

    // JSON response (recommended path)
    if (ctype.includes("application/json")) {
      const raw = (await res.json()) as RawJson;
      const json = normalizeJson(raw);
      return { kind: "json", json };
    }

    // PDF bytes fallback (if function streams a PDF)
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
