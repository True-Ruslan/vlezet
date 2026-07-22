import { describe, expect, it } from "vitest";
import { buildWallCandidates, DEFAULT_LOCAL_RECOGNITION_OPTIONS } from "./local-lines";

describe("local wall post-processing", () => {
  it("pairs parallel wall edges into one centerline candidate", () => {
    const candidates = buildWallCandidates({
      widthPx: 1000,
      heightPx: 800,
      segments: [
        { x1: 100, y1: 200, x2: 900, y2: 200 },
        { x1: 100, y1: 220, x2: 900, y2: 220 },
      ],
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.start.y).toBeCloseTo(210 / 800, 5);
    expect(candidates[0]?.end.y).toBeCloseTo(210 / 800, 5);
    expect(candidates[0]?.estimatedThicknessPx).toBeCloseTo(20, 5);
  });

  it("merges collinear fragments and rejects short isolated noise", () => {
    const candidates = buildWallCandidates({
      widthPx: 1000,
      heightPx: 800,
      segments: [
        { x1: 100, y1: 100, x2: 450, y2: 100 },
        { x1: 100, y1: 120, x2: 450, y2: 120 },
        { x1: 440, y1: 100, x2: 900, y2: 100 },
        { x1: 440, y1: 120, x2: 900, y2: 120 },
        { x1: 30, y1: 30, x2: 45, y2: 30 },
      ],
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.start.x).toBeCloseTo(0.1, 3);
    expect(candidates[0]?.end.x).toBeCloseTo(0.9, 3);
  });

  it("keeps recognition thresholds explicit and versionable", () => {
    expect(DEFAULT_LOCAL_RECOGNITION_OPTIONS.minimumSegmentLengthPx).toBeGreaterThan(0);
    expect(DEFAULT_LOCAL_RECOGNITION_OPTIONS.maximumWallThicknessPx).toBeGreaterThan(
      DEFAULT_LOCAL_RECOGNITION_OPTIONS.minimumWallThicknessPx,
    );
  });
});
