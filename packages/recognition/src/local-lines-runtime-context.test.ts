import { describe, expect, it } from "vitest";
import { analyzeWallCandidates } from "./index";
import type { DetectedLineSegment } from "./local-lines";
import { takeStructuralSegmentsForWalls } from "./recognition-runtime-context";

const WIDTH = 1000;
const HEIGHT = 800;

const segments: DetectedLineSegment[] = [
  { x1: 100, y1: 100, x2: 900, y2: 100 },
  { x1: 100, y1: 120, x2: 900, y2: 120 },
  { x1: 100, y1: 680, x2: 900, y2: 680 },
  { x1: 100, y1: 700, x2: 900, y2: 700 },
  { x1: 100, y1: 100, x2: 100, y2: 700 },
  { x1: 120, y1: 100, x2: 120, y2: 700 },
  { x1: 880, y1: 100, x2: 880, y2: 700 },
  { x1: 900, y1: 100, x2: 900, y2: 700 },
];

describe("runtime wall analysis segment registration", () => {
  it("registers the exact structural input for the active candidates returned by the public analyzer", () => {
    const analysis = analyzeWallCandidates({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      segments,
    });
    const activeWalls = analysis.candidates.filter((candidate) => candidate.conflict === null);

    expect(activeWalls.length).toBeGreaterThan(0);
    expect(takeStructuralSegmentsForWalls(activeWalls, WIDTH, HEIGHT)).toEqual(segments);
  });
});
