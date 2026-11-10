// One a4ai Agent conversation store for the whole app (module singleton + useSyncExternalStore), so the
// /dashboard?tab=agent workspace and the floating sheet show the same chat, and closing the sheet never loses it.
// Privacy (v3): the SERVER owns chats. Nothing of a conversation is written to localStorage / sessionStorage /
// IndexedDB — only the last open session id and UI prefs (./persist). Opening a chat = GET …/messages, replayed.
// Sign-out or a different user → every agent query, pref and in-memory chat is dropped.
// Streaming: events are queued and applied once per animation frame (one React update per frame, not per token).
// Approval Cancel is LOCAL ONLY — /agent/approve executes the action, so only the Approve button calls it.
import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import { AgentHttpError, isAgentPdfPath } from "./client";
import { getAgentApi, isMissingEndpoint } from "./api";
import { chatReducer, initialChatState, type Block, type ChatAction, type ChatState, type Feedback } from "./chatState";
import type { AgentEvent, ChatRequest, MetaResponse, SessionItem, StoredMessage } from "./types";
import { clearAgentStorage, isSafeId, loadPref, purgeLegacyAgentStorage, savePref, titleFrom } from "./persist";
import { replayMessages } from "./replay";
import { addRecentQuery, agentKeys, findSession, placeSession, removeSession } from "./queries";

export type MetaStatus = "idle" | "loading" | "ok" | "error";
/** Loading the open chat's messages from the server. */
export type LoadStatus = "idle" | "loading" | "ok" | "error";

export interface AgentStoreState {
  uid: string | null;
  /** session id of the open chat, or a temporary "c-…" key until the server gives one */
  activeKey: string;
  chat: ChatState;
  meta: MetaResponse | null;
  metaStatus: MetaStatus;
  /** a request to put text into the composer (Edit on an approval, "Change marks", ScopeCard edit …) */
  draft: { text: string; nonce: number } | null;
  load: LoadStatus;
  /** shown above an opened chat when its messages can't be shown */
  loadNote: string | null;
  /** a request got a 401 even after a token refresh — show "Sign in again" */
  authExpired: boolean;
}

export interface FriendlyError { message: string; code: string; retryAt?: number | null }

/** HTTP / network failure → what the user reads (Hinglish) + a code for the card title. Pure (clock injectable). */
export function friendlyError(err: unknown, now = Date.now()): FriendlyError | null {
  if (err instanceof DOMException && err.name === "AbortError") return null;
  if (err instanceof AgentHttpError) {
    if (err.status === 401) return { code: "unauthorized", message: "Aapka session expire ho gaya. Dobara sign in karein — likha hua text yahin rahega." };
    if (err.status === 403) return { code: "forbidden", message: "a4ai Agent sirf institute staff ke liye hai." };
    if (err.status === 404) return { code: "not_found", message: "Ye chat ya request nahi mili. Naya chat shuru karein." };
    if (err.status === 410) return { code: "expired", message: "Ye approval expire ho gaya. Dobara poochiye, naya approval milega." };
    if (err.status === 422) return { code: "invalid_input", message: "Ye request samajh nahi aayi. Sawaal thoda badal kar poochiye." };
    if (err.status === 429) {
      const sec = err.retryAfterSec ?? 30;
      return { code: "rate_limited", message: `Bahut saari requests. ${sec} second baad dobara try karein.`, retryAt: now + sec * 1000 };
    }
    if (err.status === 503) return { code: "unavailable", message: "a4ai Agent abhi available nahi hai (server busy ya band). Thodi der me retry karein." };
    if (err.status >= 500) return { code: "server", message: `a4ai Agent server me dikkat aayi (HTTP ${err.status}). Retry karein.` };
    return { code: "http", message: `a4ai Agent error (HTTP ${err.status}). Dobara try karein.` };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { code: "offline", message: "Aap offline hain. Internet aate hi Retry dabaiye." };
  }
  return { code: "network", message: "a4ai Agent tak nahi pahunch paye. Connection check karke retry karein." };
}

export const isTempKey = (k: string) => k.startsWith("c-");
const newKey = () => `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const findBlock = (s: ChatState, id: string): Block | undefined => s.turns.flatMap((t) => t.blocks).find((b) => b.id === id);
const MAX_MESSAGE_PAGES = 20; // × 200 = 4000 messages
const raf = (fn: () => void) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 16));

class AgentStore {
  private state: AgentStoreState = {
    uid: null, activeKey: newKey(), chat: initialChatState, meta: null, metaStatus: "idle", draft: null,
    load: "idle", loadNote: null, authExpired: false,
  };
  private listeners = new Set<() => void>();
  private ctrl: AbortController | null = null;
  private loadCtrl: AbortController | null = null;
  private authHooked = false;
  private qc: QueryClient | null = null;
  private queue: { ev: AgentEvent; key: string }[] = [];
  private flushScheduled = false;
  /** latest composer text — memory only, so "Sign in again" (new tab) never loses it */
  composerText = "";

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getState = () => this.state;

  private set(patch: Partial<AgentStoreState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  attachQueryClient(qc: QueryClient) { this.qc = qc; }

  // ---- lifecycle ------------------------------------------------------------------------------
  /** Called by every agent surface with the signed-in user id (idempotent). Reopens the last chat. */
  init(uid: string) {
    if (this.state.uid === uid) return;
    purgeLegacyAgentStorage();
    const prev = this.state.uid;
    this.abort();
    if (prev && prev !== uid) this.forgetUser(prev); // user switch: nothing of the previous user stays
    const last = loadPref(uid, "lastSession");
    const active = isSafeId(last) ? last : null;
    this.set({
      uid, activeKey: active ?? newKey(), chat: active ? { ...initialChatState, sessionId: active } : initialChatState,
      meta: null, metaStatus: "idle", draft: null, load: active ? "loading" : "idle", loadNote: null, authExpired: false,
    });
    void this.refreshMeta();
    if (active) void this.fetchMessages(active);
    this.hookAuth();
  }

  private forgetUser(uid: string | null) {
    if (uid && this.qc) this.qc.removeQueries({ queryKey: agentKeys.all(uid) });
    clearAgentStorage();
    this.composerText = "";
  }

  private hookAuth() {
    if (this.authHooked) return;
    this.authHooked = true;
    void import("@/lib/supabaseClient").then(({ supabase }) => {
      supabase.auth.onAuthStateChange((event, session) => {
        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
          if (this.state.authExpired) this.set({ authExpired: false });
          return;
        }
        if (event !== "SIGNED_OUT") return;
        this.abort();
        this.forgetUser(this.state.uid);
        if (this.qc) this.qc.removeQueries({ queryKey: ["agent"] });
        this.set({ uid: null, chat: initialChatState, meta: null, metaStatus: "idle", activeKey: newKey(), load: "idle", loadNote: null, draft: null, authExpired: false });
      });
      // "Sign in again" happens in another tab: re-check the session when this tab gets focus back
      if (typeof window !== "undefined") {
        window.addEventListener("focus", () => {
          if (!this.state.authExpired) return;
          void supabase.auth.getSession().then(({ data }) => { if (data.session) this.set({ authExpired: false }); });
        });
      }
    }).catch(() => { this.authHooked = false; });
  }

  private onAuthError(err: unknown) {
    if (err instanceof AgentHttpError && err.status === 401) this.set({ authExpired: true });
  }

  async refreshMeta() {
    if (this.state.metaStatus === "loading") return;
    this.set({ metaStatus: "loading" });
    try {
      const api = await getAgentApi();
      this.set({ meta: await api.meta(), metaStatus: "ok" });
    } catch (err) {
      this.onAuthError(err);
      this.set({ metaStatus: "error" });
    }
  }

  private rememberActive() {
    const { uid, activeKey } = this.state;
    if (uid) savePref(uid, "lastSession", isTempKey(activeKey) ? null : activeKey);
  }

  private dispatch(action: ChatAction) {
    this.set({ chat: chatReducer(this.state.chat, action) });
  }

  // ---- chats ----------------------------------------------------------------------------------
  private abort() {
    if (this.ctrl) { this.ctrl.abort(); this.ctrl = null; }
    if (this.loadCtrl) { this.loadCtrl.abort(); this.loadCtrl = null; }
    this.queue = [];
    if (this.state.chat.busy) this.dispatch({ type: "stop" });
  }

  newChat() {
    this.abort();
    this.set({ activeKey: newKey(), chat: initialChatState, load: "idle", loadNote: null });
    this.rememberActive();
  }

  /** Open a chat from the history list: GET …/messages, replayed through the reducer. */
  openSession(sessionId: string, title?: string) {
    if (sessionId === this.state.activeKey && this.state.load !== "error") return;
    this.abort();
    this.set({ activeKey: sessionId, chat: { ...initialChatState, sessionId, title: title ?? null }, load: "loading", loadNote: null });
    this.rememberActive();
    void this.fetchMessages(sessionId);
  }

  retryLoad() { if (!isTempKey(this.state.activeKey)) void this.fetchMessages(this.state.activeKey); }

  private async allMessages(sessionId: string, signal: AbortSignal): Promise<StoredMessage[]> {
    const api = await getAgentApi();
    const all: StoredMessage[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < MAX_MESSAGE_PAGES; i++) {
      const page = await api.getMessages(sessionId, { cursor, limit: 200 }, signal);
      all.push(...page.items);
      cursor = page.next_cursor ?? null;
      if (!cursor) break;
    }
    return all;
  }

  private async fetchMessages(sessionId: string) {
    this.loadCtrl?.abort();
    const ac = new AbortController();
    this.loadCtrl = ac;
    this.set({ load: "loading", loadNote: null });
    try {
      const all = await this.allMessages(sessionId, ac.signal);
      if (ac.signal.aborted || this.state.activeKey !== sessionId || this.state.chat.busy) return;
      const title = this.state.chat.title ?? (this.qc && this.state.uid ? findSession(this.qc, this.state.uid, sessionId)?.title : null) ?? null;
      this.set({ chat: replayMessages(all, sessionId, title), load: "ok", loadNote: null });
    } catch (err) {
      if (ac.signal.aborted || this.state.activeKey !== sessionId) return;
      this.onAuthError(err);
      if (err instanceof AgentHttpError && err.status === 404) {
        // deleted (here or elsewhere), or from another user: forget it and start fresh
        if (this.state.uid) savePref(this.state.uid, "lastSession", null);
        this.set({ activeKey: newKey(), chat: initialChatState, load: "ok", loadNote: "Ye chat ab nahi hai (delete ho chuki hai). Naya chat shuru karein." });
      } else this.set({ load: "error" });
    } finally {
      if (this.loadCtrl === ac) this.loadCtrl = null;
    }
  }

  /**
   * After an answer: the server numbers messages itself (a regenerated answer reuses the old seq), so read the seqs
   * back and put them on our turns (same order). Text stays as streamed; only seqs (for feedback / regenerate /
   * edit) change. Skipped while busy or after the user moved to another chat.
   */
  private async syncSeqs(sessionId: string) {
    try {
      const all = await this.allMessages(sessionId, new AbortController().signal);
      const { chat, activeKey } = this.state;
      if (activeKey !== sessionId || chat.busy || all.length !== chat.turns.length) return;
      if (all.some((m, i) => m.role !== chat.turns[i].role)) return;
      if (all.every((m, i) => m.seq === chat.turns[i].seq)) return;
      this.set({ chat: { ...chat, turns: chat.turns.map((t, i) => ({ ...t, seq: all[i].seq })) } });
    } catch { /* seqs stay as counted locally */ }
  }

  /** History panel: the chat was renamed / deleted elsewhere. */
  sessionRenamed(sessionId: string, title: string) {
    if (this.state.activeKey === sessionId) this.set({ chat: { ...this.state.chat, title } });
  }
  sessionDeleted(sessionId: string) {
    if (this.state.activeKey === sessionId) this.newChat();
  }

  // ---- conversation ---------------------------------------------------------------------------
  /** Apply queued events once per frame: one store update (one React render) per frame while tokens stream. */
  private enqueue(ev: AgentEvent, key: string) {
    this.queue.push({ ev, key });
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    raf(() => this.flushQueue());
  }

  private flushQueue() {
    this.flushScheduled = false;
    const batch = this.queue;
    this.queue = [];
    if (!batch.length) return;
    let chat = this.state.chat;
    let adopt: string | null = null;
    const touched: { id: string; title: string | null }[] = [];
    for (const { ev, key } of batch) {
      if (key !== this.state.activeKey && key !== adopt) continue;
      chat = chatReducer(chat, { type: "event", ev });
      if (ev.type === "session" || ev.type === "final") {
        if (isTempKey(this.state.activeKey)) adopt = ev.session_id;
        touched.push({ id: ev.session_id, title: ev.type === "session" ? ev.title : null });
      }
    }
    this.set(adopt ? { chat, activeKey: adopt } : { chat });
    if (adopt) this.rememberActive();
    for (const t of touched) this.touchSession(t.id, t.title);
  }

  /** Flush synchronously (end of stream) so `end` / errors land after every queued event. */
  private drain() { if (this.queue.length) this.flushQueue(); }

  private stream(body: ChatRequest) {
    const ac = new AbortController();
    this.ctrl = ac;
    const { uid } = this.state;
    if (uid && this.qc && typeof body.regenerate_from_seq !== "number" && body.message) addRecentQuery(this.qc, uid, body.message);
    const keyRef = { key: this.state.activeKey };
    const sameChat = () => this.state.activeKey === keyRef.key || (isTempKey(keyRef.key) && this.state.chat.sessionId === this.state.activeKey);
    void (async () => {
      try {
        const api = await getAgentApi();
        await api.chat({
          body, signal: ac.signal,
          onRequestId: (rid) => { if (!ac.signal.aborted && sameChat() && this.state.chat.busy) this.set({ chat: { ...this.state.chat, requestId: rid } }); },
          onEvent: (ev) => {
            if (ac.signal.aborted) return;
            if (!sameChat()) return;
            this.enqueue(ev, this.state.activeKey);
          },
        });
        this.drain();
        if (sameChat()) this.dispatch({ type: "end" });
        const sid = this.state.chat.sessionId;
        if (sid && sameChat()) void this.syncSeqs(sid);
        if (uid && this.qc) void this.qc.invalidateQueries({ queryKey: agentKeys.queries(uid) });
        if (this.state.metaStatus !== "ok") void this.refreshMeta();
      } catch (err) {
        this.drain();
        if (!sameChat()) return;
        this.onAuthError(err);
        const f = friendlyError(err);
        if (f) this.dispatch({ type: "fail", message: f.message, code: f.code, retryAt: f.retryAt ?? null });
        else this.dispatch({ type: "stop" });
      } finally {
        if (this.ctrl === ac) this.ctrl = null;
      }
    })();
  }

  /** Put / move the session to the top of the cached history lists (no refetch). */
  private touchSession(sessionId: string, title: string | null) {
    const { uid } = this.state;
    if (!uid || !this.qc) return;
    const prev = findSession(this.qc, uid, sessionId);
    const now = new Date().toISOString();
    const s: SessionItem = prev
      ? { ...prev, last_message_at: now, title: prev.title || title || "New chat", message_count: prev.message_count + 1 }
      : { id: sessionId, title: title || this.state.chat.title || titleFrom(this.state.chat.lastUserText ?? ""), created_at: now, last_message_at: now, message_count: 1, pinned: false, preview: null };
    placeSession(this.qc, uid, s);
  }

  send = (raw: string) => {
    const text = raw.trim().slice(0, 4000);
    if (!text || this.state.chat.busy) return;
    if (this.state.load === "loading") { this.loadCtrl?.abort(); this.set({ load: "ok" }); }
    this.dispatch({ type: "send", text });
    this.stream({ message: text, session_id: this.state.chat.sessionId });
  };

  /** Regenerate an assistant answer (the server deletes it and everything after, then re-answers). */
  regenerate = (turnId: string) => {
    const { chat } = this.state;
    if (chat.busy) return;
    const i = chat.turns.findIndex((t) => t.id === turnId);
    const turn = chat.turns[i];
    const user = chat.turns[i - 1];
    if (!turn || turn.role !== "assistant" || !user || user.role !== "user") return;
    this.dispatch({ type: "regenerate", turnId });
    const seq = typeof turn.seq === "number" && chat.sessionId ? turn.seq : null;
    this.stream(seq !== null
      ? { session_id: chat.sessionId, regenerate_from_seq: seq }
      : { message: user.text, session_id: chat.sessionId });
  };

  /** Edit a user message and resend (the server deletes it and everything after). */
  editAndResend = (turnId: string, raw: string) => {
    const text = raw.trim().slice(0, 4000);
    const { chat } = this.state;
    const turn = chat.turns.find((t) => t.id === turnId);
    if (!text || chat.busy || !turn || turn.role !== "user") return;
    this.dispatch({ type: "edit", turnId, text });
    const seq = typeof turn.seq === "number" && chat.sessionId ? turn.seq : null;
    this.stream(seq !== null
      ? { message: text, session_id: chat.sessionId, edit_of_seq: seq }
      : { message: text, session_id: chat.sessionId });
  };

  /**
   * Stop: POST /agent/chat/{request_id}/cancel (the server ends the stream with final.cancelled and stores the
   * partial turn), and stop reading right away. The partial answer stays, marked "stopped".
   */
  stop = () => {
    const rid = this.state.chat.requestId;
    if (rid) void getAgentApi().then((api) => api.cancel(rid)).catch(() => { /* the abort below already stops us */ });
    this.ctrl?.abort();
    this.ctrl = null;
    this.drain();
    this.dispatch({ type: "stop" });
    const sid = this.state.chat.sessionId;
    if (sid) setTimeout(() => void this.syncSeqs(sid), 400); // the server stores the partial turn when its stream ends
  };

  answerClarify = (blockId: string, value: string) => {
    if (this.state.chat.busy) return;
    this.dispatch({ type: "clarify_answered", blockId, value });
    this.send(value);
  };

  /** 👍 / 👎 (+ optional note) → POST /agent/feedback. Shown at once; restored + toast if the server refuses. */
  feedback = (turnId: string, value: Feedback, note?: string | null) => {
    const turn = this.state.chat.turns.find((t) => t.id === turnId);
    if (!turn || !value) return; // the contract has no "clear": a rating can only be replaced
    const before = { value: turn.feedback ?? null, note: turn.feedbackNote ?? null };
    this.dispatch({ type: "feedback", turnId, value, note: note ?? null });
    const sid = this.state.chat.sessionId;
    if (!sid || typeof turn.seq !== "number") return;
    void (async () => {
      try {
        const api = await getAgentApi();
        await api.feedback({ session_id: sid, message_seq: turn.seq as number, rating: value, note: value === "down" ? (note || null) : null });
        if (note && value === "down") toast.success("Shukriya — feedback mil gaya.");
      } catch (err) {
        this.onAuthError(err);
        this.dispatch({ type: "feedback", turnId, value: before.value, note: before.note });
        toast.error(isMissingEndpoint(err) ? "Ye message server par nahi mila, feedback save nahi hua." : "Feedback save nahi hua. Dobara try karein.");
      }
    })();
  };

  prefill = (text: string) => this.set({ draft: { text, nonce: (this.state.draft?.nonce ?? 0) + 1 } });

  approve = (blockId: string) => {
    const b = findBlock(this.state.chat, blockId);
    const sessionId = this.state.chat.sessionId;
    if (!b || b.kind !== "approval" || !(b.state === "pending" || b.state === "failed")) return;
    if (Date.parse(b.ev.expires_at) < Date.now()) { this.dispatch({ type: "approval", blockId, state: "expired" }); return; }
    if (!sessionId) {
      this.dispatch({ type: "approval", blockId, state: "failed", error: "Chat session abhi tayyar nahi. Dobara poochiye, phir approve karein." });
      return;
    }
    this.dispatch({ type: "approval", blockId, state: "approving" });
    void (async () => {
      try {
        const api = await getAgentApi();
        const r = await api.approve({ sessionId, approvalId: b.ev.approval_id });
        this.dispatch({ type: "approval", blockId, state: "approved", result: r });
      } catch (err) {
        this.onAuthError(err);
        if (err instanceof AgentHttpError && err.status === 410) { this.dispatch({ type: "approval", blockId, state: "expired" }); return; }
        this.dispatch({ type: "approval", blockId, state: "failed", error: friendlyError(err)?.message ?? "Approval nahi ho paya." });
      }
    })();
  };

  cancelApproval = (blockId: string) => {
    const b = findBlock(this.state.chat, blockId);
    if (b?.kind === "approval" && (b.state === "pending" || b.state === "failed")) this.dispatch({ type: "approval", blockId, state: "cancelled" });
  };

  download = (blockId: string) => {
    const b = findBlock(this.state.chat, blockId);
    if (!b || b.kind !== "approval" || b.state !== "approved") return; // download only after a successful approve
    const path = b.result?.download_path;
    if (!isAgentPdfPath(path)) return;
    void (async () => {
      try {
        const api = await getAgentApi();
        await api.downloadPdf({ path, filename: "a4ai-test.pdf" });
      } catch (err) {
        this.dispatch({ type: "approval", blockId, state: "approved", error: friendlyError(err)?.message ?? "Download nahi ho paya." });
      }
    })();
  };

  /** `file` card: GET /agent/files/{id} with the user's token. 404 / 410 → expired. */
  downloadFile = (blockId: string) => {
    const b = findBlock(this.state.chat, blockId);
    if (!b || b.kind !== "file" || b.state === "downloading" || b.state === "expired") return;
    if (b.ev.expires_at && Date.parse(b.ev.expires_at) < Date.now()) { this.dispatch({ type: "file", blockId, state: "expired" }); return; }
    this.dispatch({ type: "file", blockId, state: "downloading" });
    void (async () => {
      try {
        const api = await getAgentApi();
        await api.downloadFile({ fileId: b.ev.file_id, filename: b.ev.name });
        this.dispatch({ type: "file", blockId, state: "done" });
      } catch (err) {
        this.onAuthError(err);
        if (err instanceof AgentHttpError && (err.status === 404 || err.status === 410)) { this.dispatch({ type: "file", blockId, state: "expired" }); return; }
        this.dispatch({ type: "file", blockId, state: "failed", error: friendlyError(err)?.message ?? "Download nahi ho paya." });
      }
    })();
  };

  /** Session list deleted the open chat while the Undo toast is still up — keep it out of the cache list too. */
  forgetSession(sessionId: string) {
    const { uid } = this.state;
    if (uid && this.qc) removeSession(this.qc, uid, sessionId);
  }

  /** Tests only: a fresh store state (no user). */
  _reset() {
    this.abort();
    this.state = { uid: null, activeKey: newKey(), chat: initialChatState, meta: null, metaStatus: "idle", draft: null, load: "idle", loadNote: null, authExpired: false };
    this.composerText = "";
  }
}

export const agentStore = new AgentStore();

/** Subscribe a component to the shared agent store; `uid` (signed-in user id) loads that user's chats. */
export function useAgentStore(uid: string | null | undefined, qc?: QueryClient): AgentStoreState {
  const s = useSyncExternalStore(agentStore.subscribe, agentStore.getState, agentStore.getState);
  useEffect(() => { if (qc) agentStore.attachQueryClient(qc); }, [qc]);
  useEffect(() => { if (uid) agentStore.init(uid); }, [uid]);
  return s;
}
