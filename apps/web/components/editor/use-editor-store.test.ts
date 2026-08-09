import { createPlacedObject, type VlezetDocument } from "@vlezet/domain";
import { createHistoryState } from "@vlezet/editor-core";
import { deriveRectangularRoomDimensions, deriveRooms } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import { addToSelection, replaceSelection, type EditorEntityRef } from "./editor-selection";
import {
  createEditorStore,
  selectedObjectId,
  selectedOpeningId,
  selectedRoomId,
  selectedWallId,
  type EditorEntityIdKind,
} from "./use-editor-store";

const noSnap = (x: number, y: number) => ({ point: { x, y }, kind: "none" as const, guides: [] });

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

function rectangularRoomDocument(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 3650, y: 0 } },
      { id: "c", position: { x: 3650, y: 3400 } },
      { id: "d", position: { x: 0, y: 3400 } },
    ],
    walls: [
      { id: "top", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 100 },
      { id: "right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 100 },
      { id: "bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 100 },
      { id: "left", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 100 },
    ],
    openings: [],
    roomAnnotations: [],
    placedObjects: [],
  };
}

function selectionDocument(): VlezetDocument {
  const base = rectangularRoomDocument();
  return {
    ...base,
    openings: [{ id: "door", wallId: "top", kind: "door", offset: 800, width: 900 }],
    placedObjects: [createPlacedObject({
      id: "chair",
      presetId: null,
      name: "Стул",
      category: "chair",
      position: { x: 1800, y: 1600 },
      width: 500,
      depth: 500,
      rotationDeg: 0,
      clearance: { front: 0, right: 0, back: 0, left: 0 },
    })],
  };
}

describe("editor store topology", () => {
  it("creates a first wall with two explicit vertices as one history entry", () => {
    const store = createEditorStore({ idFactory: sequentialIds() });
    store.getState().setTool("wall"); store.getState().beginWall({ x: 0, y: 0 }); store.getState().updateDraftWall(noSnap(3000, 0)); store.getState().commitDraftWall();
    const state = store.getState();
    expect(state.history.document.vertices).toHaveLength(2);
    expect(state.history.document.walls).toEqual([{ id: "wall-1", startVertexId: "vertex-1", endVertexId: "vertex-2", junctionVertexIds: [], thickness: 150 }]);
    expect(state.history.past).toHaveLength(1);
  });

  it("chains from the exact committed vertex identity", () => {
    const store = createEditorStore({ idFactory: sequentialIds() });
    store.getState().setTool("wall"); store.getState().beginWall({ x: 0, y: 0 }); store.getState().updateDraftWall(noSnap(2500, 700)); store.getState().commitDraftWall();
    expect(store.getState().draftWall).toEqual({ start: { x: 2500, y: 700 }, end: { x: 2500, y: 700 }, snap: noSnap(2500, 700), startTarget: { kind: "vertex", vertexId: "vertex-2", point: { x: 2500, y: 700 } }, endTarget: null });
  });

  it("closes a contour by reusing an existing vertex instead of duplicating coordinates", () => {
    const store = createEditorStore({ idFactory: sequentialIds() }); store.getState().setTool("wall");
    store.getState().beginWall({ x: 0, y: 0 }); store.getState().updateDraftWall(noSnap(3000, 0)); store.getState().commitDraftWall();
    store.getState().updateDraftWall(noSnap(3000, 3000)); store.getState().commitDraftWall();
    store.getState().updateDraftWall(noSnap(0, 0), { kind: "vertex", vertexId: "vertex-1", point: { x: 0, y: 0 } }); store.getState().commitDraftWall();
    expect(store.getState().history.document.vertices).toHaveLength(3); expect(store.getState().history.document.walls.at(-1)?.endVertexId).toBe("vertex-1");
  });

  it("creates and undoes a T-junction plus partition as one semantic history entry", () => {
    const store = createEditorStore({ idFactory: sequentialIds() }); store.getState().setTool("wall");
    store.getState().beginWall({ x: 0, y: 0 }); store.getState().updateDraftWall(noSnap(6000, 0)); store.getState().commitDraftWall(); store.getState().cancelDraft();
    store.getState().beginWall({ x: 3000, y: 2500 }); store.getState().updateDraftWall(noSnap(3000, 0), { kind: "wall", wallId: "wall-1", point: { x: 3000, y: 0 } }); store.getState().commitDraftWall();
    expect(store.getState().history.past).toHaveLength(2); expect(store.getState().history.document.walls.find((wall) => wall.id === "wall-1")?.junctionVertexIds).toHaveLength(1); expect(store.getState().history.document.walls).toHaveLength(2);
    store.getState().undo(); expect(store.getState().history.document.walls).toHaveLength(1); expect(store.getState().history.document.walls[0]?.junctionVertexIds).toEqual([]); store.getState().redo(); expect(store.getState().history.document.walls).toHaveLength(2);
  });

  it("changes exact wall length and physical thickness through semantic commands", () => {
    const store = createEditorStore({ idFactory: sequentialIds() }); store.getState().setTool("wall"); store.getState().beginWall({ x: 0, y: 0 }); store.getState().updateDraftWall(noSnap(3000, 4000)); store.getState().commitDraftWall(); store.getState().selectWall("wall-1");
    store.getState().setSelectedWallLength(10000); store.getState().setSelectedWallThickness(240);
    const state = store.getState(); const end = state.history.document.vertices.find((vertex) => vertex.id === "vertex-2"); expect(end?.position.x).toBeCloseTo(6000, 10); expect(end?.position.y).toBeCloseTo(8000, 10); expect(state.history.document.walls[0]?.thickness).toBe(240); expect(state.history.past).toHaveLength(3);
  });

  it("passes a center anchor through as one semantic wall-length command", () => {
    const store = createEditorStore({ idFactory: sequentialIds() });
    store.getState().setTool("wall");
    store.getState().beginWall({ x: 0, y: 0 });
    store.getState().updateDraftWall(noSnap(4000, 0));
    store.getState().commitDraftWall();
    store.getState().cancelDraft();
    store.getState().selectWall("wall-1");

    store.getState().setSelectedWallLength(6000, "center");

    const state = store.getState();
    const start = state.history.document.vertices.find((vertex) => vertex.id === "vertex-1");
    const end = state.history.document.vertices.find((vertex) => vertex.id === "vertex-2");
    expect(start?.position).toEqual({ x: -1000, y: 0 });
    expect(end?.position).toEqual({ x: 5000, y: 0 });
    expect(state.history.past).toHaveLength(2);
    expect(state.history.past.at(-1)?.forward.label).toBe("wall/set-length");
  });

  it("changes a selected rectangular room clear width as one semantic command", () => {
    const document = rectangularRoomDocument();
    const room = deriveRooms(document).rooms[0]!;
    const store = createEditorStore({ idFactory: sequentialIds() });
    store.setState({ history: createHistoryState(document) });
    store.getState().selectRoom(room.id);

    store.getState().setSelectedRoomClearDimension("width", 4000, "min");

    const state = store.getState();
    const resizedRoom = deriveRooms(state.history.document).rooms.find((candidate) => candidate.id === room.id)!;
    expect(deriveRectangularRoomDimensions(resizedRoom)).toEqual({ widthMm: 4000, heightMm: 3300 });
    expect(state.history.past).toHaveLength(1);
    expect(state.history.past[0]?.forward.label).toBe("room/set-clear-dimension");
  });

  it("cancels a draft without creating history", () => {
    const store = createEditorStore({ idFactory: sequentialIds() }); store.getState().beginWall({ x: 0, y: 0 }); store.getState().updateDraftWall(noSnap(1000, 0)); store.getState().cancelDraft(); expect(store.getState().draftWall).toBeNull(); expect(store.getState().history.past).toHaveLength(0);
  });
});

describe("editor store unified selection", () => {
  it("supports replace, toggle, additive selection and clear with deterministic primary", () => {
    const store = createEditorStore();
    const wall: EditorEntityRef = { kind: "wall", id: "top" };
    const opening: EditorEntityRef = { kind: "opening", id: "door" };
    const object: EditorEntityRef = { kind: "placed-object", id: "chair" };

    store.setState({ history: createHistoryState(selectionDocument()) });
    store.getState().replaceSelection(wall);
    expect(store.getState().selection).toEqual({ refs: [wall], primary: wall });

    store.getState().toggleSelection(opening);
    expect(store.getState().selection).toEqual({ refs: [wall, opening], primary: opening });

    store.getState().addSelection([object]);
    expect(store.getState().selection).toEqual({ refs: [wall, opening, object], primary: object });

    store.getState().toggleSelection(object);
    expect(store.getState().selection).toEqual({ refs: [wall, opening], primary: opening });

    store.getState().clearSelection();
    expect(store.getState().selection).toEqual({ refs: [], primary: null });
  });

  it("selects all concrete document entities but not derived rooms or vertices", () => {
    const document = selectionDocument();
    const store = createEditorStore();
    store.setState({ history: createHistoryState(document) });

    store.getState().selectAllConcreteEntities();

    expect(store.getState().selection.refs).toEqual([
      ...document.walls.map((wall) => ({ kind: "wall" as const, id: wall.id })),
      ...document.openings.map((opening) => ({ kind: "opening" as const, id: opening.id })),
      ...document.placedObjects.map((object) => ({ kind: "placed-object" as const, id: object.id })),
    ]);
    expect(store.getState().selection.refs.some((ref) => ref.kind === "room" || ref.kind === "vertex")).toBe(false);
    expect(store.getState().selection.primary).toEqual({ kind: "placed-object", id: "chair" });
  });

  it("sanitises selection after deletes and history transitions", () => {
    const document = selectionDocument();
    const store = createEditorStore();
    store.setState({ history: createHistoryState(document) });

    store.getState().replaceSelection({ kind: "placed-object", id: "chair" });
    store.getState().deleteSelectedObject();
    expect(store.getState().selection).toEqual({ refs: [], primary: null });

    store.getState().undo();
    expect(store.getState().history.document.placedObjects.some((object) => object.id === "chair")).toBe(true);
    expect(store.getState().selection).toEqual({ refs: [], primary: null });

    store.getState().replaceSelection({ kind: "placed-object", id: "chair" });
    store.getState().redo();
    expect(store.getState().history.document.placedObjects.some((object) => object.id === "chair")).toBe(false);
    expect(store.getState().selection).toEqual({ refs: [], primary: null });
  });

  it("projects one-entity selection for legacy single inspector compatibility", () => {
    const wall = replaceSelection({ kind: "wall", id: "top" });
    const room = replaceSelection({ kind: "room", id: "room-1" });
    const opening = replaceSelection({ kind: "opening", id: "door" });
    const object = replaceSelection({ kind: "placed-object", id: "chair" });
    const mixed = addToSelection(wall, [{ kind: "placed-object", id: "chair" }]);

    expect(selectedWallId(wall)).toBe("top");
    expect(selectedRoomId(room)).toBe("room-1");
    expect(selectedOpeningId(opening)).toBe("door");
    expect(selectedObjectId(object)).toBe("chair");
    expect(selectedWallId(mixed)).toBeNull();
    expect(selectedObjectId(mixed)).toBeNull();
  });

  it("does not retain independent writable selected-id fields", () => {
    const state = createEditorStore().getState() as unknown as Record<string, unknown>;
    expect(state).toHaveProperty("selection");
    expect(state).not.toHaveProperty("selectedWallId");
    expect(state).not.toHaveProperty("selectedRoomId");
    expect(state).not.toHaveProperty("selectedOpeningId");
    expect(state).not.toHaveProperty("selectedObjectId");
  });
});
