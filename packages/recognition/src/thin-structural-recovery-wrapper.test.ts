import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import {
  recoverThinStructuralWalls as recoverBase,
} from "./thin-structural-recovery";
import { recoverThinStructuralWalls } from "./thin-structural-recovery-wrapper";
import type { StructuralMaskView } from "./wall-completion";

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

const segments = [
  { x1: 100, y1: 184, x2: 247, y2: 184 },
  { x1: 100, y1: 216, x2: 247, y2: 216 },
  { x1: 247, y1: 200, x2: 382, y2: 200 },
  { x1: 383, y1: 184, x2: 398, y2: 184 },
  { x1: 399, y1: 184, x2: 447, y2: 184 },
  { x1: 382, y1: 216, x2: 450, y2: 216 },
  { x1: 540, y1: 184, x2: 900, y2: 184 },
  { x1: 540, y1: 216, x2: 900, y2: 216 },
] as const;

function input(sourceSegments = segments) {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    primaryWalls: [wall("left", 100, 247), wall("right", 540, 900)],
    segments: sourceSegments,
    inkMask: mask(),
  };
}

describe("additive bounded short-run post recovery", () => {
  it("recovers a thick separator when one boundary edge is fragmented", () => {
    const result = recoverThinStructuralWalls(input());

    expect(result.recoveredWalls).toHaveLength(1);
    const recovered = result.recoveredWalls[0]!;
    expect(Math.round(recovered.start.x * WIDTH)).toBe(382);
    expect(Math.round(recovered.end.x * WIDTH)).toBe(450);
    expect(Math.round(recovered.start.y * HEIGHT)).toBe(200);
    expect(Math.round(recovered.end.y * HEIGHT)).toBe(200);
    expect(recovered.evidence.reasons).toContain("bounded-short-structural-run");
    expect(recovered.evidence.reasons).toContain("raw-thick-run-post-recovery");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "thin-wall-short-run-post-recovered",
    }));
  });

  it("returns the base result unchanged when no bounded thick run exists", () => {
    const withoutSeparator = segments.filter((segment) =>
      !(
        (segment.x1 >= 382 && segment.x2 <= 450)
        && (segment.y1 === 184 || segment.y1 === 216)
      ));

    expect(recoverThinStructuralWalls(input(withoutSeparator)))
      .toEqual(recoverBase(input(withoutSeparator)));
  });
});
