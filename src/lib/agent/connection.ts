// Connection lifecycle of the agent panel (GET /agent/meta). Pure constants + helpers; the store runs them.
//   loading ──8 s──▶ slow (Retry shown) ── each attempt times out after META_TIMEOUT_MS
//   failure ──▶ reconnecting (backoff 2 s · 4 s · 8 s) ──▶ error ("Failed", Retry)      401 / 403 → error at once
//   ok → nothing on screen. Back online after an error → tried again.
export const META_SLOW_MS = 8_000;
export const META_TIMEOUT_MS = 25_000; // a free Render instance needs ~50 s to wake: two attempts cover it
export const META_RETRY_DELAYS_MS = [2_000, 4_000, 8_000] as const;

export type MetaStatus = "idle" | "loading" | "slow" | "reconnecting" | "ok" | "error";

/** delay before retry number attempt+1, or null = give up. Pure. */
export function nextRetryDelay(attempt: number): number | null {
  return attempt < META_RETRY_DELAYS_MS.length ? META_RETRY_DELAYS_MS[attempt] : null;
}

export type ConnectionView = "none" | "connecting" | "slow" | "reconnecting" | "offline" | "failed";
/** What the panel shows for a status. Pure. */
export function connectionView(status: MetaStatus, offline: boolean): ConnectionView {
  if (offline) return "offline";
  if (status === "loading" || status === "idle") return "connecting";
  if (status === "slow") return "slow";
  if (status === "reconnecting") return "reconnecting";
  if (status === "error") return "failed";
  return "none";
}
