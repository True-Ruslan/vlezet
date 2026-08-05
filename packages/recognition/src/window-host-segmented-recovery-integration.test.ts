import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";
import { consolidateWindowHostWalls } from "./window-host-consolidation-runtime";

const WIDTH = 1000;
const HEIGHT = 800;
const BOUNDARY_X = 700;
const FRAME_X = 890;

function wall(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): RecognitionWallCandidate {
  return {
    id,
    start: { x: x1 / WIDTH, y: y1 / HEIGHT },
    end: { x: x2 / WIDTH, y: y2 / HEIGHT },
    estimatedThicknessPx: 20,
    confidence: "medium",
    evidence: {
      localScore: 0.74,
      cloudScore: null,
      reasons: ["filled-wall-region-evidence", "topology-edge"],
    },
    origin: "local",
    conflict: null,
  };
}

const upperWalls: RecognitionWallCandidate[] = [
  wall("upper-before", BOUNDARY_X, 50, BOUNDARY_X, 180),
  wall("upper-after", BOUNDARY_X, 330, BOUNDARY_X, 390),
];

const enclosureWalls: RecognitionWallCandidate[] = [
  wall("outer-frame", FRAME_X, 50, FRAME_X, 700),
  wall("top-connector", BOUNDARY_X, 50, FRAME_X, 50),
  wall("bottom-connector", BOUNDARY_X, 700, FRAME_X, 700),
];

const rails: DetectedLineSegment[] = [
  { x1: 696, y1: 180, x2: 696, y2: 330 },
  { x1: 704, y1: 180, x2: 704, y2: 330 },
  { x1: 696, y1: 510, x2: 696, y2: 620 },
  { x1: 704, y1: 510, x2: 704, y2: 620 },
];

const structuralMask: StructuralMaskView = {
  widthPx: WIDTH,
  heightPx: HEIGHT,
  isStructural(x, y): boolean {
    if (Math.abs(x - BOUNDARY_X) <= 10) {
      return (y >= 50 && y <= 390)
        || (y >= 480 && y <= 510)
        || (y >= 620 && y <= 700);
    }
    if (Math.abs(x - FRAME_X) <= 10) return y >= 50 && y <= 700;
    if (y >= 40 && y <= 60) return x >= BOUNDARY_X && x <= FRAME_X;
    return y >= 690 && y <= 710 && x >= BOUNDARY_X && x <= FRAME_X;
  },
};

function run(input: Readonly<{
  includeMask: boolean;
  includeEnclosure: boolean;
  reverse?: boolean;
}>) {
  const wallCandidates = [
    ...upperWalls,
    ...(input.includeEnclosure ? enclosureWalls : []),
  ];
  const symbolSegments = [...rails];
  if (input.reverse) {
    wallCandidates.reverse();
    symbolSegments.reverse();
  }
  return consolidateWindowHostWalls({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates,
    symbolSegments,
    ...(input.includeMask ? { structuralMask } : {}),
  });
}

describe("window host segmented structural recovery", () => {
  it("recovers a proven enclosed continuation and creates the second window proposal", () => {
    const result = run({ includeMask: true, includeEnclosure: true });

    expect(result.segmentedRecoveredWallCount).toBeGreaterThanOrEqual(2);
    expect(result.acceptedBridgeCount).toBe(2);
    const gapIntervals = result.proposalEvidence.map((item) => [
      Math.round(item.gap.start.y),
      Math.round(item.gap.end.y),
    ] as const).sort((first, second) => first[0] - second[0]);
    expect(gapIntervals).toEqual([
      [180, 330],
      [510, 620],
    ]);
    expect(result.walls.some((candidate) =>
      candidate.evidence.reasons.includes("parallel-exterior-enclosure")
      && candidate.evidence.reasons.includes("segmented-structural-boundary"))).toBe(true);
  });

  it("does not run the second recovery pass without a structural mask", () => {
    const result = run({ includeMask: false, includeEnclosure: true });

    expect(result.acceptedBridgeCount).toBe(1);
    expect(result.proposalEvidence).toHaveLength(1);
  });

  it("does not recover an interior continuation without the exterior enclosure", () => {
    const result = run({ includeMask: true, includeEnclosure: false });

    expect(result.acceptedBridgeCount).toBe(1);
    expect(result.proposalEvidence).toHaveLength(1);
  });

  it("is deterministic under wall and rail order", () => {
    const forward = run({ includeMask: true, includeEnclosure: true });
    const reverse = run({ includeMask: true, includeEnclosure: true, reverse: true });

    expect(reverse.segmentedRecoveredWallCount).toBe(forward.segmentedRecoveredWallCount);
    expect(reverse.proposalEvidence).toEqual(forward.proposalEvidence);
  });
});
