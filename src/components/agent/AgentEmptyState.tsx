// First screen of a new chat: the agent avatar, greeting (first name), what it can do, a "{Role} · {scope}" chip and
// FOUR starter cards — the only suggestion surface on an empty box. A card that needs a batch the user does not have
// stays visible but disabled (still focusable, so the reason is read out); the chip then explains what to do.
import { Info, Lock, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { htmlLang, useAgentT } from "@/lib/agent/i18n";
import { AgentMark } from "./AgentMessage";
import type { Suggestion } from "./roles";

export function AgentEmptyState({ firstName, suggestions, disabled, onPick, compact, role, scopeLine, noBatch, hideCards, connecting }: {
  firstName: string | null; suggestions: Suggestion[]; disabled?: boolean; onPick: (prompt: string) => void; compact?: boolean;
  /** "Teacher" */ role: string;
  /** "3 batch · 44 students" */ scopeLine?: string | null;
  /** the user has no batch yet: explain it next to the chip */ noBatch?: boolean;
  /** GET /agent/meta still on its way: the scope chip is a skeleton (not a "Connecting…" pill) */ connecting?: boolean;
  /** the typeahead is open (2+ characters typed): cards step aside so the two never overlap */ hideCards?: boolean;
}) {
  const { t, lang } = useAgentT();
  return (
    <div className={`mx-auto flex w-full max-w-2xl flex-col ${compact ? "pt-2" : "pt-6 sm:pt-12"}`} data-testid="agent-empty">
      <AgentMark className="h-10 w-10 rounded-xl [&>svg]:h-5 [&>svg]:w-5" />
      <h3 className={`mt-4 font-semibold text-foreground ${compact ? "text-xl" : "text-2xl sm:text-[28px]"}`} data-testid="agent-greeting">
        {firstName ? t("greeting", { name: firstName }) : t("greeting.noName")}
      </h3>
      <p className="agent-prose mt-1 text-[15px] text-muted-foreground">{t("subtitle")}</p>
      {connecting && !scopeLine ? <span aria-hidden="true" className="mt-3 block h-8 w-44 rounded-full bg-muted motion-safe:animate-pulse" data-testid="scope-skeleton" /> : null}
      {scopeLine ? (
        <div className="mt-3 flex items-center gap-1">
          <p className={`inline-flex min-h-8 w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium ${noBatch ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200" : "border-border bg-muted text-foreground"}`} data-testid="scope-summary">
            <Users aria-hidden="true" className="h-3.5 w-3.5 shrink-0 opacity-70" />{role} · {scopeLine}
          </p>
          {noBatch ? (
            <Popover>
              <PopoverTrigger aria-label={t("scope.help")} data-testid="scope-help"
                className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Info aria-hidden="true" className="h-4 w-4" />
              </PopoverTrigger>
              <PopoverContent align="start" lang={htmlLang(lang)} data-agent-root="" className="agent-prose z-[240] w-[min(20rem,calc(100vw-2rem))] p-3 text-sm" data-testid="scope-help-text">{t("scope.noneHelp")}</PopoverContent>
            </Popover>
          ) : null}
        </div>
      ) : null}
      <div className={`mt-6 grid grid-cols-2 gap-2 sm:gap-3 ${hideCards ? "invisible" : ""}`} aria-hidden={hideCards || undefined}>
        {suggestions.map(({ id, Icon, title, hint, prompt, disabledReason }) => {
          const blocked = !!disabledReason;
          return (
            <button key={id} type="button" disabled={disabled && !blocked} aria-disabled={blocked || undefined}
              aria-describedby={blocked ? `starter-${id}-why` : undefined}
              onClick={() => { if (!blocked) onPick(prompt); }} data-testid="starter-card" data-blocked={blocked || undefined}
              className={`group flex min-h-[96px] flex-col items-start gap-2 rounded-2xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${blocked
                ? "cursor-not-allowed border-dashed border-border bg-muted/40 text-muted-foreground"
                : "border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent/60"}`}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${blocked ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                {blocked ? <Lock aria-hidden="true" className="h-4 w-4" /> : <Icon aria-hidden="true" className="h-4 w-4" />}
              </span>
              <span className="min-w-0">
                <span className={`agent-prose block text-sm font-medium ${blocked ? "text-muted-foreground" : "text-foreground"}`}>{title}</span>
                <span id={blocked ? `starter-${id}-why` : undefined} className="agent-prose mt-0.5 block text-xs text-muted-foreground">{blocked ? disabledReason : hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
