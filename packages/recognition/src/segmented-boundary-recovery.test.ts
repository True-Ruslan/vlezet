import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";
import { recoverSegmentedBoundaryWalls } from "./segmented-boundary-recovery";

const WIDTH = 1000;
const HEIGHT = 800;
const AXIS_X = 700;
const HALF_THICKNESS = 10;

function verticalWall(
  id: string,
  startY: number,
  endY: number,
  conflict: RecognitionWallCandidate["conflict"] = null,
): RecognitionWallCandidate {
  return {
    id,
    start: { x: AXIS_X / WIDTH, y: startY / HEIGHT },
    end: { x: AXIS_X / WIDTH, y: endY / HEIGHT },
    estimatedThicknessPx: HALF_THICKNESS * 2,
    confidence: conflict === null ? "medium" : "low",
    evidence: {
      localScore: conflict === null ? 0.74 : 0.45,
      cloudScore: null,
      reasons: ["filled-wall-region-evidence", "topology-edge"],
    },
    origin: "local",
    conflict,
  };
}

function horizontalWall(id: string, y: number): RecognitionWallCandidate {
  return {
    id,
    start: { x: 100 / WIDTH, y: y / HEIGHT },
    end: { x: 900 / WIDTH, y: y / HEIGHT },
    estimatedThicknessPx: HALF_THICKNESS * 2,
    confidence: "medium",
    evidence: {
      localScore: 0.74,
      cloudScore: null,
      reasons: ["filled-wall-region-evidence", "topology-edge"],
    },
    origin: "local",
    conflict: null,
  };
}

function mask(input: Readonly<{
  includeTerminal?: boolean;
  useThinRails?: boolean;
  secondGapStart?: number;
}> = {}): StructuralMaskView {
  const secondGapStart = input.secondGapStart ?? 510;
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural(x, y): boolean {
      if (input.useThinRails) {
        return (x === AXIS_X - 7 || x === AXIS_X + 7)
          && y >= 350
          && y <= 700;
      }
      if (Math.abs(x - AXIS_X) <= HALF_THICKNESS) {
        if (y >= 50 && y <= 390) return true;
        if (y >= 480 && y <= secondGapStart) return true;
        if (input.includeTerminal !== false && y >= 620 && y <= 710) return true;
      }
      return input.includeTerminal !== false
        && y >= 690
        && y <= 710
        && x >= 100
        && x <= 900;
    },
  };
}

function run(input: Readonly<{
  includeTerminalAnchor?: boolean;
  structuralMask?: StructuralMaskView;
}> = {}) {
  return recoverSegmentedBoundaryWalls({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [
      verticalWall("upstream", 50, 350),
      ...(input.includeTerminalAnchor === false ? [] : [horizontalWall("terminal", 700)]),
    ],
    mask: input.structuralMask ?? mask(),
  });
}

function pixelInterval(candidate: RecognitionWallCandidate): readonly [number, number] {
  return [
    Math.round(Math.min(candidate.start.y, candidate.end.y) * HEIGHT),
    Math.round(Math.max(candidate.start.y, candidate.end.y) * HEIGHT),
  ];
}

describe("segmented structural boundary recovery", () => {
  it("recovers only the mask-backed runs between structural anchors", () => {
    const result = run();

    expect(result.recoveredWalls).toHaveLength(3);
    expect(result.recoveredWalls.map(pixelInterval)).toEqual([
      [350, 390],
      [480, 510],
      [620, 710],
    ]);
    for (const candidate of result.recoveredWalls) {
      expect(candidate.confidence).toBe("medium");
      expect(candidate.conflict).toBeNull();
      expect(candidate.evidence.reasons).toEqual(expect.arrayContaining([
        "segmented-structural-boundary",
        "mask-supported-wall-run",
        "bounded-by-structural-anchors",
      ]));
    }
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "segmented-structural-boundary-recovered",
    );
  });

  it("does not turn nearby parallel symbol rails into walls", () => {
    expect(run({ structuralMask: mask({ useThinRails: true }) }).recoveredWalls).toHaveLength(0);
  });

  it("does not recover an unbounded chain without a downstream anchor", () => {
    expect(run({ includeTerminalAnchor: false }).recoveredWalls).toHaveLength(0);
  });

  it("does not bridge a gap larger than the architectural opening budget", () => {
    const oversized: StructuralMaskView = {
      widthPx: WIDTH,
      heightPx: HEIGHT,
      isStructural(x, y): boolean {
        if (Math.abs(x - AXIS_X) > HALF_THICKNESS) return false;
        return (y >= 50 && y <= 390) || (y >= 650 && y <= 710);
      },
    };
    expect(run({ structuralMask: oversized }).recoveredWalls).toHaveLength(0);
  });

  it("is deterministic when wall input order changes", () => {
    const walls = [verticalWall("upstream", 50, 350), horizontalWall("terminal", 700)];
    const first = recoverSegmentedBoundaryWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: walls,
      mask: mask(),
    });
    const second = recoverSegmentedBoundaryWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [...walls].reverse(),
      mask: mask(),
    });

    expect(second.recoveredWalls).toEqual(first.recoveredWalls);
  });
});
