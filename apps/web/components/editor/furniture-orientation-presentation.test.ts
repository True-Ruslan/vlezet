import { describe, expect, it } from "vitest";
import {
  classifyCardinalScreenSide,
  furnitureLocalSideScreenVector,
  type FurnitureLocalSide,
  type ScreenSide,
} from "./furniture-orientation-presentation";

const EXPECTED: Readonly<Record<number, Readonly<Record<FurnitureLocalSide, ScreenSide>>>> = {
  0: { front: "bottom", right: "right", back: "top", left: "left" },
  90: { front: "left", right: "bottom", back: "right", left: "top" },
  180: { front: "top", right: "left", back: "bottom", left: "right" },
  270: { front: "right", right: "top", back: "left", left: "bottom" },
};

describe("furniture orientation presentation", () => {
  it("maps every local side at cardinal rotations", () => {
    for (const [rotationText, sides] of Object.entries(EXPECTED)) {
      const rotation = Number(rotationText);
      for (const side of ["front", "right", "back", "left"] as const) {
        expect(classifyCardinalScreenSide(furnitureLocalSideScreenVector(side, rotation))).toBe(sides[side]);
      }
    }
  });

  it("keeps exact arbitrary-angle direction instead of snapping to a cardinal", () => {
    const vector = furnitureLocalSideScreenVector("front", 45);
    expect(vector.x).toBeCloseTo(-Math.SQRT1_2, 6);
    expect(vector.y).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it("rejects non-finite angles", () => {
    expect(() => furnitureLocalSideScreenVector("front", Number.NaN)).toThrow("finite");
  });
});
