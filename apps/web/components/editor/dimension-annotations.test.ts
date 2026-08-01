import { describe, expect, it } from "vitest";
import type { DerivedRoom } from "@vlezet/geometry";
import {
  deriveRectangularRoomDimensionAnnotations,
  deriveWallCentrelineDimensionAnnotation,
  formatDimensionValue,
  formatRoomCanvasLabel,
} from "./dimension-annotations";

const NBSP = "\u00a0";

function room(overrides: Partial<DerivedRoom> = {}): DerivedRoom {
  return {
    id: "room-1",
    faceId: "face-1",
    polygon: [
      { x: 0, y: 0 },
      { x: 3550, y: 0 },
      { x: 3550, y: 3300 },
      { x: 0, y: 3300 },
    ],
    areaMm2: 11_715_000,
    areaM2: 11.715,
    labelPoint: { x: 1775, y: 1650 },
    name: "Комната 3",
    ...overrides,
  };
}

describe("canvas dimension annotations", () => {
  it("derives honest clear dimensions from a rectangular room inner polygon", () => {
    const annotations = deriveRectangularRoomDimensionAnnotations(room());

    expect(annotations).toHaveLength(2);
    expect(annotations.map((item) => item.valueMm)).toEqual([3550, 3300]);
    expect(annotations.map((item) => item.kind)).toEqual(["clear-room", "clear-room"]);
    expect(annotations.map((item) => item.emphasized)).toEqual([false, false]);
    expect(formatRoomCanvasLabel(room())).toBe(`Комната 3\n11,72${NBSP}м²\n3550 × 3300${NBSP}мм внутри`);
    expect(formatDimensionValue(annotations[0]!)).toBe(`3550${NBSP}мм внутри`);
    expect(formatDimensionValue(annotations[1]!)).toBe(`3300${NBSP}мм внутри`);
  });

  it("emphasizes an existing span without changing its measurement", () => {
    const horizontal = deriveRectangularRoomDimensionAnnotations(room(), "horizontal");
    const vertical = deriveRectangularRoomDimensionAnnotations(room(), "vertical");

    expect(horizontal.map((item) => item.valueMm)).toEqual([3550, 3300]);
    expect(horizontal.map((item) => item.emphasized)).toEqual([true, false]);
    expect(vertical.map((item) => item.valueMm)).toEqual([3550, 3300]);
    expect(vertical.map((item) => item.emphasized)).toEqual([false, true]);
  });

  it("does not invent width and height for a non-rectangular room", () => {
    const lShape = room({
      polygon: [
        { x: 0, y: 0 },
        { x: 5000, y: 0 },
        { x: 5000, y: 2000 },
        { x: 2000, y: 2000 },
        { x: 2000, y: 5000 },
        { x: 0, y: 5000 },
      ],
      areaMm2: 16_000_000,
      areaM2: 16,
    });

    expect(deriveRectangularRoomDimensionAnnotations(lShape)).toEqual([]);
    expect(formatRoomCanvasLabel(lShape)).toBe(`Комната 3\n16,00${NBSP}м²`);
  });

  it("labels a selected wall measurement explicitly as a centreline dimension", () => {
    const annotation = deriveWallCentrelineDimensionAnnotation({ x: 0, y: 0 }, { x: 3550, y: 0 });

    expect(annotation).not.toBeNull();
    expect(annotation?.kind).toBe("centreline-wall");
    expect(annotation?.valueMm).toBe(3550);
    expect(annotation?.emphasized).toBe(false);
    expect(formatDimensionValue(annotation!)).toBe(`3550${NBSP}мм по оси`);
  });
});
