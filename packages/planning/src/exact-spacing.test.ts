import type { VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import { evaluatePlanningConstraints, type PlanningConstraint } from "./constraints";
import type { PlanningCandidate } from "./contracts";

function documentWithEdgeGap(gapMm: number): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "v1", position: { x: 0, y: 0 } },
      { id: "v2", position: { x: 6000, y: 0 } },
      { id: "v3", position: { x: 6000, y: 4000 } },
      { id: "v4", position: { x: 0, y: 4000 } },
    ],
    walls: [
      { id: "w1", startVertexId: "v1", endVertexId: "v2", junctionVertexIds: [], thickness: 100 },
      { id: "w2", startVertexId: "v2", endVertexId: "v3", junctionVertexIds: [], thickness: 100 },
      { id: "w3", startVertexId: "v3", endVertexId: "v4", junctionVertexIds: [], thickness: 100 },
      { id: "w4", startVertexId: "v4", endVertexId: "v1", junctionVertexIds: [], thickness: 100 },
    ],
    openings: [],
    roomAnnotations: [],
    placedObjects: [
      {
        id: "sofa", presetId: null, name: "Диван", category: "seating",
        position: { x: 1500, y: 2000 }, width: 1000, depth: 700, height: 800, rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      },
      {
        id: "table", presetId: null, name: "Стол", category: "table",
        position: { x: 2500 + gapMm, y: 2000 }, width: 1000, depth: 700, height: 750, rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      },
    ],
  };
}

function candidate(
  document: VlezetDocument,
  constraints: readonly PlanningConstraint[],
): PlanningCandidate {
  return {
    id: "candidate:exact-spacing",
    roomId: deriveRooms(document).rooms[0]!.id,
    placements: document.placedObjects.map((object) => ({
      objectId: object.id,
      position: { ...object.position },
      rotationDeg: object.rotationDeg,
    })),
    constraints,
  };
}

describe("pair-min-gap exact hard constraint", () => {
  it("rejects 799 mm, accepts exactly 800 mm, and exposes required/actual evidence", () => {
    const below = documentWithEdgeGap(799);
    const exact = documentWithEdgeGap(800);
    const above = documentWithEdgeGap(842);
    const constraint = [{ kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 800 }] as const;

    expect(evaluatePlanningConstraints(below, candidate(below, constraint)).hardValid).toBe(false);
    expect(evaluatePlanningConstraints(exact, candidate(exact, constraint)).hardValid).toBe(true);

    const aboveEvaluation = evaluatePlanningConstraints(above, candidate(above, constraint));
    expect(aboveEvaluation.hardValid).toBe(true);
    expect(aboveEvaluation.exactEvidence).toContainEqual({
      kind: "pair-min-gap",
      objectIds: ["sofa", "table"],
      requiredMm: 800,
      actualMm: 842,
      satisfied: true,
    });
    expect(aboveEvaluation.evidence.join(" ")).toContain("требуется минимум 800 мм");
    expect(aboveEvaluation.evidence.join(" ")).toContain("фактически 842 мм");
  });

  it("lets soft near intent coexist but never rescue a hard minimum violation", () => {
    const document = documentWithEdgeGap(799);
    const evaluation = evaluatePlanningConstraints(document, candidate(document, [
      { kind: "pair-distance", objectIds: ["sofa", "table"], preference: "near" },
      { kind: "pair-min-gap", objectIds: ["table", "sofa"], minimumMm: 800 },
    ]));

    expect(evaluation.preferencePenalty).toBeGreaterThanOrEqual(0);
    expect(evaluation.hardValid).toBe(false);
    expect(evaluation.exactEvidence).toContainEqual(expect.objectContaining({
      kind: "pair-min-gap",
      requiredMm: 800,
      actualMm: 799,
      satisfied: false,
    }));
  });
});
