// Header language switch: globe + short code (EN / हि / Hx) → a small radio menu. Option names are always in their
// own script. Switching changes the panel text at once (no remount, the draft and scroll stay) and what the agent
// replies in from the next message; earlier messages are not re-translated.
import { Globe } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AGENT_LANGS, LANG_NAMES, agentLang, htmlLang, isAgentLang, useAgentT } from "@/lib/agent/i18n";

export function LanguageMenu({ className = "" }: { className?: string }) {
  const { t, lang } = useAgentT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`${t("header.lang")}: ${LANG_NAMES[lang].name}`} title={t("header.lang")} data-testid="agent-lang"
        className={`inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-1 rounded-md px-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}>
        <Globe aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
        <span lang={htmlLang(lang)} className="text-[13px] leading-none">{LANG_NAMES[lang].code}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[240] w-44" data-agent-root="">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{t("header.lang")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={lang} onValueChange={(v) => { if (isAgentLang(v)) agentLang.set(v); }}>
          {AGENT_LANGS.map((l) => (
            <DropdownMenuRadioItem key={l} value={l} lang={htmlLang(l)} className="min-h-10 text-sm" data-testid={`agent-lang-${l}`}>
              {LANG_NAMES[l].name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
