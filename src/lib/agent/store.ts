// One a4ai Agent conversation store for the whole app (module singleton + useSyncExternalStore), so the
// /dashboard?tab=agent workspace and the floating sheet show the same chat, and closing the sheet never loses it.
// Persistence: ./persist (this device, per user). Approval Cancel is LOCAL ONLY — /agent/approve executes the
// action, so only the Approve button calls it; an unapproved request simply expires on the server.
import { useEffect, useSyncExternalStore } from "react";
import {
  AgentHttpError, agentDevRole, approve as approveApi, downloadAgentPdf, fetchAgentMeta, fetchAgentSessions,
  getAgentToken, isAgentPdfPath, streamChat,
} from "./client";
import { chatReducer, initialChatState, type Block, type ChatAction, type ChatState, type Feedback } from "./chatState";
import type { AgentMeta, AgentSessionInfo } from "./events";
import {
  clearUser, loadChat, loadIndex, removeChat, saveChat, saveIndex, titleFrom, type ChatIndex, type ChatMeta,
} from "./persist";

export type MetaStatus = "idle" | "loading" | "ok" | "error";

export interface ChatListItem {
  key: string; sessionId: string | null; title: string; updatedAt: number;
  /** listed by the server only — no turns on this device */ remoteOnly: boolean;
}

export interface AgentStoreState {
  uid: string | null;
  activeKey: string;
  chat: ChatState;
  index: ChatIndex;
  remote: AgentSessionInfo[];
  meta: AgentMeta | null;
  metaStatus: MetaStatus;
  /** a request to put text into the composer (Edit on an approval, "Change marks", …) */
  draft: { text: string; nonce: number } | null;
  /** the open chat came from the server list and its earlier turns aren't on this device */
  remoteOnly: boolean;
}

export function friendlyError(err: unknown): { message: string; code: string } | null {
  if (err instanceof DOMException && err.name === "AbortError") return null;
  if (err instanceof AgentHttpError) {
    if (err.status === 401) return { code: "unauthorized", message: "Aapka session expire ho gaya. Dobara sign in karke retry karein." };
    if (err.status === 403) return { code: "forbidden", message: "a4ai Agent sirf institute staff ke liye hai." };
    if (err.status === 404) return { code: "not_found", message: "Ye chat ya request nahi mili. Naya chat shuru karein." };
    if (err.status === 410) return { code: "expired", message: "Ye approval expire ho gaya. Dobara poochiye, naya approval milega." };
    if (err.status === 429) return { code: "rate_limited", message: "Bahut saari requests. Ek minute ruk kar retry karein." };
    return { code: "http", message: `a4ai Agent error (HTTP ${err.status}). Dobara try karein.` };
  }
  return { code: "network", message: "a4ai Agent tak nahi pahunch paye. Connection check karke retry karein." };
}

const newKey = () => `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const ts = (iso: string) => { const n = Date.parse(iso); return Number.isFinite(n) ? n : 0; };

/** Local chats ∪ server sessions (server-only ones are marked remoteOnly), newest first. Pure. */
export function mergeChatList(index: ChatIndex, remote: AgentSessionInfo[]): ChatListItem[] {
  const hidden = new Set(index.hidden);
  const bySession = new Map(remote.map((r) => [r.session_id, r]));
  const out: ChatListItem[] = index.chats.map((c) => {
    const r = c.sessionId ? bySession.get(c.sessionId) : undefined;
    return { key: c.key, sessionId: c.sessionId, title: c.title, updatedAt: Math.max(c.updatedAt, r ? ts(r.updated_at) : 0), remoteOnly: false };
  });
  const local = new Set(index.chats.map((c) => c.sessionId).filter(Boolean));
  for (const r of remote) {
    if (local.has(r.session_id) || hidden.has(r.session_id)) continue;
    out.push({ key: `remote:${r.session_id}`, sessionId: r.session_id, title: r.title, updatedAt: ts(r.updated_at), remoteOnly: true });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

const findBlock = (s: ChatState, id: string): Block | undefined => s.turns.flatMap((t) => t.blocks).find((b) => b.id === id);

class AgentStore {
  private state: AgentStoreState = {
    uid: null, activeKey: newKey(), chat: initialChatState, index: { chats: [], hidden: [], activeKey: null },
    remote: [], meta: null, metaStatus: "idle", draft: null, remoteOnly: false,
  };
  private listeners = new Set<() => void>();
  private ctrl: AbortController | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private authHooked = false;

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getState = () => this.state;

  private set(patch: Partial<AgentStoreState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  // ---- lifecycle ------------------------------------------------------------------------------
  /** Called by every agent surface with the signed-in user id (idempotent). */
  init(uid: string) {
    if (this.state.uid === uid) return;
    this.abort();
    const index = loadIndex(uid);
    const active = index.activeKey && index.chats.some((c) => c.key === index.activeKey) ? index.activeKey : null;
    const chat = active ? loadChat(uid, active) : null;
    this.set({
      uid, index, activeKey: active && chat ? active : newKey(), chat: chat ?? initialChatState,
      remote: [], meta: null, metaStatus: "idle", draft: null, remoteOnly: false,
    });
    void this.refreshMeta();
    void this.refreshSessions();
    this.hookSignOut();
  }

  private hookSignOut() {
    if (this.authHooked) return;
    this.authHooked = true;
    void import("@/lib/supabaseClient").then(({ supabase }) => {
      supabase.auth.onAuthStateChange((event) => {
        if (event !== "SIGNED_OUT") return;
        const uid = this.state.uid;
        this.abort();
        if (uid) clearUser(uid);
        this.set({ uid: null, chat: initialChatState, index: { chats: [], hidden: [], activeKey: null }, remote: [], meta: null, metaStatus: "idle", activeKey: newKey() });
      });
    }).catch(() => { this.authHooked = false; });
  }

  private async token(): Promise<string | null> {
    const t = await getAgentToken().catch(() => null);
    if (!t && !agentDevRole()) throw new AgentHttpError(401, "no token");
    return t;
  }

  async refreshMeta() {
    if (this.state.metaStatus === "loading") return;
    this.set({ metaStatus: "loading" });
    try {
      const meta = await fetchAgentMeta(await this.token());
      this.set({ meta, metaStatus: "ok" });
    } catch {
      this.set({ metaStatus: "error" });
    }
  }

  async refreshSessions() {
    try {
      const remote = await fetchAgentSessions(await this.token());
      this.set({ remote });
    } catch { /* the list just stays local */ }
  }

  // ---- persistence ----------------------------------------------------------------------------
  private persist(immediate: boolean) {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    if (immediate) { this.flush(); return; }
    this.saveTimer = setTimeout(() => this.flush(), 600);
  }

  private flush() {
    const { uid, activeKey, chat, index } = this.state;
    if (!uid || chat.turns.length === 0) return;
    saveChat(uid, activeKey, chat);
    const now = Date.now();
    const existing = index.chats.find((c) => c.key === activeKey);
    const firstUser = chat.turns.find((t) => t.role === "user")?.text ?? "";
    const meta: ChatMeta = existing
      ? { ...existing, sessionId: chat.sessionId ?? existing.sessionId, updatedAt: now }
      : { key: activeKey, sessionId: chat.sessionId, title: titleFrom(firstUser), createdAt: now, updatedAt: now };
    const next = saveIndex(uid, { ...index, activeKey, chats: [meta, ...index.chats.filter((c) => c.key !== activeKey)] });
    this.set({ index: next });
  }

  private dispatch(action: ChatAction, immediate = true) {
    this.set({ chat: chatReducer(this.state.chat, action) });
    this.persist(immediate);
  }

  // ---- chats ----------------------------------------------------------------------------------
  private abort() {
    if (this.ctrl) { this.ctrl.abort(); this.ctrl = null; }
    if (this.state.chat.busy) this.dispatch({ type: "stop" });
  }

  newChat() {
    this.abort();
    this.flush();
    const { uid, index } = this.state;
    if (uid) saveIndex(uid, { ...index, activeKey: null });
    this.set({ activeKey: newKey(), chat: initialChatState, remoteOnly: false, index: { ...index, activeKey: null } });
  }

  openChat(key: string) {
    if (key === this.state.activeKey) return;
    this.abort();
    this.flush();
    const { uid, index, remote } = this.state;
    if (key.startsWith("remote:")) {
      const sid = key.slice("remote:".length);
      const r = remote.find((x) => x.session_id === sid);
      const k = newKey();
      const meta: ChatMeta = { key: k, sessionId: sid, title: r?.title ?? "Chat", createdAt: ts(r?.created_at ?? ""), updatedAt: ts(r?.updated_at ?? "") };
      const nextIndex = { ...index, activeKey: k, chats: [meta, ...index.chats] };
      if (uid) saveIndex(uid, nextIndex);
      this.set({ activeKey: k, chat: { ...initialChatState, sessionId: sid }, remoteOnly: true, index: nextIndex });
      return;
    }
    const chat = uid ? loadChat(uid, key) : null;
    const meta = index.chats.find((c) => c.key === key);
    const nextIndex = { ...index, activeKey: key };
    if (uid) saveIndex(uid, nextIndex);
    this.set({
      activeKey: key, index: nextIndex,
      chat: chat ?? { ...initialChatState, sessionId: meta?.sessionId ?? null },
      remoteOnly: !chat && !!meta?.sessionId,
    });
  }

  renameChat(key: string, title: string) {
    const t = title.trim().slice(0, 80);
    const { uid, index } = this.state;
    if (!t || !uid) return;
    const next = saveIndex(uid, { ...index, chats: index.chats.map((c) => (c.key === key ? { ...c, title: t, renamed: true } : c)) });
    this.set({ index: next });
  }

  /** Removes the chat from this device (a server session id is hidden so the list doesn't bring it back). */
  deleteChat(key: string) {
    const { uid, index, activeKey } = this.state;
    if (!uid) return;
    let sid: string | null = null;
    if (key.startsWith("remote:")) sid = key.slice("remote:".length);
    else sid = index.chats.find((c) => c.key === key)?.sessionId ?? null;
    if (key === activeKey) this.abort();
    removeChat(uid, key);
    const next = saveIndex(uid, {
      chats: index.chats.filter((c) => c.key !== key),
      hidden: sid ? [...index.hidden.filter((h) => h !== sid), sid] : index.hidden,
      activeKey: key === activeKey ? null : index.activeKey,
    });
    this.set(key === activeKey
      ? { index: next, activeKey: newKey(), chat: initialChatState, remoteOnly: false }
      : { index: next });
  }

  // ---- conversation ---------------------------------------------------------------------------
  send = (raw: string) => {
    const text = raw.trim().slice(0, 4000);
    if (!text || this.state.chat.busy) return;
    this.dispatch({ type: "send", text });
    const ac = new AbortController();
    this.ctrl = ac;
    const key = this.state.activeKey;
    void (async () => {
      try {
        const token = await this.token();
        await streamChat({
          message: text, sessionId: this.state.chat.sessionId, token, signal: ac.signal,
          onEvent: (ev) => {
            if (ac.signal.aborted || this.state.activeKey !== key) return;
            this.dispatch({ type: "event", ev }, ev.type === "final" || ev.type === "error");
          },
        });
        if (this.state.activeKey === key) this.dispatch({ type: "end" });
        void this.refreshSessions();
        if (this.state.metaStatus !== "ok") void this.refreshMeta();
      } catch (err) {
        if (this.state.activeKey !== key) return;
        const f = friendlyError(err);
        if (f) this.dispatch({ type: "fail", ...f });
        else this.dispatch({ type: "stop" });
      } finally {
        if (this.ctrl === ac) this.ctrl = null;
      }
    })();
  };

  stop = () => {
    this.ctrl?.abort();
    this.ctrl = null;
    this.dispatch({ type: "stop" });
  };

  answerClarify = (blockId: string, value: string) => {
    if (this.state.chat.busy) return;
    this.dispatch({ type: "clarify_answered", blockId, value });
    this.send(value);
  };

  feedback = (turnId: string, value: Feedback) => this.dispatch({ type: "feedback", turnId, value });

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
        const r = await approveApi({ sessionId, approvalId: b.ev.approval_id, token: await this.token() });
        this.dispatch({ type: "approval", blockId, state: "approved", result: r });
      } catch (err) {
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
        await downloadAgentPdf({ path, token: await this.token(), filename: "a4ai-test.pdf" });
      } catch (err) {
        this.dispatch({ type: "approval", blockId, state: "approved", error: friendlyError(err)?.message ?? "Download nahi ho paya." });
      }
    })();
  };
}

export const agentStore = new AgentStore();

/** Subscribe a component to the shared agent store; `uid` (signed-in user id) loads that user's history. */
export function useAgentStore(uid: string | null | undefined): AgentStoreState {
  const s = useSyncExternalStore(agentStore.subscribe, agentStore.getState, agentStore.getState);
  useEffect(() => { if (uid) agentStore.init(uid); }, [uid]);
  return s;
}
