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

describe("door host proposal evidence", () => {
  it("returns the selected leaf, gap and generated host span without changing recognition output", () => {
    const symbol: DetectedLineSegment = { x1: 430, y1: 300, x2: 500, y2: 410 };
    const result = consolidateDoorHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("left", 100, 300, 430, 300),
        wall("right", 570, 300, 900, 300),
      ],
      symbolSegments: [symbol],
    });

    expect(result.acceptedBridgeCount).toBe(1);
    expect(result.openingHypotheses).toHaveLength(1);
    expect(result.proposalEvidence).toHaveLength(1);

    const evidence = result.proposalEvidence[0]!;
    expect(evidence.sourceWallCandidateIds).toEqual(["left", "right"]);
    expect(evidence.selectedLeaf.anchorSide).toBe("start");
    expect(evidence.selectedLeaf.anchor).toEqual({ x: 430, y: 300 });
    expect(evidence.selectedLeaf.free).toEqual({ x: 500, y: 410 });
    expect(evidence.selectedLeaf.lengthPx).toBeCloseTo(Math.hypot(70, 110), 6);
    expect(evidence.gap).toEqual({
      start: { x: 430, y: 300 },
      end: { x: 570, y: 300 },
      widthPx: 140,
    });
    expect(evidence.generatedHost).toEqual({
      candidateId: "local-door-host-left--right",
      start: { x: 100, y: 300 },
      end: { x: 900, y: 300 },
    });
  });
});
