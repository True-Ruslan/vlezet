import type { VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import type { PlanningCandidate, PlanningConstraint } from "./contracts";
import { evaluatePlanningCandidate } from "./evaluation";

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
      { id: "sofa", presetId: null, name: "Диван", category: "seating", position: { x: 1200, y: 1000 }, width: 900, depth: 600, height: 800, rotationDeg: 0, clearance: { front: 0, right: 0, back: 0, left: 0 } },
      { id: "table", presetId: null, name: "Стол", category: "table", position: { x: 2800, y: 1800 }, width: 700, depth: 500, height: 750, rotationDeg: 0, clearance: { front: 0, right: 0, back: 0, left: 0 } },
    ],
  };
}

function candidate(document: VlezetDocument, constraints: readonly PlanningConstraint[]): PlanningCandidate {
  return {
    id: "candidate:revalidate",
    roomId: deriveRooms(document).rooms[0]!.id,
    placements: document.placedObjects.map((object) => ({
      objectId: object.id,
      position: { ...object.position },
      rotationDeg: object.rotationDeg,
    })),
    constraints,
  };
}

describe("candidate constraint revalidation", () => {
  it("fails closed for conflicting boundary preferences carried by a direct candidate", () => {
    const document = fixture();
    expect(evaluatePlanningCandidate(document, candidate(document, [
      { kind: "prefer-room-boundary", objectId: "sofa", target: "wall" },
      { kind: "prefer-room-boundary", objectId: "sofa", target: "corner" },
    ])).valid).toBe(false);
  });

  it("fails closed for self-pairs and an all-locked direct candidate", () => {
    const document = fixture();
    expect(evaluatePlanningCandidate(document, candidate(document, [
      { kind: "pair-distance", objectIds: ["sofa", "sofa"], preference: "near" },
    ])).valid).toBe(false);
    expect(evaluatePlanningCandidate(document, candidate(document, [
      { kind: "lock-object", objectId: "sofa" },
      { kind: "lock-object", objectId: "table" },
    ])).valid).toBe(false);
  });
});
