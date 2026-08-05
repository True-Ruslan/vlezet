import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";
import { recoverSegmentedBoundaryWalls } from "./segmented-boundary-recovery-runtime";

const WIDTH = 1000;
const HEIGHT = 800;
const AXIS_X = 900;
const HOST_HALF_THICKNESS = 10;

function verticalHost(): RecognitionWallCandidate {
  return {
    id: "upstream-host",
    start: { x: AXIS_X / WIDTH, y: 50 / HEIGHT },
    end: { x: AXIS_X / WIDTH, y: 350 / HEIGHT },
    estimatedThicknessPx: HOST_HALF_THICKNESS * 2,
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

function terminalAnchor(): RecognitionWallCandidate {
  return {
    id: "terminal-anchor",
    start: { x: 100 / WIDTH, y: 700 / HEIGHT },
    end: { x: 950 / WIDTH, y: 700 / HEIGHT },
    estimatedThicknessPx: 40,
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

function run(shortTerminal: boolean) {
  return recoverSegmentedBoundaryWalls({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [verticalHost(), terminalAnchor()],
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

  it("does not override a longer run whose body is independently measurable", () => {
    const result = run(false);
    const terminal = result.recoveredWalls.find((candidate) => interval(candidate)[0] <= 625);

    expect(terminal).toBeDefined();
    expect(terminal?.evidence.reasons).not.toContain("perpendicular-anchor-thickness-inherited");
  });
});
