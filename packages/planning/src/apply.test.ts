import { describe, expect, it } from "vitest";
import type { VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";
import { applyPlanningCandidateToDocument } from "./apply";
import { PlanningError, type PlanningCandidate } from "./contracts";

function documentFixture(): VlezetDocument {
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
      { id: "sofa", presetId: "sofa-preset", name: "Диван", category: "seating", position: { x: 1200, y: 1000 }, width: 1200, depth: 700, height: 850, rotationDeg: 0, clearance: { front: 300, right: 0, back: 0, left: 0 } },
      { id: "table", presetId: null, name: "Стол", category: "table", position: { x: 2900, y: 1800 }, width: 900, depth: 600, height: 750, rotationDeg: 0, clearance: { front: 0, right: 0, back: 0, left: 0 } },
    ],
  };
}

function candidateFor(document: VlezetDocument): PlanningCandidate {
  const room = deriveRooms(document).rooms[0]!;
  return {
    id: "candidate:apply",
    roomId: room.id,
    placements: [{ objectId: "sofa", position: { x: 1000, y: 2100 }, rotationDeg: 90 }],
  };
}

describe("applyPlanningCandidateToDocument", () => {
  it("revalidates and changes only position and rotation while preserving object semantics", () => {
    const document = documentFixture();
    const sourceJson = JSON.stringify(document);
    const source = document.placedObjects[0]!;
    const applied = applyPlanningCandidateToDocument(document, candidateFor(document));
    const changed = applied.placedObjects[0]!;

    expect(changed).toEqual({ ...source, position: { x: 1000, y: 2100 }, rotationDeg: 90 });
    expect(applied.placedObjects[1]).toEqual(document.placedObjects[1]);
    expect(JSON.stringify(document)).toBe(sourceJson);
  });

  it("normalizes candidate rotation before it becomes persistent document state", () => {
    const document = documentFixture();
    const candidate = candidateFor(document);
    const applied = applyPlanningCandidateToDocument(document, {
      ...candidate,
      placements: candidate.placements.map((placement) => ({ ...placement, rotationDeg: 450 })),
    });

    expect(applied.placedObjects[0]?.rotationDeg).toBe(90);
  });

  it("fails atomically when the candidate became invalid against the current document", () => {
    const original = documentFixture();
    const candidate = candidateFor(original);
    const staleCurrent: VlezetDocument = {
      ...original,
      placedObjects: original.placedObjects.map((object) => object.id === "table"
        ? { ...object, position: { x: 1000, y: 2100 } }
        : object),
    };
    const before = JSON.stringify(staleCurrent);

    expect(() => applyPlanningCandidateToDocument(staleCurrent, candidate))
      .toThrowError(expect.objectContaining<Partial<PlanningError>>({ code: "candidate-invalid" }));
    expect(JSON.stringify(staleCurrent)).toBe(before);
  });
});
