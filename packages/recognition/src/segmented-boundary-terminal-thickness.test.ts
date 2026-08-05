import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";
import { recoverSegmentedBoundaryWalls } from "./segmented-boundary-recovery-runtime";

const WIDTH = 1000;
const HEIGHT = 800;
const AXIS_X = 900;
const HOST_HALF_THICKNESS = 10;

function verticalWall(
  id: string,
  startY: number,
  endY: number,
  thicknessPx = HOST_HALF_THICKNESS * 2,
): RecognitionWallCandidate {
  return {
    id,
    start: { x: AXIS_X / WIDTH, y: startY / HEIGHT },
    end: { x: AXIS_X / WIDTH, y: endY / HEIGHT },
    estimatedThicknessPx: thicknessPx,
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

function horizontalAnchor(y: number, thicknessPx = 40): RecognitionWallCandidate {
  return {
    id: `terminal-anchor-${y}`,
    start: { x: 100 / WIDTH, y: y / HEIGHT },
    end: { x: 950 / WIDTH, y: y / HEIGHT },
    estimatedThicknessPx: thicknessPx,
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

function contaminatedMask(shortTerminal: boolean): StructuralMaskView {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural(x, y): boolean {
      const onVerticalAxis = Math.abs(x - AXIS_X) <= HOST_HALF_THICKNESS;
      if (onVerticalAxis && y >= 50 && y <= 350) return true;
      if (onVerticalAxis && y >= 400 && y <= 510) return true;
      if (onVerticalAxis && y >= (shortTerminal ? 682 : 620) && y <= 720) return true;
      return y >= 680 && y <= 720 && x >= 100 && x <= 950;
    },
  };
}

function fragmentedChainMask(): StructuralMaskView {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural(x, y): boolean {
      const onVerticalAxis = Math.abs(x - AXIS_X) <= HOST_HALF_THICKNESS;
      if (onVerticalAxis && y >= 50 && y <= 200) return true;
      if (onVerticalAxis && y >= 400 && y <= 422) return true;
      if (onVerticalAxis && y >= 612 && y <= 648) return true;
      return y >= 610 && y <= 650 && x >= 100 && x <= 950;
    },
  };
}

function run(shortTerminal: boolean) {
  return recoverSegmentedBoundaryWalls({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [
      verticalWall("upstream-host", 50, 350),
      horizontalAnchor(700),
    ],
    mask: contaminatedMask(shortTerminal),
  });
}

function interval(candidate: RecognitionWallCandidate): readonly [number, number] {
  return [
    Math.round(Math.min(candidate.start.y, candidate.end.y) * HEIGHT),
    Math.round(Math.max(candidate.start.y, candidate.end.y) * HEIGHT),
  ];
}

describe("segmented terminal thickness at a perpendicular anchor", () => {
  it("inherits upstream thickness when the entire short terminal lies in the anchor band", () => {
    const result = run(true);
    const terminal = result.recoveredWalls.find((candidate) => interval(candidate)[0] >= 680);

    expect(terminal).toBeDefined();
    expect(Math.abs((terminal?.estimatedThicknessPx ?? 0) - 20)).toBeLessThanOrEqual(1);
    expect(terminal?.evidence.reasons).toContain("perpendicular-anchor-thickness-inherited");
  });

  it("inherits through a connected chain whose immediate relay is shorter than the upstream minimum", () => {
    const result = recoverSegmentedBoundaryWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        verticalWall("fragmented-upstream-host", 50, 200),
        horizontalAnchor(630),
      ],
      mask: fragmentedChainMask(),
    });
    const terminal = result.recoveredWalls.find((candidate) => interval(candidate)[0] >= 610);

    expect(terminal).toBeDefined();
    expect(Math.abs((terminal?.estimatedThicknessPx ?? 0) - 20)).toBeLessThanOrEqual(1);
    expect(terminal?.evidence.reasons).toContain("perpendicular-anchor-thickness-inherited");
  });

  it("does not override a longer run whose body is independently measurable", () => {
    const result = run(false);
    const terminal = result.recoveredWalls.find((candidate) => interval(candidate)[0] <= 625);

    expect(terminal).toBeDefined();
    expect(terminal?.evidence.reasons).not.toContain("perpendicular-anchor-thickness-inherited");
  });
});
