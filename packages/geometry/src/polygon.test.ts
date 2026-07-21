import { describe, expect, it } from "vitest";
import { findInteriorPoint, pointInPolygon, polygonSelfIntersects, signedPolygonArea } from "./polygon";

const square = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];

describe("polygon geometry", () => {
  it("calculates signed polygon area", () => {
    expect(signedPolygonArea(square)).toBe(12_000_000);
    expect(signedPolygonArea([...square].reverse())).toBe(-12_000_000);
  });

  it("detects containment and self intersections", () => {
    expect(pointInPolygon({ x: 1000, y: 1000 }, square)).toBe(true);
    expect(pointInPolygon({ x: 5000, y: 1000 }, square)).toBe(false);
    expect(polygonSelfIntersects(square)).toBe(false);
    expect(polygonSelfIntersects([
      { x: 0, y: 0 },
      { x: 4000, y: 4000 },
      { x: 0, y: 4000 },
      { x: 4000, y: 0 },
    ])).toBe(true);
  });

  it("finds a deterministic point inside a concave polygon", () => {
    const lShape = [
      { x: 0, y: 0 },
      { x: 5000, y: 0 },
      { x: 5000, y: 2000 },
      { x: 2000, y: 2000 },
      { x: 2000, y: 5000 },
      { x: 0, y: 5000 },
    ];
    const point = findInteriorPoint(lShape);
    expect(pointInPolygon(point, lShape)).toBe(true);
    expect(findInteriorPoint(lShape)).toEqual(point);
  });
});
