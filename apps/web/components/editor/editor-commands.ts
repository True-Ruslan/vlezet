export type EditorCommandId =
  | "history.undo"
  | "history.redo"
  | "selection.selectAll"
  | "selection.copy"
  | "selection.cut"
  | "selection.paste"
  | "selection.duplicate"
  | "selection.delete"
  | "selection.clear"
  | "view.zoomIn"
  | "view.zoomOut"
  | "view.actualSize"
  | "view.fitPlan"
  | "view.fitSelection"
  | "tool.select"
  | "tool.wall"
  | "tool.door"
  | "tool.window"
  | "object.rotate90";

export type EditorCommandDescriptor = Readonly<{
  id: EditorCommandId;
  label: string;
  shortcut: string | null;
}>;

export type ShortcutKeyEvent = Readonly<{
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}>;

export const EDITOR_COMMANDS: readonly EditorCommandDescriptor[] = Object.freeze([
  { id: "history.undo", label: "Отменить", shortcut: "Cmd/Ctrl+Z" },
  { id: "history.redo", label: "Повторить", shortcut: "Cmd/Ctrl+Shift+Z" },
  { id: "selection.selectAll", label: "Выбрать всё", shortcut: "Cmd/Ctrl+A" },
  { id: "selection.copy", label: "Копировать", shortcut: "Cmd/Ctrl+C" },
  { id: "selection.cut", label: "Вырезать", shortcut: "Cmd/Ctrl+X" },
  { id: "selection.paste", label: "Вставить", shortcut: "Cmd/Ctrl+V" },
  { id: "selection.duplicate", label: "Дублировать", shortcut: "Cmd/Ctrl+D" },
  { id: "selection.delete", label: "Удалить", shortcut: "Delete" },
  { id: "selection.clear", label: "Снять выделение", shortcut: null },
  { id: "view.zoomIn", label: "Увеличить", shortcut: "+" },
  { id: "view.zoomOut", label: "Уменьшить", shortcut: "-" },
  { id: "view.actualSize", label: "Масштаб 1:1", shortcut: "0" },
  { id: "view.fitPlan", label: "Показать весь план", shortcut: "1" },
  { id: "view.fitSelection", label: "Показать выделение", shortcut: "2" },
  { id: "tool.select", label: "Выбор", shortcut: "V" },
  { id: "tool.wall", label: "Стена", shortcut: "W" },
  { id: "tool.door", label: "Дверь", shortcut: "D" },
  { id: "tool.window", label: "Окно", shortcut: "O" },
  { id: "object.rotate90", label: "Повернуть на 90°", shortcut: "R" },
] satisfies readonly EditorCommandDescriptor[]);

export function isNativeEditableTarget(target: EventTarget | null): boolean {
  if (target === null || typeof target !== "object") return false;
  const candidate = target as EventTarget & {
    tagName?: unknown;
    isContentEditable?: unknown;
    getAttribute?: (name: string) => string | null;
  };
  const tagName = typeof candidate.tagName === "string" ? candidate.tagName.toUpperCase() : "";
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") return true;
  if (candidate.isContentEditable === true) return true;
  if (typeof candidate.getAttribute === "function") {
    const marker = candidate.getAttribute("data-editor-native-editable");
    if (marker === "" || marker === "true") return true;
  }
  return false;
}

export function commandForKeyboardEvent(event: ShortcutKeyEvent): EditorCommandId | null {
  const key = event.key.toLowerCase();
  const command = event.ctrlKey || event.metaKey;

  if (command) {
    if (key === "z") return event.shiftKey ? "history.redo" : "history.undo";
    if (key === "y") return "history.redo";
    if (key === "a") return "selection.selectAll";
    if (key === "c") return "selection.copy";
    if (key === "x") return "selection.cut";
    if (key === "v") return "selection.paste";
    if (key === "d") return "selection.duplicate";
    return null;
  }

  if (event.key === "Delete" || event.key === "Backspace") return "selection.delete";
  if (event.key === "+" || event.key === "=") return "view.zoomIn";
  if (event.key === "-") return "view.zoomOut";
  if (event.key === "0") return "view.actualSize";
  if (event.key === "1") return "view.fitPlan";
  if (event.key === "2") return "view.fitSelection";
  if (key === "v") return "tool.select";
  if (key === "w") return "tool.wall";
  if (key === "d") return "tool.door";
  if (key === "o") return "tool.window";
  if (key === "r") return "object.rotate90";
  return null;
}
