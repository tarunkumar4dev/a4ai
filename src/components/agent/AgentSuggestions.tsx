// The suggestions popup of the agent input (ARIA combobox pattern: the textarea owns focus and points at the
// highlighted option with aria-activedescendant; this is the listbox). Opens upwards from the composer; on phones it
// is a full-width sheet above the keyboard with 44px rows. Mouse-down never steals focus from the input.
import { memo } from "react";
import { ArrowUpLeft, Clock, Sparkles, Trash2, Users, X } from "lucide-react";
import { highlightParts, type SuggestOption } from "@/lib/agent/suggest";

const ICON = { recent: Clock, entity: Users, template: Sparkles } as const;
const TYPE_LABEL = { recent: "Recent", entity: "Batch / student", template: "Try" } as const;

export const optionId = (listId: string, i: number) => `${listId}-opt-${i}`;

const Highlight = memo(function Highlight({ text, q }: { text: string; q: string }) {
  const parts = highlightParts(text, q);
  return (
    <>
      {parts.map((p, i) => (p.match
        ? <mark key={i} className="bg-transparent font-semibold text-foreground">{p.text}</mark>
        : <span key={i}>{p.text}</span>))}
    </>
  );
});

export function AgentSuggestions({ listId, options, active, query, onRun, onFill, onRemove, onHover, onClear, canClear, loading }: {
  listId: string; options: SuggestOption[]; active: number; query: string;
  onRun: (o: SuggestOption) => void; onFill: (o: SuggestOption) => void; onRemove: (o: SuggestOption) => void;
  onHover: (i: number) => void; onClear: () => void; canClear: boolean; loading?: boolean;
}) {
  const sections: { key: SuggestOption["section"]; label: string | null; items: { o: SuggestOption; i: number }[] }[] = [];
  options.forEach((o, i) => {
    const label = o.section === "recent" ? "Recent" : o.section === "try" ? "Try" : null;
    const last = sections[sections.length - 1];
    if (last && last.key === o.section) last.items.push({ o, i });
    else sections.push({ key: o.section, label, items: [{ o, i }] });
  });

  return (
    <div className="absolute inset-x-0 bottom-full z-30 mb-2 max-h-[min(55vh,420px)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover text-popover-foreground shadow-lg sm:left-0 sm:right-0"
      onMouseDown={(e) => e.preventDefault() /* keep focus (and the caret) in the input */}
      data-testid="agent-suggestions">
      <ul id={listId} role="listbox" aria-label="Suggestions" className="py-1.5">
        {sections.map((sec) => (
          <li key={sec.key} role="presentation">
            {sec.label ? (
              <p id={`${listId}-${sec.key}`} role="presentation" className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{sec.label}</p>
            ) : null}
            <ul role="group" aria-labelledby={sec.label ? `${listId}-${sec.key}` : undefined} aria-label={sec.label ? undefined : "Matches"}>
              {sec.items.map(({ o, i }) => {
                const Icon = ICON[o.type];
                const isActive = i === active;
                return (
                  <li key={o.key} id={optionId(listId, i)} role="option" aria-selected={isActive}
                    data-testid="suggestion" data-type={o.type}
                    onMouseMove={() => { if (!isActive) onHover(i); }}
                    onClick={() => onRun(o)}
                    className={`group/opt flex min-h-11 cursor-pointer items-center gap-3 px-3 text-sm ${isActive ? "bg-accent text-accent-foreground" : ""}`}>
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate py-2 text-foreground/80">
                      <Highlight text={o.text} q={query} />
                      <span className="sr-only">{`, ${TYPE_LABEL[o.type]}`}{o.hint ? `, ${o.hint}` : ""}</span>
                    </span>
                    {o.hint ? <span aria-hidden="true" className={`hidden max-w-[45%] shrink-0 truncate text-xs min-[400px]:inline ${isActive ? "text-accent-foreground/75" : "text-muted-foreground"}`}>{o.hint}</span> : null}
                    <button type="button" tabIndex={-1} aria-label={`Fill “${o.text}” without sending`} title="Box me bharo"
                      onClick={(e) => { e.stopPropagation(); onFill(o); }}
                      className="grid h-11 w-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground">
                      <ArrowUpLeft aria-hidden="true" className="h-4 w-4" />
                    </button>
                    {o.type === "recent" && o.historyId ? (
                      <button type="button" tabIndex={-1} aria-label={`Remove “${o.text}” from history`} title="History se hatao"
                        onClick={(e) => { e.stopPropagation(); onRemove(o); }} data-testid="suggestion-remove"
                        className="-ml-1 grid h-11 w-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground">
                        <X aria-hidden="true" className="h-4 w-4" />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      {loading && !options.length ? <p className="px-3 pb-2 text-xs text-muted-foreground">Dhoondh raha hoon…</p> : null}
      {canClear ? (
        <div className="sticky bottom-0 border-t border-border bg-popover px-1.5 py-1">
          <button type="button" onClick={onClear} data-testid="clear-history"
            className="flex h-11 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />Clear history
          </button>
        </div>
      ) : null}
    </div>
  );
}
