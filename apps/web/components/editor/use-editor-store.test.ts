import type { VlezetDocument } from "@vlezet/domain";
import { createHistoryState } from "@vlezet/editor-core";
import { deriveRectangularRoomDimensions, deriveRooms } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import { createEditorStore, type EditorEntityIdKind } from "./use-editor-store";

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
    store.setState({ history: createHistoryState(document), selectedRoomId: room.id });

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
