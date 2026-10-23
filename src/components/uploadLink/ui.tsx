// src/components/uploadLink/ui.tsx — small shared pieces of the student upload-link page (mobile-first).

import type { ReactNode } from "react";
import { WifiOff } from "lucide-react";
import { fmtLeft } from "@/lib/uploadLink/time";
import { useCountdown, useOnline } from "@/hooks/useUploadLinkTimers";
import type { StudentBadge, TeacherBadge } from "@/lib/uploadLink/status";

const TONE: Record<string, string> = {
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  green: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  violet: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
};

export function ToneChip({ badge, className = "" }: { badge: StudentBadge | TeacherBadge; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[badge.tone]} ${className}`}>
      {badge.label}
    </span>
  );
}

export function Chip({ tone, children }: { tone: keyof typeof TONE; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[tone]}`}>{children}</span>;
}

export function Countdown({ until, prefix, onDone }: { until: number; prefix: string; onDone?: () => void }) {
  const left = useCountdown(until, onDone);
  return <span data-testid="countdown">{prefix} {fmtLeft(left)}</span>;
}

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-sm font-semibold text-white">
      <WifiOff className="h-4 w-4" /> No internet — upload paused
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-hidden />;
}
