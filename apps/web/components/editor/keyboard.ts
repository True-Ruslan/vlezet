import type { ShortcutKeyEvent } from "./editor-commands";

export type { ShortcutKeyEvent } from "./editor-commands";

export type EditorLegacyShortcut = "furnishing-catalog" | "cancel";

export function getEditorLegacyShortcut(event: ShortcutKeyEvent): EditorLegacyShortcut | null {
  if (event.ctrlKey || event.metaKey) return null;
  const key = event.key.toLowerCase();
  if (key === "f") return "furnishing-catalog";
  if (event.key === "Escape") return "cancel";
  return null;
}
