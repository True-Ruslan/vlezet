export type EditorContextKind =
  | "empty"
  | "multi-selection"
  | "wall"
  | "room"
  | "opening-door"
  | "opening-window"
  | "object"
  | "planning"
  | "reference"
  | "recognition";

export type EditorContextInput = Readonly<{
  recognitionPanelOpen: boolean;
  referencePanelOpen: boolean;
  planningRoomId: string | null;
  selectionCount: number;
  selectedObjectId: string | null;
  selectedOpeningKind: "door" | "window" | null;
  selectedRoomId: string | null;
  selectedWallId: string | null;
}>;

export type CompactEditorSurface = "catalogue" | "context" | null;

export type CompactEditorSurfaceEvent =
  | Readonly<{ kind: "open-catalogue" }>
  | Readonly<{ kind: "open-context" }>
  | Readonly<{ kind: "context-changed"; context: EditorContextKind }>
  | Readonly<{ kind: "close" }>
  | Readonly<{ kind: "view-changed"; view: "2d" | "3d" }>;

export function deriveEditorContextKind(input: EditorContextInput): EditorContextKind {
  if (input.recognitionPanelOpen) return "recognition";
  if (input.referencePanelOpen) return "reference";
  if (input.planningRoomId) return "planning";
  if (input.selectionCount > 1) return "multi-selection";
  if (input.selectedObjectId) return "object";
  if (input.selectedOpeningKind === "door") return "opening-door";
  if (input.selectedOpeningKind === "window") return "opening-window";
  if (input.selectedRoomId) return "room";
  if (input.selectedWallId) return "wall";
  return "empty";
}

const CONTEXT_LABELS: Readonly<Record<EditorContextKind, string>> = {
  empty: "Свойства",
  "multi-selection": "Свойства · Выделение",
  wall: "Свойства · Стена",
  room: "Свойства · Комната",
  "opening-door": "Свойства · Дверь",
  "opening-window": "Свойства · Окно",
  object: "Свойства · Предмет",
  planning: "Панель · Расстановка",
  reference: "Панель · Подложка",
  recognition: "Панель · Распознавание",
};

export function editorContextLabel(kind: EditorContextKind): string {
  return CONTEXT_LABELS[kind];
}

export function nextCompactEditorSurface(
  current: CompactEditorSurface,
  event: CompactEditorSurfaceEvent,
): CompactEditorSurface {
  switch (event.kind) {
    case "open-catalogue":
      return "catalogue";
    case "open-context":
      return "context";
    case "context-changed":
      return event.context === "empty" ? current : "context";
    case "close":
      return null;
    case "view-changed":
      return event.view === "3d" ? null : current;
  }
}
