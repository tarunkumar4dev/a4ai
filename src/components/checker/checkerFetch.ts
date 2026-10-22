// src/components/checker/checkerFetch.ts
// One way to call the checker backend (Check Copies + Assignments AI check), so a teacher never sees
// "Failed to fetch" / "Request failed (504)" — only a sentence they can act on.

import { supabase } from "@/lib/supabaseClient";

export const NETWORK_ERROR = "Server se connect nahi ho paya. Dobara try karein.";
export const SERVER_ERROR = "Server mein dikkat hai, thodi der baad try karein.";
export const SESSION_ERROR = "Session expired. Please log in again.";
export const AI_BUSY_ERROR = "AI is busy, please try again in a minute.";
const GENERIC_ERROR = "Kuch galat ho gaya. Dobara try karein.";

export async function checkerFetch(url: string, method: "POST" | "PATCH", body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error(SESSION_ERROR);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    // offline, DNS, CORS block, server unreachable — the browser only says "Failed to fetch"
    throw new Error(NETWORK_ERROR);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) throw new Error(SESSION_ERROR);
    // Gemini quota / overload after the backend's one retry
    if (data?.error?.code === "AI_BUSY") throw new Error(AI_BUSY_ERROR);
    // our backend always sends a readable sentence in `detail`; anything else (Vercel 504 page,
    // validation arrays) is replaced
    if (typeof data.detail === "string" && data.detail.trim()) throw new Error(data.detail);
    throw new Error(res.status >= 500 ? SERVER_ERROR : GENERIC_ERROR);
  }
  return data;
}

/** Any error → a sentence for the teacher ("Failed to fetch" never reaches the screen). */
export function humanError(err: unknown, fallback = GENERIC_ERROR): string {
  const msg = (err instanceof Error ? err.message : typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : String(err ?? "")).trim();
  if (!msg) return fallback;
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg)) return NETWORK_ERROR;
  return msg;
}
