import { describe, expect, it } from "vitest";
import { measureBetweenPoints } from "./two-point-measurement";

describe("two point measurement", () => {
  it("returns direct distance and axis deltas in millimeters", () => {
    expect(measureBetweenPoints({ x: 1000, y: 2000 }, { x: 4000, y: 6000 })).toEqual({
      distanceMm: 5000,
      deltaXmm: 3000,
      deltaYmm: 4000,
    });
  });

  it("reports user-facing axis deltas as positive magnitudes", () => {
    expect(measureBetweenPoints({ x: 4000, y: 6000 }, { x: 1000, y: 2000 })).toEqual({
      distanceMm: 5000,
      deltaXmm: 3000,
      deltaYmm: 4000,
    });
  });
});
