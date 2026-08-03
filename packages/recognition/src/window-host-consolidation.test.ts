import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import { consolidateWindowHostWalls } from "./window-host-consolidation";

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
    evidence: { localScore: 0.72, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
    origin: "local",
    conflict: null,
  };
}

const left = wall("left", 100, 300, 430, 300);
const right = wall("right", 570, 300, 900, 300);
const rails: DetectedLineSegment[] = [
  { x1: 430, y1: 296, x2: 570, y2: 296 },
  { x1: 430, y1: 304, x2: 570, y2: 304 },
];

function coordinates(candidate: RecognitionWallCandidate): [number, number, number, number] {
  return [
    Math.round(candidate.start.x * WIDTH),
    Math.round(candidate.start.y * HEIGHT),
    Math.round(candidate.end.x * WIDTH),
    Math.round(candidate.end.y * HEIGHT),
  ];
}

describe("symbol-confirmed window host consolidation", () => {
  it("bridges two collinear wall fragments only when paired rails cover the gap", () => {
    const result = consolidateWindowHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [left, right],
      symbolSegments: rails,
    });

    expect(result.acceptedBridgeCount).toBe(1);
    expect(result.walls).toHaveLength(1);
    expect(coordinates(result.walls[0]!)).toEqual([100, 300, 900, 300]);
    expect(result.walls[0]?.evidence.reasons).toContain("window-symbol-host-bridge");
    expect(result.walls[0]?.confidence).toBe("medium");
  });

  it("does not bridge without two independent rails", () => {
    for (const symbolSegments of [[], rails.slice(0, 1)]) {
      const result = consolidateWindowHostWalls({
        widthPx: WIDTH,
        heightPx: HEIGHT,
        wallCandidates: [left, right],
        symbolSegments,
      });
      expect(result.acceptedBridgeCount).toBe(0);
      expect(result.walls.map(coordinates)).toEqual([[100, 300, 430, 300], [570, 300, 900, 300]]);
    }
  });

  it("rejects parallel dimension lines outside the wall thickness", () => {
    const result = consolidateWindowHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [left, right],
      symbolSegments: [
        { x1: 430, y1: 250, x2: 570, y2: 250 },
        { x1: 430, y1: 258, x2: 570, y2: 258 },
      ],
    });
    expect(result.acceptedBridgeCount).toBe(0);
    expect(result.walls).toHaveLength(2);
  });

  it("bounds the host by nearest perpendicular junctions and preserves residual fragments", () => {
    const result = consolidateWindowHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("left-long", 20, 300, 430, 300),
        wall("right-long", 570, 300, 920, 300),
        wall("junction-left", 100, 80, 100, 520),
        wall("junction-right", 650, 80, 650, 520),
      ],
      symbolSegments: rails,
    });

    expect(result.acceptedBridgeCount).toBe(1);
    expect(result.walls.map(coordinates)).toEqual([
      [20, 300, 100, 300],
      [100, 300, 650, 300],
      [650, 300, 920, 300],
      [100, 80, 100, 520],
      [650, 80, 650, 520],
    ]);
  });

  it("is deterministic under wall and symbol input order", () => {
    const forward = consolidateWindowHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [left, right],
      symbolSegments: rails,
    });
    const reverse = consolidateWindowHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [right, left],
      symbolSegments: [...rails].reverse(),
    });
    expect(reverse).toEqual(forward);
  });

  it("fails closed when the candidate budget is exceeded", () => {
    const overloaded = Array.from({ length: 65 }, (_, index) =>
      wall(`wall-${index}`, 10 + index * 2, 100, 11 + index * 2, 100));
    const result = consolidateWindowHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: overloaded,
      symbolSegments: rails,
    });
    expect(result.acceptedBridgeCount).toBe(0);
    expect(result.walls).toEqual(overloaded);
    expect(result.diagnostics).toContain("window-host-budget-exceeded");
  });
});
