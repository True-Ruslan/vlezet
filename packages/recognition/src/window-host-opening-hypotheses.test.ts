import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import { consolidateWindowHostWalls } from "./window-host-consolidation-runtime";
import { createWindowHostOpeningHypotheses } from "./window-host-opening-hypotheses";

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

function symbolBridge() {
  return consolidateWindowHostWalls({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [
      wall("left", 100, 300, 430, 300),
      wall("right", 570, 300, 900, 300),
    ],
    symbolSegments: [
      { x1: 430, y1: 296, x2: 570, y2: 296 },
      { x1: 430, y1: 304, x2: 570, y2: 304 },
    ],
  });
}

describe("window host opening hypotheses", () => {
  it("creates one exact window hypothesis from accepted symbol proposal evidence", () => {
    const result = symbolBridge();
    const hypotheses = createWindowHostOpeningHypotheses({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: result.walls,
    });

    expect(hypotheses).toHaveLength(1);
    expect(hypotheses[0]).toMatchObject({
      kind: "window",
      hostWallCandidateId: "local-window-host-left--right",
      center: { x: 0.5, y: 0.5 },
      widthPx: 140,
      orientationDeg: 0,
      confidence: "medium",
      origin: "local",
      conflict: null,
    });
    expect(hypotheses[0]?.evidence.reasons).toEqual(expect.arrayContaining([
      "host-wall-validated",
      "opening-span-validated",
      "paired-window-rails",
      "window-host-proposal-evidence",
    ]));
  });

  it("creates a detached hypothesis after the generated host was consumed", () => {
    const result = symbolBridge();
    const hypotheses = createWindowHostOpeningHypotheses({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [],
      proposalEvidence: result.proposalEvidence,
    });

    expect(hypotheses).toHaveLength(1);
    expect(hypotheses[0]).toMatchObject({
      kind: "window",
      hostWallCandidateId: "local-window-host-left--right",
      center: { x: 0.5, y: 0.5 },
      widthPx: 140,
    });
  });

  it("does not create an opening from an exterior boundary bridge", () => {
    const result = consolidateWindowHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("boundary-left", 100, 20, 430, 20),
        wall("boundary-right", 570, 20, 900, 20),
      ],
      symbolSegments: [],
    });

    expect(createWindowHostOpeningHypotheses({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: result.walls,
      proposalEvidence: result.proposalEvidence,
    })).toEqual([]);
  });

  it("fails closed when metadata host identity no longer matches the wall", () => {
    const result = symbolBridge();
    const candidate = result.walls[0]!;
    const mismatched = {
      ...candidate,
      id: "replacement-host",
    };

    expect(createWindowHostOpeningHypotheses({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [mismatched],
    })).toEqual([]);
  });

  it("is deterministic and does not duplicate the same proposal", () => {
    const result = symbolBridge();
    const forward = createWindowHostOpeningHypotheses({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: result.walls,
      proposalEvidence: result.proposalEvidence,
    });
    const reverse = createWindowHostOpeningHypotheses({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [...result.walls].reverse(),
      proposalEvidence: [...result.proposalEvidence].reverse(),
    });

    expect(reverse).toEqual(forward);
    expect(forward).toHaveLength(1);
  });
});
