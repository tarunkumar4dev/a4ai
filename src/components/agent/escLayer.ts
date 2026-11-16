// "Esc closes the inner thing first": an element with this attribute (open suggestions list, inline rename, the
// history drawer inside the sheet, a non-empty search box) handles Escape itself, so the sheet must not close.
// AgentSheetFrame checks for it in Radix's onEscapeKeyDown (which runs first, in the capture phase).
export const ESC_LAYER = "data-agent-esc-layer";

export function hasEscLayer(root: ParentNode | null | undefined): boolean {
  return !!root?.querySelector(`[${ESC_LAYER}]`);
}
