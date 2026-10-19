import { supabase } from "@/lib/supabaseClient";

/** Headers for FastAPI calls that need the signed-in user (the backend reads the Supabase JWT). */
export async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}
