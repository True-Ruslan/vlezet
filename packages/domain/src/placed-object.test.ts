import { describe, expect, it } from "vitest";
import { createPlacedObject, normalizeRotationDeg } from "./placed-object";

describe("placed objects", () => {
  it("preserves exact millimetre geometry and clones nested values", () => {
    const object = createPlacedObject({
      id: "bed-1",
      presetId: "double-bed",
      name: "  Двуспальная кровать  ",
      category: "sleep",
      position: { x: 2400, y: 1800 },
      width: 1600,
      depth: 2000,
      height: 450,
      rotationDeg: -90,
      clearance: { front: 700, right: 600, back: 0, left: 600 },
    });

    expect(object).toEqual({
      id: "bed-1",
      presetId: "double-bed",
      name: "Двуспальная кровать",
      category: "sleep",
      position: { x: 2400, y: 1800 },
      width: 1600,
      depth: 2000,
      height: 450,
      rotationDeg: 270,
      clearance: { front: 700, right: 600, back: 0, left: 600 },
    });
  });

  it.each([0, 49, -1, Number.NaN, Number.POSITIVE_INFINITY, 20001])("rejects invalid width %s", (width) => {
    expect(() => createPlacedObject({
      id: "x",
      presetId: null,
      name: "Предмет",
      category: "custom",
      position: { x: 0, y: 0 },
      width,
      depth: 600,
      rotationDeg: 0,
      clearance: { front: 0, right: 0, back: 0, left: 0 },
    })).toThrow(RangeError);
  });

  it("normalizes rotations to the half-open 0..360 interval", () => {
    expect(normalizeRotationDeg(450)).toBe(90);
    expect(normalizeRotationDeg(-90)).toBe(270);
    expect(Object.is(normalizeRotationDeg(-360), -0)).toBe(false);
  });

  it("rejects blank names and negative clearances", () => {
    const base = {
      id: "x",
      presetId: null,
      category: "custom" as const,
      position: { x: 0, y: 0 },
      width: 1000,
      depth: 600,
      rotationDeg: 0,
    };
    expect(() => createPlacedObject({ ...base, name: " ", clearance: { front: 0, right: 0, back: 0, left: 0 } })).toThrow(RangeError);
    expect(() => createPlacedObject({ ...base, name: "X", clearance: { front: -1, right: 0, back: 0, left: 0 } })).toThrow(RangeError);
  });
});
