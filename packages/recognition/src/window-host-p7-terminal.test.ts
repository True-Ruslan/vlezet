import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import { consolidateWindowHostWalls } from "./window-host-consolidation-runtime";

const WIDTH = 940;
const HEIGHT = 710;

function wall(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thicknessPx = 21,
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
      reasons: ["filled-wall-region-evidence"],
    },
    origin: "local",
    conflict: null,
  };
}

const rails: DetectedLineSegment[] = [
  { x1: 844, y1: 582, x2: 844, y2: 487 },
  { x1: 846, y1: 582, x2: 846, y2: 487 },
  { x1: 848, y1: 582, x2: 848, y2: 487 },
];

describe("plan-007 terminal window host", () => {
  it("accepts the lower kitchen-window gap when the short terminal run is present", () => {
    const result = consolidateWindowHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("upper-host", 849.5, 319.5, 849.5, 486.5),
        wall("terminal-run", 849.5, 581.5, 849.5, 601.5, 20),
        wall("bottom-junction", 84.5, 589.5, 849.5, 589.5, 31),
      ],
      symbolSegments: rails,
    });

    expect(result.acceptedBridgeCount).toBe(1);
    expect(result.proposalEvidence).toHaveLength(1);
    expect(result.proposalEvidence[0]).toMatchObject({
      bridgeKind: "symbol",
      openingEligible: true,
      gap: {
        center: { x: 849.5, y: 534 },
        widthPx: 95,
        orientationDeg: 90,
      },
    });
  });

  it("fails closed when the terminal structural run is absent", () => {
    const result = consolidateWindowHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("upper-host", 849.5, 319.5, 849.5, 486.5),
        wall("bottom-junction", 84.5, 589.5, 849.5, 589.5, 31),
      ],
      symbolSegments: rails,
    });

    expect(result.acceptedBridgeCount).toBe(0);
    expect(result.proposalEvidence).toEqual([]);
  });
});
