import { describe, expect, it } from "vitest";
import type { RecognitionConfidence } from "./model";
import {
  completeWallCenterlines,
  DEFAULT_WALL_COMPLETION_OPTIONS,
  type StructuralMaskView,
} from "./wall-completion";
import type { LocalWallCenterline } from "./wall-topology";

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  confidence: RecognitionConfidence,
): LocalWallCenterline {
  return {
    startPx: { x: x1, y: y1 },
    endPx: { x: x2, y: y2 },
    thicknessPx: 10,
    evidenceCount: 3,
    confidence,
    reasons: ["filled-wall-region-evidence"],
  };
}

function supportedBand(rows: ReadonlySet<number>): StructuralMaskView {
  return {
    widthPx: 200,
    heightPx: 120,
    isStructural: (x, y) => x >= 20 && x <= 150 && rows.has(y),
  };
}

describe("conservative completion confidence", () => {
  it("never promotes a raster-completed wall to high confidence", () => {
    const result = completeWallCenterlines({
      centerlines: [
        line(20, 40, 80, 40, "high"),
        line(88, 40, 150, 40, "high"),
      ],
      mask: supportedBand(new Set([35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45])),
      options: DEFAULT_WALL_COMPLETION_OPTIONS,
    });

    expect(result.acceptedCompletionCount).toBe(1);
    expect(result.centerlines).toHaveLength(1);
    expect(result.centerlines[0]?.confidence).toBe("medium");
  });

  it("downgrades near-threshold raster support to low confidence", () => {
    const result = completeWallCenterlines({
      centerlines: [
        line(20, 40, 80, 40, "medium"),
        line(88, 40, 150, 40, "medium"),
      ],
      mask: supportedBand(new Set([36, 37, 38, 39, 40, 41, 42, 43])),
      options: {
        ...DEFAULT_WALL_COMPLETION_OPTIONS,
        minimumOccupancyRatio: 0.7,
      },
    });

    expect(result.acceptedCompletionCount).toBe(1);
    expect(result.centerlines[0]?.confidence).toBe("low");
  });

  it("caps a high-confidence endpoint extension at medium", () => {
    const mask: StructuralMaskView = {
      widthPx: 200,
      heightPx: 140,
      isStructural: (x, y) => (
        (x >= 20 && x <= 86 && Math.abs(y - 60) <= 5)
        || (Math.abs(x - 86) <= 5 && y >= 20 && y <= 110)
      ),
    };
    const result = completeWallCenterlines({
      centerlines: [
        line(20, 60, 80, 60, "high"),
        line(86, 20, 86, 110, "high"),
      ],
      mask,
      options: DEFAULT_WALL_COMPLETION_OPTIONS,
    });

    expect(result.acceptedCompletionCount).toBe(1);
    expect(result.centerlines.find((candidate) => candidate.endPx.x === 86 && candidate.endPx.y === 60)?.confidence)
      .toBe("medium");
  });
});
