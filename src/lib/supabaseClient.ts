// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

/** ---------------- Env (fail fast) ---------------- */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "[a4ai] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Check your .env and Vite env exposure."
  );
}

/** ---------------- Client (stable PKCE auth) ----------------
 * - persistSession: keeps the session in localStorage
 * - autoRefreshToken: refreshes tokens before expiry
 * - detectSessionInUrl: handles the PKCE callback fragment
 * - flowType: 'pkce' to avoid implicit flow issues
 * - storageKey: namespaced to avoid collisions
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
    storage: window.localStorage,
    storageKey: "a4ai.auth.token",
  },
  global: {
    headers: { "x-client-info": "a4ai-web" },
  },
});
