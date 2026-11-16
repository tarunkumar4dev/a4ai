// Agent backend base URL. The agent router lives at /agent/* (not under /api/v1), so it has its own env var.
// VITE_AGENT_URL may be given with or without a trailing slash or "/agent"; default = local uvicorn.
export const DEFAULT_AGENT_URL = "http://localhost:8000";

export function agentBaseUrl(raw: string | undefined = import.meta.env.VITE_AGENT_URL as string | undefined): string {
  const base = (raw ?? "").trim() || DEFAULT_AGENT_URL;
  return base.replace(/\/+$/, "").replace(/\/agent$/, "");
}

/** agentUrl("/agent/chat") -> "<base>/agent/chat" */
export function agentUrl(path: string, raw?: string): string {
  return `${agentBaseUrl(raw)}${path.startsWith("/") ? path : `/${path}`}`;
}
