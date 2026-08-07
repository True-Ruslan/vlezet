import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import { analyzeOpeningHypotheses } from "./opening-analysis-runtime-with-short-jamb";

const WIDTH = 1000;
const HEIGHT = 800;
const TARGET_Y = 100;

function wall(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thicknessPx = 30,
): RecognitionWallCandidate {
  return {
    id,
    start: { x: x1 / WIDTH, y: y1 / HEIGHT },
    end: { x: x2 / WIDTH, y: y2 / HEIGHT },
    estimatedThicknessPx: thicknessPx,
    confidence: "medium",
    evidence: {
      localScore: 0.72,
      cloudScore: null,
      reasons: ["topology-edge"],
    },
    origin: "local",
    conflict: null,
  };
}

function network() {
  return [
    wall("target", 100, TARGET_Y, 900, TARGET_Y),
    wall("bottom", 100, 700, 900, 700),
    wall("left", 100, TARGET_Y, 100, 700),
    wall("right", 900, TARGET_Y, 900, 700),
  ];
}

function analyzeGap(gapStart: number, gapEnd: number) {
  return analyzeOpeningHypotheses({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: network(),
    wallSegments: [
      { x1: 100, y1: TARGET_Y - 15, x2: gapStart, y2: TARGET_Y - 15 },
      { x1: gapEnd, y1: TARGET_Y - 15, x2: 900, y2: TARGET_Y - 15 },
    ],
    symbolSegments: [],
  });
}

describe("narrow structural-network boundary fallback", () => {
  it("suppresses a fallback window whose gap is less than 2.5 wall thicknesses", () => {
    const result = analyzeGap(400, 460);
    const target = result.candidates.filter(({ hostWallCandidateId }) => hostWallCandidateId === "target");

    expect(target).toEqual([]);
  });

  it("keeps a wall-proportional fallback window on the same structural boundary", () => {
    const result = analyzeGap(400, 520);
    const target = result.candidates.filter(({ hostWallCandidateId }) => hostWallCandidateId === "target");

    expect(target).toHaveLength(1);
    expect(target[0]).toMatchObject({
      kind: "window",
      hostWallCandidateId: "target",
    });
    expect(target[0]?.evidence.reasons).toContain("structural-network-boundary-gap");
  });
});
