import type { VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";
import {
  validateWorkflowReturnTarget,
  type WorkflowReturnTarget,
} from "./context-panel-contract";

export type EditorOrdinarySelection = Readonly<{
  selectedWallId: string | null;
  selectedRoomId: string | null;
  selectedOpeningId: string | null;
  selectedObjectId: string | null;
}>;

export const EMPTY_EDITOR_SELECTION: EditorOrdinarySelection = Object.freeze({
  selectedWallId: null,
  selectedRoomId: null,
  selectedOpeningId: null,
  selectedObjectId: null,
});

export function captureEditorWorkflowReturnTarget(
  selection: EditorOrdinarySelection,
  document: VlezetDocument,
): WorkflowReturnTarget {
  if (selection.selectedObjectId) {
    const object = document.placedObjects.find((candidate) => candidate.id === selection.selectedObjectId);
    if (object) return { kind: "object", objectId: object.id, label: `Предмет «${object.name}»` };
  }

  if (selection.selectedOpeningId) {
    const opening = document.openings.find((candidate) => candidate.id === selection.selectedOpeningId);
    if (opening) {
      return opening.kind === "door"
        ? { kind: "opening-door", openingId: opening.id, label: "Дверь" }
        : { kind: "opening-window", openingId: opening.id, label: "Окно" };
    }
  }

  if (selection.selectedRoomId) {
    const room = deriveRooms(document).rooms.find((candidate) => candidate.id === selection.selectedRoomId);
    if (room) return { kind: "room", roomId: room.id, label: `Комната «${room.name}»` };
  }

  if (selection.selectedWallId && document.walls.some((wall) => wall.id === selection.selectedWallId)) {
    return { kind: "wall", wallId: selection.selectedWallId, label: "Стена" };
  }

  return { kind: "empty", label: "Ничего не выбрано" };
}

export function selectionForWorkflowReturnTarget(
  target: WorkflowReturnTarget,
  document: VlezetDocument,
): EditorOrdinarySelection {
  const valid = validateWorkflowReturnTarget(target, document);
  switch (valid.kind) {
    case "wall":
      return { ...EMPTY_EDITOR_SELECTION, selectedWallId: valid.wallId };
    case "room":
      return { ...EMPTY_EDITOR_SELECTION, selectedRoomId: valid.roomId };
    case "opening-door":
    case "opening-window":
      return { ...EMPTY_EDITOR_SELECTION, selectedOpeningId: valid.openingId };
    case "object":
      return { ...EMPTY_EDITOR_SELECTION, selectedObjectId: valid.objectId };
    case "empty":
      return EMPTY_EDITOR_SELECTION;
  }
}

export function workflowReturnActionLabel(target: WorkflowReturnTarget): string {
  switch (target.kind) {
    case "wall":
      return "К стене";
    case "room":
      return target.label.replace(/^Комната/, "К комнате");
    case "opening-door":
      return "К двери";
    case "opening-window":
      return "К окну";
    case "object":
      return target.label.replace(/^Предмет/, "К предмету");
    case "empty":
      return "Закрыть workflow";
  }
}
