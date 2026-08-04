import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";
import { detectContinuousHostDoorOpenings } from "./continuous-door-host-analysis-runtime";

const WIDTH = 1000;
const HEIGHT = 600;
const WALL_X = 400;
const WALL_START = 80;
const WALL_END = 520;
const GAP_START = 220;
const GAP_END = 310;

function wall(endY = WALL_END): RecognitionWallCandidate {
  return {
    id: "room-divider",
    start: { x: WALL_X / WIDTH, y: WALL_START / HEIGHT },
    end: { x: WALL_X / WIDTH, y: endY / HEIGHT },
    estimatedThicknessPx: 20,
    confidence: "medium",
    evidence: {
      localScore: 0.74,
      cloudScore: null,
      reasons: ["filled-wall-region-evidence"],
    },
    origin: "local",
    conflict: null,
  };
}

function mask(options: Readonly<{
  includeGap?: boolean;
  closeAfterGap?: boolean;
  wallEnd?: number;
}> = {}): StructuralMaskView {
  const includeGap = options.includeGap !== false;
  const closeAfterGap = options.closeAfterGap !== false;
  const wallEnd = options.wallEnd ?? WALL_END;
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural(x, y): boolean {
      if (Math.abs(x - WALL_X) > 10 || y < WALL_START || y > wallEnd) return false;
      if (!includeGap) return true;
      if (y >= GAP_START && y <= GAP_END) return false;
      if (!closeAfterGap && y > GAP_START) return false;
      return true;
    },
  };
}

const doorLeaf: DetectedLineSegment = {
  x1: WALL_X,
  y1: GAP_START,
  x2: WALL_X - (GAP_END - GAP_START),
  y2: GAP_START,
};

function run(input: Readonly<{
  segment?: DetectedLineSegment;
  structuralMask?: StructuralMaskView;
  wallEnd?: number;
}> = {}) {
  return detectContinuousHostDoorOpenings({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [wall(input.wallEnd)],
    symbolSegments: [input.segment ?? doorLeaf],
    mask: input.structuralMask ?? mask({ wallEnd: input.wallEnd }),
  });
}

describe("continuous-host door analysis", () => {
  it("creates one door hypothesis from an anchored leaf and a closed raster gap", () => {
    const result = run();

    expect(result.openingHypotheses).toHaveLength(1);
    const opening = result.openingHypotheses[0]!;
    expect(opening.kind).toBe("door");
    expect(opening.hostWallCandidateId).toBe("room-divider");
    expect(opening.center.x * WIDTH).toBeCloseTo(WALL_X, 4);
    expect(Math.abs(opening.center.y * HEIGHT - (GAP_START + GAP_END) / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs((opening.widthPx ?? 0) - (GAP_END - GAP_START))).toBeLessThanOrEqual(2);
    expect(opening.orientationDeg).toBeCloseTo(90, 4);
    expect(opening.confidence).toBe("medium");
    expect(opening.evidence.reasons).toEqual(expect.arrayContaining([
      "continuous-host-mask-door-gap",
      "door-leaf-anchored",
      "perpendicular-door-leaf",
    ]));
    expect(result.diagnostics).toContain("continuous-host-door-detected");
  });

  it("accepts a closed structural tail shorter than the preferred probe length", () => {
    const wallEnd = GAP_END + 19.8;
    const result = run({ wallEnd });

    expect(result.openingHypotheses).toHaveLength(1);
    expect(result.openingHypotheses[0]!.hostWallCandidateId).toBe("room-divider");
  });

  it("rejects a door-like segment that touches the raster border", () => {
    const wallX = 180;
    const gapEnd = 340;
    const candidate: RecognitionWallCandidate = {
      ...wall(),
      id: "border-adjacent-wall",
      start: { x: wallX / WIDTH, y: WALL_START / HEIGHT },
      end: { x: wallX / WIDTH, y: WALL_END / HEIGHT },
    };
    const structuralMask: StructuralMaskView = {
      widthPx: WIDTH,
      heightPx: HEIGHT,
      isStructural(x, y): boolean {
        if (Math.abs(x - wallX) > 10 || y < WALL_START || y > WALL_END) return false;
        return y < GAP_START || y > gapEnd;
      },
    };
    const result = detectContinuousHostDoorOpenings({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [candidate],
      symbolSegments: [{ x1: 0, y1: GAP_START, x2: wallX, y2: GAP_START }],
      mask: structuralMask,
    });

    expect(result.openingHypotheses).toHaveLength(0);
  });

  it("does not create a door without a raster gap", () => {
    expect(run({ structuralMask: mask({ includeGap: false }) }).openingHypotheses).toHaveLength(0);
  });

  it("does not create a door from a segment that is not anchored to the host axis", () => {
    expect(run({
      segment: { ...doorLeaf, x1: WALL_X + 40, x2: WALL_X - 50 },
    }).openingHypotheses).toHaveLength(0);
  });

  it("does not create a door from a segment parallel to the host", () => {
    expect(run({
      segment: { x1: WALL_X, y1: GAP_START, x2: WALL_X, y2: GAP_END },
    }).openingHypotheses).toHaveLength(0);
  });

  it("does not create a door when the low-support run is open to the wall end", () => {
    expect(run({
      structuralMask: mask({ closeAfterGap: false }),
    }).openingHypotheses).toHaveLength(0);
  });
});
