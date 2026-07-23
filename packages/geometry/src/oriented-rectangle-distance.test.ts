import { describe, expect, it } from "vitest";
import { minimumDistanceBetweenOrientedRectangles } from "./oriented-rectangle-distance";
import type { OrientedRectangle } from "./oriented-rectangle";

const rect = (
  x: number,
  y: number,
  width: number,
  depth: number,
  rotationDeg = 0,
): OrientedRectangle => ({
  center: { x, y },
  width,
  depth,
  rotationDeg,
});

describe("minimumDistanceBetweenOrientedRectangles", () => {
  it("returns an exact 1000 mm axis-aligned edge gap", () => {
    expect(
      minimumDistanceBetweenOrientedRectangles(
        rect(0, 0, 1000, 1000),
        rect(2000, 0, 1000, 1000),
      ),
    ).toBe(1000);
  });

  it("returns zero for touching rectangles", () => {
    expect(
      minimumDistanceBetweenOrientedRectangles(
        rect(0, 0, 1000, 1000),
        rect(1000, 0, 1000, 1000),
      ),
    ).toBe(0);
  });

  it("returns zero for overlapping rectangles", () => {
    expect(
      minimumDistanceBetweenOrientedRectangles(
        rect(0, 0, 1000, 1000),
        rect(500, 0, 1000, 1000),
      ),
    ).toBe(0);
  });

  it("measures rotated rectangles instead of axis-aligned bounds", () => {
    const offset = 1500 / Math.sqrt(2);
    const first = rect(0, 0, 1000, 600, 45);
    const second = rect(offset, offset, 1000, 600, 45);

    expect(minimumDistanceBetweenOrientedRectangles(first, second)).toBeCloseTo(500, 6);
  });

  it("is symmetric", () => {
    const first = rect(100, -200, 900, 500, 27);
    const second = rect(2200, 1300, 700, 1100, -18);

    expect(minimumDistanceBetweenOrientedRectangles(first, second)).toBeCloseTo(
      minimumDistanceBetweenOrientedRectangles(second, first),
      9,
    );
  });
});
