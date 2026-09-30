// src/lib/supabasePortalClient.ts
// Client for the student portal (/student) ONLY.
// It never stores or reads a staff session: every request goes out as `anon`, even if a teacher/admin
// is logged in in the same browser (B2). The portal talks to the DB only through the access-code RPCs
// in supabase/migrations/05_student_portal.sql (get_student_by_code, get_student_feed, submit_assignment).
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const portalSupabase = createClient(
  SUPABASE_URL || "https://example.supabase.co",
  SUPABASE_ANON_KEY || "public-anon-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "a4ai.portal.auth", // separate from the staff key "a4ai.auth.token"
    },
    global: {
      headers: { "x-client-info": "a4ai-student-portal" },
    },
  },
);
