import { describe, expect, it } from "vitest";
import { pointInPolygonInclusive } from "./point-in-polygon";

const L_SHAPED_ROOM = [
  { x: 0, y: 0 },
  { x: 6000, y: 0 },
  { x: 6000, y: 3000 },
  { x: 3000, y: 3000 },
  { x: 3000, y: 6000 },
  { x: 0, y: 6000 },
] as const;

describe("pointInPolygonInclusive", () => {
  it("rejects the cut-out of a concave room and includes both arms", () => {
    expect(pointInPolygonInclusive({ x: 4500, y: 4500 }, L_SHAPED_ROOM)).toBe(false);
    expect(pointInPolygonInclusive({ x: 1500, y: 4500 }, L_SHAPED_ROOM)).toBe(true);
    expect(pointInPolygonInclusive({ x: 4500, y: 1500 }, L_SHAPED_ROOM)).toBe(true);
  });

  it("treats an edge and a vertex as inside", () => {
    expect(pointInPolygonInclusive({ x: 3000, y: 4500 }, L_SHAPED_ROOM)).toBe(true);
    expect(pointInPolygonInclusive({ x: 3000, y: 3000 }, L_SHAPED_ROOM)).toBe(true);
  });

  it("rejects a degenerate polygon", () => {
    expect(pointInPolygonInclusive({ x: 0, y: 0 }, [{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false);
  });
});
