import { describe, expect, it } from "vitest";
import type { VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";
import type { PlanningCandidate } from "@vlezet/planning";
import { createHistoryState, executeCommand, redo, undo } from "./history";
import { applyPlanningCandidate } from "./planning-editing";

function fixture(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "v1", position: { x: 0, y: 0 } }, { id: "v2", position: { x: 4000, y: 0 } },
      { id: "v3", position: { x: 4000, y: 3000 } }, { id: "v4", position: { x: 0, y: 3000 } },
    ],
    walls: [
      { id: "w1", startVertexId: "v1", endVertexId: "v2", junctionVertexIds: [], thickness: 100 },
      { id: "w2", startVertexId: "v2", endVertexId: "v3", junctionVertexIds: [], thickness: 100 },
      { id: "w3", startVertexId: "v3", endVertexId: "v4", junctionVertexIds: [], thickness: 100 },
      { id: "w4", startVertexId: "v4", endVertexId: "v1", junctionVertexIds: [], thickness: 100 },
    ],
    openings: [], roomAnnotations: [],
    placedObjects: [
      { id: "sofa", presetId: null, name: "Диван", category: "seating", position: { x: 1000, y: 900 }, width: 1000, depth: 600, rotationDeg: 0, clearance: { front: 0, right: 0, back: 0, left: 0 } },
      { id: "table", presetId: null, name: "Стол", category: "table", position: { x: 2900, y: 1900 }, width: 800, depth: 600, rotationDeg: 0, clearance: { front: 0, right: 0, back: 0, left: 0 } },
    ],
  };
}

describe("planning candidate editing", () => {
  it("applies all candidate transforms as one semantic undoable transition", () => {
    const before = fixture();
    const roomId = deriveRooms(before).rooms[0]!.id;
    const candidate: PlanningCandidate = {
      id: "candidate:history",
      roomId,
      placements: [
        { objectId: "sofa", position: { x: 1100, y: 2100 }, rotationDeg: 90 },
        { objectId: "table", position: { x: 2900, y: 900 }, rotationDeg: 90 },
      ],
    };
    const after = applyPlanningCandidate(before, candidate);
    const executed = executeCommand(createHistoryState(before), {
      type: "document/replace",
      label: "planning/apply-candidate",
      before,
      after,
    });

    expect(executed.past).toHaveLength(1);
    expect(executed.document).toEqual(after);
    expect(undo(executed).document).toEqual(before);
    expect(redo(undo(executed)).document).toEqual(after);
  });
});
