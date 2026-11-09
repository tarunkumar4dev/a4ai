// One a4ai Agent conversation store for the whole app (module singleton + useSyncExternalStore), so the
// /dashboard?tab=agent workspace and the floating sheet show the same chat, and closing the sheet never loses it.
// v2: the SERVER owns history (GET /agent/sessions, …/messages). This device keeps a cache of recent chats
// (./persist) so a chat opens instantly and still shows when offline or on a v1 backend without /messages.
// Approval Cancel is LOCAL ONLY — /agent/approve executes the action, so only the Approve button calls it.
import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import { AgentHttpError, isAgentPdfPath } from "./client";
import { getAgentApi, isMissingEndpoint } from "./api";
import { chatReducer, initialChatState, type Block, type ChatAction, type ChatState, type Feedback } from "./chatState";
import type { AgentMeta, ChatRequestBody, SessionSummary, StoredMessage } from "./types";
import { clearUser, loadChat, loadIndex, removeChat, saveChat, saveIndex, titleFrom, type ChatIndex, type ChatMeta } from "./persist";
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
  meta: AgentMeta | null;
  metaStatus: MetaStatus;
  /** a request to put text into the composer (Edit on an approval, "Change marks", ScopeCard edit …) */
  draft: { text: string; nonce: number } | null;
  load: LoadStatus;
  /** shown above an opened chat: why earlier turns are missing / this is an offline copy */
  loadNote: string | null;
  /** the last request got a 401 — show the "sign in again" prompt */
  authExpired: boolean;
}

export function friendlyError(err: unknown): { message: string; code: string } | null {
  if (err instanceof DOMException && err.name === "AbortError") return null;
  if (err instanceof AgentHttpError) {
    if (err.status === 401) return { code: "unauthorized", message: "Aapka session expire ho gaya. Dobara sign in karein — likha hua text save rahega." };
    if (err.status === 403) return { code: "forbidden", message: "a4ai Agent sirf institute staff ke liye hai." };
    if (err.status === 404) return { code: "not_found", message: "Ye chat ya request nahi mili. Naya chat shuru karein." };
    if (err.status === 410) return { code: "expired", message: "Ye approval expire ho gaya. Dobara poochiye, naya approval milega." };
    if (err.status === 429) return { code: "rate_limited", message: "Bahut saari requests. Ek minute ruk kar retry karein." };
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
const MAX_MESSAGE_PAGES = 25;

class AgentStore {
  private state: AgentStoreState = {
    uid: null, activeKey: newKey(), chat: initialChatState, meta: null, metaStatus: "idle", draft: null,
    load: "idle", loadNote: null, authExpired: false,
  };
  private index: ChatIndex = { chats: [], hidden: [], activeKey: null };
  private listeners = new Set<() => void>();
  private ctrl: AbortController | null = null;
  private loadCtrl: AbortController | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private authHooked = false;
  private qc: QueryClient | null = null;
  /** latest composer text (not state: no re-render per keystroke) — saved when the user signs in again */
  composerText = "";

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getState = () => this.state;

  private set(patch: Partial<AgentStoreState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  attachQueryClient(qc: QueryClient) { this.qc = qc; }

  // ---- lifecycle ------------------------------------------------------------------------------
  /** Called by every agent surface with the signed-in user id (idempotent). Restores the last open chat. */
  init(uid: string) {
    if (this.state.uid === uid) return;
    this.abort();
    this.index = loadIndex(uid);
    const active = this.index.activeKey;
    const cached = active ? loadChat(uid, active) : null;
    this.set({
      uid, activeKey: active ?? newKey(), chat: cached ?? (active && !isTempKey(active) ? { ...initialChatState, sessionId: active } : initialChatState),
      meta: null, metaStatus: "idle", draft: null, load: "idle", loadNote: null, authExpired: false,
    });
    void this.refreshMeta();
    if (active && !isTempKey(active)) void this.fetchMessages(active, !!cached);
    this.hookSignOut();
  }

  private hookSignOut() {
    if (this.authHooked) return;
    this.authHooked = true;
    void import("@/lib/supabaseClient").then(({ supabase }) => {
      supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") { if (this.state.authExpired) this.set({ authExpired: false }); return; }
        if (event !== "SIGNED_OUT") return;
        const uid = this.state.uid;
        this.abort();
        if (uid) clearUser(uid);
        if (uid && this.qc) this.qc.removeQueries({ queryKey: agentKeys.all(uid) });
        this.index = { chats: [], hidden: [], activeKey: null };
        this.set({ uid: null, chat: initialChatState, meta: null, metaStatus: "idle", activeKey: newKey(), load: "idle", loadNote: null });
      });
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

  // ---- local cache ----------------------------------------------------------------------------
  private persist(immediate: boolean) {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    if (immediate) { this.flush(); return; }
    this.saveTimer = setTimeout(() => this.flush(), 600);
  }

  private flush() {
    const { uid, activeKey, chat } = this.state;
    if (!uid) return;
    if (chat.turns.length === 0) { this.writeActive(); return; }
    saveChat(uid, activeKey, chat);
    const now = Date.now();
    const existing = this.index.chats.find((c) => c.key === activeKey);
    const firstUser = chat.turns.find((t) => t.role === "user")?.text ?? "";
    const meta: ChatMeta = existing
      ? { ...existing, sessionId: chat.sessionId ?? existing.sessionId, title: chat.title ?? existing.title, updatedAt: now }
      : { key: activeKey, sessionId: chat.sessionId, title: chat.title ?? titleFrom(firstUser), createdAt: now, updatedAt: now };
    this.index = saveIndex(uid, { ...this.index, activeKey, chats: [meta, ...this.index.chats.filter((c) => c.key !== activeKey)] });
  }

  private writeActive() {
    const { uid, activeKey, chat } = this.state;
    if (!uid) return;
    const key = chat.turns.length || !isTempKey(activeKey) ? activeKey : null;
    this.index = saveIndex(uid, { ...this.index, activeKey: key });
  }

  private dispatch(action: ChatAction, immediate = true) {
    this.set({ chat: chatReducer(this.state.chat, action) });
    this.persist(immediate);
  }

  /** The temporary key became a real session: move the cached chat under the session id. */
  private adoptSession(sessionId: string) {
    const { uid, activeKey } = this.state;
    if (!uid || activeKey === sessionId) return;
    if (isTempKey(activeKey)) {
      removeChat(uid, activeKey);
      this.index = { ...this.index, chats: this.index.chats.filter((c) => c.key !== activeKey) };
    }
    this.set({ activeKey: sessionId });
    this.flush();
  }

  // ---- chats ----------------------------------------------------------------------------------
  private abort() {
    if (this.ctrl) { this.ctrl.abort(); this.ctrl = null; }
    if (this.loadCtrl) { this.loadCtrl.abort(); this.loadCtrl = null; }
    if (this.state.chat.busy) this.dispatch({ type: "stop" });
  }

  newChat() {
    this.abort();
    this.flush();
    this.set({ activeKey: newKey(), chat: initialChatState, load: "idle", loadNote: null });
    this.writeActive();
  }

  /** Open a chat from the history list: cached copy at once (if any), then the server's messages. */
  openSession(sessionId: string, title?: string) {
    if (sessionId === this.state.activeKey && this.state.load !== "error") return;
    this.abort();
    this.flush();
    const { uid } = this.state;
    const cached = uid ? loadChat(uid, sessionId) : null;
    this.set({
      activeKey: sessionId, chat: cached ? { ...cached, title: title ?? cached.title ?? null } : { ...initialChatState, sessionId, title: title ?? null },
      load: "loading", loadNote: null,
    });
    this.writeActive();
    void this.fetchMessages(sessionId, !!cached);
  }

  retryLoad() { if (!isTempKey(this.state.activeKey)) void this.fetchMessages(this.state.activeKey, this.state.chat.turns.length > 0); }

  private async fetchMessages(sessionId: string, hasCache: boolean) {
    this.loadCtrl?.abort();
    const ac = new AbortController();
    this.loadCtrl = ac;
    this.set({ load: "loading", loadNote: null });
    try {
      const api = await getAgentApi();
      const all: StoredMessage[] = [];
      let cursor: string | null = null;
      for (let i = 0; i < MAX_MESSAGE_PAGES; i++) {
        const page = await api.getMessages(sessionId, cursor, ac.signal);
        all.unshift(...page.messages);
        cursor = page.next_cursor;
        if (!cursor) break;
      }
      if (ac.signal.aborted || this.state.activeKey !== sessionId || this.state.chat.busy) return;
      const title = this.state.chat.title ?? (this.qc && this.state.uid ? findSession(this.qc, this.state.uid, sessionId)?.title : null) ?? null;
      this.set({ chat: replayMessages(all, sessionId, title), load: "ok", loadNote: null });
      this.persist(true);
    } catch (err) {
      if (ac.signal.aborted || this.state.activeKey !== sessionId) return;
      this.onAuthError(err);
      if (hasCache) this.set({ load: "ok", loadNote: "Server se nahi mila — ye is device par saved copy hai." });
      else if (isMissingEndpoint(err)) this.set({ load: "ok", loadNote: "Is chat ki purani baatein yahan nahi dikh sakti. Yahin se aage poochh sakte hain." });
      else this.set({ load: "error" });
    } finally {
      if (this.loadCtrl === ac) this.loadCtrl = null;
    }
  }

  /** History panel: the chat was renamed / deleted elsewhere. */
  sessionRenamed(sessionId: string, title: string) {
    if (this.state.activeKey === sessionId) { this.set({ chat: { ...this.state.chat, title } }); this.persist(false); }
  }
  sessionDeleted(sessionId: string) {
    const { uid } = this.state;
    if (uid) removeChat(uid, sessionId);
    this.index = { ...this.index, chats: this.index.chats.filter((c) => c.key !== sessionId) };
    if (this.state.activeKey === sessionId) this.newChat();
    else if (uid) this.index = saveIndex(uid, this.index);
  }

  // ---- conversation ---------------------------------------------------------------------------
  private stream(body: ChatRequestBody) {
    const ac = new AbortController();
    this.ctrl = ac;
    const startKey = this.state.activeKey;
    let key = startKey;
    const { uid } = this.state;
    if (uid && this.qc && typeof body.regenerate_from_seq !== "number") addRecentQuery(this.qc, uid, body.message);
    void (async () => {
      try {
        const api = await getAgentApi();
        await api.chat({
          body, signal: ac.signal,
          onEvent: (ev) => {
            if (ac.signal.aborted || this.state.activeKey !== key) return;
            this.dispatch({ type: "event", ev }, ev.type === "final" || ev.type === "error" || ev.type === "session");
            if (ev.type === "session" || ev.type === "final") {
              if (isTempKey(key)) { this.adoptSession(ev.session_id); key = ev.session_id; }
              this.touchSession(ev.session_id, ev.type === "session" ? ev.title : null);
            }
          },
        });
        if (this.state.activeKey === key) this.dispatch({ type: "end" });
        if (uid && this.qc) void this.qc.invalidateQueries({ queryKey: agentKeys.queries(uid) });
        if (this.state.metaStatus !== "ok") void this.refreshMeta();
      } catch (err) {
        if (this.state.activeKey !== key) return;
        this.onAuthError(err);
        const f = friendlyError(err);
        if (f) this.dispatch({ type: "fail", ...f });
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
    const s: SessionSummary = prev
      ? { ...prev, updated_at: now, title: prev.title || title || "New chat" }
      : { session_id: sessionId, title: title || this.state.chat.title || titleFrom(this.state.chat.lastUserText ?? ""), created_at: now, updated_at: now, pinned: false };
    placeSession(this.qc, uid, s);
  }

  send = (raw: string) => {
    const text = raw.trim().slice(0, 4000);
    if (!text || this.state.chat.busy) return;
    if (this.state.load === "loading") { this.loadCtrl?.abort(); this.set({ load: "ok" }); }
    this.dispatch({ type: "send", text });
    this.stream({ message: text, session_id: this.state.chat.sessionId });
  };

  /** Regenerate an assistant answer (replaces it and anything after it). */
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
      ? { message: user.text, session_id: chat.sessionId, regenerate_from_seq: seq }
      : { message: user.text, session_id: chat.sessionId });
  };

  /** Edit a user message and resend (replaces it and everything after it). */
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

  /** Stop: cancel on the server (best effort), stop reading, keep the partial answer (marked "stopped"). */
  stop = () => {
    const rid = this.state.chat.requestId;
    if (rid) void getAgentApi().then((api) => api.cancel(rid)).catch(() => { /* the abort below already stops us */ });
    this.ctrl?.abort();
    this.ctrl = null;
    this.dispatch({ type: "stop" });
  };

  answerClarify = (blockId: string, value: string) => {
    if (this.state.chat.busy) return;
    this.dispatch({ type: "clarify_answered", blockId, value });
    this.send(value);
  };

  /** Thumbs up/down (+ optional note). Saved on the server when the message has a seq; local state either way. */
  feedback = (turnId: string, value: Feedback, note?: string | null) => {
    const turn = this.state.chat.turns.find((t) => t.id === turnId);
    const before = turn ? { value: turn.feedback ?? null, note: turn.feedbackNote ?? null } : null;
    this.dispatch({ type: "feedback", turnId, value, note: note ?? null });
    const sid = this.state.chat.sessionId;
    if (!turn || !sid || typeof turn.seq !== "number") return;
    void (async () => {
      try {
        const api = await getAgentApi();
        await api.feedback({ session_id: sid, message_seq: turn.seq as number, rating: value, note: value === "down" ? note ?? null : null });
        if (note && value === "down") toast.success("Shukriya — feedback mil gaya.");
      } catch (err) {
        if (isMissingEndpoint(err)) return; // v1 backend: stays on this device
        this.onAuthError(err);
        if (before) this.dispatch({ type: "feedback", turnId, value: before.value, note: before.note });
        toast.error("Feedback save nahi hua. Dobara try karein.");
      }
    })();
  };

  prefill = (text: string) => this.set({ draft: { text, nonce: (this.state.draft?.nonce ?? 0) + 1 } });

  approve = (blockId: string) => {
    const b = findBlock(this.state.chat, blockId);
    const sessionId = this.state.chat.sessionId;
    if (!b || b.kind !== "approval" || !(b.state === "pending" || b.state === "failed")) return;
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

  /** Session list deleted the open chat while the Undo toast is still up — keep it out of the cache list too. */
  forgetSession(sessionId: string) {
    const { uid } = this.state;
    if (uid && this.qc) removeSession(this.qc, uid, sessionId);
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
