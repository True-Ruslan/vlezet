import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import { consolidateDoorHostWalls } from "./door-host-consolidation";

const WIDTH = 1000;
const HEIGHT = 600;

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
    evidence: { localScore: 0.72, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
    origin: "local",
    conflict: null,
  };
}

const input = {
  widthPx: WIDTH,
  heightPx: HEIGHT,
  wallCandidates: [
    wall("left", 100, 300, 430, 300),
    wall("right", 570, 300, 900, 300),
    wall("junction-left", 400, 80, 400, 520),
    wall("junction-right", 600, 80, 600, 520),
  ],
  symbolSegments: [
    { x1: 430, y1: 300, x2: 500, y2: 410 } satisfies DetectedLineSegment,
  ],
} as const;

describe("door host residual reconsolidation", () => {
  it("does not bridge residual fragments across an already generated collinear host", () => {
    const first = consolidateDoorHostWalls(input);
    const second = consolidateDoorHostWalls(input);

    expect(first).toEqual(second);
    expect(first.acceptedBridgeCount).toBe(1);
    expect(first.openingHypotheses).toHaveLength(1);
    expect(first.proposalEvidence).toHaveLength(1);
    expect(first.diagnostics).not.toContain("door-host-bridge-budget-reached");

    expect(first.walls.map((candidate) => candidate.id)).toEqual(expect.arrayContaining([
      "local-door-host-left--right-residual-before",
      "local-door-host-left--right",
      "local-door-host-left--right-residual-after",
      "junction-left",
      "junction-right",
    ]));
  });
});
