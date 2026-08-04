import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import { analyzeOpeningHypotheses } from "./opening-analysis-runtime-with-window-proposals";
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

describe("opening analysis window host proposals", () => {
  it("passes exact symbol-bridge window evidence through the common validator", () => {
    const consolidation = consolidateWindowHostWalls({
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

    const result = analyzeOpeningHypotheses({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: consolidation.walls,
      wallSegments: [],
      symbolSegments: [],
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      kind: "window",
      hostWallCandidateId: "local-window-host-left--right",
      center: { x: 0.5, y: 0.5 },
      widthPx: 140,
      orientationDeg: 0,
      confidence: "medium",
      conflict: null,
    });
    expect(result.candidates[0]?.evidence.reasons).toContain("window-host-proposal-evidence");
    expect(result.rejections).toEqual([]);
  });

  it("does not create an opening from boundary-only host evidence", () => {
    const consolidation = consolidateWindowHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("boundary-left", 100, 20, 430, 20),
        wall("boundary-right", 570, 20, 900, 20),
      ],
      symbolSegments: [],
    });

    const result = analyzeOpeningHypotheses({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: consolidation.walls,
      wallSegments: [],
      symbolSegments: [],
    });

    expect(result.candidates).toEqual([]);
  });
});
