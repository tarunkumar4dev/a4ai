// Activity timeline of one assistant turn, built from thinking_status tool.* / status.* events (chatState.applyStep).
// Each step: the tool's own icon, label, then a spinner (running) / duration / failed / stopped on the right.
// Running: open list. Done: collapses to "3 steps · 4.2s" (click to expand). Rows have a fixed height, so the
// answer below never jumps while steps arrive. Not a live region — the single aria-live status line is in the panel.
import { useState } from "react";
import {
  AlertTriangle, BarChart3, BookOpen, CalendarCheck, ChevronRight, FileDown, FileText, GraduationCap, LayoutList, Loader2,
  Lock, MinusCircle, PenLine, RefreshCw, Save, Search, Send, ShieldCheck, Sparkles, TrendingUp, Users, Wrench, XCircle,
  type LucideIcon,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { fmtMs, stepLabel, stepsSummary, type ChatTurn, type Step } from "@/lib/agent/chatState";

const STEP_ICON: Record<string, LucideIcon> = {
  "tool.resolve_entity": Search,
  "tool.attendance_stats": CalendarCheck,
  "tool.low_attendance_list": AlertTriangle,
  "tool.attendance_trend": TrendingUp,
  "tool.marks_stats": GraduationCap,
  "tool.tests_created_by_teacher": FileText,
  "tool.blueprint_defaults": LayoutList,
  "tool.generate_questions": PenLine,
  "tool.verify_paper": ShieldCheck,
  "tool.regenerate_failed": RefreshCw,
  "tool.save_draft": Save,
  "tool.finalize_test": Lock,
  "tool.assign_to_section": Send,
  "tool.export_pdf": FileDown,
  "tool.my_scope": Users,
  "tool.section_comparison": BarChart3,
  "status.retrieving_ncert": BookOpen,
  "status.generating": PenLine,
  "status.verifying": ShieldCheck,
  "status.regenerating": RefreshCw,
  "status.thinking": Sparkles,
};

/** Icon for a step key (exported for tests). Unknown tools get a wrench. */
export const stepIcon = (key: string): LucideIcon => STEP_ICON[key] ?? Wrench;

function StepRow({ s }: { s: Step }) {
  const Icon = stepIcon(s.key);
  const state = s.status === "running" ? "chal raha hai" : s.status === "failed" ? "fail hua" : s.status === "stopped" ? "ruk gaya" : "ho gaya";
  return (
    <li className="flex h-6 items-center gap-2" data-status={s.status} data-step={s.key}>
      <Icon aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 ${s.status === "running" ? "text-primary" : s.status === "failed" ? "text-destructive dark:text-red-400" : "text-muted-foreground"}`} />
      <span className={`min-w-0 truncate ${s.status === "running" ? "text-foreground" : "text-muted-foreground"}`}>{stepLabel(s.key, s.params)}</span>
      <span className="sr-only">({state})</span>
      <span className="ml-auto flex shrink-0 items-center gap-1 pl-2 tabular-nums text-muted-foreground/90">
        {s.status === "running" ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin text-primary" />
          : s.status === "failed" ? <><XCircle aria-hidden="true" className="h-3.5 w-3.5 text-destructive dark:text-red-400" />{fmtMs(s.ms)}</>
          : s.status === "stopped" ? <><MinusCircle aria-hidden="true" className="h-3.5 w-3.5" />ruka</>
          : fmtMs(s.ms)}
      </span>
    </li>
  );
}

export function StepTimeline({ turn }: { turn: ChatTurn }) {
  const steps = turn.steps ?? [];
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;
  const list = <ol className="border-l border-border pl-3 text-xs">{steps.map((s) => <StepRow key={s.id} s={s} />)}</ol>;

  if (!turn.done) return <div className="max-w-md" data-testid="steps">{list}</div>;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="max-w-md" data-testid="steps">
      <CollapsibleTrigger className="-ml-1.5 inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronRight aria-hidden="true" className={`h-3.5 w-3.5 ${open ? "rotate-90" : ""}`} />
        {stepsSummary(turn)}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1">{list}</CollapsibleContent>
    </Collapsible>
  );
}
