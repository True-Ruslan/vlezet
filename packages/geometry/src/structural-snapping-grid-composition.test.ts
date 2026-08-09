import { describe, expect, it } from "vitest";
import { resolveStructuralSnap } from "./structural-snapping";

const emptyDocument = {
  schemaVersion: 3 as const,
  vertices: [],
  walls: [],
};

const baseInput = {
  document: emptyDocument,
  gridStep: 25,
  acquisitionTolerance: 10,
  releaseTolerance: 18,
  replacementAdvantage: 1,
  snappingEnabled: true,
} as const;

describe("M8.2 structural snap grid composition", () => {
  it("quantizes the free coordinate while preserving horizontal and vertical construction constraints", () => {
    expect(resolveStructuralSnap({
      ...baseInput,
      rawPoint: { x: 73, y: 4 },
      startPoint: { x: 0, y: 0 },
    })).toMatchObject({
      kind: "horizontal",
      point: { x: 75, y: 0 },
    });

    expect(resolveStructuralSnap({
      ...baseInput,
      rawPoint: { x: 4, y: 73 },
      startPoint: { x: 0, y: 0 },
    })).toMatchObject({
      kind: "vertical",
      point: { x: 0, y: 75 },
    });
  });
});
