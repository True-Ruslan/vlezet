import { describe, expect, it } from "vitest";
import {
  deriveEditorContextKind,
  editorContextLabel,
  nextCompactEditorSurface,
  type EditorContextInput,
} from "./editor-context-kind";

const emptyInput: EditorContextInput = {
  recognitionPanelOpen: false,
  referencePanelOpen: false,
  planningRoomId: null,
  selectionCount: 0,
  selectedObjectId: null,
  selectedOpeningKind: null,
  selectedRoomId: null,
  selectedWallId: null,
};

describe("M7.1 editor context identity", () => {
  it("uses one deterministic workflow and selection precedence", () => {
    expect(deriveEditorContextKind({
      ...emptyInput,
      recognitionPanelOpen: true,
      referencePanelOpen: true,
      planningRoomId: "room-1",
      selectionCount: 4,
      selectedObjectId: "object-1",
      selectedOpeningKind: "door",
      selectedRoomId: "room-1",
      selectedWallId: "wall-1",
    })).toBe("recognition");

    expect(deriveEditorContextKind({
      ...emptyInput,
      referencePanelOpen: true,
      planningRoomId: "room-1",
      selectionCount: 2,
      selectedObjectId: "object-1",
    })).toBe("reference");

    expect(deriveEditorContextKind({
      ...emptyInput,
      planningRoomId: "room-1",
      selectionCount: 2,
      selectedObjectId: "object-1",
    })).toBe("planning");

    expect(deriveEditorContextKind({
      ...emptyInput,
      selectionCount: 2,
      selectedObjectId: "object-1",
      selectedOpeningKind: "door",
    })).toBe("multi-selection");

    expect(deriveEditorContextKind({
      ...emptyInput,
      selectionCount: 1,
      selectedObjectId: "object-1",
      selectedOpeningKind: "door",
      selectedRoomId: "room-1",
      selectedWallId: "wall-1",
    })).toBe("object");

    expect(deriveEditorContextKind({
      ...emptyInput,
      selectionCount: 1,
      selectedOpeningKind: "window",
      selectedRoomId: "room-1",
      selectedWallId: "wall-1",
    })).toBe("opening-window");

    expect(deriveEditorContextKind({
      ...emptyInput,
      selectionCount: 1,
      selectedRoomId: "room-1",
      selectedWallId: "wall-1",
    })).toBe("room");

    expect(deriveEditorContextKind({ ...emptyInput, selectionCount: 1, selectedWallId: "wall-1" })).toBe("wall");
    expect(deriveEditorContextKind(emptyInput)).toBe("empty");
  });

  it("distinguishes door and window context", () => {
    expect(deriveEditorContextKind({ ...emptyInput, selectionCount: 1, selectedOpeningKind: "door" })).toBe("opening-door");
    expect(deriveEditorContextKind({ ...emptyInput, selectionCount: 1, selectedOpeningKind: "window" })).toBe("opening-window");
  });

  it("provides stable Russian labels for the compact context trigger", () => {
    expect(editorContextLabel("empty")).toBe("Свойства");
    expect(editorContextLabel("multi-selection")).toBe("Свойства · Выделение");
    expect(editorContextLabel("wall")).toBe("Свойства · Стена");
    expect(editorContextLabel("room")).toBe("Свойства · Комната");
    expect(editorContextLabel("opening-door")).toBe("Свойства · Дверь");
    expect(editorContextLabel("opening-window")).toBe("Свойства · Окно");
    expect(editorContextLabel("object")).toBe("Свойства · Предмет");
    expect(editorContextLabel("planning")).toBe("Панель · Расстановка");
    expect(editorContextLabel("reference")).toBe("Панель · Подложка");
    expect(editorContextLabel("recognition")).toBe("Панель · Распознавание");
  });

  it("keeps compact side-surface transitions explicit and ephemeral", () => {
    expect(nextCompactEditorSurface(null, { kind: "open-catalogue" })).toBe("catalogue");
    expect(nextCompactEditorSurface("catalogue", { kind: "open-context" })).toBe("context");
    expect(nextCompactEditorSurface("catalogue", { kind: "context-changed", context: "object" })).toBe("context");
    expect(nextCompactEditorSurface("catalogue", { kind: "context-changed", context: "multi-selection" })).toBe("context");
    expect(nextCompactEditorSurface("catalogue", { kind: "context-changed", context: "empty" })).toBe("catalogue");
    expect(nextCompactEditorSurface("context", { kind: "close" })).toBeNull();
    expect(nextCompactEditorSurface("context", { kind: "view-changed", view: "3d" })).toBeNull();
    expect(nextCompactEditorSurface("context", { kind: "view-changed", view: "2d" })).toBe("context");
  });

  it("does not mutate source state while deriving presentation", () => {
    const input = Object.freeze({ ...emptyInput, selectionCount: 1, selectedObjectId: "object-1" });
    const event = Object.freeze({ kind: "context-changed" as const, context: "object" as const });

    expect(deriveEditorContextKind(input)).toBe("object");
    expect(nextCompactEditorSurface("catalogue", event)).toBe("context");
    expect(input.selectedObjectId).toBe("object-1");
    expect(event.context).toBe("object");
  });
});
