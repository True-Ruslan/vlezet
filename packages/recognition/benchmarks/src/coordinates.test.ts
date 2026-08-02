import { describe, expect, it } from "vitest";
import {
  normalizedPointToReferenceMm,
  stablePointKey,
  stableSegmentKey,
} from "./coordinates";

const calibration = {
  sourceWidthPx: 2000,
  sourceHeightPx: 1000,
  millimetersPerPixel: 2,
  originPx: { x: 100, y: 50 },
} as const;

describe("recognition benchmark coordinates", () => {
  it("converts normalized source coordinates to reference-local millimetres", () => {
    expect(normalizedPointToReferenceMm({ x: 0.5, y: 0.25 }, calibration))
      .toEqual({ x: 1800, y: 400 });
  });

  it.each([
    { x: -0.001, y: 0.5 },
    { x: 1.001, y: 0.5 },
    { x: 0.5, y: Number.NaN },
  ])("rejects a normalized point outside the finite unit square", (point) => {
    expect(() => normalizedPointToReferenceMm(point, calibration)).toThrow();
  });

  it("rejects non-finite or non-positive calibration values", () => {
    expect(() => normalizedPointToReferenceMm(
      { x: 0.5, y: 0.5 },
      { ...calibration, millimetersPerPixel: Number.POSITIVE_INFINITY },
    )).toThrow();
    expect(() => normalizedPointToReferenceMm(
      { x: 0.5, y: 0.5 },
      { ...calibration, sourceWidthPx: 0 },
    )).toThrow();
  });

  it("uses stable 0.1 mm point keys", () => {
    expect(stablePointKey({ x: 10.04, y: -0.04 })).toBe("10.0,0.0");
    expect(stablePointKey({ x: 10.06, y: 0.06 })).toBe("10.1,0.1");
  });

  it("canonicalises reversed segments to the same key", () => {
    expect(stableSegmentKey({ x: 0, y: 0 }, { x: 1000, y: 0 }))
      .toBe(stableSegmentKey({ x: 1000, y: 0 }, { x: 0, y: 0 }));
  });
});
