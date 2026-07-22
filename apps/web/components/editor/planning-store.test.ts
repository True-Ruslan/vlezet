import type { VlezetDocument } from "@vlezet/domain";
import { createHistoryState } from "@vlezet/editor-core";
import { deriveRooms } from "@vlezet/geometry";
import type { PlanningCandidate } from "@vlezet/planning";
import { describe, expect, it } from "vitest";
import { createEditorStore } from "./use-editor-store";

function fixture(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } }, { id: "b", position: { x: 4000, y: 0 } },
      { id: "c", position: { x: 4000, y: 3000 } }, { id: "d", position: { x: 0, y: 3000 } },
    ],
    walls: [
      { id: "top", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 100 },
      { id: "right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 100 },
      { id: "bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 100 },
      { id: "left", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 100 },
    ],
    openings: [], roomAnnotations: [],
    placedObjects: [
      { id: "sofa", presetId: null, name: "Диван", category: "seating", position: { x: 1000, y: 900 }, width: 1000, depth: 600, rotationDeg: 0, clearance: { front: 0, right: 0, back: 0, left: 0 } },
      { id: "table", presetId: null, name: "Стол", category: "table", position: { x: 2900, y: 1900 }, width: 800, depth: 600, rotationDeg: 0, clearance: { front: 0, right: 0, back: 0, left: 0 } },
    ],
  };
}

describe("editor store planning apply", () => {
  it("applies a multi-object candidate as one semantic undo/redo operation", () => {
    const before = fixture();
    const candidate: PlanningCandidate = {
      id: "candidate:store",
      roomId: deriveRooms(before).rooms[0]!.id,
      placements: [
        { objectId: "sofa", position: { x: 1100, y: 2100 }, rotationDeg: 90 },
        { objectId: "table", position: { x: 2900, y: 900 }, rotationDeg: 90 },
      ],
    };
    const store = createEditorStore();
    store.setState({ history: createHistoryState(before) });

    store.getState().applyPlanningCandidate(candidate);

    expect(store.getState().history.past).toHaveLength(1);
    expect(store.getState().history.past[0]?.forward.label).toBe("planning/apply-candidate");
    const applied = store.getState().history.document;
    expect(applied.placedObjects.find((object) => object.id === "sofa")?.position).toEqual({ x: 1100, y: 2100 });
    expect(applied.placedObjects.find((object) => object.id === "table")?.position).toEqual({ x: 2900, y: 900 });

    store.getState().undo();
    expect(store.getState().history.document).toEqual(before);
    store.getState().redo();
    expect(store.getState().history.document).toEqual(applied);
  });
});
