// Voice UI logic (phase 4): mic states through the session reducer, ui_action + speech in the chat reducer and the
// event parser, settings + consent prefs, the ui_action bus, and the player's language mapping.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chatReducer, initialChatState, eventToBlock } from "@/lib/agent/chatState";
import { EVENT_TYPES, parseAgentEvent } from "@/lib/agent/events";
import type { AgentEvent } from "@/lib/agent/types";
import { DEFAULT_PREFS, hasConsent, loadPrefs, parsePrefs, savePrefs, withConsent } from "./prefs";
import { AUTO_SEND_PAUSE_MS } from "./ptt";
import { synthLang } from "./player";
import { initialSession, liveText, sessionReducer, type VoiceSession } from "./session";
import { _resetVoiceSurface, onVoiceStartRequest, requestVoiceStart } from "./surface";
import { _listenerCount, emitUiAction, onUiAction } from "./uiActions";

const ev = (e: Record<string, unknown>, seq = 1, rid = "r1") => ({ request_id: rid, seq, ...e }) as unknown as AgentEvent;

describe("mic states (session reducer)", () => {
  const step = (s: VoiceSession, a: Parameters<typeof sessionReducer>[1]) => sessionReducer(s, a);
  it("tap → listening (meter live) → tap → transcribing, visible at once", () => {
    let s = step(initialSession, { type: "ptt", ev: { type: "tap" } });
    expect(s.state).toBe("listening");
    s = step(s, { type: "level", rms: 0.3 });
    expect(s.level).toBe(0.3);
    s = step(s, { type: "ptt", ev: { type: "tap" } });
    expect(s.state).toBe("transcribing");
    expect(s.level).toBe(0);
  });
  it("level is ignored unless listening", () => {
    expect(step(initialSession, { type: "level", rms: 0.5 }).level).toBe(0);
  });
  it("transcript → auto-send strip with a pause and an Edit option", () => {
    let s = step(initialSession, { type: "ptt", ev: { type: "tap" } });
    s = step(s, { type: "ptt", ev: { type: "tap" } });
    s = step(s, { type: "transcript", text: "10A ki attendance", next: "auto", at: 1000 });
    expect(s.notice).toEqual({ kind: "auto", text: "10A ki attendance", sendAt: 1000 + AUTO_SEND_PAUSE_MS });
    expect(s.transcript).toBe("10A ki attendance");
    const edited = step(s, { type: "edit" });
    expect(edited.state).toBe("idle");
    expect(edited.notice).toBeNull();
    const sent = step(s, { type: "sent" });
    expect(sent.state).toBe("thinking");
  });
  it("low confidence asks 'Maine suna … Sahi hai?'; empty says 'Dobara boliye'; ambiguous shows chips", () => {
    const base = step(step(initialSession, { type: "ptt", ev: { type: "tap" } }), { type: "ptt", ev: { type: "tap" } });
    const c = step(base, { type: "transcript", text: "sharma ki hazri", next: "confirm" });
    expect(c.notice?.kind).toBe("confirm");
    expect(liveText(c, null)).toBe("Maine suna: sharma ki hazri. Sahi hai?");
    const r = step(base, { type: "transcript", text: "", next: "repeat" });
    expect(r.notice).toEqual({ kind: "repeat" });
    expect(liveText(r, null)).toBe("Dobara boliye.");
    const p = step(base, { type: "transcript", text: "Rahul ke marks", next: "pick", clarify: { question: "Kaun sa?", chips: [{ label: "Rahul (10A)", value: "Rahul (10A) ke marks" }] } });
    expect(p.notice?.kind).toBe("pick");
    expect(p.state).toBe("idle");
  });
  it("answer → speaking (caption = speech) → tap stops → idle", () => {
    let s: VoiceSession = { ...initialSession, state: "thinking" };
    s = step(s, { type: "ptt", ev: { type: "answer_done", speech: true } });
    expect(s.state).toBe("speaking");
    expect(liveText(s, "10A की attendance 80% रही।")).toBe("10A की attendance 80% रही।");
    s = step(s, { type: "ptt", ev: { type: "tap" } });
    expect(s.state).toBe("idle");
  });
  it("mic denied / unsupported / limit / network drop all land in idle with a message and keep the transcript", () => {
    const d = step(step(initialSession, { type: "ptt", ev: { type: "tap" } }), { type: "ptt", ev: { type: "denied" } });
    expect(d.state).toBe("idle");
    expect(d.notice).toEqual({ kind: "denied" });
    const n = step({ ...initialSession, state: "thinking", transcript: "meri classes" }, { type: "notice", notice: { kind: "network", text: "meri classes" } });
    expect(n.state).toBe("idle");
    expect(n.transcript).toBe("meri classes");
    const l = step(initialSession, { type: "notice", notice: { kind: "limit", message: "Aaj ki voice limit", retryAt: null } });
    expect(l.notice?.kind).toBe("limit");
  });
});

describe("ui_action + speech in the chat reducer / parser", () => {
  it("EVENT_TYPES lists the 1.4 events", () => {
    expect(EVENT_TYPES).toContain("speech");
    expect(EVENT_TYPES).toContain("ui_action");
  });
  it("parser: speech needs text; ui_action needs a registry-shaped key for navigate", () => {
    expect(parseAgentEvent({ seq: 1, request_id: "r", type: "speech", text: "ठीक है", language: "hi" })).toMatchObject({ type: "speech", language: "hi" });
    expect(parseAgentEvent({ seq: 1, request_id: "r", type: "speech", text: "  " })).toBeNull();
    expect(parseAgentEvent({ seq: 1, request_id: "r", type: "speech", text: "x", language: "fr" })).toMatchObject({ language: "hi-en" });
    expect(parseAgentEvent({ seq: 2, request_id: "r", type: "ui_action", action: "navigate", route_key: "dashboard.attendance", params: { x: "1", y: 2 } }))
      .toMatchObject({ action: "navigate", route_key: "dashboard.attendance", params: { x: "1" } });
    expect(parseAgentEvent({ seq: 2, request_id: "r", type: "ui_action", action: "navigate", route_key: "/etc/passwd" })).toBeNull();
    expect(parseAgentEvent({ seq: 2, request_id: "r", type: "ui_action", action: "delete_all" })).toBeNull();
    expect(parseAgentEvent({ seq: 2, request_id: "r", type: "ui_action", action: "highlight_confirm" })).toMatchObject({ action: "highlight_confirm", route_key: null });
  });
  it("speech lands on the assistant turn, not as a block; ui_action is a block; highlight_confirm flags the chat", () => {
    let s = chatReducer(initialChatState, { type: "send", text: "haan kar do" });
    s = chatReducer(s, { type: "event", ev: ev({ type: "session", session_id: "s1", title: "t" }, 0) });
    s = chatReducer(s, { type: "event", ev: ev({ type: "text_delta", text: "Voice se approve nahi hota." }, 1) });
    s = chatReducer(s, { type: "event", ev: ev({ type: "ui_action", action: "highlight_confirm", params: {} }, 2) });
    s = chatReducer(s, { type: "event", ev: ev({ type: "speech", text: "Screen पर Confirm दबाइए।", language: "hi-en" }, 3) });
    s = chatReducer(s, { type: "event", ev: ev({ type: "final", session_id: "s1" }, 4) });
    const a = s.turns[1];
    expect(a.blocks.map((b) => b.kind)).toEqual(["text", "ui_action"]);
    expect(a.speech).toEqual({ text: "Screen पर Confirm दबाइए।", language: "hi-en" });
    expect(s.confirmHighlightAt).toBeTypeOf("number");
    expect(s.busy).toBe(false);
    // the next send clears the highlight
    expect(chatReducer(s, { type: "send", text: "ok" }).confirmHighlightAt).toBeNull();
    expect(eventToBlock(ev({ type: "speech", text: "x", language: "en" }))).toBeNull();
    expect(eventToBlock(ev({ type: "ui_action", action: "navigate", route_key: "notes", params: {} }))?.kind).toBe("ui_action");
  });
});

describe("settings + consent prefs (per user, on device)", () => {
  beforeEach(() => { localStorage.clear(); });
  it("round-trips and sanitises", () => {
    expect(loadPrefs("user-0001")).toEqual(DEFAULT_PREFS);
    savePrefs("user-0001", { ...DEFAULT_PREFS, speaker: "ishita_enhi_companion", pace: 1.1, muted: true });
    expect(loadPrefs("user-0001")).toMatchObject({ speaker: "ishita_enhi_companion", pace: 1.1, muted: true });
    expect(loadPrefs("user-0002")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs({ speaker: "<evil>", pace: 2, muted: "yes", consentAt: "nope" })).toEqual(DEFAULT_PREFS);
    expect(Object.keys(localStorage)).toEqual(["a4ai.agent.v3.user-0001.pref.voice"]); // the agent prefix: cleared on sign-out
  });
  it("consent keeps the timestamp and is per data-note version", () => {
    const p = withConsent(DEFAULT_PREFS, "2026-11-10", new Date("2026-11-10T10:00:00+05:30"));
    expect(p.consentAt).toBe("2026-11-10T04:30:00.000Z");
    expect(hasConsent(p, "2026-11-10")).toBe(true);
    expect(hasConsent(p, "2027-01-01")).toBe(false);
    expect(hasConsent(DEFAULT_PREFS, "2026-11-10")).toBe(false);
    savePrefs("user-0001", p);
    expect(loadPrefs("user-0001").consentAt).toBe("2026-11-10T04:30:00.000Z");
  });
  it("never stores transcript text (only the known pref fields)", () => {
    savePrefs("user-0001", { ...DEFAULT_PREFS, transcript: "Rahul ki attendance" } as never);
    expect(localStorage.getItem("a4ai.agent.v3.user-0001.pref.voice")).not.toContain("Rahul");
  });
});

describe("ui_action bus + voice start requests", () => {
  beforeEach(() => _resetVoiceSurface());
  it("delivers navigate actions to the mounted listener and survives a throwing one", () => {
    const got: string[] = [];
    const off1 = onUiAction(() => { throw new Error("boom"); });
    const off2 = onUiAction((a) => got.push(a.routeKey));
    emitUiAction({ routeKey: "settings", params: {}, label: null });
    expect(got).toEqual(["settings"]);
    off1(); off2();
    expect(_listenerCount()).toBe(0);
  });
  it("a start request before the dock mounts is delivered once it does", async () => {
    const fn = vi.fn();
    requestVoiceStart();
    onVoiceStartRequest(fn);
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(1);
    requestVoiceStart();
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it("speechSynthesis language from the agent language", () => {
    expect(synthLang("en")).toBe("en-IN");
    expect(synthLang("hi")).toBe("hi-IN");
    expect(synthLang("hi-en")).toBe("hi-IN");
  });
});
