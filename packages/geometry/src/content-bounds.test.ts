import { describe, expect, it } from "vitest";
import { deriveDocumentBounds, fitViewportToBounds } from "./content-bounds";

const empty = {
  schemaVersion: 3 as const,
  vertices: [], walls: [], openings: [], roomAnnotations: [], placedObjects: [],
};

describe("document content bounds", () => {
  it("returns null for an empty plan and a stable default viewport", () => {
    expect(deriveDocumentBounds(empty)).toBeNull();
    expect(fitViewportToBounds(null, { width: 1000, height: 700 })).toEqual({
      offsetX: 140,
      offsetY: 140,
      pixelsPerMillimeter: 0.12,
    });
  });

  it("includes physical wall thickness", () => {
    const document = {
      ...empty,
      vertices: [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "b", position: { x: 4000, y: 0 } },
      ],
      walls: [{ id: "w", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 200 }],
    };
    expect(deriveDocumentBounds(document)).toEqual({ minX: -100, minY: -100, maxX: 4100, maxY: 100 });
  });

  it("includes rotated furniture and fits it with padding", () => {
    const document = {
      ...empty,
      placedObjects: [{
        id: "table", name: "Стол", position: { x: 2000, y: 1000 }, width: 1000, depth: 500,
        rotationDeg: 90, clearance: { front: 0, right: 0, back: 0, left: 0 },
      }],
    };
    const bounds = deriveDocumentBounds(document)!;
    expect(bounds.minX).toBeCloseTo(1750, 8);
    expect(bounds.maxX).toBeCloseTo(2250, 8);
    expect(bounds.minY).toBeCloseTo(500, 8);
    expect(bounds.maxY).toBeCloseTo(1500, 8);
    const viewport = fitViewportToBounds(bounds, { width: 1000, height: 700 }, 64);
    expect(viewport.pixelsPerMillimeter).toBeCloseTo(0.572, 3);
    expect(2000 * viewport.pixelsPerMillimeter + viewport.offsetX).toBeCloseTo(500, 8);
    expect(1000 * viewport.pixelsPerMillimeter + viewport.offsetY).toBeCloseTo(350, 8);
  });

  it("clamps extreme scales", () => {
    expect(fitViewportToBounds({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, { width: 1000, height: 1000 }).pixelsPerMillimeter).toBe(2);
    expect(fitViewportToBounds({ minX: 0, minY: 0, maxX: 1_000_000, maxY: 1_000_000 }, { width: 1000, height: 1000 }).pixelsPerMillimeter).toBe(0.01);
  });
});
