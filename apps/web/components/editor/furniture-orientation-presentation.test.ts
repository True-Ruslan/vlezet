import { describe, expect, it } from "vitest";
import {
  classifyCardinalScreenSide,
  describeFurnitureScreenDirection,
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
    expect(describeFurnitureScreenDirection(vector)).toBe("снизу слева на плане");
  });

  it("describes every octant without losing diagonal meaning", () => {
    expect(describeFurnitureScreenDirection({ x: 1, y: 0 })).toBe("справа на плане");
    expect(describeFurnitureScreenDirection({ x: 1, y: 1 })).toBe("снизу справа на плане");
    expect(describeFurnitureScreenDirection({ x: 0, y: 1 })).toBe("снизу на плане");
    expect(describeFurnitureScreenDirection({ x: -1, y: 1 })).toBe("снизу слева на плане");
    expect(describeFurnitureScreenDirection({ x: -1, y: 0 })).toBe("слева на плане");
    expect(describeFurnitureScreenDirection({ x: -1, y: -1 })).toBe("сверху слева на плане");
    expect(describeFurnitureScreenDirection({ x: 0, y: -1 })).toBe("сверху на плане");
    expect(describeFurnitureScreenDirection({ x: 1, y: -1 })).toBe("сверху справа на плане");
  });

  it("rejects non-finite angles", () => {
    expect(() => furnitureLocalSideScreenVector("front", Number.NaN)).toThrow("finite");
  });
});
