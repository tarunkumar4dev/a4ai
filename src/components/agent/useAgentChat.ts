// Chat controller for the "Ask a4ai" panel. State lives here (in the always-mounted launcher), so closing the
// sheet or an error never clears the history. Cancel on an approval is LOCAL ONLY: /agent/approve executes the
// action, so it is called solely by the Approve button; an unapproved request simply expires (15 min).
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { AgentHttpError, agentDevRole, approve as approveApi, downloadAgentPdf, getAgentToken, isAgentPdfPath, streamChat } from "@/lib/agent/client";
import { chatReducer, initialChatState, type Block, type ChatState } from "@/lib/agent/chatState";

export interface AgentChat {
  state: ChatState;
  send: (text: string) => void;
  answerClarify: (blockId: string, value: string) => void;
  approve: (blockId: string) => void;
  cancelApproval: (blockId: string) => void;
  download: (blockId: string) => void;
  stop: () => void;
}

export function friendlyError(err: unknown): { message: string; code: string } | null {
  if (err instanceof DOMException && err.name === "AbortError") return null;
  if (err instanceof AgentHttpError) {
    if (err.status === 401) return { code: "unauthorized", message: "Your session expired. Sign in again, then retry." };
    if (err.status === 403) return { code: "forbidden", message: "a4ai Agent is available to institute staff only." };
    if (err.status === 404) return { code: "not_found", message: "This chat or request was not found." };
    if (err.status === 410) return { code: "expired", message: "This approval expired. Ask again to get a new one." };
    if (err.status === 429) return { code: "rate_limited", message: "Too many requests. Wait a minute and retry." };
    return { code: "http", message: `a4ai Agent error (HTTP ${err.status}). Try again.` };
  }
  return { code: "network", message: "Can't reach a4ai Agent. Check your connection and try again." };
}

const findBlock = (s: ChatState, id: string): Block | undefined =>
  s.turns.flatMap((t) => t.blocks).find((b) => b.id === id);

export function useAgentChat(): AgentChat {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const ref = useRef(state);
  ref.current = state;
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => () => ctrl.current?.abort(), []);

  const send = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text || ref.current.busy) return;
    dispatch({ type: "send", text });
    const ac = new AbortController();
    ctrl.current = ac;
    void (async () => {
      try {
        const token = await getAgentToken();
        if (!token && !agentDevRole()) {
          dispatch({ type: "fail", code: "unauthorized", message: "Please sign in to use a4ai Agent." });
          return;
        }
        await streamChat({
          message: text, sessionId: ref.current.sessionId, token, signal: ac.signal,
          onEvent: (ev) => dispatch({ type: "event", ev }),
        });
        dispatch({ type: "end" });
      } catch (err) {
        const f = friendlyError(err);
        if (f) dispatch({ type: "fail", ...f });
        else dispatch({ type: "end" });
      }
    })();
  }, []);

  const answerClarify = useCallback((blockId: string, value: string) => {
    if (ref.current.busy) return;
    dispatch({ type: "clarify_answered", blockId, value });
    send(value);
  }, [send]);

  const approve = useCallback((blockId: string) => {
    const b = findBlock(ref.current, blockId);
    const sessionId = ref.current.sessionId;
    if (!b || b.kind !== "approval" || !(b.state === "pending" || b.state === "failed")) return;
    if (!sessionId) {
      dispatch({ type: "approval", blockId, state: "failed", error: "No chat session yet. Ask again, then approve." });
      return;
    }
    dispatch({ type: "approval", blockId, state: "approving" });
    void (async () => {
      try {
        const token = await getAgentToken();
        if (!token && !agentDevRole()) throw new AgentHttpError(401, "no token");
        const r = await approveApi({ sessionId, approvalId: b.ev.approval_id, token });
        dispatch({ type: "approval", blockId, state: "approved", result: r });
      } catch (err) {
        dispatch({ type: "approval", blockId, state: "failed", error: friendlyError(err)?.message ?? "Approval failed." });
      }
    })();
  }, []);

  const cancelApproval = useCallback((blockId: string) => {
    const b = findBlock(ref.current, blockId);
    if (b?.kind === "approval" && (b.state === "pending" || b.state === "failed")) dispatch({ type: "approval", blockId, state: "cancelled" });
  }, []);

  const download = useCallback((blockId: string) => {
    const b = findBlock(ref.current, blockId);
    if (!b || b.kind !== "approval" || b.state !== "approved") return; // download only after a successful approve
    const path = b.result?.download_path;
    if (!isAgentPdfPath(path)) return;
    void (async () => {
      try {
        const token = await getAgentToken();
        if (!token && !agentDevRole()) throw new AgentHttpError(401, "no token");
        await downloadAgentPdf({ path, token, filename: "a4ai-test.pdf" });
      } catch (err) {
        dispatch({ type: "approval", blockId, state: "approved", error: friendlyError(err)?.message ?? "Download failed." });
      }
    })();
  }, []);

  const stop = useCallback(() => ctrl.current?.abort(), []);

  return useMemo(() => ({ state, send, answerClarify, approve, cancelApproval, download, stop }),
    [state, send, answerClarify, approve, cancelApproval, download, stop]);
}
