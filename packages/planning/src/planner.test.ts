import { describe, expect, it } from "vitest";
import type { VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";
import { orientationsFor, placementOptionsForObject } from "./anchors";
import {
  MAX_PLANNING_EVALUATIONS,
  MAX_SELECTED_PLANNING_OBJECTS,
  PlanningError,
  type PlanningCandidate,
  validatePlanningRequest,
} from "./contracts";
import {
  comparePlanningCandidateEvaluations,
  evaluatePlanningCandidate,
  type PlanningCandidateEvaluation,
} from "./evaluation";
import { planLayoutAlternatives } from "./planner";

function rectangularDocument(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "v1", position: { x: 0, y: 0 } },
      { id: "v2", position: { x: 4000, y: 0 } },
      { id: "v3", position: { x: 4000, y: 3000 } },
      { id: "v4", position: { x: 0, y: 3000 } },
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
        position: { x: 1200, y: 1000 }, width: 1200, depth: 700, height: 850, rotationDeg: 0,
        clearance: { front: 300, right: 0, back: 0, left: 0 },
      },
      {
        id: "table", presetId: null, name: "Стол", category: "table",
        position: { x: 2900, y: 1800 }, width: 900, depth: 600, height: 750, rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      },
    ],
  };
}

function lShapedDocument(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "v1", position: { x: 0, y: 0 } }, { id: "v2", position: { x: 4000, y: 0 } },
      { id: "v3", position: { x: 4000, y: 2000 } }, { id: "v4", position: { x: 2500, y: 2000 } },
      { id: "v5", position: { x: 2500, y: 3500 } }, { id: "v6", position: { x: 0, y: 3500 } },
    ],
    walls: [
      { id: "w1", startVertexId: "v1", endVertexId: "v2", junctionVertexIds: [], thickness: 100 },
      { id: "w2", startVertexId: "v2", endVertexId: "v3", junctionVertexIds: [], thickness: 100 },
      { id: "w3", startVertexId: "v3", endVertexId: "v4", junctionVertexIds: [], thickness: 100 },
      { id: "w4", startVertexId: "v4", endVertexId: "v5", junctionVertexIds: [], thickness: 100 },
      { id: "w5", startVertexId: "v5", endVertexId: "v6", junctionVertexIds: [], thickness: 100 },
      { id: "w6", startVertexId: "v6", endVertexId: "v1", junctionVertexIds: [], thickness: 100 },
    ],
    openings: [], roomAnnotations: [],
    placedObjects: [{
      id: "chair", presetId: null, name: "Стул", category: "chair", position: { x: 1000, y: 1000 },
      width: 500, depth: 500, height: 900, rotationDeg: 0,
      clearance: { front: 0, right: 0, back: 0, left: 0 },
    }],
  };
}

function roomId(document: VlezetDocument): string {
  const room = deriveRooms(document).rooms[0];
  if (!room) throw new Error("Expected fixture room");
  return room.id;
}

function candidate(document: VlezetDocument, placements: PlanningCandidate["placements"]): PlanningCandidate {
  return { id: "candidate:test", roomId: roomId(document), placements };
}

function ranking(overrides: Partial<PlanningCandidateEvaluation>): PlanningCandidateEvaluation {
  return {
    candidateId: "candidate:test",
    valid: true,
    tightObjectCount: 0,
    recommendationCount: 0,
    preferencePenalty: 0,
    rotatedObjectCount: 0,
    totalMovementMm: 0,
    reasons: [],
    stableKey: "a",
    ...overrides,
  };
}

describe("validatePlanningRequest", () => {
  it("accepts one to three unique existing objects inside a rectangular target room", () => {
    const document = rectangularDocument();
    const context = validatePlanningRequest(document, { roomId: roomId(document), objectIds: ["sofa", "table"] });
    expect(context.room.id).toBe(roomId(document));
    expect(context.selectedObjects.map((object) => object.id)).toEqual(["sofa", "table"]);
  });

  it("fails closed for empty, duplicate or oversized object selections", () => {
    const document = rectangularDocument();
    const targetRoomId = roomId(document);
    for (const objectIds of [[], ["sofa", "sofa"], Array.from({ length: MAX_SELECTED_PLANNING_OBJECTS + 1 }, (_, index) => `object-${index}`)]) {
      expect(() => validatePlanningRequest(document, { roomId: targetRoomId, objectIds })).toThrowError(PlanningError);
    }
  });

  it("fails closed when room or selected object is missing", () => {
    const document = rectangularDocument();
    expect(() => validatePlanningRequest(document, { roomId: "missing-room", objectIds: ["sofa"] }))
      .toThrowError(expect.objectContaining({ code: "room-missing" }));
    expect(() => validatePlanningRequest(document, { roomId: roomId(document), objectIds: ["missing-object"] }))
      .toThrowError(expect.objectContaining({ code: "object-missing" }));
  });

  it("fails closed for a non-rectangular target room", () => {
    const document = lShapedDocument();
    expect(() => validatePlanningRequest(document, { roomId: roomId(document), objectIds: ["chair"] }))
      .toThrowError(expect.objectContaining({ code: "room-unsupported" }));
  });
});

describe("deterministic placement options", () => {
  it("deduplicates current and quarter-turn orientations in stable order", () => {
    expect(orientationsFor(0)).toEqual([0, 90]);
    expect(orientationsFor(270)).toEqual([270, 0]);
  });

  it("places corner anchors using the oriented footprint instead of the object centre", () => {
    const document = rectangularDocument();
    const room = deriveRooms(document).rooms[0]!;
    const sofa = document.placedObjects[0]!;
    const options = placementOptionsForObject(room, sofa);
    const bounds = {
      minX: Math.min(...room.polygon.map((point) => point.x)),
      minY: Math.min(...room.polygon.map((point) => point.y)),
    };
    expect(options[0]).toMatchObject({
      rotationDeg: 0,
      position: { x: bounds.minX + sofa.width / 2, y: bounds.minY + sofa.depth / 2 },
    });
    expect(new Set(options.map((option) => `${option.position.x}:${option.position.y}:${option.rotationDeg}`)).size)
      .toBe(options.length);
  });
});

describe("evaluatePlanningCandidate", () => {
  it("rejects selected-object placements outside the room and collisions with fixed objects", () => {
    const document = rectangularDocument();
    const outside = evaluatePlanningCandidate(document, candidate(document, [{
      objectId: "sofa", position: { x: -500, y: -500 }, rotationDeg: 0,
    }]));
    const collision = evaluatePlanningCandidate(document, candidate(document, [{
      objectId: "sofa", position: { ...document.placedObjects[1]!.position }, rotationDeg: 0,
    }]));
    expect(outside.valid).toBe(false);
    expect(collision.valid).toBe(false);
  });

  it("rejects a placement that obstructs an authoritative door swing", () => {
    const base = rectangularDocument();
    const document: VlezetDocument = {
      ...base,
      openings: [{ id: "door", wallId: "w1", kind: "door", offset: 1400, width: 900, doorSwing: { hinge: "start", side: "left" } }],
    };
    const result = evaluatePlanningCandidate(document, candidate(document, [{
      objectId: "sofa", position: { x: 1750, y: 500 }, rotationDeg: 0,
    }]));
    expect(result.valid).toBe(false);
  });
});

describe("deterministic ranking", () => {
  it("orders by tight count, recommendations, preferences, rotations, movement, then stable key", () => {
    expect(comparePlanningCandidateEvaluations(ranking({}), ranking({ tightObjectCount: 1 }))).toBeLessThan(0);
    expect(comparePlanningCandidateEvaluations(ranking({}), ranking({ recommendationCount: 1 }))).toBeLessThan(0);
    expect(comparePlanningCandidateEvaluations(ranking({ preferencePenalty: 0.1 }), ranking({ preferencePenalty: 0.2 }))).toBeLessThan(0);
    expect(comparePlanningCandidateEvaluations(ranking({}), ranking({ rotatedObjectCount: 1 }))).toBeLessThan(0);
    expect(comparePlanningCandidateEvaluations(ranking({ totalMovementMm: 100 }), ranking({ totalMovementMm: 200 }))).toBeLessThan(0);
    expect(comparePlanningCandidateEvaluations(ranking({ stableKey: "a" }), ranking({ stableKey: "b" }))).toBeLessThan(0);
  });

  it("returns stable bounded alternatives without mutating the source document", () => {
    const document = rectangularDocument();
    const before = JSON.stringify(document);
    const request = { roomId: roomId(document), objectIds: ["sofa", "table"] } as const;
    const first = planLayoutAlternatives(document, request);
    const second = planLayoutAlternatives(document, request);
    expect(second).toEqual(first);
    expect(first.evaluatedCandidateCount).toBeLessThanOrEqual(MAX_PLANNING_EVALUATIONS);
    expect(first.candidates.length).toBeLessThanOrEqual(3);
    expect(first.candidates.every((item) => item.evaluation.valid)).toBe(true);
    expect(JSON.stringify(document)).toBe(before);
  });
});
