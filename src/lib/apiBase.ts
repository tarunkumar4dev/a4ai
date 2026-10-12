// One place that turns the backend env URL into the FastAPI "/api" base.
// Vercel has had both shapes over time — VITE_BACKEND_URL without "/api" broke every
// "${VITE_BACKEND_URL}/v1/..." call (404) — so accept any of:
//   https://host   https://host/   https://host/api   https://host/api/   https://host/api/v1
// and always return "https://host/api" (never "/api/api").
// Source: VITE_BACKEND_URL, else VITE_API_URL (both point at the same backend), else local dev.

function devFallback(): string {
  // dev on a phone over LAN: the backend runs on the same machine as the Vite server
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") return `http://${hostname}:8000`;
  }
  return "http://localhost:8000";
}

export function getBackendApiBase(): string {
  const raw = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || devFallback()) as string;
  let base = raw.trim().replace(/\/+$/, "");
  if (base.endsWith("/api/v1")) base = base.slice(0, -"/v1".length);
  if (!base.endsWith("/api")) base = `${base}/api`;
  return base;
}

/** Full URL for a backend path. Accepts "/api/v1/x", "/v1/x" or "v1/x" — the "/api" prefix is added once. */
export function backendUrl(path: string): string {
  let p = path.startsWith("/") ? path : `/${path}`;
  if (p === "/api" || p.startsWith("/api/")) p = p.slice("/api".length);
  return `${getBackendApiBase()}${p}`;
}
