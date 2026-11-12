// "Open this feature": the typed route registry (src/lib/agent/routeRegistry.json — a byte-identical copy of
// RAG-BACKEND/agent/routes/registry.json, refreshed with `npm run agent:routes`). A `ui_action navigate` event names a
// registry KEY; this file turns it into a URL. Keys not in the registry, params that don't match their type, and
// pages the caller's role may not open are ignored — the backend never sends URLs and the frontend never builds one
// from free text.
import registry from "@/lib/agent/routeRegistry.json";
import type { StaffRole } from "@/components/agent/roles";

export interface RouteParam { type: string; in: "query" | "path"; name: string; required: boolean }
export interface RouteEntry {
  path: string; query: Record<string, string>; roles: StaffRole[]; params: Record<string, RouteParam>;
  deep_link: boolean; label: { hi: string; en: string }; aliases: string[];
}
export interface Registry { version: number; param_types: Record<string, string>; routes: Record<string, RouteEntry> }

export const ROUTES: Registry = registry as unknown as Registry;

export const routeKeys = (): string[] => Object.keys(ROUTES.routes);

/** Build the URL for a registry key, or null when the key / role / params are not acceptable. Pure. */
export function resolveRoute(key: string, params: Record<string, string> | null | undefined, role: StaffRole | null | undefined):
  { to: string; label: { hi: string; en: string }; deepLink: boolean } | null {
  const r = ROUTES.routes[key];
  if (!r || !role || !r.roles.includes(role)) return null;
  let path = r.path;
  const q = new URLSearchParams(r.query);
  for (const [pname, p] of Object.entries(r.params)) {
    const raw = params?.[pname];
    const v = typeof raw === "string" ? raw.trim() : "";
    if (!v) { if (p.required) return null; continue; }
    const pat = ROUTES.param_types[p.type];
    if (!pat || v.length > 80 || !new RegExp(pat).test(v)) return null;
    if (p.in === "path") path = path.replace(`:${p.name}`, encodeURIComponent(v));
    else q.set(p.name, v);
  }
  if (/:\w+/.test(path)) return null; // a path param left unfilled
  const qs = q.toString();
  return { to: qs ? `${path}?${qs}` : path, label: r.label, deepLink: r.deep_link };
}

/** Routes whose tab / item cannot be deep-linked today (the page opens, the tab must be tapped). */
export const shallowRoutes = (): string[] => Object.entries(ROUTES.routes).filter(([, r]) => !r.deep_link).map(([k]) => k);
