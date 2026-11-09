// Message box with Google-style suggestions (ARIA combobox). Grows up to ~6 lines, Enter sends, Shift+Enter = new
// line, 4000-char limit (counter near the limit), paste is always plain text, Stop while a reply streams.
// Focused + empty → "Recent" (≤ 6, each with ×) and role-based "Try"; typing → merged recent / entity / template
// suggestions (debounced 120 ms, see queries.ts) with the match highlighted. Keys: ↑/↓ move, Enter runs, Tab or →
// (caret at the end) fills without sending, Shift+Delete removes a recent one, Esc closes.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { ArrowUp, Square, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { getAgentApi } from "@/lib/agent/api";
import { takePendingDraft } from "@/lib/agent/persist";
import { clearRecentQueries, removeRecentQuery, useAgentQueryClient, useRecentQueries, useSuggestions } from "@/lib/agent/queries";
import { agentStore } from "@/lib/agent/store";
import { comboKey, idleOptions, rankSuggestions, type SuggestOption } from "@/lib/agent/suggest";
import { onComposerFocusRequest } from "@/lib/agent/surface";
import { AgentConfirm } from "./AgentConfirm";
import { AgentSuggestions, optionId } from "./AgentSuggestions";
import { ESC_LAYER } from "./escLayer";

export const MAX_CHARS = 4000;
const COUNTER_FROM = 3600;
const MAX_HEIGHT = 168; // ≈ 6 lines of 15px/1.5 + padding

/** Insert plain text at the selection, cut to the limit. Pure — exported for tests. */
export function insertPlain(value: string, start: number, end: number, pasted: string, max = MAX_CHARS): { value: string; caret: number } {
  const clean = pasted.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  const room = Math.max(0, max - (value.length - (end - start)));
  const ins = clean.slice(0, room);
  return { value: value.slice(0, start) + ins + value.slice(end), caret: start + ins.length };
}

export function AgentComposer({ busy, onSend, onStop, draftRequest, autoFocus, inputId, compact, uid, templates, offline }: {
  busy: boolean; onSend: (text: string) => void; onStop: () => void;
  draftRequest?: { text: string; nonce: number } | null; autoFocus?: boolean; inputId: string; compact?: boolean;
  /** signed-in user (suggestions + recent history); null = no suggestions */ uid?: string | null;
  /** role-based "Try" prompts */ templates?: string[];
  /** no connection: typing still works, sending waits */ offline?: boolean;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const hadFocus = useRef(false);
  const lastNonce = useRef(draftRequest?.nonce ?? 0);
  const listId = `${useId().replace(/:/g, "")}-suggest`;
  const qc = useAgentQueryClient();

  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(-1);
  const [confirmClear, setConfirmClear] = useState(false);

  const recent = useRecentQueries(uid ?? null, focused);
  const typed = value.trim();
  const suggest = useSuggestions(uid ?? null, value, focused && !!typed && !busy);
  const recentList = useMemo(() => recent.data ?? [], [recent.data]);
  const tpl = useMemo(() => templates ?? [], [templates]);
  const options: SuggestOption[] = useMemo(() => {
    if (!uid) return [];
    if (!typed) return idleOptions(recentList, tpl);
    return rankSuggestions(typed, { server: suggest.data ?? [], recent: recentList, templates: tpl });
  }, [uid, typed, recentList, tpl, suggest.data]);
  const canClear = !typed && recentList.length > 0;
  const open = focused && !dismissed && !busy && !value.includes("\n") && (options.length > 0 || canClear);

  useEffect(() => { setActive(-1); }, [typed, options.length]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [value]);

  // the store keeps the latest text (not as state) so "Sign in again" can save it
  useEffect(() => { agentStore.composerText = value; }, [value]);

  // back from "Sign in again": the text typed before the session expired
  useEffect(() => {
    const t = takePendingDraft();
    if (t) setValue(t.slice(0, MAX_CHARS));
  }, []);

  const focusEnd = () => requestAnimationFrame(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
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
    if (hadFocus.current) { hadFocus.current = false; ref.current?.focus(); }
  }, [busy]);

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

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
    setDismissed(false);
    focusEnd();
  };
  const remove = (o: SuggestOption) => {
    if (!uid || !o.historyId) return;
    void getAgentApi().then((api) => removeRecentQuery(qc, uid, api, o.historyId!)).catch((err: Error) => toast.error(err.message));
    ref.current?.focus();
  };
  const clearAll = () => {
    setConfirmClear(false);
    if (!uid) return;
    void getAgentApi().then((api) => clearRecentQueries(qc, uid, api))
      .then(() => toast.success("Search history clear ho gayi."))
      .catch((err: Error) => toast.error(err.message));
    focusEnd();
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
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(value); }
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
  return (
    <form className={compact ? "px-3 pb-3 pt-2" : "px-3 pb-3 pt-2 sm:px-6 sm:pb-5"} onSubmit={(e) => { e.preventDefault(); send(value); }}>
      <div ref={wrap} className="relative mx-auto max-w-3xl" {...(open ? { [ESC_LAYER]: "" } : {})}
        onBlur={(e) => { if (!wrap.current?.contains(e.relatedTarget as Node | null)) { setFocused(false); setActive(-1); } }}>
        <div className="flex items-end gap-2 rounded-2xl border border-input bg-background p-1.5 pl-3 shadow-sm focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-ring/30">
          <label htmlFor={inputId} className="sr-only">Message a4ai Agent</label>
          <textarea id={inputId} ref={ref} rows={1} value={value} disabled={busy} maxLength={MAX_CHARS}
            role="combobox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-autocomplete="list" aria-haspopup="listbox"
            aria-activedescendant={activeId}
            onFocus={() => { setFocused(true); setDismissed(false); }}
            onChange={(e) => { setValue(e.target.value.slice(0, MAX_CHARS)); setDismissed(false); }}
            onKeyDown={onKeyDown} onPaste={onPaste}
            placeholder={busy ? "Jawab aa raha hai…" : offline ? "Offline — connection aate hi bhej paayenge" : "Poochiye — attendance, marks, test…"}
            aria-describedby={near ? `${inputId}-count` : undefined}
            className="max-h-[168px] min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" />
          {busy ? (
            <button type="button" onClick={onStop} aria-label="Stop" title="Stop"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-background text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="agent-stop">
              <Square aria-hidden="true" className="h-4 w-4" fill="currentColor" />
            </button>
          ) : (
            <button type="submit" disabled={!value.trim() || offline} aria-label={offline ? "Send (offline)" : "Send"}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:bg-muted disabled:text-muted-foreground">
              {offline ? <WifiOff aria-hidden="true" className="h-5 w-5" /> : <ArrowUp aria-hidden="true" className="h-5 w-5" />}
            </button>
          )}
        </div>
        {open ? (
          <AgentSuggestions listId={listId} options={options} active={active} query={typed}
            onRun={(o) => send(o.text)} onFill={fill} onRemove={remove} onHover={setActive}
            onClear={() => setConfirmClear(true)} canClear={canClear} loading={suggest.isFetching} />
        ) : null}
      </div>
      <div className="mx-auto mt-1.5 flex max-w-3xl items-center justify-between gap-2 px-1 text-[11px] text-muted-foreground">
        <span className="hidden sm:inline">Enter = bhejo · Shift+Enter = nayi line · ↑↓ suggestions</span>
        <span className="sm:hidden">Numbers sirf aapke institute ke data se</span>
        {near ? (
          <span id={`${inputId}-count`} className={`tabular-nums ${value.length >= MAX_CHARS ? "font-medium text-destructive dark:text-red-400" : ""}`}>
            {value.length} / {MAX_CHARS}
          </span>
        ) : <span className="hidden sm:inline">Numbers sirf aapke institute ke data se</span>}
      </div>
      <AgentConfirm open={confirmClear} onOpenChange={setConfirmClear} title="Search history clear karein?"
        description="Aapke pichhle sawaal suggestions se hat jayenge. Chats delete nahi hongi." confirmLabel="Clear history" onConfirm={clearAll} />
    </form>
  );
}
