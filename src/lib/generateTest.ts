// /src/lib/generateTest.ts
import { supabase } from "@/lib/supabaseClient";
import type { GenerateTestRequest } from "@/types/testgen";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
export type GenerateTestResponse = {
  ok: true;
  url: string;
  meta: any;
  json: any;
  used: { modelGPT: string; modelDeepseek: string };
};

type RawJson = {
  ok?: boolean;
  url?: string;
  publicUrl?: string;
  downloadUrl?: string;
  file_url?: string;
  signed_url?: string;
  filePath?: string;
  storagePath?: string;
  path?: string;
  storage_path?: string;
  meta?: Record<string, any>;
  used?: { modelGPT?: string; modelDeepseek?: string };
  error?: string;
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

function normalizeServerJson(raw: RawJson): GenerateTestResponse {
  const publicUrl =
    raw.url ??
    raw.publicUrl ??
    raw.downloadUrl ??
    raw.file_url ??
    raw.signed_url;

  // kept for potential future use / debugging
  // const storagePath = raw.filePath ?? raw.storagePath ?? raw.path ?? raw.storage_path;

  return {
    ok: raw.ok ?? !!publicUrl,
    url: publicUrl as string,
    meta: raw.meta ?? {},
    json: raw,
    used: {
      modelGPT: raw.used?.modelGPT ?? "unknown",
      modelDeepseek: raw.used?.modelDeepseek ?? "unknown",
    },
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function checkHealth(): Promise<Health> {
  const ref = (import.meta.env.VITE_SUPABASE_REF as string | undefined)?.trim();
  const base = ref ? `https://${ref}.functions.supabase.co` : getFunctionsBaseUrl();
  const r = await fetch(`${base}/generate-test/health`);
  if (!r.ok) throw new Error("Health check failed");
  return (await r.json()) as Health;
}

export async function generateTest(
  payload: GenerateTestRequest,
  options?: { timeoutMs?: number }
): Promise<GenerateTestResponse> {
  // ---- Path A: invoke (preferred) ----
  try {
    const { data, error } = await supabase.functions.invoke("generate-test", {
      body: payload,
    });

    if (error) throw error;

    if (data?.ok && data?.url) {
      return data as GenerateTestResponse;
    }
    if (data && typeof data === "object") {
      return normalizeServerJson(data as RawJson);
    }

    throw new Error("Unexpected response from generate-test");
  } catch {
    // fall through to direct fetch
  }

  // ---- Path B: direct fetch fallback ----
  const base = getFunctionsBaseUrl();
  const url = `${base}/generate-test`;

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
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });

    if (!res.ok) {
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
      return normalized;
    }

    if (ctype.includes("application/pdf")) {
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      return {
        ok: true,
        url: objectUrl, // ephemeral blob URL
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
