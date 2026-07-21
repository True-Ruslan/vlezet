export type EditorShortcut = "undo" | "redo" | "select-tool" | "wall-tool" | "door-tool" | "window-tool" | "cancel";

export type ShortcutKeyEvent = Readonly<{
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}>;

export function getEditorShortcut(event: ShortcutKeyEvent): EditorShortcut | null {
  const key = event.key.toLowerCase();
  const command = event.ctrlKey || event.metaKey;

  if (command && key === "z") return event.shiftKey ? "redo" : "undo";
  if (command && key === "y") return "redo";
  if (!command && key === "w") return "wall-tool";
  if (!command && key === "v") return "select-tool";
  if (!command && key === "d") return "door-tool";
  if (!command && key === "o") return "window-tool";
  if (!command && event.key === "Escape") return "cancel";
  return null;
}
