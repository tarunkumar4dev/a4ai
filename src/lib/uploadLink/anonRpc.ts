// src/lib/uploadLink/anonRpc.ts — a Supabase RPC call as anon with plain fetch (PostgREST /rest/v1/rpc/<name>).
// The student upload link only needs a handful of anon RPCs; this keeps supabase-js (auth, realtime, storage
// clients) out of its first load. Same project URL + anon key as src/lib/supabasePortalClient.ts.

const URL_BASE = (import.meta.env.VITE_SUPABASE_URL || "https://example.supabase.co").replace(/\/+$/, "");
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "public-anon-key";

/** status 0 = no response (offline / blocked); code = the Postgres / PostgREST error code (e.g. 23514, PGRST202). */
export class RpcError extends Error {
  constructor(message: string, public status: number, public code: string | null = null) { super(message); }
}

export async function anonRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${URL_BASE}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json",
        "x-client-info": "a4ai-student-link",
      },
      body: JSON.stringify(args),
    });
  } catch {
    throw new RpcError("network", 0);
  }
  const text = await res.text();
  if (!res.ok) {
    let code: string | null = null;
    try { code = (JSON.parse(text) as { code?: unknown }).code?.toString() || null; } catch { /* not JSON */ }
    throw new RpcError(text.slice(0, 300) || `HTTP ${res.status}`, res.status, code);
  }
  return (text ? JSON.parse(text) : null) as T;
}
