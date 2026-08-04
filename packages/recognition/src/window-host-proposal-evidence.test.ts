import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import { consolidateWindowHostWalls } from "./window-host-consolidation-runtime";

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
    evidence: {
      localScore: 0.72,
      cloudScore: null,
      reasons: ["filled-wall-region-evidence"],
    },
    origin: "local",
    conflict: null,
  };
}

const left = wall("left", 100, 300, 430, 300);
const right = wall("right", 570, 300, 900, 300);
const rails: DetectedLineSegment[] = [
  { x1: 430, y1: 296, x2: 570, y2: 296 },
  { x1: 430, y1: 304, x2: 570, y2: 304 },
];

describe("window host proposal evidence", () => {
  it("records the exact accepted symbol gap and generated host", () => {
    const result = consolidateWindowHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [left, right],
      symbolSegments: rails,
    });

    expect(result.acceptedBridgeCount).toBe(1);
    expect(result.proposalEvidence).toHaveLength(1);
    expect(result.proposalEvidence[0]).toEqual({
      sourceWallCandidateIds: ["left", "right"],
      bridgeKind: "symbol",
      openingEligible: true,
      gap: {
        start: { x: 430, y: 300 },
        end: { x: 570, y: 300 },
        center: { x: 500, y: 300 },
        widthPx: 140,
        orientationDeg: 0,
      },
      generatedHost: {
        candidateId: "local-window-host-left--right",
        start: { x: 100, y: 300 },
        end: { x: 900, y: 300 },
      },
    });
    expect(result.walls[0]).toHaveProperty("windowHostProposalEvidence", result.proposalEvidence[0]);
  });

  it("records every accepted proposal when a later bridge consumes a residual wall", () => {
    const result = consolidateWindowHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("upper", 400, 40, 400, 160),
        wall("middle", 400, 240, 400, 440),
        wall("lower", 400, 520, 400, 590),
        wall("junction", 100, 340, 700, 340),
      ],
      symbolSegments: [
        { x1: 396, y1: 160, x2: 396, y2: 240 },
        { x1: 404, y1: 160, x2: 404, y2: 240 },
        { x1: 396, y1: 440, x2: 396, y2: 520 },
        { x1: 404, y1: 440, x2: 404, y2: 520 },
      ],
    });

    expect(result.acceptedBridgeCount).toBe(2);
    expect(result.proposalEvidence).toHaveLength(2);
    expect(result.proposalEvidence.map((item) => ({
      sources: item.sourceWallCandidateIds,
      gapStart: Math.round(item.gap.start.y),
      gapEnd: Math.round(item.gap.end.y),
    }))).toEqual([
      {
        sources: ["middle", "upper"],
        gapStart: 160,
        gapEnd: 240,
      },
      {
        sources: ["local-window-host-middle--upper-residual-after", "lower"],
        gapStart: 440,
        gapEnd: 520,
      },
    ]);
  });

  it("records boundary bridges as ineligible for window creation", () => {
    const result = consolidateWindowHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("boundary-left", 100, 20, 430, 20),
        wall("boundary-right", 570, 20, 900, 20),
      ],
      symbolSegments: [],
    });

    expect(result.proposalEvidence).toHaveLength(1);
    expect(result.proposalEvidence[0]?.bridgeKind).toBe("boundary");
    expect(result.proposalEvidence[0]?.openingEligible).toBe(false);
  });

  it("is deterministic under input order", () => {
    const forward = consolidateWindowHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [left, right],
      symbolSegments: rails,
    });
    const reverse = consolidateWindowHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [right, left],
      symbolSegments: [...rails].reverse(),
    });

    expect(reverse.proposalEvidence).toEqual(forward.proposalEvidence);
  });
});
