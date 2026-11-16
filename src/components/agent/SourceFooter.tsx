import { Database } from "lucide-react";
import { asOfLabel, sourceLabel } from "./format";

/** "Source: Attendance stats · as of 5 Nov, 1:13 pm IST" — every number says where it came from. */
export function SourceFooter({ source, asOf, className = "" }: { source: string; asOf: string; className?: string }) {
  return (
    <p className={`flex items-center gap-1.5 text-[11px] leading-4 text-muted-foreground ${className}`}>
      <Database aria-hidden="true" className="h-3 w-3 shrink-0" />
      <span className="min-w-0 truncate">Source: {sourceLabel(source)} · as of {asOfLabel(asOf)}</span>
    </p>
  );
}
