import { describe, expect, it } from "vitest";
import {
  selectDominantWallThicknessCenterlines,
} from "./wall-evidence-filter";
import type { LocalWallCenterline } from "./wall-topology";

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thicknessPx: number,
  evidenceCount = 2,
): LocalWallCenterline {
  return {
    startPx: { x: x1, y: y1 },
    endPx: { x: x2, y: y2 },
    thicknessPx,
    evidenceCount,
    confidence: "medium",
    reasons: ["paired-parallel-edges"],
  };
}

describe("dominant wall thickness filtering", () => {
  it("prefers long coherent wall evidence over many short furniture pairs", () => {
    const structural = [
      line(0, 0, 900, 0, 15),
      line(0, 700, 900, 700, 16),
      line(0, 0, 0, 700, 15),
      line(900, 0, 900, 700, 16),
    ];
    const furniture = Array.from({ length: 12 }, (_, index) =>
      line(200 + index * 5, 200, 260 + index * 5, 200, 48 + index));

    const result = selectDominantWallThicknessCenterlines({
      centerlines: [...furniture, ...structural],
      binWidthPx: 4,
    });

    expect(result).toHaveLength(4);
    expect(result.every((candidate) => (candidate.thicknessPx ?? 0) < 30)).toBe(true);
    expect(result.every((candidate) => candidate.reasons.includes("dominant-wall-thickness-band"))).toBe(true);
  });

  it("keeps plausible internal and external wall thicknesses in the same band", () => {
    const result = selectDominantWallThicknessCenterlines({
      centerlines: [
        line(0, 0, 1000, 0, 14),
        line(0, 100, 1000, 100, 24),
        line(0, 200, 200, 200, 52),
      ],
      binWidthPx: 4,
    });

    expect(result.map((candidate) => candidate.thicknessPx)).toEqual([14, 24]);
  });

  it("is stable under input permutation", () => {
    const input = [
      line(0, 0, 1000, 0, 15),
      line(0, 100, 1000, 100, 16),
      line(0, 200, 100, 200, 60),
    ];
    expect(selectDominantWallThicknessCenterlines({ centerlines: input, binWidthPx: 4 }))
      .toEqual(selectDominantWallThicknessCenterlines({ centerlines: [...input].reverse(), binWidthPx: 4 }));
  });
});
