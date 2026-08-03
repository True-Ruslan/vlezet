import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import {
  consolidateThickWallSiblings,
  type StructuralMaskView,
} from "./thick-wall-consolidation";

const WIDTH = 1000;
const HEIGHT = 600;

function wall(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thicknessPx = 20,
): RecognitionWallCandidate {
  return {
    id,
    start: { x: x1 / WIDTH, y: y1 / HEIGHT },
    end: { x: x2 / WIDTH, y: y2 / HEIGHT },
    estimatedThicknessPx: thicknessPx,
    confidence: "medium",
    evidence: { localScore: 0.74, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
    origin: "local",
    conflict: null,
  };
}

function mask(predicate: (x: number, y: number) => boolean): StructuralMaskView {
  return { widthPx: WIDTH, heightPx: HEIGHT, isStructural: predicate };
}

function coordinates(candidate: RecognitionWallCandidate): [number, number, number, number, number] {
  return [
    Math.round(candidate.start.x * WIDTH),
    Math.round(candidate.start.y * HEIGHT),
    Math.round(candidate.end.x * WIDTH),
    Math.round(candidate.end.y * HEIGHT),
    Math.round(candidate.estimatedThicknessPx ?? 0),
  ];
}

describe("thick wall sibling consolidation", () => {
  it("merges two parallel axes inside one filled structural band", () => {
    const result = consolidateThickWallSiblings({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("upper", 100, 190, 900, 190, 20),
        wall("lower", 100, 210, 900, 210, 20),
      ],
      mask: mask((x, y) => x >= 95 && x <= 905 && y >= 178 && y <= 222),
    });

    expect(result.mergedGroupCount).toBe(1);
    expect(result.walls).toHaveLength(1);
    expect(coordinates(result.walls[0]!)).toEqual([100, 200, 900, 200, 40]);
    expect(result.walls[0]?.confidence).toBe("medium");
    expect(result.walls[0]?.evidence.reasons).toContain("thick-wall-sibling-consolidation");
  });

  it("does not merge parallel real walls separated by a white corridor", () => {
    const result = consolidateThickWallSiblings({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("upper", 100, 180, 900, 180, 20),
        wall("lower", 100, 240, 900, 240, 20),
      ],
      mask: mask((x, y) =>
        x >= 95 && x <= 905
        && ((y >= 168 && y <= 192) || (y >= 228 && y <= 252))),
    });

    expect(result.mergedGroupCount).toBe(0);
    expect(result.walls.map(coordinates)).toEqual([
      [100, 240, 900, 240, 20],
      [100, 180, 900, 180, 20],
    ]);
  });

  it("merges three sibling axes deterministically into one outer band", () => {
    const candidates = [
      wall("middle", 120, 200, 880, 200, 16),
      wall("bottom", 100, 220, 900, 220, 20),
      wall("top", 100, 180, 900, 180, 20),
    ];
    const structural = mask((x, y) => x >= 95 && x <= 905 && y >= 168 && y <= 232);

    const forward = consolidateThickWallSiblings({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: candidates,
      mask: structural,
    });
    const reverse = consolidateThickWallSiblings({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [...candidates].reverse(),
      mask: structural,
    });

    expect(reverse).toEqual(forward);
    expect(forward.mergedGroupCount).toBe(1);
    expect(forward.walls).toHaveLength(1);
    expect(coordinates(forward.walls[0]!)).toEqual([100, 200, 900, 200, 60]);
  });

  it("does not merge perpendicular walls", () => {
    const candidates = [
      wall("horizontal", 100, 200, 900, 200, 24),
      wall("vertical", 500, 50, 500, 550, 24),
    ];
    const result = consolidateThickWallSiblings({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: candidates,
      mask: mask(() => true),
    });

    expect(result.mergedGroupCount).toBe(0);
    expect(result.walls).toEqual([...candidates].sort((a, b) => a.id.localeCompare(b.id)));
  });

  it("fails closed when the candidate budget is exceeded", () => {
    const candidates = Array.from({ length: 97 }, (_, index) =>
      wall(`wall-${String(index).padStart(3, "0")}`, 10, 10 + index * 4, 990, 10 + index * 4, 10));
    const result = consolidateThickWallSiblings({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: candidates,
      mask: mask(() => true),
    });

    expect(result.mergedGroupCount).toBe(0);
    expect(result.walls).toEqual([...candidates].sort((a, b) => a.id.localeCompare(b.id)));
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "thick-wall-consolidation-budget-exceeded",
      severity: "warning",
    }));
  });
});
