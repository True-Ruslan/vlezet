import { createPlacedObject, type PlacedObject, type VlezetDocument } from "@vlezet/domain";
import { createHistoryState } from "@vlezet/editor-core";
import { deriveRooms } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import { addToSelection, replaceSelection } from "./editor-selection";
import { createEditorStore } from "./use-editor-store";

function furniture(id: string, x: number, y: number): PlacedObject {
  return createPlacedObject({
    id,
    presetId: null,
    name: id,
    category: "chair",
    position: { x, y },
    width: 500,
    depth: 500,
    rotationDeg: 0,
    clearance: { front: 0, right: 0, back: 0, left: 0 },
  });
}

function isolatedRoomDocument(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 5000, y: 0 } },
      { id: "c", position: { x: 5000, y: 4000 } },
      { id: "d", position: { x: 0, y: 4000 } },
    ],
    walls: [
      { id: "top", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 180 },
      { id: "right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 180 },
      { id: "bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 180 },
      { id: "left", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 180 },
    ],
    openings: [{ id: "door", wallId: "top", kind: "door", offset: 1200, width: 900 }],
    roomAnnotations: [{ id: "name", name: "Комната", anchor: { x: 2500, y: 2000 } }],
    placedObjects: [
      furniture("selected-a", 1600, 1600),
      furniture("selected-b", 2600, 1600),
      furniture("unselected-inside", 3600, 1600),
      furniture("outside", 7000, 1500),
    ],
  };
}

function adjacentRoomsDocument(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
      { id: "c", position: { x: 4000, y: 3000 } },
      { id: "d", position: { x: 0, y: 3000 } },
      { id: "e", position: { x: 8000, y: 0 } },
      { id: "f", position: { x: 8000, y: 3000 } },
    ],
    walls: [
      { id: "ab", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 180 },
      { id: "shared", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 180 },
      { id: "cd", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 180 },
      { id: "da", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 180 },
      { id: "be", startVertexId: "b", endVertexId: "e", junctionVertexIds: [], thickness: 180 },
      { id: "ef", startVertexId: "e", endVertexId: "f", junctionVertexIds: [], thickness: 180 },
      { id: "fc", startVertexId: "f", endVertexId: "c", junctionVertexIds: [], thickness: 180 },
    ],
    openings: [],
    roomAnnotations: [],
    placedObjects: [furniture("chair", 1500, 1500)],
  };
}

function roomId(document: VlezetDocument): string {
  const rooms = deriveRooms(document).rooms;
  expect(rooms.length).toBeGreaterThan(0);
  return [...rooms].sort((first, second) => first.labelPoint.x - second.labelPoint.x)[0]!.id;
}

function objectPosition(document: VlezetDocument, id: string) {
  return document.placedObjects.find((object) => object.id === id)?.position;
}

function vertexPosition(document: VlezetDocument, id: string) {
  return document.vertices.find((vertex) => vertex.id === id)?.position;
}

function preparedStore(document = isolatedRoomDocument()) {
  const store = createEditorStore();
  store.setState({ history: createHistoryState(document) });
  return store;
}

describe("M8.2 atomic room translation gesture", () => {
  it("moves an isolated room only while leaving unselected furniture fixed", () => {
    const document = isolatedRoomDocument();
    const id = roomId(document);
    const store = preparedStore(document);
    store.setState({ selection: replaceSelection({ kind: "room", id }) });

    store.getState().beginStructuralRoomGesture(id);
    store.getState().previewStructuralRoomGesture({ x: 800, y: -300 });

    let state = store.getState();
    expect(state.structuralGesture?.kind).toBe("translate-room");
    expect(state.structuralGesture?.valid).toBe(true);
    expect(vertexPosition(state.structuralGesture!.previewDocument, "a")).toEqual({ x: 800, y: -300 });
    expect(objectPosition(state.structuralGesture!.previewDocument, "unselected-inside"))
      .toEqual(objectPosition(document, "unselected-inside"));
    expect(state.history.past).toHaveLength(0);

    store.getState().commitStructuralGesture();
    state = store.getState();
    expect(state.structuralGesture).toBeNull();
    expect(state.history.past).toHaveLength(1);
    expect(state.history.past[0]?.forward.label).toBe("room/translate");
    expect(vertexPosition(state.history.document, "a")).toEqual({ x: 800, y: -300 });
    expect(objectPosition(state.history.document, "unselected-inside"))
      .toEqual(objectPosition(document, "unselected-inside"));
  });

  it("moves room plus exactly the explicitly selected furniture by one identical delta", () => {
    const document = isolatedRoomDocument();
    const id = roomId(document);
    const store = preparedStore(document);
    const selection = addToSelection(
      replaceSelection({ kind: "room", id }),
      [
        { kind: "placed-object", id: "selected-a" },
        { kind: "placed-object", id: "selected-b" },
      ],
    );
    store.setState({ selection });

    store.getState().beginStructuralRoomGesture(id);
    store.getState().previewStructuralRoomGesture({ x: 900, y: 300 });

    let state = store.getState();
    const preview = state.structuralGesture!.previewDocument;
    expect(objectPosition(preview, "selected-a")).toEqual({ x: 2500, y: 1900 });
    expect(objectPosition(preview, "selected-b")).toEqual({ x: 3500, y: 1900 });
    expect(objectPosition(preview, "unselected-inside")).toEqual({ x: 3600, y: 1600 });
    expect(state.selection).toEqual(selection);

    store.getState().commitStructuralGesture();
    state = store.getState();
    const after = structuredClone(state.history.document);
    expect(state.history.past).toHaveLength(1);
    expect(objectPosition(after, "selected-a")).toEqual({ x: 2500, y: 1900 });
    expect(objectPosition(after, "unselected-inside")).toEqual({ x: 3600, y: 1600 });

    store.getState().undo();
    expect(store.getState().history.document).toEqual(document);
    store.getState().redo();
    expect(store.getState().history.document).toEqual(after);
  });

  it("rejects unsafe shared topology without partial furniture movement or history", () => {
    const document = adjacentRoomsDocument();
    const id = roomId(document);
    const store = preparedStore(document);
    const selection = addToSelection(
      replaceSelection({ kind: "room", id }),
      [{ kind: "placed-object", id: "chair" }],
    );
    store.setState({ selection });

    store.getState().beginStructuralRoomGesture(id);

    const state = store.getState();
    expect(state.structuralGesture).toBeNull();
    expect(state.history.document).toEqual(document);
    expect(state.history.past).toHaveLength(0);
    expect(objectPosition(state.history.document, "chair")).toEqual({ x: 1500, y: 1500 });
  });

  it("creates no history for zero delta or cancel and rejects a stale concurrent document", () => {
    const document = isolatedRoomDocument();
    const id = roomId(document);
    const store = preparedStore(document);
    store.setState({ selection: replaceSelection({ kind: "room", id }) });

    store.getState().beginStructuralRoomGesture(id);
    store.getState().previewStructuralRoomGesture({ x: 0, y: 0 });
    store.getState().commitStructuralGesture();
    expect(store.getState().history.past).toHaveLength(0);

    store.getState().beginStructuralRoomGesture(id);
    store.getState().previewStructuralRoomGesture({ x: 500, y: 0 });
    store.getState().cancelStructuralGesture();
    expect(store.getState().history.document).toEqual(document);
    expect(store.getState().history.past).toHaveLength(0);

    store.getState().beginStructuralRoomGesture(id);
    store.getState().previewStructuralRoomGesture({ x: 500, y: 0 });
    const concurrent = { ...document, roomAnnotations: [...document.roomAnnotations] };
    store.setState({ history: createHistoryState(concurrent) });
    store.getState().commitStructuralGesture();
    const state = store.getState();
    expect(state.structuralGesture?.valid).toBe(false);
    expect(state.structuralGesture?.reason).toMatch(/изменился/i);
    expect(state.history.document).toBe(concurrent);
    expect(state.history.past).toHaveLength(0);
  });

  it("expands room selection with contained furniture only and never touches document/history", () => {
    const document = isolatedRoomDocument();
    const id = roomId(document);
    const store = preparedStore(document);
    store.setState({ selection: replaceSelection({ kind: "room", id }) });
    const beforeDocument = store.getState().history.document;
    const beforePast = store.getState().history.past;

    store.getState().selectFurnitureInSelectedRoom();

    const state = store.getState();
    expect(state.selection.refs).toEqual([
      { kind: "room", id },
      { kind: "placed-object", id: "selected-a" },
      { kind: "placed-object", id: "selected-b" },
      { kind: "placed-object", id: "unselected-inside" },
    ]);
    expect(state.history.document).toBe(beforeDocument);
    expect(state.history.past).toBe(beforePast);
  });
});
