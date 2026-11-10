// Executes `ui_action navigate` from a live stream: registry key → URL (role-gated, typed params) → react-router.
// Mounted once inside the router (AskA4aiLauncher). Unknown keys and pages the role may not open are ignored.
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAccess } from "@/context/AccessProvider";
import { agentRole } from "@/components/agent/roles";
import { agentStore } from "@/lib/agent/store";
import { resolveRoute } from "./routes";
import { onUiAction } from "./uiActions";

export function useVoiceNavigation(onNavigated?: () => void) {
  const navigate = useNavigate();
  const { access } = useAccess();
  useEffect(() => onUiAction(({ routeKey, params }) => {
    const role = agentRole(agentStore.getState().meta?.role, access);
    const r = resolveRoute(routeKey, params, role);
    if (!r) return;
    navigate(r.to);
    onNavigated?.();
  }), [navigate, access, onNavigated]);
}
