// `ui_action navigate` bus (main bundle, no deps): the agent store emits a registry KEY when a live stream says so;
// the component mounted inside the router (AskA4aiLauncher → useVoiceNavigation) resolves it through the registry copy
// (role-gated, typed params) and navigates. Replayed history never emits. Nothing here touches URLs.
export interface UiNavigate { routeKey: string; params: Record<string, string>; label: string | null }

const listeners = new Set<(a: UiNavigate) => void>();

export function onUiAction(fn: (a: UiNavigate) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function emitUiAction(a: UiNavigate): void {
  listeners.forEach((l) => { try { l(a); } catch { /* one bad listener must not break the stream */ } });
}

/** Tests only. */
export const _listenerCount = () => listeners.size;
