import type { VlezetDocument } from "@vlezet/domain";
import type { PlanningCandidate } from "@vlezet/planning";
import { describe, expect, it } from "vitest";
import { deriveExactGapAnnotation } from "./exact-gap-annotation";

function documentWithGap(gapMm: number): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [],
    walls: [],
    openings: [],
    roomAnnotations: [],
    placedObjects: [
      {
        id: "sofa", presetId: null, name: "Диван", category: "seating",
        position: { x: 500, y: 500 }, width: 1000, depth: 700, height: 800, rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      },
      {
        id: "table", presetId: null, name: "Стол", category: "table",
        position: { x: 1500 + gapMm, y: 500 }, width: 1000, depth: 700, height: 750, rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      },
    ],
  };
}

function candidate(document: VlezetDocument, minimumMm = 800): PlanningCandidate {
  return {
    id: "candidate:gap",
    roomId: "room-1",
    placements: document.placedObjects.map((object) => ({
      objectId: object.id,
      position: { ...object.position },
      rotationDeg: object.rotationDeg,
    })),
    constraints: [{ kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm }],
  };
}

describe("deriveExactGapAnnotation", () => {
  it("derives required and actual gap from preview transforms without mutation", () => {
    const document = documentWithGap(842);
    const preview = candidate(document);
    const documentBefore = JSON.stringify(document);
    const candidateBefore = JSON.stringify(preview);

    expect(deriveExactGapAnnotation(document, preview, "sofa|table")).toMatchObject({
      pairKey: "sofa|table",
      actualMm: 842,
      requiredMm: 800,
      satisfied: true,
      zeroLength: false,
      label: "↔ Кратчайший зазор 842 мм",
    });
    expect(JSON.stringify(document)).toBe(documentBefore);
    expect(JSON.stringify(preview)).toBe(candidateBefore);
  });

  it("reports current preview geometry as stale and unsatisfied", () => {
    const document = documentWithGap(799);
    expect(deriveExactGapAnnotation(document, candidate(document), "sofa|table"))
      .toMatchObject({ actualMm: 799, requiredMm: 800, satisfied: false });
  });

  it("returns zero-length contact semantics", () => {
    const document = documentWithGap(0);
    expect(deriveExactGapAnnotation(document, candidate(document, 0), "sofa|table"))
      .toMatchObject({
        actualMm: 0,
        requiredMm: 0,
        satisfied: true,
        zeroLength: true,
        label: "↔ Кратчайший зазор 0 мм",
      });
  });

  it("returns null for missing Preview, active key, exact rule, object or unique overlap witness", () => {
    const document = documentWithGap(842);
    const exact = candidate(document);
    expect(deriveExactGapAnnotation(document, null, "sofa|table")).toBeNull();
    expect(deriveExactGapAnnotation(document, exact, null)).toBeNull();
    expect(deriveExactGapAnnotation(document, { ...exact, constraints: [] }, "sofa|table")).toBeNull();
    expect(deriveExactGapAnnotation(
      { ...document, placedObjects: document.placedObjects.slice(0, 1) },
      exact,
      "sofa|table",
    )).toBeNull();
    const overlap = documentWithGap(-100);
    expect(deriveExactGapAnnotation(overlap, candidate(overlap, 0), "sofa|table")).toBeNull();
  });
});
