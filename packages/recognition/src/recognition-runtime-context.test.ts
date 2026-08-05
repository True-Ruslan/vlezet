import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import {
  takeStructuralMaskForWalls,
} from "./recognition-runtime-context";
import { applyStructuralClutterVeto } from "./structural-clutter-veto-runtime";
import type { StructuralMaskView } from "./wall-completion";

const WIDTH = 1000;
const HEIGHT = 600;

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
      reasons: ["filled-wall-region-evidence"],
    },
    origin: "local",
    conflict: null,
  };
}

const symbols: DetectedLineSegment[] = [
  { x1: 455, y1: 285, x2: 545, y2: 285 },
  { x1: 455, y1: 315, x2: 545, y2: 315 },
  { x1: 470, y1: 270, x2: 470, y2: 330 },
];

const mask: StructuralMaskView = {
  widthPx: WIDTH,
  heightPx: HEIGHT,
  isStructural(x, y): boolean {
    return x >= 445 && x <= 555
      && ((y >= 282 && y <= 286) || (y >= 314 && y <= 318));
  },
};

describe("recognition runtime structural-mask context", () => {
  it("registers the mask for active structural-clutter output and consumes it once", () => {
    const result = applyStructuralClutterVeto({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [wall("partition", 700, 50, 700, 550)],
      symbolSegments: symbols,
      mask,
    });
    const activeWalls = result.walls.filter((candidate) => candidate.conflict === null);

    expect(takeStructuralMaskForWalls(activeWalls, WIDTH, HEIGHT)).toBe(mask);
    expect(takeStructuralMaskForWalls(activeWalls, WIDTH, HEIGHT)).toBeNull();
  });

  it("does not expose the mask through a blocked wall", () => {
    const result = applyStructuralClutterVeto({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("anchor", 450, 80, 450, 300),
        wall("sanitary", 450, 300, 550, 300, 36),
      ],
      symbolSegments: symbols,
      mask,
    });
    const blockedWalls = result.walls.filter((candidate) => candidate.conflict !== null);
    const activeWalls = result.walls.filter((candidate) => candidate.conflict === null);

    expect(blockedWalls).toHaveLength(1);
    expect(takeStructuralMaskForWalls(blockedWalls, WIDTH, HEIGHT)).toBeNull();
    expect(takeStructuralMaskForWalls(activeWalls, WIDTH, HEIGHT)).toBe(mask);
  });

  it("keeps a registered mask available after a mismatched dimension lookup", () => {
    const result = applyStructuralClutterVeto({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [wall("partition", 700, 50, 700, 550)],
      symbolSegments: symbols,
      mask,
    });
    const activeWalls = result.walls.filter((candidate) => candidate.conflict === null);

    expect(takeStructuralMaskForWalls(activeWalls, WIDTH + 1, HEIGHT)).toBeNull();
    expect(takeStructuralMaskForWalls(activeWalls, WIDTH, HEIGHT)).toBe(mask);
  });
});
