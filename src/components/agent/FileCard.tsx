// `file` event (NOT in contract 1.2 yet) → a download card: name, rows, size, expiry. Download = GET
// /agent/files/{file_id} with the user's token (never a public URL). After expires_at, or on 404 / 410, it says
// "expired" and offers to ask again.
import { Download, FileSpreadsheet, Loader2, RotateCcw, TimerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Block } from "@/lib/agent/chatState";
import { asOfLabel } from "./format";

type FileBlock = Extract<Block, { kind: "file" }>;

const size = (n: number | null | undefined) => (typeof n === "number" && n > 0 ? (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`) : null);

/** "6 rows · 8 KB · expires 9 Nov, 10:12 pm IST". Pure. */
export function fileMeta(ev: FileBlock["ev"]): string {
  return [
    typeof ev.rows === "number" ? `${ev.rows} row${ev.rows === 1 ? "" : "s"}` : null,
    size(ev.size_bytes),
    ev.expires_at ? `expires ${asOfLabel(ev.expires_at)}` : null,
  ].filter(Boolean).join(" · ");
}

export function FileCard({ block, onDownload, onAskAgain, busy }: { block: FileBlock; onDownload: () => void; onAskAgain: () => void; busy?: boolean }) {
  const { ev, state, error } = block;
  const expired = state === "expired";
  return (
    <section className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card p-3.5 text-card-foreground" data-testid="file-card" data-state={state}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${expired ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
        {expired ? <TimerOff aria-hidden="true" className="h-5 w-5" /> : <FileSpreadsheet aria-hidden="true" className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground" title={ev.name}>{ev.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {expired ? "Link expire ho gaya — dobara poochiye, nayi file milegi." : state === "failed" ? error ?? "Download nahi ho paya." : fileMeta(ev) || "Download ke liye tayyar"}
        </p>
      </div>
      {expired ? (
        <Button type="button" variant="outline" className="h-11 shrink-0" disabled={busy} onClick={onAskAgain}>
          <RotateCcw aria-hidden="true" />Dobara banao
        </Button>
      ) : (
        <Button type="button" className="h-11 shrink-0" disabled={state === "downloading"} onClick={onDownload} aria-label={`Download ${ev.name}`}>
          {state === "downloading" ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Download aria-hidden="true" />}
          <span className="hidden sm:inline">{state === "done" ? "Phir se" : "Download"}</span>
        </Button>
      )}
    </section>
  );
}
