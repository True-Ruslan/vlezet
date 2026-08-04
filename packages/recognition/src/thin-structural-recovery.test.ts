import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";
// RED: implemented after this contract is observed failing.
// @ts-expect-error planned M7.10 module does not exist in the RED commit
import { recoverThinStructuralWalls } from "./thin-structural-recovery";

const WIDTH = 1000;
const HEIGHT = 600;

function wall(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thicknessPx = 30,
): RecognitionWallCandidate {
  return {
    id,
    start: { x: x1 / WIDTH, y: y1 / HEIGHT },
    end: { x: x2 / WIDTH, y: y2 / HEIGHT },
    estimatedThicknessPx: thicknessPx,
    confidence: "medium",
    evidence: { localScore: 0.76, cloudScore: null, reasons: ["primary"] },
    origin: "local",
    conflict: null,
  };
}

function segment(x1: number, y1: number, x2: number, y2: number): DetectedLineSegment {
  return { x1, y1, x2, y2 };
}

function maskFrom(predicate: (x: number, y: number) => boolean): StructuralMaskView {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural: (x, y) => predicate(Math.floor(x), Math.floor(y)),
  };
}

function aroundHorizontal(x: number, y: number, x1: number, x2: number, axis: number, half: number) {
  return x >= x1 && x <= x2 && Math.abs(y - axis) <= half;
}

function aroundVertical(x: number, y: number, y1: number, y2: number, axis: number, half: number) {
  return y >= y1 && y <= y2 && Math.abs(x - axis) <= half;
}

function pixelGeometry(candidate: RecognitionWallCandidate) {
  return {
    start: {
      x: Math.round(candidate.start.x * WIDTH),
      y: Math.round(candidate.start.y * HEIGHT),
    },
    end: {
      x: Math.round(candidate.end.x * WIDTH),
      y: Math.round(candidate.end.y * HEIGHT),
    },
    thickness: Math.round(candidate.estimatedThicknessPx ?? 0),
  };
}

describe("M7.10 thin structural recovery", () => {
  it("accepts a long thin wall from the primary network to the image boundary", () => {
    const primary = wall("primary-top", 100, 100, 700, 100, 30);
    const result = recoverThinStructuralWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      primaryWalls: [primary],
      segments: [segment(700, 100, 700, 594)],
      inkMask: maskFrom((x, y) =>
        aroundHorizontal(x, y, 90, 710, 100, 15)
        || aroundVertical(x, y, 95, 599, 700, 3)),
    });

    expect(result.recoveredWalls).toHaveLength(1);
    expect(pixelGeometry(result.recoveredWalls[0]!)).toMatchObject({
      start: { x: 700, y: 100 },
      end: { x: 700, y: 594 },
    });
    expect(result.recoveredWalls[0]?.confidence).toBe("medium");
    expect(result.recoveredWalls[0]?.evidence.reasons).toContain("thin-ink-structural-component");
  });

  it("accepts a bounded two-fragment partition with one independent primary anchor", () => {
    const primary = wall("primary-top", 100, 100, 500, 100, 30);
    const result = recoverThinStructuralWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      primaryWalls: [primary],
      segments: [
        segment(500, 100, 500, 320),
        segment(500, 320, 820, 320),
      ],
      inkMask: maskFrom((x, y) =>
        aroundHorizontal(x, y, 90, 510, 100, 15)
        || aroundVertical(x, y, 95, 325, 500, 3)
        || aroundHorizontal(x, y, 495, 825, 320, 3)),
    });

    expect(result.recoveredWalls).toHaveLength(2);
    expect(result.acceptedComponentCount).toBe(1);
    expect(result.recoveredWalls.map((candidate) => candidate.evidence.reasons))
      .toEqual(expect.arrayContaining([
        expect.arrayContaining(["bounded-thin-wall-component"]),
        expect.arrayContaining(["bounded-thin-wall-component"]),
      ]));
  });

  it("rejects paired window rails with white space between them", () => {
    const primaries = [
      wall("left-host", 300, 100, 300, 500, 30),
      wall("right-host", 500, 100, 500, 500, 30),
    ];
    const result = recoverThinStructuralWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      primaryWalls: primaries,
      segments: [
        segment(300, 290, 500, 290),
        segment(300, 310, 500, 310),
      ],
      inkMask: maskFrom((x, y) =>
        aroundVertical(x, y, 90, 510, 300, 15)
        || aroundVertical(x, y, 90, 510, 500, 15)
        || aroundHorizontal(x, y, 300, 500, 290, 2)
        || aroundHorizontal(x, y, 300, 500, 310, 2)),
    });

    expect(result.recoveredWalls).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "thin-wall-parallel-symbol-rails-rejected",
    }));
  });

  it("rejects a small sanitary enclosure attached at one corner", () => {
    const primary = wall("primary", 300, 80, 300, 500, 30);
    const segments = [
      segment(300, 250, 420, 250),
      segment(420, 250, 420, 330),
      segment(420, 330, 300, 330),
    ];
    const result = recoverThinStructuralWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      primaryWalls: [primary],
      segments,
      inkMask: maskFrom((x, y) =>
        aroundVertical(x, y, 70, 510, 300, 15)
        || segments.some((line) => {
          if (line.y1 === line.y2) return aroundHorizontal(x, y, line.x1, line.x2, line.y1, 2);
          return aroundVertical(x, y, line.y1, line.y2, line.x1, 2);
        })),
    });

    expect(result.recoveredWalls).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "thin-wall-small-enclosure-rejected",
    }));
  });

  it("rejects an unanchored text underline", () => {
    const result = recoverThinStructuralWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      primaryWalls: [],
      segments: [segment(300, 400, 620, 400)],
      inkMask: maskFrom((x, y) => aroundHorizontal(x, y, 300, 620, 400, 2)),
    });
    expect(result.recoveredWalls).toEqual([]);
  });

  it("collapses two filled-band edge lines into one measured centreline", () => {
    const primaries = [
      wall("left", 100, 100, 100, 320, 30),
      wall("right", 900, 100, 900, 320, 30),
    ];
    const result = recoverThinStructuralWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      primaryWalls: primaries,
      segments: [
        segment(100, 195, 900, 195),
        segment(100, 245, 900, 245),
      ],
      inkMask: maskFrom((x, y) =>
        aroundVertical(x, y, 90, 330, 100, 15)
        || aroundVertical(x, y, 90, 330, 900, 15)
        || (x >= 100 && x <= 900 && y >= 190 && y <= 250)),
    });

    expect(result.recoveredWalls).toHaveLength(1);
    expect(pixelGeometry(result.recoveredWalls[0]!)).toMatchObject({
      start: { x: 100, y: 220 },
      end: { x: 900, y: 220 },
      thickness: 61,
    });
  });

  it("is deterministic under segment ordering", () => {
    const primary = wall("primary-top", 100, 100, 500, 100, 30);
    const segments = [segment(500, 100, 500, 320), segment(500, 320, 820, 320)];
    const inkMask = maskFrom((x, y) =>
      aroundHorizontal(x, y, 90, 510, 100, 15)
      || aroundVertical(x, y, 95, 325, 500, 3)
      || aroundHorizontal(x, y, 495, 825, 320, 3));
    const forward = recoverThinStructuralWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      primaryWalls: [primary],
      segments,
      inkMask,
    });
    const reverse = recoverThinStructuralWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      primaryWalls: [primary],
      segments: [...segments].reverse(),
      inkMask,
    });
    expect(reverse).toEqual(forward);
  });

  it("fails closed when the raw segment budget is exceeded", () => {
    const primary = wall("primary", 100, 100, 900, 100, 30);
    const segments = Array.from({ length: 513 }, (_value, index) =>
      segment(10, 20 + index, 990, 20 + index));
    const result = recoverThinStructuralWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      primaryWalls: [primary],
      segments,
      inkMask: maskFrom(() => true),
    });
    expect(result.walls).toEqual([primary]);
    expect(result.recoveredWalls).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "thin-wall-recovery-budget-exceeded",
      severity: "warning",
    }));
  });
});
