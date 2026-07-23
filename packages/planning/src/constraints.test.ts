import type { VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import {
  MAX_PLANNING_CONSTRAINTS,
  PlanningError,
  type PlanningCandidate,
  type PlanningConstraint,
  validatePlanningRequest,
} from "./contracts";
import {
  evaluatePlanningConstraints,
  normalizePlanningConstraints,
  planningConstraintSetKey,
} from "./constraints";
import { evaluatePlanningCandidate } from "./evaluation";
import { planLayoutAlternatives } from "./planner";

function fixture(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "v1", position: { x: 0, y: 0 } },
      { id: "v2", position: { x: 5000, y: 0 } },
      { id: "v3", position: { x: 5000, y: 4000 } },
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
        position: { x: 1400, y: 1200 }, width: 1200, depth: 700, height: 850, rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      },
      {
        id: "table", presetId: null, name: "Стол", category: "table",
        position: { x: 3400, y: 2200 }, width: 900, depth: 600, height: 750, rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      },
      {
        id: "chair", presetId: null, name: "Кресло", category: "chair",
        position: { x: 2500, y: 3200 }, width: 700, depth: 700, height: 900, rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      },
    ],
  };
}

function roomId(document: VlezetDocument): string {
  return deriveRooms(document).rooms[0]!.id;
}

function candidate(document: VlezetDocument, placements: PlanningCandidate["placements"], constraints: readonly PlanningConstraint[] = []): PlanningCandidate {
  return { id: "candidate:test", roomId: roomId(document), placements, constraints };
}

describe("planning constraint validation", () => {
  it("normalizes supported constraints into a stable deterministic order", () => {
    const constraints: readonly PlanningConstraint[] = [
      { kind: "pair-distance", objectIds: ["table", "sofa"], preference: "near" },
      { kind: "prefer-room-boundary", objectId: "sofa", target: "wall" },
      { kind: "lock-object", objectId: "table" },
    ];
    const normalized = normalizePlanningConstraints(constraints);
    expect(normalized).toEqual([
      { kind: "prefer-room-boundary", objectId: "sofa", target: "wall" },
      { kind: "lock-object", objectId: "table" },
      { kind: "pair-distance", objectIds: ["sofa", "table"], preference: "near" },
    ]);
    expect(planningConstraintSetKey(constraints)).toBe(planningConstraintSetKey([...constraints].reverse()));
  });

  it("normalizes and validates exact pair minimum gaps without conflicting with soft pair intent", () => {
    const selected = new Set(["sofa", "table"]);
    expect(normalizePlanningConstraints([
      { kind: "pair-min-gap", objectIds: ["table", "sofa"], minimumMm: 800 },
    ])).toEqual([
      { kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 800 },
    ]);
    expect(validatePlanningRequest(fixture(), {
      roomId: roomId(fixture()),
      objectIds: ["sofa", "table"],
      constraints: [
        { kind: "pair-distance", objectIds: ["table", "sofa"], preference: "near" },
        { kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 0 },
      ],
    }).constraints).toHaveLength(2);

    const invalidMinimums = [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    for (const minimumMm of invalidMinimums) {
      expect(() => validatePlanningRequest(fixture(), {
        roomId: roomId(fixture()),
        objectIds: ["sofa", "table"],
        constraints: [{ kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm }],
      })).toThrowError(expect.objectContaining<Partial<PlanningError>>({ code: "invalid-constraints" }));
    }

    const invalidExactConstraints: readonly (readonly PlanningConstraint[])[] = [
      [{ kind: "pair-min-gap", objectIds: ["sofa", "sofa"], minimumMm: 100 }],
      [{ kind: "pair-min-gap", objectIds: ["sofa", "chair"], minimumMm: 100 }],
      [
        { kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 800 },
        { kind: "pair-min-gap", objectIds: ["table", "sofa"], minimumMm: 900 },
      ],
    ];
    for (const constraints of invalidExactConstraints) {
      expect(() => validatePlanningRequest(fixture(), {
        roomId: roomId(fixture()), objectIds: [...selected], constraints,
      })).toThrowError(expect.objectContaining<Partial<PlanningError>>({ code: "invalid-constraints" }));
    }
  });

  it("fails closed for missing/non-selected refs, pair self-reference, conflicts and excessive constraints", () => {
    const document = fixture();
    const base = { roomId: roomId(document), objectIds: ["sofa", "table"] } as const;
    const invalid: readonly (readonly PlanningConstraint[])[] = [
      [{ kind: "lock-object", objectId: "chair" }],
      [{ kind: "prefer-room-boundary", objectId: "missing", target: "wall" }],
      [{ kind: "pair-distance", objectIds: ["sofa", "sofa"], preference: "near" }],
      [
        { kind: "prefer-room-boundary", objectId: "sofa", target: "wall" },
        { kind: "prefer-room-boundary", objectId: "sofa", target: "corner" },
      ],
      [
        { kind: "pair-distance", objectIds: ["sofa", "table"], preference: "near" },
        { kind: "pair-distance", objectIds: ["table", "sofa"], preference: "far" },
      ],
      Array.from({ length: MAX_PLANNING_CONSTRAINTS + 1 }, () => ({ kind: "lock-object", objectId: "sofa" } as const)),
    ];
    for (const constraints of invalid) {
      expect(() => validatePlanningRequest(document, { ...base, constraints }))
        .toThrowError(expect.objectContaining<Partial<PlanningError>>({ code: "invalid-constraints" }));
    }
  });

  it("rejects a planning request where every selected object is locked", () => {
    const document = fixture();
    expect(() => validatePlanningRequest(document, {
      roomId: roomId(document),
      objectIds: ["sofa", "table"],
      constraints: [
        { kind: "lock-object", objectId: "sofa" },
        { kind: "lock-object", objectId: "table" },
      ],
    })).toThrowError(expect.objectContaining<Partial<PlanningError>>({ code: "invalid-constraints" }));
  });
});

describe("hard lock semantics", () => {
  it("keeps a locked selected object at its current transform in every generated candidate", () => {
    const document = fixture();
    const source = document.placedObjects.find((object) => object.id === "table")!;
    const result = planLayoutAlternatives(document, {
      roomId: roomId(document),
      objectIds: ["sofa", "table"],
      constraints: [{ kind: "lock-object", objectId: "table" }],
    });
    expect(result.candidates.length).toBeGreaterThan(0);
    for (const item of result.candidates) {
      const locked = item.candidate.placements.find((placement) => placement.objectId === "table")!;
      expect(locked.position).toEqual(source.position);
      expect(locked.rotationDeg).toBe(source.rotationDeg);
    }
  });

  it("rejects a stale candidate when a locked object changed in the current document", () => {
    const original = fixture();
    const constraints: readonly PlanningConstraint[] = [{ kind: "lock-object", objectId: "table" }];
    const generated = planLayoutAlternatives(original, {
      roomId: roomId(original), objectIds: ["sofa", "table"], constraints,
    }).candidates[0]!.candidate;
    const current: VlezetDocument = {
      ...original,
      placedObjects: original.placedObjects.map((object) => object.id === "table"
        ? { ...object, position: { x: object.position.x + 100, y: object.position.y } }
        : object),
    };
    expect(evaluatePlanningCandidate(current, generated).valid).toBe(false);
  });
});

describe("soft constraint metrics", () => {
  it("scores wall and corner preferences with explicit evidence", () => {
    const document = fixture();
    const wallCandidate = candidate(document, [
      { objectId: "sofa", position: { x: 700, y: 1000 }, rotationDeg: 0 },
    ], [{ kind: "prefer-room-boundary", objectId: "sofa", target: "wall" }]);
    const cornerCandidate = candidate(document, [
      { objectId: "sofa", position: { x: 700, y: 450 }, rotationDeg: 0 },
    ], [{ kind: "prefer-room-boundary", objectId: "sofa", target: "corner" }]);
    const wall = evaluatePlanningConstraints(document, wallCandidate);
    const corner = evaluatePlanningConstraints(document, cornerCandidate);
    expect(wall.hardValid).toBe(true);
    expect(wall.preferencePenalty).toBeGreaterThanOrEqual(0);
    expect(wall.evidence.join(" ")).toContain("стены");
    expect(corner.evidence.join(" ")).toContain("угла");
  });

  it("makes near prefer smaller and far prefer larger centre-to-centre distance", () => {
    const document = fixture();
    const nearConstraint: readonly PlanningConstraint[] = [{ kind: "pair-distance", objectIds: ["sofa", "table"], preference: "near" }];
    const farConstraint: readonly PlanningConstraint[] = [{ kind: "pair-distance", objectIds: ["sofa", "table"], preference: "far" }];
    const close = candidate(document, [
      { objectId: "sofa", position: { x: 1200, y: 1500 }, rotationDeg: 0 },
      { objectId: "table", position: { x: 2500, y: 1500 }, rotationDeg: 0 },
    ], nearConstraint);
    const distant = candidate(document, [
      { objectId: "sofa", position: { x: 800, y: 800 }, rotationDeg: 0 },
      { objectId: "table", position: { x: 4200, y: 3200 }, rotationDeg: 0 },
    ], nearConstraint);
    expect(evaluatePlanningConstraints(document, close).preferencePenalty)
      .toBeLessThan(evaluatePlanningConstraints(document, distant).preferencePenalty);

    const closeFar = { ...close, constraints: farConstraint };
    const distantFar = { ...distant, constraints: farConstraint };
    expect(evaluatePlanningConstraints(document, distantFar).preferencePenalty)
      .toBeLessThan(evaluatePlanningConstraints(document, closeFar).preferencePenalty);
    expect(evaluatePlanningConstraints(document, close).evidence.join(" ")).toContain("между центрами");
  });
});
