import { describe, expect, it } from "vitest";
import {
  normalizeCanvasAngleDeg,
  pointFromCanvasPolar,
  vectorToCanvasAngleDeg,
} from "./structural-angle";

describe("M8.2 canvas angle contract", () => {
  it.each([
    [{ x: 10, y: 0 }, 0],
    [{ x: 0, y: 10 }, 90],
    [{ x: -10, y: 0 }, 180],
    [{ x: 0, y: -10 }, 270],
  ] as const)("maps Canvas vector %o to %d degrees", (end, expected) => {
    expect(vectorToCanvasAngleDeg({ x: 0, y: 0 }, end)).toBe(expected);
  });

  it.each([
    [0, 0],
    [360, 0],
    [450, 90],
    [-90, 270],
    [810, 90],
  ] as const)("normalises %d degrees to %d", (input, expected) => {
    expect(normalizeCanvasAngleDeg(input)).toBe(expected);
  });

  it("constructs exact endpoints using the Canvas-oriented angle convention", () => {
    const start = { x: 100, y: 200 };

    expect(pointFromCanvasPolar(start, 1000, 0)).toEqual({ x: 1100, y: 200 });
    expect(pointFromCanvasPolar(start, 1000, 90)).toEqual({ x: 100, y: 1200 });
    expect(pointFromCanvasPolar(start, 1000, 180)).toEqual({ x: -900, y: 200 });
    expect(pointFromCanvasPolar(start, 1000, 270)).toEqual({ x: 100, y: -800 });
  });

  it("round-trips representative non-axis directions within floating tolerance", () => {
    const start = { x: -350, y: 725 };
    const end = pointFromCanvasPolar(start, 2375, 37.5);

    expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeCloseTo(2375, 9);
    expect(vectorToCanvasAngleDeg(start, end)).toBeCloseTo(37.5, 9);
  });

  it("rejects non-finite angles and non-positive or non-finite lengths", () => {
    expect(() => normalizeCanvasAngleDeg(Number.NaN)).toThrow(RangeError);
    expect(() => normalizeCanvasAngleDeg(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => pointFromCanvasPolar({ x: 0, y: 0 }, 0, 0)).toThrow(RangeError);
    expect(() => pointFromCanvasPolar({ x: 0, y: 0 }, -1, 0)).toThrow(RangeError);
    expect(() => pointFromCanvasPolar({ x: 0, y: 0 }, Number.NaN, 0)).toThrow(RangeError);
  });

  it("rejects a zero vector because it has no meaningful direction", () => {
    expect(() => vectorToCanvasAngleDeg({ x: 10, y: 20 }, { x: 10, y: 20 })).toThrow(RangeError);
  });
});
