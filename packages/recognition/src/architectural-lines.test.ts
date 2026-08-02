import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import {
  normaliseArchitecturalLineSegments,
  type ArchitecturalLineOptions,
} from "./architectural-lines";

const TEST_OPTIONS: ArchitecturalLineOptions = Object.freeze({
  minimumSegmentLengthPx: 20,
  axisToleranceDeg: 8,
  duplicateEndpointTolerancePx: 2,
  borderMarginPx: 4,
  borderSpanRatio: 0.9,
});

function run(segments: readonly DetectedLineSegment[]) {
  return normaliseArchitecturalLineSegments({
    widthPx: 1000,
    heightPx: 800,
    segments,
    options: TEST_OPTIONS,
  });
}

describe("architectural line normalisation", () => {
  it("canonicalises reversed duplicates into one stable segment", () => {
    const result = run([
      { x1: 100, y1: 200, x2: 900, y2: 200 },
      { x1: 900.5, y1: 200.4, x2: 99.7, y2: 199.8 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.sourceCount).toBe(2);
    expect(result[0]?.orientation).toBe("horizontal");
    expect(result[0]?.start.x).toBeLessThan(result[0]?.end.x ?? 0);
  });

  it("rejects full-frame borders but keeps nearby architectural walls", () => {
    const result = run([
      { x1: 0, y1: 1, x2: 999, y2: 1 },
      { x1: 40, y1: 30, x2: 960, y2: 30 },
      { x1: 998, y1: 0, x2: 998, y2: 799 },
      { x1: 950, y1: 40, x2: 950, y2: 760 },
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((segment) => segment.orientation)).toEqual(["horizontal", "vertical"]);
    expect(result[0]?.start.y).toBeCloseTo(30);
    expect(result[1]?.start.x).toBeCloseTo(950);
  });

  it("rejects short noise and classifies axis and diagonal evidence", () => {
    const result = run([
      { x1: 10, y1: 10, x2: 20, y2: 10 },
      { x1: 100, y1: 100, x2: 900, y2: 106 },
      { x1: 200, y1: 50, x2: 205, y2: 700 },
      { x1: 100, y1: 700, x2: 600, y2: 400 },
    ]);

    expect(result).toHaveLength(3);
    expect(result.map((segment) => segment.orientation)).toEqual([
      "horizontal",
      "vertical",
      "diagonal",
    ]);
  });

  it("suppresses diagonal symbol noise when a strong orthogonal plan grid exists", () => {
    const result = run([
      { x1: 100, y1: 100, x2: 900, y2: 100 },
      { x1: 100, y1: 200, x2: 900, y2: 200 },
      { x1: 100, y1: 300, x2: 900, y2: 300 },
      { x1: 100, y1: 400, x2: 900, y2: 400 },
      { x1: 100, y1: 100, x2: 100, y2: 700 },
      { x1: 300, y1: 100, x2: 300, y2: 700 },
      { x1: 500, y1: 100, x2: 500, y2: 700 },
      { x1: 700, y1: 100, x2: 700, y2: 700 },
      { x1: 200, y1: 600, x2: 400, y2: 450 },
      { x1: 500, y1: 600, x2: 650, y2: 450 },
    ]);

    expect(result).toHaveLength(8);
    expect(result.every((segment) => segment.orientation !== "diagonal")).toBe(true);
  });

  it("retains diagonals when the source lacks a complete orthogonal grid", () => {
    const result = run([
      { x1: 100, y1: 700, x2: 600, y2: 400 },
      { x1: 200, y1: 650, x2: 700, y2: 350 },
      { x1: 100, y1: 100, x2: 900, y2: 100 },
      { x1: 200, y1: 50, x2: 200, y2: 700 },
    ]);

    expect(result.filter((segment) => segment.orientation === "diagonal")).toHaveLength(2);
  });

  it("is stable under permutation and direction reversal", () => {
    const forward: DetectedLineSegment[] = [
      { x1: 100, y1: 200, x2: 900, y2: 200 },
      { x1: 200, y1: 100, x2: 200, y2: 700 },
      { x1: 150, y1: 650, x2: 650, y2: 350 },
    ];
    const reversedPermutation: DetectedLineSegment[] = [
      { x1: 650, y1: 350, x2: 150, y2: 650 },
      { x1: 200, y1: 700, x2: 200, y2: 100 },
      { x1: 900, y1: 200, x2: 100, y2: 200 },
    ];

    expect(run(forward)).toEqual(run(reversedPermutation));
  });

  it("fails closed for invalid dimensions and options", () => {
    expect(() => normaliseArchitecturalLineSegments({
      widthPx: 0,
      heightPx: 800,
      segments: [],
      options: TEST_OPTIONS,
    })).toThrow(/Ширина изображения/);

    expect(() => normaliseArchitecturalLineSegments({
      widthPx: 1000,
      heightPx: 800,
      segments: [],
      options: { ...TEST_OPTIONS, borderSpanRatio: 1.5 },
    })).toThrow(/Доля рамки/);
  });
});
