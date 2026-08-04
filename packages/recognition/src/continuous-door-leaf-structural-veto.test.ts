import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";
import { detectContinuousHostDoorOpenings } from "./continuous-door-host-analysis-runtime";

const widthPx = 1000;
const heightPx = 600;
const wallX = 400;
const gapStart = 220;
const gapEnd = 310;

const host: RecognitionWallCandidate = {
  id: "continuous-host",
  start: { x: wallX / widthPx, y: 80 / heightPx },
  end: { x: wallX / widthPx, y: 520 / heightPx },
  estimatedThicknessPx: 20,
  confidence: "medium",
  evidence: {
    localScore: 0.74,
    cloudScore: null,
    reasons: ["filled-wall-region-evidence"],
  },
  origin: "local",
  conflict: null,
};

function mask(structuralLeaf: boolean): StructuralMaskView {
  return {
    widthPx,
    heightPx,
    isStructural(x, y): boolean {
      const hostSupport = Math.abs(x - wallX) <= 10
        && y >= 80
        && y <= 520
        && (y < gapStart || y > gapEnd);
      const leafSupport = structuralLeaf
        && x >= wallX - 90
        && x <= wallX - 18
        && Math.abs(y - gapStart) <= 6;
      return hostSupport || leafSupport;
    },
  };
}

function detect(structuralLeaf: boolean) {
  return detectContinuousHostDoorOpenings({
    widthPx,
    heightPx,
    wallCandidates: [host],
    symbolSegments: [{
      x1: wallX,
      y1: gapStart,
      x2: wallX - 90,
      y2: gapStart,
    }],
    mask: mask(structuralLeaf),
  });
}

describe("continuous door leaf structural veto", () => {
  it("keeps a thin symbolic door leaf", () => {
    expect(detect(false).openingHypotheses).toHaveLength(1);
  });

  it("rejects high structural support along the free leaf", () => {
    expect(detect(true).openingHypotheses).toHaveLength(0);
  });
});
