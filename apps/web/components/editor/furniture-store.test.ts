import { describe, expect, it } from "vitest";
import { createEditorStore, type EditorEntityIdKind } from "./use-editor-store";

function sequentialIds() {
  const counters: Record<EditorEntityIdKind, number> = {
    wall: 0,
    vertex: 0,
    "room-annotation": 0,
    opening: 0,
    "placed-object": 0,
  };
  return (kind: EditorEntityIdKind) => `${kind}-${++counters[kind]}`;
}

describe("furniture editor store", () => {
  it("places a catalogue snapshot as one selected semantic operation", () => {
    const store = createEditorStore({ idFactory: sequentialIds() });
    store.getState().setPlacementPreset("double-bed");
    store.getState().placeSelectedPreset({ x: 2400, y: 1800 });

    const state = store.getState();
    expect(state.history.document.placedObjects).toEqual([
      expect.objectContaining({
        id: "placed-object-1",
        presetId: "double-bed",
        name: "Двуспальная кровать",
        category: "sleep",
        position: { x: 2400, y: 1800 },
        width: 1600,
        depth: 2000,
        rotationDeg: 0,
      }),
    ]);
    expect(state.selectedObjectId).toBe("placed-object-1");
    expect(state.placementPresetId).toBeNull();
    expect(state.history.past).toHaveLength(1);
  });

  it("keeps entity selection mutually exclusive", () => {
    const store = createEditorStore({ idFactory: sequentialIds() });
    store.getState().setPlacementPreset("desk");
    store.getState().placeSelectedPreset({ x: 1000, y: 1000 });
    store.getState().selectWall("wall-x");
    expect(store.getState()).toMatchObject({
      selectedWallId: "wall-x",
      selectedRoomId: null,
      selectedOpeningId: null,
      selectedObjectId: null,
      placementPresetId: null,
    });
    store.getState().selectObject("placed-object-1");
    expect(store.getState()).toMatchObject({
      selectedWallId: null,
      selectedRoomId: null,
      selectedOpeningId: null,
      selectedObjectId: "placed-object-1",
    });
  });

  it("previews a drag without history and commits one move entry", () => {
    const store = createEditorStore({ idFactory: sequentialIds() });
    store.getState().setPlacementPreset("desk");
    store.getState().placeSelectedPreset({ x: 1000, y: 1000 });
    const historyLength = store.getState().history.past.length;

    store.getState().beginObjectGesture("placed-object-1", "move");
    store.getState().previewObjectGesture({ position: { x: 1800, y: 1400 } });
    expect(store.getState().history.past).toHaveLength(historyLength);
    expect(store.getState().history.document.placedObjects[0]?.position).toEqual({ x: 1000, y: 1000 });
    expect(store.getState().objectGesture?.preview.position).toEqual({ x: 1800, y: 1400 });

    store.getState().commitObjectGesture();
    expect(store.getState().history.past).toHaveLength(historyLength + 1);
    expect(store.getState().history.document.placedObjects[0]?.position).toEqual({ x: 1800, y: 1400 });
  });

  it("cancels an in-progress transform without mutating the document", () => {
    const store = createEditorStore({ idFactory: sequentialIds() });
    store.getState().setPlacementPreset("wardrobe");
    store.getState().placeSelectedPreset({ x: 2000, y: 2000 });
    const before = store.getState().history.document;
    store.getState().beginObjectGesture("placed-object-1", "transform");
    store.getState().previewObjectGesture({ width: 2000, rotationDeg: 45 });
    store.getState().cancelObjectGesture();
    expect(store.getState().history.document).toBe(before);
    expect(store.getState().objectGesture).toBeNull();
  });

  it("updates, rotates, duplicates and deletes through semantic history", () => {
    const store = createEditorStore({ idFactory: sequentialIds() });
    store.getState().setPlacementPreset("custom-object");
    store.getState().placeSelectedPreset({ x: 2000, y: 1600 });
    store.getState().updateSelectedObject({ name: "Пианино", width: 1450, depth: 600 });
    store.getState().rotateSelectedObject90();
    store.getState().duplicateSelectedObject();

    expect(store.getState().history.document.placedObjects).toHaveLength(2);
    expect(store.getState().history.document.placedObjects[0]).toMatchObject({ name: "Пианино", width: 1450, rotationDeg: 90 });
    expect(store.getState().selectedObjectId).toBe("placed-object-2");

    store.getState().deleteSelectedObject();
    expect(store.getState().history.document.placedObjects).toHaveLength(1);
    expect(store.getState().selectedObjectId).toBeNull();
  });
});
