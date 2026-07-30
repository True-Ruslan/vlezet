import { describe, expect, it } from "vitest";
import {
  minimumDistanceBetweenOrientedRectangles,
  minimumGapWitnessBetweenOrientedRectangles,
} from "./oriented-rectangle-distance";
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

  it("returns zero when a rotated furniture corner touches the middle of another edge", () => {
    const halfDiagonal = 1000 / Math.sqrt(2);
    expect(
      minimumDistanceBetweenOrientedRectangles(
        rect(0, 0, 2000, 1000),
        rect(0, 500 + halfDiagonal, 1000, 1000, 45),
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

describe("minimumGapWitnessBetweenOrientedRectangles", () => {
  it("returns deterministic closest points for an axis-aligned separated gap", () => {
    expect(minimumGapWitnessBetweenOrientedRectangles(
      rect(0, 0, 1000, 1000),
      rect(2000, 0, 1000, 1000),
    )).toEqual({
      distanceMm: 1000,
      firstPoint: { x: 500, y: -500 },
      secondPoint: { x: 1500, y: -500 },
      relation: "separated",
    });
  });

  it("returns closest points on real rotated contours", () => {
    const offset = 1500 / Math.sqrt(2);
    const witness = minimumGapWitnessBetweenOrientedRectangles(
      rect(0, 0, 1000, 600, 45),
      rect(offset, offset, 1000, 600, 45),
    );
    expect(witness.relation).toBe("separated");
    expect(witness.distanceMm).toBeCloseTo(500, 6);
    expect(witness.firstPoint).not.toBeNull();
    expect(witness.secondPoint).not.toBeNull();
  });

  it("returns one deterministic coincident witness for touching contours", () => {
    expect(minimumGapWitnessBetweenOrientedRectangles(
      rect(0, 0, 1000, 1000),
      rect(1000, 0, 1000, 1000),
    )).toEqual({
      distanceMm: 0,
      firstPoint: { x: 500, y: -500 },
      secondPoint: { x: 500, y: -500 },
      relation: "touching",
    });
  });

  it("does not invent a unique witness for overlap", () => {
    expect(minimumGapWitnessBetweenOrientedRectangles(
      rect(0, 0, 1000, 1000),
      rect(500, 0, 1000, 1000),
    )).toEqual({ distanceMm: 0, firstPoint: null, secondPoint: null, relation: "overlapping" });
  });

  it("swaps witness ownership when rectangle order is reversed", () => {
    const first = rect(100, -200, 900, 500, 27);
    const second = rect(2200, 1300, 700, 1100, -18);
    const forward = minimumGapWitnessBetweenOrientedRectangles(first, second);
    const reverse = minimumGapWitnessBetweenOrientedRectangles(second, first);
    expect(reverse.distanceMm).toBeCloseTo(forward.distanceMm, 9);
    expect(reverse.firstPoint).toEqual(forward.secondPoint);
    expect(reverse.secondPoint).toEqual(forward.firstPoint);
  });

  it("keeps the numeric API delegated to the witness result", () => {
    const first = rect(0, 0, 1000, 600, 45);
    const second = rect(1800, 900, 800, 700, -15);
    expect(minimumDistanceBetweenOrientedRectangles(first, second)).toBe(
      minimumGapWitnessBetweenOrientedRectangles(first, second).distanceMm,
    );
  });
});
