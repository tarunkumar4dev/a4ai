// First screen of a new chat: a4ai logo, greeting with the first name, scope pill, and 3–4 role example chips.
import { Users } from "lucide-react";
import type { Suggestion } from "./roles";

export function AgentEmptyState({ firstName, suggestions, disabled, onPick, compact, scopeLine }: {
  firstName: string | null; suggestions: Suggestion[]; disabled?: boolean; onPick: (prompt: string) => void; compact?: boolean;
  /** "2 batches · 44 students" */ scopeLine?: string | null;
}) {
  return (
    <div className={`mx-auto flex w-full max-w-2xl flex-col ${compact ? "pt-4" : "pt-6 sm:pt-12"}`} data-testid="agent-empty">
      <img src="/ICON.ico" alt="a4ai" className="h-10 w-10 rounded-lg object-contain dark:bg-white dark:p-1" />
      <h3 className={`mt-4 font-semibold tracking-tight text-foreground ${compact ? "text-xl" : "text-2xl sm:text-[28px]"}`}>
        Namaste{firstName ? `, ${firstName}` : ""}
      </h3>
      <p className="mt-1 text-[15px] text-muted-foreground">Attendance, marks ya naya test — seedha poochiye. Jawab aapke institute ke data se aata hai.</p>
      {scopeLine ? (
        <p className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground" data-testid="scope-summary">
          <Users aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />Aapke paas: {scopeLine}
        </p>
      ) : null}
      <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        {suggestions.map(({ Icon, title, hint, prompt }) => (
          <button key={title} type="button" disabled={disabled} onClick={() => onPick(prompt)}
            className="group flex min-h-[64px] items-start gap-3 rounded-lg border border-border bg-card p-3.5 text-left text-card-foreground hover:border-primary/50 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Icon aria-hidden="true" className="h-4 w-4" /></span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{title}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
