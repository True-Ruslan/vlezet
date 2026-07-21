import { describe, expect, it } from "vitest";
import {
  expandedOrientedRectangle,
  localToWorld,
  orientedRectangleCorners,
  orientedRectanglesIntersect,
  pointInOrientedRectangle,
  worldToLocal,
} from "./oriented-rectangle";

describe("oriented rectangle geometry", () => {
  it("returns clockwise world corners at zero rotation", () => {
    expect(orientedRectangleCorners({ center: { x: 100, y: 200 }, width: 2000, depth: 1000, rotationDeg: 0 })).toEqual([
      { x: -900, y: -300 },
      { x: 1100, y: -300 },
      { x: 1100, y: 700 },
      { x: -900, y: 700 },
    ]);
  });

  it("rotates a centred 2000x1000 rectangle by 90 degrees", () => {
    expect(orientedRectangleCorners({ center: { x: 0, y: 0 }, width: 2000, depth: 1000, rotationDeg: 90 })).toEqual([
      { x: 500, y: -1000 },
      { x: 500, y: 1000 },
      { x: -500, y: 1000 },
      { x: -500, y: -1000 },
    ]);
  });

  it("round-trips local and world coordinates", () => {
    const rectangle = { center: { x: 1200, y: -300 }, width: 1000, depth: 600, rotationDeg: 37 };
    const local = { x: 230, y: -110 };
    const world = localToWorld(rectangle, local);
    const restored = worldToLocal(rectangle, world);
    expect(restored.x).toBeCloseTo(local.x, 10);
    expect(restored.y).toBeCloseTo(local.y, 10);
  });

  it("includes boundary points and excludes points beyond the footprint", () => {
    const rectangle = { center: { x: 0, y: 0 }, width: 1000, depth: 500, rotationDeg: 45 };
    expect(pointInOrientedRectangle(localToWorld(rectangle, { x: 500, y: 0 }), rectangle)).toBe(true);
    expect(pointInOrientedRectangle(localToWorld(rectangle, { x: 501, y: 0 }), rectangle)).toBe(false);
  });

  it("detects rotated overlap but not exact edge touching", () => {
    const a = { center: { x: 0, y: 0 }, width: 1000, depth: 1000, rotationDeg: 45 };
    const overlapping = { center: { x: 900, y: 0 }, width: 1000, depth: 1000, rotationDeg: -20 };
    expect(orientedRectanglesIntersect(a, overlapping)).toBe(true);

    const axisAligned = { center: { x: 0, y: 0 }, width: 1000, depth: 500, rotationDeg: 0 };
    const touching = { center: { x: 1000, y: 0 }, width: 1000, depth: 500, rotationDeg: 0 };
    expect(orientedRectanglesIntersect(axisAligned, touching)).toBe(false);
  });

  it("expands asymmetric functional clearance in local directions", () => {
    expect(expandedOrientedRectangle(
      { center: { x: 0, y: 0 }, width: 1000, depth: 500, rotationDeg: 0 },
      { front: 80, right: 300, back: 20, left: 100 },
    )).toEqual({ center: { x: 100, y: 30 }, width: 1400, depth: 600, rotationDeg: 0 });
  });
});
