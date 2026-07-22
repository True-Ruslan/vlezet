import type { VlezetDocument } from "@vlezet/domain";
import { createHistoryState } from "@vlezet/editor-core";
import { describe, expect, it } from "vitest";
import { createEditorStore } from "./use-editor-store";

function rectangleDocument(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
      { id: "c", position: { x: 4000, y: 3000 } },
      { id: "d", position: { x: 0, y: 3000 } },
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

describe("editor store wall thickness alignment", () => {
  it("applies a face-fixed thickness edit as one semantic command", () => {
    const document = rectangleDocument();
    const store = createEditorStore();
    store.setState({ history: createHistoryState(document), selectedWallId: "top" });

    store.getState().setSelectedWallThickness(300, "right-face");

    const state = store.getState();
    expect(state.history.document.walls.find((wall) => wall.id === "top")?.thickness).toBe(300);
    expect(state.history.document.vertices.find((vertex) => vertex.id === "a")?.position).toEqual({ x: 0, y: 100 });
    expect(state.history.document.vertices.find((vertex) => vertex.id === "b")?.position).toEqual({ x: 4000, y: 100 });
    expect(state.history.past).toHaveLength(1);
    expect(state.history.past[0]?.forward.label).toBe("wall/set-thickness");

    store.getState().undo();
    expect(store.getState().history.document.walls.find((wall) => wall.id === "top")?.thickness).toBe(100);
    expect(store.getState().history.document.vertices.find((vertex) => vertex.id === "a")?.position).toEqual({ x: 0, y: 0 });
  });
});
