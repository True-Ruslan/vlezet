import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";
import { recoverThinStructuralWalls } from "./thin-structural-recovery";

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

function filledMask(includeSeparator: boolean): StructuralMaskView {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural(x, y): boolean {
      const inBand = Math.abs(y - 200) <= 16;
      if (!inBand) return false;
      return (x >= 100 && x <= 247)
        || (x >= 540 && x <= 900)
        || (includeSeparator && x >= 382 && x <= 450);
    },
  };
}

describe("short structural separator recovery", () => {
  it("recovers a filled run bounded by two primary walls and two opening-sized gaps", () => {
    const result = recoverThinStructuralWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      primaryWalls: [wall("left", 100, 247), wall("right", 540, 900)],
      segments: [
        { x1: 382, y1: 184, x2: 450, y2: 184 },
        { x1: 382, y1: 216, x2: 450, y2: 216 },
      ],
      inkMask: filledMask(true),
    });

    expect(result.recoveredWalls).toHaveLength(1);
    const recovered = result.recoveredWalls[0]!;
    expect(Math.round(recovered.start.x * WIDTH)).toBe(382);
    expect(Math.round(recovered.end.x * WIDTH)).toBe(450);
    expect(Math.round(recovered.start.y * HEIGHT)).toBe(200);
    expect(Math.round(recovered.end.y * HEIGHT)).toBe(200);
    expect(recovered.confidence).toBe("medium");
    expect(recovered.evidence.reasons).toContain("bounded-short-structural-run");
  });

  it("does not recover the same run without a primary wall on both sides", () => {
    const result = recoverThinStructuralWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      primaryWalls: [wall("left", 100, 247)],
      segments: [
        { x1: 382, y1: 184, x2: 450, y2: 184 },
        { x1: 382, y1: 216, x2: 450, y2: 216 },
      ],
      inkMask: filledMask(true),
    });

    expect(result.recoveredWalls).toEqual([]);
  });

  it("rejects a separator when either neighbouring gap exceeds the opening budget", () => {
    const result = recoverThinStructuralWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      primaryWalls: [wall("left", 100, 120), wall("right", 540, 900)],
      segments: [
        { x1: 382, y1: 184, x2: 450, y2: 184 },
        { x1: 382, y1: 216, x2: 450, y2: 216 },
      ],
      inkMask: filledMask(true),
    });

    expect(result.recoveredWalls).toEqual([]);
  });
});
