// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types"; // keep or inline (see below)

// Read env (Vite injects under import.meta.env)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: "pkce",
    autoRefreshToken: true,
    persistSession: true,
    // You said you handle /auth/callback manually → keep this false
    detectSessionInUrl: false,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

/** Always use the current origin for the OAuth redirect (works for localhost and prod) added 10 september*/
export function getAuthRedirectURL() {
  return `${window.location.origin}/auth/callback`;
}