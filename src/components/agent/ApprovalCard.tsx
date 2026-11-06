// pending_approval → what will happen, that it can't be undone, and three choices:
// Approve (the ONLY caller of /agent/approve), Edit (puts a message in the composer), Cancel (local only — the
// server request just expires). Download PDF appears only after a successful approve with the agent's own PDF path.
import { CheckCircle2, Clock, Download, Loader2, Pencil, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Block } from "@/lib/agent/chatState";
import { isAgentPdfPath } from "@/lib/agent/client";
import { asOfLabel } from "./format";

type ApprovalBlock = Extract<Block, { kind: "approval" }>;

const ACTION_LABEL: Record<string, { title: string; effect: string }> = {
  finalize_test: { title: "Test final karna hai", effect: "Paper lock ho jayega aur Test History me save hoga." },
  assign_to_section: { title: "Section ko assign karna hai", effect: "Students ko ye test dikhne lagega." },
};

export const EDIT_PREFILL = "Approve se pehle ye badlo: ";

export function ApprovalCard({ block, busy, onApprove, onCancel, onEdit, onDownload }: {
  block: ApprovalBlock; busy?: boolean;
  onApprove: () => void; onCancel: () => void; onEdit: () => void; onDownload: () => void;
}) {
  const { ev, state, result, error } = block;
  const label = ACTION_LABEL[ev.action] ?? { title: "Approval chahiye", effect: "" };
  const canDownload = state === "approved" && isAgentPdfPath(result?.download_path);
  const open = state === "pending" || state === "failed" || state === "approving";
  const expired = Number.isFinite(Date.parse(ev.expires_at)) && Date.parse(ev.expires_at) < Date.now();

  return (
    <section className={`min-w-0 rounded-lg border bg-card p-4 text-card-foreground ${open ? "border-primary/50" : "border-border"}`} data-testid="approval">
      <div className="flex items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${state === "approved" ? "bg-primary/10 text-primary" : "bg-muted text-foreground"}`}>
          {state === "approved" ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <ShieldAlert aria-hidden="true" className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Aapki approval chahiye</p>
          <h4 className="mt-0.5 text-sm font-semibold">{label.title}</h4>
          <p className="mt-1 break-words text-sm text-foreground">{ev.summary}</p>
          {open ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {label.effect} <strong className="font-medium text-foreground">Approve ke baad wapas nahi hoga.</strong> Approve tak kuch nahi badlega.
            </p>
          ) : null}
          {open ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock aria-hidden="true" className="h-3.5 w-3.5" />{expired ? "Expire ho gaya" : `Expires ${asOfLabel(ev.expires_at)}`}
            </p>
          ) : null}
        </div>
      </div>

      {error ? <p role="alert" className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive dark:text-red-300">{error}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {open ? (
          <>
            <Button type="button" className="h-11" disabled={state === "approving" || expired} onClick={onApprove}>
              {state === "approving" ? <><Loader2 aria-hidden="true" className="animate-spin" />Approving…</> : state === "failed" ? "Approve again" : "Approve"}
            </Button>
            <Button type="button" variant="outline" className="h-11" disabled={state === "approving" || busy} onClick={onEdit}>
              <Pencil aria-hidden="true" />Edit
            </Button>
            <Button type="button" variant="ghost" className="h-11" disabled={state === "approving"} onClick={onCancel}>
              <X aria-hidden="true" />Cancel
            </Button>
          </>
        ) : null}
        {state === "approved" ? (
          <p className="text-sm font-medium">Approved{result?.replayed ? " (pehle hi ho chuka tha)" : ""}</p>
        ) : null}
        {canDownload ? (
          <Button type="button" variant="secondary" className="h-11" onClick={onDownload}><Download aria-hidden="true" />Download PDF</Button>
        ) : null}
        {state === "cancelled" ? (
          <p className="text-sm text-muted-foreground">Cancel kiya — kuch nahi badla. Request apne aap expire ho jayegi.</p>
        ) : null}
      </div>
    </section>
  );
}
