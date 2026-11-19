// Who / where the agent panel runs. In the app this is just the real hooks (auth, access, network, my scope). The
// dev-only preview page (/__agent-preview) wraps the panel in <AgentEnvProvider> to fake a signed-in teacher, a
// network state or a scope — no credentials, nothing stored. Production never renders the provider.
import { createContext, useContext, type ReactNode } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useAccess } from "@/context/AccessProvider";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useMyScope, type MyScope } from "@/hooks/useMyScope";
import type { NetQuality } from "@/lib/networkStatus";

type Access = ReturnType<typeof useAccess>["access"];
export interface AgentUser { id: string; user_metadata?: Record<string, unknown> }
export interface AgentEnv {
  user?: AgentUser | null;
  access?: Access;
  net?: NetQuality;
  scope?: Pick<MyScope, "loading" | "batches">;
}

const Ctx = createContext<AgentEnv | null>(null);

export function AgentEnvProvider({ value, children }: { value: AgentEnv; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAgentUser(): AgentUser | null {
  const env = useContext(Ctx);
  const { user } = useAuth();
  return env && "user" in env ? env.user ?? null : (user as AgentUser | null);
}
export function useAgentAccess(): Access {
  const env = useContext(Ctx);
  const { access } = useAccess();
  return env && "access" in env ? env.access ?? null : access;
}
export function useAgentNet(): NetQuality {
  const env = useContext(Ctx);
  const net = useNetworkStatus();
  return env?.net ?? net;
}
export function useAgentScope(): Pick<MyScope, "loading" | "batches"> {
  const env = useContext(Ctx);
  const scope = useMyScope();
  return env?.scope ?? scope;
}
