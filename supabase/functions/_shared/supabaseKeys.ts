// supabase/functions/_shared/supabaseKeys.ts — server-side Supabase key for Edge Functions.
//
// Supabase injects both key styles into every Edge Function:
//   SUPABASE_SECRET_KEYS       new sb_secret_… keys (JSON: { "<key name>": "sb_secret_…" }, "default" first)
//   SUPABASE_SERVICE_ROLE_KEY  legacy service_role JWT — stops working once legacy API keys are disabled
// Use the new key when present, else the legacy one, so the functions keep working before AND after the switch.

function fromSecretKeys(raw: string | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (trimmed.startsWith("sb_secret_")) return trimmed; // plain value
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      const values = Object.values(parsed as Record<string, unknown>).filter((v): v is string => typeof v === "string");
      return (typeof (parsed as Record<string, unknown>).default === "string"
        ? (parsed as Record<string, string>).default
        : values[0]) || "";
    }
  } catch {
    /* not JSON */
  }
  return "";
}

/** Secret (service-role level) key: sb_secret_… if available, otherwise the legacy service_role JWT. */
export function supabaseSecretKey(): string {
  return fromSecretKeys(Deno.env.get("SUPABASE_SECRET_KEYS")) || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
