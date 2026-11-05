// "Ask a4ai" chat panel (lazy-loaded by AskA4aiLauncher). Only the status line is aria-live.
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { statusLabel } from "@/lib/agent/chatState";
import { AgentEventBlock, type BlockHandlers } from "./AgentEventBlock";
import type { AgentChat } from "./useAgentChat";

export const SUGGESTIONS: Record<"admin" | "teacher", string[]> = {
  admin: ["Aaj ki attendance", "Sharma ma'am ki attendance"],
  teacher: ["Class 10 trigonometry test banao"],
};

export const suggestionsFor = (role: string) => (role === "admin" ? SUGGESTIONS.admin : SUGGESTIONS.teacher);

export default function AgentChatPanel({ chat, role }: { chat: AgentChat; role: string }) {
  const { state } = chat;
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const blockCount = state.turns.reduce((n, t) => n + t.blocks.length + 1, 0);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [blockCount]);

  const submit = (text: string) => {
    if (!text.trim() || state.busy) return;
    chat.send(text);
    setDraft("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit(draft);
    }
  };
  const h: BlockHandlers = {
    busy: state.busy,
    onAnswer: chat.answerClarify,
    onApprove: chat.approve,
    onCancel: chat.cancelApproval,
    onRetry: (text) => chat.send(text),
    onDownload: chat.download,
  };
  const chips = suggestionsFor(role);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background text-foreground">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {state.turns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ask about attendance or marks, or ask for a CBSE test paper. Numbers come from your institute's data only.
          </p>
        ) : null}
        {state.turns.map((t) => (t.role === "user" ? (
          <div key={t.id} className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">{t.text}</div>
        ) : (
          <div key={t.id} className="space-y-3">
            {t.blocks.map((b) => <AgentEventBlock key={b.id} block={b} h={h} />)}
          </div>
        )))}
        <div ref={endRef} />
      </div>

      <p aria-live="polite" className="min-h-[1.25rem] px-4 text-xs text-muted-foreground">
        {state.status ? statusLabel(state.status.key, state.status.params) : ""}
      </p>

      <div className="border-t border-border px-4 pb-4 pt-2">
        <div className="mb-2 flex flex-wrap gap-2">
          {chips.map((c) => (
            <button key={c} type="button" disabled={state.busy} onClick={() => submit(c)}
              className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-60">
              {c}
            </button>
          ))}
        </div>
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); submit(draft); }}>
          <label htmlFor="ask-a4ai-input" className="sr-only">Message a4ai Agent</label>
          <textarea id="ask-a4ai-input" rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Type a question… (Enter to send, Shift+Enter for a new line)" maxLength={4000}
            className="min-h-[44px] flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          {state.busy
            ? <Button type="button" variant="outline" onClick={chat.stop}>Stop</Button>
            : <Button type="submit" disabled={!draft.trim()}>Send</Button>}
        </form>
      </div>
    </div>
  );
}
