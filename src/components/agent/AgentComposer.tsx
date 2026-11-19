// Message box with Google-style suggestions (ARIA combobox). Grows 1–6 lines, 4000-char limit (counter near the
// limit), paste is always plain text, Send turns into Stop while a reply streams. Enter sends and Shift+Enter is a new
// line on desktop; on touch screens Enter is a new line and the Send button sends (enterKeyHint="send"). Enter never
// sends while an IME is composing (Hindi keyboards). Suggestions appear only after 2+ typed characters (the empty
// box has ONE suggestion surface: the starter cards) — merged recent / entity / template, ≤ 4, match highlighted.
// Keys: ↑/↓ move, Enter runs, Tab or → (caret at the end) fills without sending, Shift+Delete removes a recent one.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import { ArrowUp, Info, Square, WifiOff } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAgentT } from "@/lib/agent/i18n";
import { toast } from "sonner";
import { getAgentApi } from "@/lib/agent/api";
import { prefetchAgentCaches, removeRecentQuery, useAgentQueryClient, useRecentQueries, useSuggestions } from "@/lib/agent/queries";
import { agentStore } from "@/lib/agent/store";
import { comboKey, rankSuggestions, type SuggestOption } from "@/lib/agent/suggest";
import { onComposerFocusRequest } from "@/lib/agent/surface";
import { AgentSuggestions, optionId } from "./AgentSuggestions";
import { ESC_LAYER } from "./escLayer";

export const MAX_CHARS = 4000;
const COUNTER_FROM = 3600;
const MAX_HEIGHT = 168; // ≈ 6 lines of 15px/1.5 + padding
/** typeahead opens from this many typed characters */
export const TYPEAHEAD_MIN = 2;
const TYPEAHEAD_MAX = 4;
const coarsePointer = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

/** Insert plain text at the selection, cut to the limit. Pure — exported for tests. */
export function insertPlain(value: string, start: number, end: number, pasted: string, max = MAX_CHARS): { value: string; caret: number } {
  const clean = pasted.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  const room = Math.max(0, max - (value.length - (end - start)));
  const ins = clean.slice(0, room);
  return { value: value.slice(0, start) + ins + value.slice(end), caret: start + ins.length };
}

export function AgentComposer({ busy, onSend, onStop, draftRequest, autoFocus, inputId, compact, uid, templates, offline, mic, above, onTextChange, footerStart }: {
  busy: boolean; onSend: (text: string) => void; onStop: () => void;
  draftRequest?: { text: string; nonce: number } | null; autoFocus?: boolean; inputId: string; compact?: boolean;
  /** signed-in user (suggestions + recent history); null = no suggestions */ uid?: string | null;
  /** role-based "Try" prompts */ templates?: string[];
  /** no connection: typing still works, sending waits */ offline?: boolean;
  /** the mic button (voice input), beside Send */ mic?: ReactNode;
  /** a strip inside the composer card, above the text (voice state / live transcript) */ above?: ReactNode;
  /** every text change (voice input reads it to know whether its transcript was edited) */ onTextChange?: (v: string) => void;
  /** small controls at the start of the line under the box (voice settings) */ footerStart?: ReactNode;
}) {
  const { t } = useAgentT();
  // the text survives closing the sheet / switching surfaces (store memory — never storage)
  const [value, setValue] = useState(() => agentStore.composerText.slice(0, MAX_CHARS));
  const ref = useRef<HTMLTextAreaElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const hadFocus = useRef(false);
  const lastNonce = useRef(draftRequest?.nonce ?? 0);
  const listId = `${useId().replace(/:/g, "")}-suggest`;
  const qc = useAgentQueryClient();

  const [focused, setFocused] = useState(false);
  // closed until the user focuses the box themselves (click / Tab), types, or presses ↓ — focus moved by code
  // (sheet opening, Ctrl+K, back after a reply) never pops the list over the answer
  const [dismissed, setDismissed] = useState(true);
  const codeFocus = useRef(false);
  const focusByCode = (el: HTMLTextAreaElement | null) => { if (!el) return; codeFocus.current = true; el.focus(); codeFocus.current = false; };
  const [active, setActive] = useState(-1);
  const touch = useMemo(coarsePointer, []);

  const recent = useRecentQueries(uid ?? null, focused);
  const typed = value.trim();
  const longEnough = typed.length >= TYPEAHEAD_MIN;
  const suggest = useSuggestions(uid ?? null, value, focused && longEnough && !busy);
  const recentList = useMemo(() => recent.data ?? [], [recent.data]);
  const tpl = useMemo(() => templates ?? [], [templates]);
  const options: SuggestOption[] = useMemo(() => {
    if (!uid || !longEnough) return [];
    return rankSuggestions(typed, { server: suggest.data ?? [], recent: recentList, templates: tpl }, TYPEAHEAD_MAX);
  }, [uid, typed, longEnough, recentList, tpl, suggest.data]);
  const open = focused && !dismissed && !busy && !value.includes("\n") && options.length > 0;

  useEffect(() => { setActive(-1); }, [typed, options.length]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [value]);

  // the store keeps the latest text (not as state) so "Sign in again" can save it
  useEffect(() => { agentStore.composerText = value; onTextChange?.(value); }, [value, onTextChange]);

  const focusEnd = () => requestAnimationFrame(() => {
    const el = ref.current;
    if (!el) return;
    focusByCode(el);
    el.setSelectionRange(el.value.length, el.value.length);
  });

  // Edit / Change marks / ScopeCard put text in the box (only requests made after this composer mounted)
  useEffect(() => {
    if (!draftRequest || draftRequest.nonce === lastNonce.current) return;
    lastNonce.current = draftRequest.nonce;
    setValue(draftRequest.text.slice(0, MAX_CHARS));
    setDismissed(true);
    focusEnd();
  }, [draftRequest]);

  // Ctrl/⌘+K, "/", New chat → focus this box
  useEffect(() => onComposerFocusRequest(() => { if (!ref.current?.disabled) focusEnd(); }), []);

  // give focus back after a reply if the user was typing here
  useEffect(() => {
    if (busy) { hadFocus.current = document.activeElement === ref.current || hadFocus.current; return; }
    if (hadFocus.current) { hadFocus.current = false; focusByCode(ref.current); }
  }, [busy]);

  useEffect(() => { if (autoFocus) focusByCode(ref.current); }, [autoFocus]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy || offline) return;
    hadFocus.current = document.activeElement === ref.current;
    onSend(t);
    setValue("");
    setDismissed(true);
  };
  const fill = (o: SuggestOption) => {
    setValue(o.text.slice(0, MAX_CHARS));
    focusEnd();
    setDismissed(false);
  };
  const remove = (o: SuggestOption) => {
    if (!uid || !o.historyId) return;
    void getAgentApi().then((api) => removeRecentQuery(qc, uid, api, o.historyId!)).catch(() => toast.error(t("error.generic")));
    focusByCode(ref.current);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (open && e.key === "Delete" && e.shiftKey && active >= 0 && options[active]?.type === "recent") {
      e.preventDefault();
      remove(options[active]);
      return;
    }
    const caretAtEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
    const a = comboKey({ key: e.key, shiftKey: e.shiftKey, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, isComposing: e.nativeEvent.isComposing, caretAtEnd },
      open, active, options.length);
    switch (a.type) {
      case "move": e.preventDefault(); setActive(a.active); return;
      case "open": if (value.includes("\n")) break; e.preventDefault(); setDismissed(false); setActive(0); return;
      case "run": e.preventDefault(); send(options[a.index].text); return;
      case "fill": e.preventDefault(); fill(options[a.index]); return;
      case "close": e.preventDefault(); setDismissed(true); setActive(-1); return;
      default: break;
    }
    // IME composition (Hindi / Devanagari keyboards): Enter picks a word, it never sends (keyCode 229 = Android IMEs)
    const composing = e.nativeEvent.isComposing || e.keyCode === 229;
    if (e.key === "Enter" && !e.shiftKey && !composing && !touch) { e.preventDefault(); send(value); }
  };
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData("text/plain");
    e.preventDefault();
    const el = e.currentTarget;
    const r = insertPlain(value, el.selectionStart ?? value.length, el.selectionEnd ?? value.length, text);
    setValue(r.value);
    requestAnimationFrame(() => ref.current?.setSelectionRange(r.caret, r.caret));
  };

  const near = value.length >= COUNTER_FROM;
  const activeId = open && active >= 0 && active < options.length ? optionId(listId, active) : undefined;
  const pad = compact ? "px-3" : "px-3 sm:px-6";
  return (
    <form className={`${pad} pb-3 pt-2 ${compact ? "" : "sm:pb-4"}`} onSubmit={(e) => { e.preventDefault(); send(value); }}>
      <div ref={wrap} className="relative mx-auto max-w-3xl" {...(open ? { [ESC_LAYER]: "" } : {})}
        onBlur={(e) => { if (!wrap.current?.contains(e.relatedTarget as Node | null)) { setFocused(false); setActive(-1); } }}>
        <div className="rounded-[22px] border border-input bg-card shadow-sm focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-ring/30">
          {above}
          <div className="flex items-end gap-1.5 p-1.5 pl-4">
            <label htmlFor={inputId} className="sr-only">{t("composer.label")}</label>
            <textarea id={inputId} ref={ref} rows={1} value={value} disabled={busy} maxLength={MAX_CHARS} enterKeyHint={touch ? "enter" : "send"}
              role="combobox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-autocomplete="list" aria-haspopup="listbox"
              aria-activedescendant={activeId}
              onFocus={() => { setFocused(true); if (!codeFocus.current) setDismissed(false); if (uid) prefetchAgentCaches(qc, uid); }}
              onPointerDown={() => setDismissed(false)}
              onChange={(e) => { setValue(e.target.value.slice(0, MAX_CHARS)); setDismissed(false); }}
              onKeyDown={onKeyDown} onPaste={onPaste}
              placeholder={busy ? t("composer.placeholderBusy") : offline ? t("composer.placeholderOffline") : t("composer.placeholder")}
              aria-describedby={near ? `${inputId}-count` : undefined}
              className="agent-prose max-h-[168px] min-h-[44px] flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" />
            {mic}
            {busy ? (
              <button type="button" onClick={onStop} aria-label={t("composer.stop")} title={t("composer.stop")}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="agent-stop">
                <Square aria-hidden="true" className="h-4 w-4" fill="currentColor" />
              </button>
            ) : (
              <button type="submit" disabled={!value.trim() || offline} aria-label={offline ? t("composer.sendOffline") : t("composer.send")} title={t("composer.send")} data-testid="agent-send"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:bg-muted disabled:text-muted-foreground">
                {offline ? <WifiOff aria-hidden="true" className="h-5 w-5" /> : <ArrowUp aria-hidden="true" className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>
        {open ? (
          <AgentSuggestions listId={listId} options={options} active={active} query={typed}
            onRun={(o) => send(o.text)} onFill={fill} onRemove={remove} onHover={setActive}
            onClear={() => undefined} canClear={false} loading={suggest.isFetching} />
        ) : null}
      </div>
      <div className="mx-auto mt-1.5 flex min-h-5 max-w-3xl items-center justify-between gap-2 px-2 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1">{footerStart}{focused && !touch ? <span className="hidden truncate sm:inline" data-testid="composer-hint">{t("composer.hint")}</span> : null}</span>
        {near ? (
          <span id={`${inputId}-count`} className={`shrink-0 tabular-nums ${value.length >= MAX_CHARS ? "font-medium text-destructive dark:text-red-400" : ""}`}>
            {value.length} / {MAX_CHARS}
          </span>
        ) : (
          <Popover>
            <PopoverTrigger className="-mr-1 inline-flex min-h-8 items-center gap-1 rounded-md px-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="agent-trust">
              <span className={`agent-prose truncate ${focused && !touch ? "sr-only" : ""}`}>{t("trust")}</span><Info aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="agent-prose z-[240] w-[min(18rem,calc(100vw-2rem))] p-3 text-sm">{t("trust.help")}</PopoverContent>
          </Popover>
        )}
      </div>
    </form>
  );
}
