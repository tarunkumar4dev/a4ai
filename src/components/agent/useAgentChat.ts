// Thin adapter over the shared agent store (src/lib/agent/store.ts) for components that want the
// classic { state, send, … } chat interface.
import { useMemo } from "react";
import { useAuth } from "@/providers/AuthProvider";
import type { ChatState, Feedback } from "@/lib/agent/chatState";
import { agentStore, useAgentStore } from "@/lib/agent/store";

export { friendlyError } from "@/lib/agent/store";

export interface AgentChat {
  state: ChatState;
  send: (text: string) => void;
  answerClarify: (blockId: string, value: string) => void;
  approve: (blockId: string) => void;
  cancelApproval: (blockId: string) => void;
  download: (blockId: string) => void;
  stop: () => void;
  feedback: (turnId: string, value: Feedback) => void;
  prefill: (text: string) => void;
}

export const chatActions: Omit<AgentChat, "state"> = {
  send: agentStore.send, answerClarify: agentStore.answerClarify, approve: agentStore.approve,
  cancelApproval: agentStore.cancelApproval, download: agentStore.download, stop: agentStore.stop,
  feedback: agentStore.feedback, prefill: agentStore.prefill,
};

export function useAgentChat(): AgentChat {
  const { user } = useAuth();
  const s = useAgentStore(user?.id ?? "anon");
  return useMemo(() => ({ state: s.chat, ...chatActions }), [s.chat]);
}
