// /src/lib/generateTest.ts
import { supabase } from "@/lib/supabaseClient";
import type { GenerateTestRequest } from "@/types/testgen";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
export type GenerateTestResponse = {
  ok: true;
  /** Primary PDF (new backend) or legacy single URL */
  url: string;
  /** New backend explicit urls (may be undefined if legacy) */
  pdfUrl?: string | null;
  docxUrl?: string | null;
  csvUrl?: string | null;
  /** Optional requestId we attached/passed through */
  requestId?: string;
  /** Raw meta from server */
  meta: any;
  /** Entire raw JSON for debugging */
  json: any;
  /** Model info if returned */
  used: { modelGPT: string; modelDeepseek: string };
};

type RawJson = {
  ok?: boolean;
  // legacy/various url fields
  url?: string;
  publicUrl?: string;
  downloadUrl?: string;
  file_url?: string;
  signed_url?: string;

  // new explicit fields
  pdfUrl?: string;
  docxUrl?: string;
  csvUrl?: string;

  // misc storage paths
  filePath?: string;
  storagePath?: string | { pdfPath?: string; docxPath?: string; csvPath?: string };
  path?: string;
  storage_path?: string;

  meta?: Record<string, any>;
  used?: { modelGPT?: string; modelDeepseek?: string };
  error?: string;
  rid?: string;
  [k: string]: any;
};

export type Health = {
  openaiOk: boolean;
  deepseekOk: boolean;
  modelGPT: string;
  modelDeepseek: string;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function getFunctionsBaseUrl(): string {
  const fn = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined;
  if (fn) return fn.replace(/\/+$/, "");

  const supaUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supaUrl) throw new Error("VITE_SUPABASE_URL is missing");
  const url = new URL(supaUrl);
  const [ref] = url.hostname.split(".");
  return `https://${ref}.functions.supabase.co`;
}

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;

  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return anon ?? null;
}

function preferUrl(raw: RawJson): string | undefined {
  return (
    raw.pdfUrl ||
    raw.publicUrl ||
    raw.url ||
    raw.downloadUrl ||
    raw.file_url ||
    raw.signed_url
  );
}

function normalizeServerJson(raw: RawJson): GenerateTestResponse {
  const primary = preferUrl(raw);
  const ok = raw.ok ?? !!primary;

  return {
    ok: !!ok,
    url: (primary as string) || "",
    pdfUrl: raw.pdfUrl ?? primary ?? null,
    docxUrl: raw.docxUrl ?? null,
    csvUrl: raw.csvUrl ?? null,
    requestId: typeof raw?.meta?.requestId === "string" ? raw.meta.requestId : raw?.requestId,
    meta: raw.meta ?? {},
    json: raw,
    used: {
      modelGPT: raw.used?.modelGPT ?? "unknown",
      modelDeepseek: raw.used?.modelDeepseek ?? "unknown",
    },
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function shouldRetry(status: number) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function checkHealth(): Promise<Health> {
  const ref = (import.meta.env.VITE_SUPABASE_REF as string | undefined)?.trim();
  const base = ref ? `https://${ref}.functions.supabase.co` : getFunctionsBaseUrl();
  const r = await fetch(`${base}/generate-test/health`);
  if (!r.ok) throw new Error("Health check failed");

  const j = (await r.json()) as any;
  // server returns: { ok, keys: { openai, deepseek, ... }, models: { openai, deepseek } }
  const openaiOk = !!j?.keys?.openai;
  const deepseekOk = !!j?.keys?.deepseek;
  const modelGPT = String(j?.models?.openai ?? "unknown");
  const modelDeepseek = String(j?.models?.deepseek ?? "unknown");

  return { openaiOk, deepseekOk, modelGPT, modelDeepseek };
}

export async function generateTest(
  payload: GenerateTestRequest,
  options?: { timeoutMs?: number; retries?: number }
): Promise<GenerateTestResponse> {
  // Attach a requestId (non-breaking) so backend can track status rows
  const requestId = (globalThis.crypto && "randomUUID" in globalThis.crypto)
    ? (globalThis.crypto as Crypto).randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const fullPayload: any = { ...payload, requestId };

  // ---- Path A: supabase.functions.invoke (preferred) ----
  try {
    const { data, error } = await supabase.functions.invoke("generate-test", {
      body: fullPayload,
    });

    if (error) throw error;

    if (data && typeof data === "object") {
      const normalized = normalizeServerJson(data as RawJson);
      if (!normalized.ok || !normalized.url) {
        // fallback to throw so we try direct fetch
        throw new Error((data as any)?.error || "Generation failed (invoke path)");
      }
      // ensure we surface requestId we generated
      normalized.requestId = normalized.requestId || requestId;
      return normalized;
    }

    throw new Error("Unexpected response from generate-test (invoke)");
  } catch {
    // fall through to direct fetch
  }

  // ---- Path B: direct fetch with retries ----
  const base = getFunctionsBaseUrl();
  const url = `${base}/generate-test`;

  const maxRetries = Math.max(0, options?.retries ?? 2);
  let attempt = 0;

  while (true) {
    const ctrl = new AbortController();
    const timeoutMs = options?.timeoutMs && options.timeoutMs > 0 ? options.timeoutMs : undefined;
    const timer = timeoutMs ? setTimeout(() => ctrl.abort(), timeoutMs) : null;

    try {
      const token = await getAuthToken();

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(fullPayload),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        if (shouldRetry(res.status) && attempt < maxRetries) {
          attempt++;
          const backoff = 500 * attempt; // 0.5s, 1s
          await sleep(backoff);
          continue;
        }

        let detail: unknown = null;
        try { detail = await res.json(); }
        catch { try { detail = await res.text(); } catch { /* ignore */ } }

        throw new Error(
          `generate-test failed (${res.status})${
            detail ? `: ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""
          }`
        );
      }

      const ctype = res.headers.get("content-type") ?? "";

      if (ctype.includes("application/json")) {
        const raw = (await res.json()) as RawJson;
        const normalized = normalizeServerJson(raw);
        if (!normalized.ok || !normalized.url) {
          throw new Error(raw.error || "Generation failed (no URL in response)");
        }
        normalized.requestId = normalized.requestId || requestId;
        return normalized;
      }

      if (ctype.includes("application/pdf")) {
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        return {
          ok: true,
          url: objectUrl, // ephemeral blob URL
          pdfUrl: objectUrl,
          docxUrl: null,
          csvUrl: null,
          requestId,
          meta: {},
          json: { note: "Streamed PDF (blob URL)", content_type: ctype },
          used: { modelGPT: "unknown", modelDeepseek: "unknown" },
        };
      }

      const text = await res.text();
      throw new Error(`Unexpected content-type: ${ctype || "n/a"}${text ? ` • ${text}` : ""}`);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
