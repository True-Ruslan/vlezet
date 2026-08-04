import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";
import { recoverSegmentedBoundaryWalls } from "./segmented-boundary-recovery-runtime";

const widthPx = 1000;
const heightPx = 800;

function wall(
  id: string,
  axisX: number,
  startY: number,
  endY: number,
): RecognitionWallCandidate {
  return {
    id,
    start: { x: axisX / widthPx, y: startY / heightPx },
    end: { x: axisX / widthPx, y: endY / heightPx },
    estimatedThicknessPx: 20,
    confidence: "medium",
    evidence: { localScore: 0.74, cloudScore: null, reasons: ["topology-edge"] },
    origin: "local",
    conflict: null,
  };
}

function terminal(axisX: number): RecognitionWallCandidate {
  return {
    ...wall("terminal", axisX, 700, 700),
    start: { x: 100 / widthPx, y: 700 / heightPx },
    end: { x: 900 / widthPx, y: 700 / heightPx },
  };
}

function structuralMask(
  axisX: number,
  runs: readonly (readonly [number, number])[],
): StructuralMaskView {
  return {
    widthPx,
    heightPx,
    isStructural(x, y): boolean {
      if (Math.abs(x - axisX) <= 10) {
        return runs.some(([start, end]) => y >= start && y <= end);
      }
      return y >= 690 && y <= 710 && x >= 100 && x <= 900;
    },
  };
}

function recover(
  axisX: number,
  runs: readonly (readonly [number, number])[],
) {
  return recoverSegmentedBoundaryWalls({
    widthPx,
    heightPx,
    wallCandidates: [wall("upstream", axisX, 50, 350), terminal(axisX)],
    mask: structuralMask(axisX, runs),
  });
}

const twoGapRuns = [[50, 390], [480, 510], [620, 710]] as const;

describe("segmented boundary exterior two-gap runtime", () => {
  it("keeps an exterior chain with two architectural gaps", () => {
    const result = recover(880, twoGapRuns);
    expect(result.recoveredWalls.length).toBeGreaterThan(0);
    expect(result.acceptedChainCount).toBeGreaterThan(0);
  });

  it("rejects a normal single-window continuation", () => {
    const result = recover(880, [[50, 390], [500, 710]]);
    expect(result.recoveredWalls).toHaveLength(0);
    expect(result.acceptedChainCount).toBe(0);
  });

  it("rejects an interior wet-zone chain even with two gaps", () => {
    const result = recover(500, twoGapRuns);
    expect(result.recoveredWalls).toHaveLength(0);
    expect(result.acceptedChainCount).toBe(0);
  });
});
