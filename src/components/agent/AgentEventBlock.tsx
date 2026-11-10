// Event block → component. Theme tokens only (light + dark). All actions are real <button>s.
// Assistant prose goes through AgentMarkdown (no raw HTML); paper text through AgentMath (KaTeX trust:false + DOMPurify).
import { useEffect, useState } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Block } from "@/lib/agent/chatState";
import { AgentMarkdown } from "./AgentMarkdown";
import { ApprovalCard, EDIT_PREFILL } from "./ApprovalCard";
import { BlueprintCard } from "./BlueprintCard";
import { ClarifyChips } from "./ClarifyChips";
import { DataTable } from "./DataTable";
import type { PaperContext } from "./PaperPreview";
import { LazyChart, LazyPaper } from "./lazyBlocks";
import { FileCard } from "./FileCard";
import { RankingTable } from "./RankingTable";
import { ScopeCard } from "./ScopeCard";
import { StatCard } from "./StatCard";
import { VerificationBadge } from "./VerificationBadge";

export interface BlockHandlers {
  busy: boolean;
  onAnswer: (blockId: string, value: string) => void;
  onApprove: (blockId: string) => void;
  onCancel: (blockId: string) => void;
  onRetry: (text: string) => void;
  onDownload: (blockId: string) => void;
  /** send a chat message (Blueprint "Looks good", paper question actions) */
  onSend?: (text: string) => void;
  /** put text into the composer without sending (approval Edit, "Change marks") */
  onPrefill?: (text: string) => void;
  /** `file` card download (GET /agent/files/{id}) */
  onDownloadFile?: (blockId: string) => void;
}

/** What a block knows about the rest of the chat (paper header from the blueprint, failed ids from the paper). */
export interface BlockContext { paper?: PaperContext; failedIds?: string[] }

const ERROR_TITLE: Record<string, string> = {
  budget_exceeded: "Aaj ki limit khatam",
  forbidden: "Access nahi hai",
  not_found: "Nahi mila",
  invalid_input: "Request samajh nahi aayi",
  provider_error: "AI service busy hai",
  internal: "Kuch gadbad ho gayi",
  unauthorized: "Sign in chahiye",
  rate_limited: "Thoda rukiye",
  network: "Connection nahi bana",
  unavailable: "Agent abhi available nahi",
  server: "Server me dikkat",
  offline: "Aap offline hain",
  expired: "Approval expire ho gaya",
};

/** Seconds left until `retryAt` (0 when free to retry), ticking once a second. */
function useCountdown(retryAt: number | null | undefined): number {
  const left = () => (retryAt ? Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)) : 0);
  const [s, setS] = useState(left);
  useEffect(() => {
    setS(left());
    if (!retryAt || retryAt <= Date.now()) return;
    const id = setInterval(() => { const v = left(); setS(v); if (!v) clearInterval(id); }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryAt]);
  return s;
}

export function ErrorCard({ code, message, retryText, busy, onRetry, retryAt }: {
  code: string; message: string; retryText: string | null; busy?: boolean; onRetry: (text: string) => void;
  /** 429: Retry is disabled until then (ms since epoch) */ retryAt?: number | null;
}) {
  const wait = useCountdown(retryAt);
  return (
    <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm" data-testid="agent-error">
      <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive dark:text-red-400" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{ERROR_TITLE[code] ?? "Jawab nahi aa paya"}</p>
        <p className="mt-0.5 break-words text-muted-foreground">{message}</p>
        {retryText ? (
          <Button type="button" variant="outline" className="mt-3 h-11" disabled={busy || wait > 0} onClick={() => onRetry(retryText)}>
            <RotateCcw aria-hidden="true" />{wait > 0 ? `Retry (${wait}s)` : "Retry"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function AgentEventBlock({ block, h, ctx }: { block: Block; h: BlockHandlers; ctx?: BlockContext }) {
  const send = h.onSend ?? h.onRetry;
  const prefill = h.onPrefill ?? (() => {});
  switch (block.kind) {
    case "text":
      return <AgentMarkdown text={block.text} />;
    case "stat_card":
      return <StatCard ev={block.ev} />;
    case "table":
      // the backend sends my_scope and section_comparison as tables; they get their own views
      if (block.ev.source === "tool:my_scope") return <ScopeCard ev={block.ev} disabled={h.busy} onSend={send} onPrefill={prefill} />;
      if (block.ev.source === "tool:section_comparison" && block.ev.columns[0] === "#") return <RankingTable ev={block.ev} disabled={h.busy} onSend={send} />;
      return <DataTable ev={block.ev} />;
    case "chart":
      return <LazyChart ev={block.ev} />;
    case "clarify":
      return <ClarifyChips ev={block.ev} answered={block.answered} disabled={h.busy} onPick={(v) => h.onAnswer(block.id, v)} />;
    case "blueprint":
      return <BlueprintCard ev={block.ev} disabled={h.busy} onConfirm={send} />;
    case "paper_preview":
      return <LazyPaper ev={block.ev} ctx={ctx?.paper} disabled={h.busy} onSend={send} onPrefill={prefill} />;
    case "verification":
      return <VerificationBadge ev={block.ev} failedIds={ctx?.failedIds} />;
    case "approval":
      return (
        <ApprovalCard block={block} busy={h.busy} onApprove={() => h.onApprove(block.id)} onCancel={() => h.onCancel(block.id)}
          onEdit={() => prefill(EDIT_PREFILL)} onDownload={() => h.onDownload(block.id)} />
      );
    case "file":
      return <FileCard block={block} busy={h.busy} onDownload={() => h.onDownloadFile?.(block.id)} onAskAgain={() => send(`${block.ev.name} dobara banao`)} />;
    case "error":
      return <ErrorCard code={block.code} message={block.message} retryText={block.retryText} busy={h.busy} onRetry={h.onRetry} retryAt={block.retryAt} />;
    default: {
      const unhandled: never = block;
      return unhandled;
    }
  }
}
