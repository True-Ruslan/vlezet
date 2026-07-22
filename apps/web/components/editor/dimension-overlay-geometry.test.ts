import { describe, expect, it } from "vitest";
import type { LinearDimensionAnnotation } from "./dimension-annotations";
import { projectDimensionAnnotation } from "./dimension-overlay-geometry";

const roomWidth: LinearDimensionAnnotation = {
  kind: "clear-room",
  axis: "horizontal",
  start: { x: 0, y: 0 },
  end: { x: 3550, y: 0 },
  valueMm: 3550,
  outward: { x: 0, y: -1 },
};

describe("dimension overlay screen geometry", () => {
  it("keeps the annotation offset constant in screen pixels across zoom levels", () => {
    const first = projectDimensionAnnotation(roomWidth, {
      offsetX: 0,
      offsetY: 0,
      pixelsPerMillimeter: 0.1,
    });
    const second = projectDimensionAnnotation(roomWidth, {
      offsetX: 0,
      offsetY: 0,
      pixelsPerMillimeter: 0.2,
    });

    expect(first.measuredStart).toEqual({ x: 0, y: 0 });
    expect(first.measuredEnd).toEqual({ x: 355, y: 0 });
    expect(first.dimensionStart).toEqual({ x: 0, y: -24 });
    expect(first.dimensionEnd).toEqual({ x: 355, y: -24 });
    expect(first.labelPoint).toEqual({ x: 177.5, y: -24 });

    expect(second.measuredEnd).toEqual({ x: 710, y: 0 });
    expect(second.dimensionStart.y).toBe(-24);
    expect(second.dimensionEnd.y).toBe(-24);
  });
});
