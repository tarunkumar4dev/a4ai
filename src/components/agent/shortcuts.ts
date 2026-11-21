import type { AgentKey } from "@/lib/agent/i18n";
// Keyboard shortcuts of the agent (pure matching + labels). Wired up in AskA4aiLauncher (global, dashboard routes)
// and listed in the "?" popover (ShortcutsHelp).
export const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || "");
export const MOD = IS_MAC ? "⌘" : "Ctrl";
export const OPEN_SHORTCUT = `${MOD}+K`;
export const NEW_CHAT_SHORTCUT = `${MOD}+Shift+O`;

export type ShortcutAction = "open-agent" | "new-chat" | "focus-input";

interface KeyLike { key: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean; isComposing?: boolean; defaultPrevented?: boolean }

/** True for inputs, textareas, selects and contenteditable (where "/" must type a slash). */
export function isEditable(t: EventTarget | null): boolean {
  if (!t || typeof (t as HTMLElement).tagName !== "string") return false;
  const el = t as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea" || tag === "select") return true;
  if (tag === "input") {
    const type = ((el as HTMLInputElement).type || "text").toLowerCase();
    return !["button", "checkbox", "radio", "submit", "reset", "range", "color", "file", "image"].includes(type);
  }
  return el.isContentEditable === true;
}

/** Which agent shortcut (if any) a keydown is. Pure. */
export function matchShortcut(e: KeyLike, target: EventTarget | null): ShortcutAction | null {
  if (e.isComposing || e.defaultPrevented) return null;
  const mod = IS_MAC ? !!e.metaKey : !!e.ctrlKey;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (mod && !e.altKey && !e.shiftKey && k === "k") return "open-agent";
  if (mod && !e.altKey && e.shiftKey && k === "o") return "new-chat";
  if (!mod && !e.altKey && !e.ctrlKey && !e.metaKey && e.key === "/" && !isEditable(target)) return "focus-input";
  return null;
}

export const SHORTCUTS: { keys: string; label: AgentKey }[] = [
  { keys: OPEN_SHORTCUT, label: "shortcut.open" },
  { keys: NEW_CHAT_SHORTCUT, label: "shortcut.newChat" },
  { keys: "/", label: "shortcut.focus" },
  { keys: "↑ ↓", label: "shortcut.move" },
  { keys: "Enter", label: "shortcut.run" },
  { keys: "Tab  →", label: "shortcut.fill" },
  { keys: "Shift+Enter", label: "shortcut.newline" },
  { keys: "Esc", label: "shortcut.close" },
];
