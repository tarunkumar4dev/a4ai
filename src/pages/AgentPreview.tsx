// DEV ONLY — /__agent-preview. Mounted in App.tsx behind `import.meta.env.DEV`, so it is not in the production
// build (checked by grepping dist for "__agent-preview"). Renders the real agent panel against the in-memory mock
// (lib/agent/mock.ts) plus fixtures, with a fake signed-in staff user: no credentials, no network, nothing real.
// Every state can be opened by URL, for screenshots and Playwright:
//   /__agent-preview?state=nobatch&lang=hi&w=wide&bare=1
import { useEffect, useMemo, useState } from "react";
import AgentChatPanel from "@/components/agent/AgentChatPanel";
import { setAgentApiForTests, type AgentApi, type StreamOptions } from "@/lib/agent/api";
import { AgentHttpError } from "@/lib/agent/client";
import { CONTRACT_FIXTURES, RANKING_TABLE } from "@/lib/agent/contract/fixtures";
import { AgentEnvProvider, type AgentEnv } from "@/lib/agent/env";
import { agentLang, isAgentLang } from "@/lib/agent/i18n";
import { mockApi } from "@/lib/agent/mock";
import { agentStore } from "@/lib/agent/store";
import type { AgentEvent } from "@/lib/agent/types";
import { previewVoice, type PreviewVoiceState } from "@/lib/voice/preview";

export const PREVIEW_STATES = [
  "empty", "nobatch", "admin", "connecting", "slow", "failed", "offline", "streaming", "attendance", "marks", "test",
  "e429", "e401", "e5xx", "enet", "history",
  "voice-listening", "voice-ready", "voice-denied", "voice-unsupported", "voice-processing",
] as const;
type State = (typeof PREVIEW_STATES)[number];
const isState = (s: string | null): s is State => !!s && (PREVIEW_STATES as readonly string[]).includes(s);

/** what each result state types into the composer and sends */
const AUTO_SEND: Partial<Record<State, string>> = {
  streaming: "Is mahine ki attendance detail me explain karo", attendance: "ECE 1 ki is mahine ki attendance",
  marks: "Mere tests ke marks summary", test: "Class 10 trigonometry test banao, 40 marks",
  e429: "Meri classes ki attendance", e401: "Meri classes ki attendance", e5xx: "Meri classes ki attendance",
  enet: "Meri classes ki attendance",
};

const wait = (ms: number, signal?: AbortSignal) => new Promise<void>((res, rej) => {
  const t = setTimeout(res, ms);
  signal?.addEventListener("abort", () => { clearTimeout(t); rej(new DOMException("aborted", "AbortError")); }, { once: true });
});

function fixtureChat(events: AgentEvent[]) {
  return async ({ body, onEvent, onRequestId, signal }: StreamOptions) => {
    const rid = Math.random().toString(16).slice(2, 18).padEnd(16, "0");
    onRequestId?.(rid);
    const sid = body.session_id ?? crypto.randomUUID();
    let seq = 0;
    const out: AgentEvent[] = [
      { type: "session", seq: 0, request_id: rid, session_id: sid, title: (body.message ?? "Preview").slice(0, 48) },
      ...events, { ...CONTRACT_FIXTURES.final, session_id: sid },
    ];
    for (const ev of out) {
      await wait(ev.type === "thinking_status" ? 450 : 160, signal);
      onEvent({ ...ev, seq: seq++, request_id: rid } as AgentEvent);
    }
  };
}

const F = CONTRACT_FIXTURES;
const MARKS: AgentEvent[] = [
  { ...F.thinking_status, key: "tool.marks_stats", params: { phase: "start" } },
  { ...F.thinking_status, key: "tool.marks_stats", params: { phase: "done", ms: 640, ok: true } },
  { ...F.stat_card, source: "tool:marks_stats", title: "Average · Unit test 2", value: "71.4", unit: "%", subtitle: "ECE 1 · 38 students", delta: null },
  { ...F.stat_card, source: "tool:marks_stats", title: "Highest · Unit test 2", value: "96", unit: "/100", subtitle: "Meera Iyer", delta: null },
  { ...RANKING_TABLE, source: "tool:marks_stats", title: "Marks by test" },
  { ...F.text_delta, text: "Unit test 2 me class ka average pichhle test se behtar raha." },
];
const TEST: AgentEvent[] = [
  { ...F.thinking_status, key: "tool.blueprint_defaults", params: { phase: "done", ms: 380, ok: true } },
  { ...F.thinking_status, key: "tool.generate_questions", params: { phase: "done", ms: 2100, ok: true } },
  { ...F.thinking_status, key: "tool.verify_paper", params: { phase: "done", ms: 1300, ok: true } },
  F.blueprint, F.paper_preview, F.verification_summary,
];

function previewApi(state: State): AgentApi {
  const msgErr: Partial<Record<State, () => never>> = {
    e429: () => { throw new AgentHttpError(429, "rate", 30); },
    e401: () => { throw new AgentHttpError(401, "unauthorized"); },
    e5xx: () => { throw new AgentHttpError(500, "internal"); },
    enet: () => { throw new TypeError("Failed to fetch"); },
  };
  return {
    ...mockApi,
    async meta(signal?: AbortSignal) {
      if (state === "connecting") { await new Promise((_, rej) => signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")))); }
      if (state === "slow") await wait(10_000, signal);
      if (state === "failed") throw new TypeError("Failed to fetch");
      const m = await mockApi.meta(signal);
      if (state === "nobatch") return { ...m, role: "teacher", first_name: "Asha", scope: { ...m.scope, batch_count: 0, student_count: 0, batches: [] } };
      if (state === "admin") return { ...m, role: "admin", first_name: "Rohit", scope: { ...m.scope, level: "institute" } };
      return { ...m, role: "teacher", first_name: "Asha" };
    },
    async chat(o) {
      msgErr[state]?.();
      if (state === "marks") return fixtureChat(MARKS)(o);
      if (state === "test") return fixtureChat(TEST)(o);
      return mockApi.chat(o);
    },
  } as AgentApi;
}

export default function AgentPreview() {
  const params = new URLSearchParams(window.location.search);
  const [state, setState] = useState<State>(() => (isState(params.get("state")) ? params.get("state") as State : "empty"));
  const [wide, setWide] = useState(params.get("w") === "wide");
  const [nonce, setNonce] = useState(0);
  const bare = params.get("bare") === "1";

  useEffect(() => { const l = params.get("lang"); if (isAgentLang(l)) agentLang.set(l); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // a new fake user per state → the store reloads meta / history for it
  const uid = `preview-${state}-${nonce}`;
  useMemo(() => { setAgentApiForTests(previewApi(state)); agentStore._reset(); }, [state, nonce]);
  useEffect(() => {
    previewVoice.set(state.startsWith("voice-") ? (state.slice(6) as PreviewVoiceState) : null);
    const text = AUTO_SEND[state];
    if (!text) return;
    const id = setTimeout(() => agentStore.send(text), 700);
    return () => clearTimeout(id);
  }, [state, nonce]);
  useEffect(() => () => { setAgentApiForTests(null); previewVoice.set(null); }, []);

  const env: AgentEnv = useMemo(() => ({
    user: { id: uid, user_metadata: { full_name: state === "admin" ? "Rohit Mehra" : "Asha Verma" } },
    access: { primary_role: state === "admin" ? "admin" : "teacher" } as AgentEnv["access"],
    net: state === "offline" ? "offline" : "online",
    scope: { loading: false, batches: state === "nobatch" ? [] : [{ id: "b1", name: "ECE 1", class_level: null, section_id: null, department_id: null }] },
  }), [uid, state]);

  return (
    <div className="flex h-[100dvh] flex-col bg-muted/40 font-halenoir">
      {bare ? null : (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2 text-sm">
          <strong className="mr-2">Agent preview (dev)</strong>
          <label className="flex items-center gap-1">State
            <select value={state} onChange={(e) => setState(e.target.value as State)} className="h-9 rounded-md border border-input bg-background px-2" data-testid="preview-state">
              {PREVIEW_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <button type="button" className="h-9 rounded-md border border-border px-3" onClick={() => setWide((w) => !w)}>{wide ? "720px" : "420px"}</button>
          <button type="button" className="h-9 rounded-md border border-border px-3" onClick={() => setNonce((n) => n + 1)}>Reset</button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 justify-end">
        <AgentEnvProvider value={env}>
          <div key={uid} className={`flex h-full w-full flex-col border-l border-border bg-card shadow-xl sm:max-w-full ${wide ? "sm:w-[720px]" : "sm:w-[420px]"}`} data-testid="preview-frame">
            <AgentChatPanel variant="sheet" autoFocus />
          </div>
        </AgentEnvProvider>
      </div>
    </div>
  );
}
