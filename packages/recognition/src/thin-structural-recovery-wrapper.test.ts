import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";
import { recoverThinStructuralWalls } from "./thin-structural-recovery-wrapper";

const WIDTH = 1000;
const HEIGHT = 600;

function wall(id: string, x1: number, x2: number): RecognitionWallCandidate {
  return {
    id,
    start: { x: x1 / WIDTH, y: 200 / HEIGHT },
    end: { x: x2 / WIDTH, y: 200 / HEIGHT },
    estimatedThicknessPx: 32,
    confidence: "medium",
    evidence: { localScore: 0.76, cloudScore: null, reasons: ["primary"] },
    origin: "local",
    conflict: null,
  };
}

function mask(): StructuralMaskView {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural(x, y): boolean {
      const thickBand = Math.abs(y - 200) <= 16;
      const thinRail = y >= 199 && y <= 201;
      return (thickBand && ((x >= 100 && x <= 247) || (x >= 382 && x <= 450) || (x >= 540 && x <= 900)))
        || (thinRail && x >= 247 && x <= 382);
    },
  };
}

describe("thin structural recovery symbol-rail preprocessing", () => {
  it("does not let a thin rail chain-merge a short separator into a primary wall", () => {
    const result = recoverThinStructuralWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      primaryWalls: [wall("left", 100, 247), wall("right", 540, 900)],
      segments: [
        { x1: 100, y1: 184, x2: 247, y2: 184 },
        { x1: 100, y1: 216, x2: 247, y2: 216 },
        { x1: 247, y1: 200, x2: 382, y2: 200 },
        { x1: 382, y1: 184, x2: 450, y2: 184 },
        { x1: 382, y1: 216, x2: 450, y2: 216 },
        { x1: 540, y1: 184, x2: 900, y2: 184 },
        { x1: 540, y1: 216, x2: 900, y2: 216 },
      ],
      inkMask: mask(),
    });

    expect(result.recoveredWalls).toHaveLength(1);
    expect(Math.round(result.recoveredWalls[0]!.start.x * WIDTH)).toBe(382);
    expect(Math.round(result.recoveredWalls[0]!.end.x * WIDTH)).toBe(450);
    expect(result.recoveredWalls[0]!.evidence.reasons).toContain("bounded-short-structural-run");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "thin-wall-symbol-bridge-filtered",
    }));
  });
});
