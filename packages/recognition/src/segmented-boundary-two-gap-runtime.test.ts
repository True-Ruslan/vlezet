import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";
import { recoverSegmentedBoundaryWalls } from "./segmented-boundary-recovery-runtime";

const widthPx = 1000;
const heightPx = 800;
const axisX = 700;

function wall(id: string, startY: number, endY: number): RecognitionWallCandidate {
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

const terminal: RecognitionWallCandidate = {
  ...wall("terminal", 700, 700),
  start: { x: 100 / widthPx, y: 700 / heightPx },
  end: { x: 900 / widthPx, y: 700 / heightPx },
};

function structuralMask(runs: readonly (readonly [number, number])[]): StructuralMaskView {
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

function recover(runs: readonly (readonly [number, number])[]) {
  return recoverSegmentedBoundaryWalls({
    widthPx,
    heightPx,
    wallCandidates: [wall("upstream", 50, 350), terminal],
    mask: structuralMask(runs),
  });
}

describe("segmented boundary two-gap runtime", () => {
  it("keeps a chain with two architectural gaps", () => {
    const result = recover([[50, 390], [480, 510], [620, 710]]);
    expect(result.recoveredWalls.length).toBeGreaterThan(0);
    expect(result.acceptedChainCount).toBeGreaterThan(0);
  });

  it("rejects a normal single-window continuation", () => {
    const result = recover([[50, 390], [500, 710]]);
    expect(result.recoveredWalls).toHaveLength(0);
    expect(result.acceptedChainCount).toBe(0);
  });
});
