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

  it("cancels a draft without creating history", () => {
    const store = createEditorStore({ idFactory: sequentialIds() }); store.getState().beginWall({ x: 0, y: 0 }); store.getState().updateDraftWall(noSnap(1000, 0)); store.getState().cancelDraft(); expect(store.getState().draftWall).toBeNull(); expect(store.getState().history.past).toHaveLength(0);
  });
});
