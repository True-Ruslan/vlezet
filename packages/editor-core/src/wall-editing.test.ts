import { describe, expect, it } from "vitest";
import { createWall } from "@vlezet/domain";
import { setWallLength, wallLength } from "./wall-editing";

describe("wall length editing", () => {
  it("keeps the start fixed and preserves direction", () => {
    const wall = createWall({ id: "wall-1", start: { x: 0, y: 0 }, end: { x: 3000, y: 4000 }, thickness: 150 });
    const resized = setWallLength(wall, 10000);
    expect(resized.start).toEqual({ x: 0, y: 0 });
    expect(resized.end.x).toBeCloseTo(6000, 10);
    expect(resized.end.y).toBeCloseTo(8000, 10);
    expect(wallLength(resized)).toBeCloseTo(10000, 10);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid requested length %s", (length) => {
    const wall = createWall({ id: "wall-1", start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, thickness: 150 });
    expect(() => setWallLength(wall, length)).toThrow(RangeError);
  });

  it("rejects resizing a zero-length wall", () => {
    const wall = createWall({ id: "wall-1", start: { x: 10, y: 10 }, end: { x: 10, y: 10 }, thickness: 150 });
    expect(() => setWallLength(wall, 1000)).toThrow(RangeError);
  });
});
