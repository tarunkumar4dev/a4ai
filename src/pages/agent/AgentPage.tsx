// /agent — mobile-first chat with the a4ai agent (SSE contract: RAG-BACKEND agent/schemas.py).
// Route (add to App.tsx, inside the staff routes):
//   <Route path="/agent" element={<RoleRoute allow={["admin", "hod", "proctor", "teacher"]}><AgentPage /></RoleRoute>} />
//   with: const AgentPage = lazy(() => import("@/pages/agent/AgentPage"));
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAccess } from "@/context/AccessProvider";
import { AgentHttpError, getAgentToken, streamChat } from "@/lib/agent/client";
import type { AgentEvent, Chart } from "@/lib/agent/events";
import { StatCard } from "@/components/agent/StatCard";
import { DataTable } from "@/components/agent/DataTable";
import { ClarifyChips } from "@/components/agent/ClarifyChips";
import { BlueprintEditor } from "@/components/agent/BlueprintEditor";
import { PaperPreview } from "@/components/agent/PaperPreview";
import { VerificationBadge } from "@/components/agent/VerificationBadge";
import { ApprovalCard } from "@/components/agent/ApprovalCard";

type Turn =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "agent"; text: string; blocks: AgentEvent[]; done: boolean; error?: string };

const STATUS_TEXT: Record<string, string> = {
  "status.thinking": "Soch raha hoon…",
  "status.planning": "Plan bana raha hoon…",
  "status.retrieving_ncert": "NCERT se questions dhoondh raha hoon…",
  "status.querying_attendance": "Attendance check kar raha hoon…",
  "status.fetching_data": "Data la raha hoon…",
  "status.generating": "Questions bana raha hoon…",
  "status.verifying": "Answers verify kar raha hoon…",
  "status.building_blueprint": "Blueprint bana raha hoon…",
  "status.rendering": "Paper taiyaar kar raha hoon…",
};
const statusText = (key: string) => STATUS_TEXT[key] ?? "Kaam chal raha hai…";

const SUGGESTIONS: Record<"admin" | "teacher", string[]> = {
  admin: ["Is mahine ki attendance kya hai?", "Low attendance students (<75%)"],
  teacher: ["Mere class ki attendance", "Class 10 trigonometry test, 40 marks"],
};

const ERROR_TEXT: Record<string, string> = {
  budget_exceeded: "Aaj ki limit khatam ho gayi. Kal try karein.",
  forbidden: "Aapko iski access nahi hai.",
  not_found: "Ye data nahi mila.",
  invalid_input: "Request samajh nahi aayi — thoda alag likh kar try karein.",
  provider_error: "AI service abhi busy hai. Thodi der baad try karein.",
  internal: "Kuch gadbad ho gayi. Dobara try karein.",
};

function ChartAsTable({ ev }: { ev: Chart }) {
  // No chart lib wired here yet: show the series as a compact table (scrolls inside its card).
  const labels = Array.from(new Set(ev.series.flatMap((s) => s.points.map((p) => p[0]))));
  return (
    <DataTable ev={{
      ...ev, type: "table", title: ev.y_unit ? `${ev.title} (${ev.y_unit})` : ev.title,
      columns: ["", ...ev.series.map((s) => s.name)],
      rows: labels.map((l) => [l, ...ev.series.map((s) => {
        const v = s.points.find((p) => p[0] === l)?.[1];
        return v == null ? null : String(v);
      })]),
    }} />
  );
}

export default function AgentPage() {
  const { access } = useAccess();
  const role: "admin" | "teacher" = access?.primary_role === "admin" ? "admin" : "teacher";
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(0);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [turns, status]);

  const patchAgent = useCallback((id: number, fn: (t: Extract<Turn, { role: "agent" }>) => Extract<Turn, { role: "agent" }>) => {
    setTurns((all) => all.map((t) => (t.id === id && t.role === "agent" ? fn(t) : t)));
  }, []);

  const send = useCallback(async (raw: string) => {
    const message = raw.trim().slice(0, 4000);
    if (!message || busy) return;
    setInput("");
    const userId = ++idRef.current;
    const agentId = ++idRef.current;
    setTurns((t) => [...t, { id: userId, role: "user", text: message }, { id: agentId, role: "agent", text: "", blocks: [], done: false }]);
    setBusy(true);
    setStatus(statusText("status.thinking"));
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const token = await getAgentToken();
      if (!token) throw new AgentHttpError(401, "Please sign in again.");
      await streamChat({
        message, sessionId, token, signal: ctrl.signal,
        onEvent: (ev) => {
          switch (ev.type) {
            case "text_delta": patchAgent(agentId, (t) => ({ ...t, text: t.text + ev.text })); break;
            case "thinking_status": setStatus(statusText(ev.key)); break;
            case "final": setSessionId(ev.session_id); patchAgent(agentId, (t) => ({ ...t, done: true })); break;
            case "error": patchAgent(agentId, (t) => ({ ...t, error: ERROR_TEXT[ev.code] ?? ev.message })); break;
            default: patchAgent(agentId, (t) => ({ ...t, blocks: [...t.blocks, ev] }));
          }
        },
      });
    } catch (e) {
      if (!ctrl.signal.aborted) {
        const msg = e instanceof AgentHttpError
          ? (e.status === 401 ? "Please sign in again." : e.status === 403 ? ERROR_TEXT.forbidden : e.status === 429 ? ERROR_TEXT.budget_exceeded : ERROR_TEXT.internal)
          : "Network problem — connection check karke dobara try karein.";
        patchAgent(agentId, (t) => ({ ...t, error: msg }));
      }
    } finally {
      patchAgent(agentId, (t) => ({ ...t, done: true }));
      setBusy(false);
      setStatus(null);
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }, [busy, sessionId, patchAgent]);

  const suggestions = useMemo(() => SUGGESTIONS[role], [role]);

  const renderBlock = (ev: AgentEvent, key: string) => {
    switch (ev.type) {
      case "stat_card": return <StatCard key={key} ev={ev} />;
      case "table": return <DataTable key={key} ev={ev} />;
      case "chart": return <ChartAsTable key={key} ev={ev} />;
      case "clarify": return <ClarifyChips key={key} ev={ev} disabled={busy} onPick={send} />;
      case "blueprint": return <BlueprintEditor key={key} ev={ev} />;
      case "paper_preview": return <PaperPreview key={key} ev={ev} />;
      case "verification_summary": return <VerificationBadge key={key} ev={ev} />;
      case "pending_approval": return <ApprovalCard key={key} ev={ev} sessionId={sessionId} />;
      default: return null;
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <h1 className="text-base font-semibold">a4ai Agent</h1>
        <p className="text-xs text-muted-foreground">Attendance, reports aur test papers — sirf aapke scope ka data.</p>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-4">
        {turns.length === 0 ? (
          <Card>
            <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Kya poochna hai?</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2 p-4 pt-0">
              {suggestions.map((s) => (
                <Button key={s} type="button" variant="outline" size="sm" className="h-auto whitespace-normal text-left" onClick={() => send(s)}>{s}</Button>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {turns.map((t) => t.role === "user" ? (
          <div key={t.id} className="flex justify-end">
            <p className="max-w-[85%] break-words rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">{t.text}</p>
          </div>
        ) : (
          <div key={t.id} className="min-w-0 space-y-3">
            {t.text ? <p className="whitespace-pre-wrap break-words text-sm">{t.text}</p> : null}
            {t.blocks.map((b) => renderBlock(b, `${b.request_id}-${b.seq}`))}
            {t.error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{t.error}</p> : null}
          </div>
        ))}

        {status ? <p className="text-xs text-muted-foreground" aria-live="polite">{status}</p> : null}
        <div ref={endRef} />
      </main>

      <form
        className="sticky bottom-0 border-t bg-background px-4 py-3"
        onSubmit={(e) => { e.preventDefault(); void send(input); }}
      >
        <div className="mx-auto flex w-full max-w-3xl gap-2">
          <Input
            value={input} onChange={(e) => setInput(e.target.value)} maxLength={4000}
            placeholder="Message likhein…" aria-label="Message" disabled={busy} className="min-w-0 flex-1"
          />
          {busy ? (
            <Button type="button" variant="outline" onClick={() => abortRef.current?.abort()}>Stop</Button>
          ) : (
            <Button type="submit" disabled={!input.trim()}>Send</Button>
          )}
        </div>
      </form>
    </div>
  );
}
