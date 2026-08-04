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
  reasons: readonly string[] = ["filled-wall-region-evidence"],
): RecognitionWallCandidate {
  return {
    id,
    start: { x: x1 / WIDTH, y: y1 / HEIGHT },
    end: { x: x2 / WIDTH, y: y2 / HEIGHT },
    estimatedThicknessPx: 20,
    confidence: "medium",
    evidence: { localScore: 0.72, cloudScore: null, reasons: [...reasons] },
    origin: "local",
    conflict: null,
  };
}

const leaf: DetectedLineSegment = { x1: 430, y1: 300, x2: 500, y2: 410 };

describe("door host residual reconsolidation", () => {
  it("does not bridge residual fragments across a host generated earlier in the same pass", () => {
    const input = {
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("left", 100, 300, 430, 300),
        wall("right", 570, 300, 900, 300),
        wall("junction-left", 400, 80, 400, 520),
        wall("junction-right", 600, 80, 600, 520),
      ],
      symbolSegments: [leaf],
    } as const;

    const first = consolidateDoorHostWalls(input);
    const second = consolidateDoorHostWalls(input);

    expect(first).toEqual(second);
    expect(first.acceptedBridgeCount).toBe(1);
    expect(first.openingHypotheses).toHaveLength(1);
    expect(first.proposalEvidence).toHaveLength(1);
    expect(first.diagnostics).not.toContain("door-host-bridge-budget-reached");
  });

  it("does not let original collinear structural evidence suppress the first bridge", () => {
    const result = consolidateDoorHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("left", 100, 300, 430, 300),
        wall("right", 570, 300, 900, 300),
        wall("existing-structural-wall", 400, 300, 600, 300),
      ],
      symbolSegments: [leaf],
    });

    expect(result.acceptedBridgeCount).toBe(1);
    expect(result.proposalEvidence[0]?.sourceWallCandidateIds).toEqual(["left", "right"]);
    expect(result.walls.some((candidate) => candidate.id === "existing-structural-wall")).toBe(true);
  });
});
