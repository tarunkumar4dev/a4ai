// Chat header: title, role badge, data-source pill (GET /agent/meta), New chat. `leading` / `trailing` slots hold
// the history button (phones) and the sheet's close button.
import type { ReactNode } from "react";
import { SquarePen } from "lucide-react";
import type { AgentMeta } from "@/lib/agent/events";
import type { MetaStatus } from "@/lib/agent/store";
import { AgentMark } from "./AgentMessage";

/** Pill text + tone. emerald / amber are the documented exception to "tokens only" (no success/warning tokens). */
export function dataSourcePill(meta: AgentMeta | null, status: MetaStatus): { label: string; tone: "live" | "demo" | "unknown"; title: string } {
  if (status === "ok" && meta?.data_source === "live") {
    return { label: meta.read_only ? "Live · read-only" : "Live", tone: "live", title: "Aapke institute ka asli data. Agent kuch bhi badal nahi sakta." };
  }
  if (status === "ok" && meta?.data_source === "demo") return { label: "Demo data", tone: "demo", title: "Ye sample data hai, asli institute ka nahi." };
  return { label: "Connecting…", tone: "unknown", title: status === "error" ? "Agent se connect nahi ho paya. Message bhejne par dobara try hoga." : "Agent se connect ho raha hai" };
}

const TONE = {
  live: "border-emerald-600/25 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-950/50 dark:text-emerald-300",
  demo: "border-amber-600/25 bg-amber-50 text-amber-900 dark:border-amber-400/25 dark:bg-amber-950/50 dark:text-amber-300",
  unknown: "border-border bg-muted text-muted-foreground",
} as const;
const DOT = { live: "bg-emerald-600 dark:bg-emerald-400", demo: "bg-amber-500 dark:bg-amber-400", unknown: "bg-muted-foreground/60" } as const;

export function DataSourcePill({ meta, status }: { meta: AgentMeta | null; status: MetaStatus }) {
  const p = dataSourcePill(meta, status);
  return (
    <span title={p.title} data-testid="data-source" data-tone={p.tone}
      className={`inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-[11px] font-medium ${TONE[p.tone]}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${DOT[p.tone]}`} />{p.label}
    </span>
  );
}

export function AgentHeader({ meta, metaStatus, role, onNewChat, canNew, leading, trailing, compact, newChatInSidebar }: {
  meta: AgentMeta | null; metaStatus: MetaStatus; role: string; onNewChat: () => void; canNew: boolean;
  leading?: ReactNode; trailing?: ReactNode; compact?: boolean;
  /** the workspace sidebar (lg+) already has a New chat button */ newChatInSidebar?: boolean;
}) {
  return (
    <header className={`flex items-center gap-2 border-b border-border bg-background/95 ${compact ? "px-3 py-2" : "px-3 py-2.5 sm:px-5"}`}>
      {leading}
      <AgentMark className="hidden sm:grid" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-[15px] font-semibold leading-tight text-foreground">a4ai Agent</h2>
          <span data-testid="role-badge" className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground">{role}</span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          <DataSourcePill meta={meta} status={metaStatus} />
          {meta?.institute_name ? <span className="hidden truncate text-xs text-muted-foreground sm:inline">{meta.institute_name}</span> : null}
        </div>
      </div>
      <button type="button" onClick={onNewChat} disabled={!canNew}
        className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 ${newChatInSidebar ? "lg:hidden" : ""}`}>
        <SquarePen aria-hidden="true" className="h-4 w-4" /><span className={compact ? "sr-only" : "hidden sm:inline"}>New chat</span>
        {compact ? null : <span className="sr-only sm:hidden">New chat</span>}
      </button>
      {trailing}
    </header>
  );
}
