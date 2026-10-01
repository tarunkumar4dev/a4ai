/**
 * aiChat.ts — client for the backend AI chat proxy (POST /api/v1/chat).
 *
 * The browser never holds an LLM key. Requests carry the user's Supabase access token; the
 * backend enforces per-user limits and talks to OpenRouter.
 *
 * Feature flag: VITE_CHAT_BACKEND_ENABLED=false turns the proxy off (callers fall back to their
 * offline helper). Vite inlines env vars at build time, so flipping it needs a Vercel redeploy.
 */
import { supabase } from "@/lib/supabaseClient";

export type ChatTurn = { role: "user" | "assistant" | "system"; content: string };

export type AiChatResult =
  | { ok: true; content: string; remainingToday: number | null }
  | { ok: false; reason: "disabled" | "unauthenticated" | "rate_limited" | "unavailable"; message?: string };

// Mirrors backend limits (chat.py) so requests are never rejected for size.
const MAX_HISTORY = 12;
const MAX_CONTENT = 4000;
const REQUEST_TIMEOUT_MS = 35_000;

export const CHAT_BACKEND_ENABLED =
  String(import.meta.env.VITE_CHAT_BACKEND_ENABLED ?? "true").toLowerCase() !== "false";

function chatApiUrl(): string {
  const raw = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").trim().replace(/\/+$/, "");
  if (raw.endsWith("/api/v1")) return `${raw}/chat`;
  if (raw.endsWith("/api")) return `${raw}/v1/chat`;
  return `${raw}/api/v1/chat`;
}

function trimTurns(turns: ChatTurn[]): ChatTurn[] {
  const system = turns[0]?.role === "system" ? [turns[0]] : [];
  const rest = turns.filter((t) => t.role !== "system").slice(-MAX_HISTORY);
  return [...system, ...rest]
    .filter((t) => t.content && t.content.trim())
    .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_CONTENT) }));
}

export async function sendAiChat(turns: ChatTurn[]): Promise<AiChatResult> {
  if (!CHAT_BACKEND_ENABLED) return { ok: false, reason: "disabled" };

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    console.warn("[aiChat] No Supabase session; skipping backend chat.");
    return { ok: false, reason: "unauthenticated" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(chatApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: trimTurns(turns) }),
      signal: controller.signal,
    });
    if (res.status === 401) {
      console.warn("[aiChat] Backend returned 401 (token missing/invalid).");
      return { ok: false, reason: "unauthenticated" };
    }
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      const detail = body?.detail;
      const message = typeof detail === "string" ? detail : detail?.message;
      return { ok: false, reason: "rate_limited", message };
    }
    if (!res.ok) {
      console.warn(`[aiChat] Backend chat failed with HTTP ${res.status}.`);
      return { ok: false, reason: "unavailable" };
    }
    const json = await res.json();
    const content = typeof json?.content === "string" ? json.content : "";
    if (!content) return { ok: false, reason: "unavailable" };
    return { ok: true, content, remainingToday: typeof json.remaining_today === "number" ? json.remaining_today : null };
  } catch (err) {
    console.warn("[aiChat] Backend chat request failed or timed out.", err);
    return { ok: false, reason: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
