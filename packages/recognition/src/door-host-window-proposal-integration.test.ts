import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import { consolidateDoorHostWalls } from "./door-host-consolidation-runtime";
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

describe("door host window proposal integration", () => {
  it("carries every nested window proposal into the generic opening rebind path", () => {
    const windows = consolidateWindowHostWalls({
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
    const result = consolidateDoorHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: windows.walls,
      symbolSegments: [],
    });

    expect(result.acceptedBridgeCount).toBe(0);
    expect(result.openingHypotheses).toHaveLength(2);
    expect(result.openingHypotheses.map((candidate) => ({
      kind: candidate.kind,
      centerY: candidate.center.y * HEIGHT,
      widthPx: candidate.widthPx,
    }))).toEqual([
      { kind: "window", centerY: 200, widthPx: 80 },
      { kind: "window", centerY: 480, widthPx: 80 },
    ]);
  });

  it("does not turn boundary-only bridge evidence into a window", () => {
    const windows = consolidateWindowHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("left", 100, 20, 430, 20),
        wall("right", 570, 20, 900, 20),
      ],
      symbolSegments: [],
    });
    const result = consolidateDoorHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: windows.walls,
      symbolSegments: [],
    });

    expect(result.openingHypotheses).toEqual([]);
  });
});
