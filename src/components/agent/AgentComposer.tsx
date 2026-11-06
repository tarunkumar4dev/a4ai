// Message box: grows up to ~6 lines, Enter sends, Shift+Enter = new line, 4000-char limit (counter near the
// limit), paste is always plain text, disabled while a reply streams (Stop instead of Send).
import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";

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

export function AgentComposer({ busy, onSend, onStop, draftRequest, autoFocus, inputId, compact }: {
  busy: boolean; onSend: (text: string) => void; onStop: () => void;
  draftRequest?: { text: string; nonce: number } | null; autoFocus?: boolean; inputId: string; compact?: boolean;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const hadFocus = useRef(false);
  const lastNonce = useRef(draftRequest?.nonce ?? 0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [value]);

  // Edit / Change marks put text in the box (only requests made after this composer mounted)
  useEffect(() => {
    if (!draftRequest || draftRequest.nonce === lastNonce.current) return;
    lastNonce.current = draftRequest.nonce;
    setValue(draftRequest.text.slice(0, MAX_CHARS));
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }, [draftRequest]);

  // give focus back after a reply if the user was typing here
  useEffect(() => {
    if (busy) { hadFocus.current = document.activeElement === ref.current || hadFocus.current; return; }
    if (hadFocus.current) { hadFocus.current = false; ref.current?.focus(); }
  }, [busy]);

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  const submit = () => {
    const t = value.trim();
    if (!t || busy) return;
    hadFocus.current = document.activeElement === ref.current;
    onSend(t);
    setValue("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
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
  return (
    <form className={compact ? "px-3 pb-3 pt-2" : "px-3 pb-3 pt-2 sm:px-6 sm:pb-5"} onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-input bg-background p-1.5 pl-3 shadow-sm focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-ring/30">
        <label htmlFor={inputId} className="sr-only">Message a4ai Agent</label>
        <textarea id={inputId} ref={ref} rows={1} value={value} disabled={busy} maxLength={MAX_CHARS}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_CHARS))} onKeyDown={onKeyDown} onPaste={onPaste}
          placeholder={busy ? "Jawab aa raha hai…" : "Poochiye — attendance, marks, ya naya test…"}
          aria-describedby={near ? `${inputId}-count` : undefined}
          className="max-h-[168px] min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" />
        {busy ? (
          <button type="button" onClick={onStop} aria-label="Stop"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-background text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Square aria-hidden="true" className="h-4 w-4" fill="currentColor" />
          </button>
        ) : (
          <button type="submit" disabled={!value.trim()} aria-label="Send"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:bg-muted disabled:text-muted-foreground">
            <ArrowUp aria-hidden="true" className="h-5 w-5" />
          </button>
        )}
      </div>
      <div className="mx-auto mt-1.5 flex max-w-3xl items-center justify-between gap-2 px-1 text-[11px] text-muted-foreground">
        <span className="hidden sm:inline">Enter = bhejo · Shift+Enter = nayi line</span>
        <span className="sm:hidden">Numbers sirf aapke institute ke data se</span>
        {near ? (
          <span id={`${inputId}-count`} className={`tabular-nums ${value.length >= MAX_CHARS ? "font-medium text-destructive dark:text-red-400" : ""}`}>
            {value.length} / {MAX_CHARS}
          </span>
        ) : <span className="hidden sm:inline">Numbers sirf aapke institute ke data se</span>}
      </div>
    </form>
  );
}
