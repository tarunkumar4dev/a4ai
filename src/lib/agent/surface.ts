// Tiny flag: is the full agent workspace on screen? The floating "Ask a4ai" button hides while it is
// (the dashboard switches tabs without changing the URL, so ?tab=agent alone isn't enough). No deps — main bundle.
import { useEffect, useSyncExternalStore } from "react";

let mounted = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const get = () => mounted > 0;

export const useAgentWorkspaceOpen = () => useSyncExternalStore(subscribe, get, get);

/** Call from the workspace component. */
export function useMarkAgentWorkspace() {
  useEffect(() => {
    mounted++; emit();
    return () => { mounted--; emit(); };
  }, []);
}

// ---- "focus the message box" requests (Ctrl+K, "/", New chat) — the composer on screen listens ----------------
const focusListeners = new Set<() => void>();
export function onComposerFocusRequest(fn: () => void) { focusListeners.add(fn); return () => { focusListeners.delete(fn); }; }
export function requestComposerFocus() { focusListeners.forEach((l) => l()); }

// ---- "open the agent sheet" requests (e.g. from the mobile bottom dock) ----------------
const openListeners = new Set<() => void>();
export function onAgentOpenRequest(fn: () => void) { openListeners.add(fn); return () => { openListeners.delete(fn); }; }
export function requestAgentOpen() { openListeners.forEach((l) => l()); }
