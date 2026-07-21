import { describe, expect, it } from "vitest";
import { measureObjectClearances } from "./measurements";
import type { FitDocumentLike, FitPlacedObjectLike } from "./fit";

function document(placedObjects: readonly FitPlacedObjectLike[]): FitDocumentLike {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 6000, y: 0 } },
      { id: "c", position: { x: 6000, y: 4000 } },
      { id: "d", position: { x: 0, y: 4000 } },
    ],
    walls: [
      { id: "top", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 200 },
      { id: "right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 200 },
      { id: "bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 200 },
      { id: "left", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 200 },
    ],
    roomAnnotations: [],
    openings: [],
    placedObjects,
  };
}

const selected: FitPlacedObjectLike = {
  id: "selected",
  name: "Стол",
  position: { x: 3000, y: 2000 },
  width: 1000,
  depth: 500,
  rotationDeg: 0,
  clearance: { front: 0, right: 0, back: 0, left: 0 },
};

describe("directional object clearances", () => {
  it("measures the nearest usable room boundary from every local side", () => {
    expect(measureObjectClearances(document([selected]), "selected")).toEqual({
      front: 1650,
      right: 2400,
      back: 1650,
      left: 2400,
    });
  });

  it("uses nearby object footprints before the room boundary", () => {
    const nearby: FitPlacedObjectLike = {
      id: "nearby",
      name: "Тумба",
      position: { x: 4300, y: 2000 },
      width: 600,
      depth: 1000,
      rotationDeg: 0,
      clearance: { front: 0, right: 0, back: 0, left: 0 },
    };
    expect(measureObjectClearances(document([selected, nearby]), "selected").right).toBeCloseTo(500, 10);
  });

  it("returns local-direction values after rotation", () => {
    const rotated = { ...selected, rotationDeg: 90 };
    const clearances = measureObjectClearances(document([rotated]), "selected");
    expect(clearances.front).toBeCloseTo(2400, 10);
    expect(clearances.right).toBeCloseTo(1650, 10);
    expect(clearances.back).toBeCloseTo(2400, 10);
    expect(clearances.left).toBeCloseTo(1650, 10);
  });

  it("throws for a missing selected object", () => {
    expect(() => measureObjectClearances(document([selected]), "missing")).toThrow(/missing/i);
  });
});
