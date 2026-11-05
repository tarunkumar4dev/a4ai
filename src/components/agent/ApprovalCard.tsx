import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { approve, getAgentToken, type ApproveResult } from "@/lib/agent/client";
import type { PendingApproval } from "@/lib/agent/events";

const fmtExpiry = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
};

export function ApprovalCard({ ev, sessionId }: { ev: PendingApproval; sessionId: string | null }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [result, setResult] = useState<ApproveResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const expired = new Date(ev.expires_at).getTime() < Date.now();

  const onApprove = async () => {
    if (!sessionId) { setErr("Session not ready yet — wait for the reply to finish."); setState("error"); return; }
    setState("busy"); setErr(null);
    try {
      const token = await getAgentToken();
      if (!token) throw new Error("Please sign in again.");
      const r = await approve({ sessionId, approvalId: ev.approval_id, token });
      setResult(r); setState("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Approval failed."); setState("error");
    }
  };

  const downloadUrl = typeof result?.download_url === "string" ? result.download_url
    : typeof result?.url === "string" ? result.url : null;
  const safeUrl = downloadUrl && /^https:\/\//i.test(downloadUrl) ? downloadUrl : null;

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <p className="text-xs font-medium uppercase text-muted-foreground">
          {ev.action === "finalize_test" ? "Finalize test" : "Assign to section"} · needs your approval
        </p>
        <p className="break-words text-sm">{ev.summary}</p>
        <p className="text-xs text-muted-foreground">Expires {fmtExpiry(ev.expires_at)}</p>
        {state === "done" ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-green-700">Approved ✓</p>
            {safeUrl ? (
              <Button asChild size="sm"><a href={safeUrl} target="_blank" rel="noopener noreferrer">Download</a></Button>
            ) : null}
          </div>
        ) : (
          <Button type="button" size="sm" disabled={state === "busy" || expired} onClick={onApprove}>
            {expired ? "Expired" : state === "busy" ? "Approving…" : "Approve"}
          </Button>
        )}
        {err ? <p className="text-sm text-red-600" role="alert">{err}</p> : null}
      </CardContent>
    </Card>
  );
}
