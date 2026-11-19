// Chat header, 56 px: ONE agent avatar · "a4ai Agent" (+ open chat title / institute, a Demo chip only on demo data) ·
// at most four labelled icons — language, history, new chat, close — plus a ⋯ menu (wider panel, keyboard shortcuts,
// clear search history). No role badge, no permanent connection pill (the connection strip lives above the composer).
import { useState, type ReactNode } from "react";
import { Eraser, Keyboard, Maximize2, Minimize2, MoreHorizontal, SquarePen } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { MetaResponse } from "@/lib/agent/events";
import { useAgentT } from "@/lib/agent/i18n";
import { AgentMark } from "./AgentMessage";
import { IconTip, iconBtn } from "./IconTip";
import { LanguageMenu } from "./LanguageMenu";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { NEW_CHAT_SHORTCUT } from "./shortcuts";

export function AgentHeader({ meta, onNewChat, canNew, leading, trailing, compact, newChatInSidebar, title, wide, onToggleWide, onClearSearch }: {
  meta: MetaResponse | null; onNewChat: () => void; canNew: boolean;
  /** the open chat's title */ title?: string | null;
  /** the history button (sheet / phones) */ leading?: ReactNode;
  /** the close button (sheet) */ trailing?: ReactNode;
  compact?: boolean;
  /** the workspace sidebar (lg+) already has a New chat button */ newChatInSidebar?: boolean;
  /** sheet on desktop: 420 ↔ 720 px */ wide?: boolean; onToggleWide?: () => void;
  /** clear the recent-question history (suggestions) — null when there is none */ onClearSearch?: (() => void) | null;
}) {
  const { t } = useAgentT();
  const [shortcuts, setShortcuts] = useState(false);
  const sub = title ?? meta?.institute_name ?? null;
  const fine = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches;
  return (
    <header className={`flex h-14 shrink-0 items-center gap-1 border-b border-border bg-card ${compact ? "pl-3 pr-1.5" : "pl-3 pr-2 sm:pl-5"}`} data-testid="agent-header">
      <AgentMark className="mr-1.5 h-8 w-8 rounded-lg" />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[15px] font-semibold leading-5 text-foreground">{t("brand.title")}</h2>
        {sub || meta?.data_source === "demo" ? (
          <p className="flex min-w-0 items-center gap-1.5 text-xs leading-4 text-muted-foreground">
            {meta?.data_source === "demo" ? (
              <span title={t("header.demoHelp")} data-testid="data-source" data-tone="demo"
                className="shrink-0 rounded bg-amber-100 px-1 font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">{t("header.demo")}</span>
            ) : null}
            {sub ? <span className="min-w-0 truncate" data-testid={title ? "chat-title" : undefined} title={sub}>{sub}</span> : null}
          </p>
        ) : null}
      </div>
      <LanguageMenu />
      {leading}
      <IconTip label={`${t("header.newChat")} (${NEW_CHAT_SHORTCUT})`}>
        <button type="button" onClick={onNewChat} disabled={!canNew} aria-label={t("header.newChat")} data-testid="agent-new-chat"
          className={`${iconBtn} ${newChatInSidebar ? "lg:hidden" : ""}`}>
          <SquarePen aria-hidden="true" className="h-[18px] w-[18px]" />
        </button>
      </IconTip>
      <DropdownMenu>
        <IconTip label={t("header.more")}>
          <DropdownMenuTrigger aria-label={t("header.more")} className={iconBtn} data-testid="agent-more">
            <MoreHorizontal aria-hidden="true" className="h-[18px] w-[18px]" />
          </DropdownMenuTrigger>
        </IconTip>
        <DropdownMenuContent align="end" className="z-[240] min-w-52">
          {onToggleWide ? (
            <DropdownMenuItem className="hidden min-h-10 gap-2 sm:flex" onSelect={onToggleWide} data-testid="agent-expand">
              {wide ? <Minimize2 aria-hidden="true" className="h-4 w-4" /> : <Maximize2 aria-hidden="true" className="h-4 w-4" />}
              {wide ? t("header.collapse") : t("header.expand")}
            </DropdownMenuItem>
          ) : null}
          {fine ? (
            <DropdownMenuItem className="min-h-10 gap-2" onSelect={() => setShortcuts(true)}>
              <Keyboard aria-hidden="true" className="h-4 w-4" />{t("header.shortcuts")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem className="min-h-10 gap-2" disabled={!onClearSearch} onSelect={() => onClearSearch?.()} data-testid="clear-history">
            <Eraser aria-hidden="true" className="h-4 w-4" />{t("header.clearSearch")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {trailing}
      <ShortcutsHelp open={shortcuts} onOpenChange={setShortcuts} />
    </header>
  );
}
