import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
// RED: implemented after this contract is observed failing.
// @ts-expect-error planned M7.10 door host module does not exist in the RED commit
import { consolidateDoorHostWalls } from "./door-host-consolidation";

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

function coordinates(candidate: RecognitionWallCandidate): [number, number, number, number] {
  return [
    Math.round(candidate.start.x * WIDTH),
    Math.round(candidate.start.y * HEIGHT),
    Math.round(candidate.end.x * WIDTH),
    Math.round(candidate.end.y * HEIGHT),
  ];
}

const left = wall("left", 100, 300, 430, 300);
const right = wall("right", 570, 300, 900, 300);
const doorLeaf: DetectedLineSegment = { x1: 430, y1: 300, x2: 500, y2: 410 };

describe("symbol-confirmed door host consolidation", () => {
  it("bridges an interior wall gap only when a door leaf is anchored to a gap edge", () => {
    const result = consolidateDoorHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [left, right],
      symbolSegments: [doorLeaf],
    });

    expect(result.acceptedBridgeCount).toBe(1);
    expect(result.walls).toHaveLength(1);
    expect(coordinates(result.walls[0]!)).toEqual([100, 300, 900, 300]);
    expect(result.walls[0]?.confidence).toBe("medium");
    expect(result.walls[0]?.evidence.reasons).toContain("door-symbol-host-bridge");
  });

  it("does not bridge an unsupported gap or a leaf that is not anchored to either edge", () => {
    for (const symbolSegments of [
      [],
      [{ x1: 470, y1: 300, x2: 520, y2: 410 }],
      [{ x1: 430, y1: 300, x2: 455, y2: 318 }],
    ] satisfies readonly (readonly DetectedLineSegment[])[]) {
      const result = consolidateDoorHostWalls({
        widthPx: WIDTH,
        heightPx: HEIGHT,
        wallCandidates: [left, right],
        symbolSegments,
      });
      expect(result.acceptedBridgeCount).toBe(0);
      expect(result.walls.map(coordinates)).toEqual([[100, 300, 430, 300], [570, 300, 900, 300]]);
    }
  });

  it("rejects a small rectangular enclosure spanning the gap", () => {
    const result = consolidateDoorHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [left, right],
      symbolSegments: [
        { x1: 430, y1: 300, x2: 430, y2: 370 },
        { x1: 430, y1: 370, x2: 570, y2: 370 },
        { x1: 570, y1: 370, x2: 570, y2: 300 },
      ],
    });

    expect(result.acceptedBridgeCount).toBe(0);
    expect(result.walls).toHaveLength(2);
    expect(result.diagnostics).toContain("door-host-enclosure-rejected");
  });

  it("supports a rotated orthogonal wall frame", () => {
    const first = wall("rotated-first", 100, 100, 350, 350);
    const second = wall("rotated-second", 500, 500, 800, 800);
    const result = consolidateDoorHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [first, second],
      symbolSegments: [{ x1: 350, y1: 350, x2: 350, y2: 500 }],
    });

    expect(result.acceptedBridgeCount).toBe(1);
    expect(result.walls).toHaveLength(1);
    expect(coordinates(result.walls[0]!)).toEqual([100, 100, 800, 800]);
    expect(result.walls[0]?.evidence.reasons).toContain("door-symbol-host-bridge");
  });

  it("bounds the consolidated host by nearest perpendicular junctions and preserves residuals", () => {
    const result = consolidateDoorHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("left-long", 20, 300, 430, 300),
        wall("right-long", 570, 300, 920, 300),
        wall("junction-left", 100, 80, 100, 520),
        wall("junction-right", 650, 80, 650, 520),
      ],
      symbolSegments: [doorLeaf],
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
    const forward = consolidateDoorHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [left, right],
      symbolSegments: [doorLeaf],
    });
    const reverse = consolidateDoorHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [right, left],
      symbolSegments: [{ ...doorLeaf }].reverse(),
    });
    expect(reverse).toEqual(forward);
  });

  it("fails closed when wall or symbol budgets are exceeded", () => {
    const overloadedWalls = Array.from({ length: 65 }, (_, index) =>
      wall(`wall-${index}`, 10 + index * 2, 100, 11 + index * 2, 100));
    const wallBudget = consolidateDoorHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: overloadedWalls,
      symbolSegments: [doorLeaf],
    });
    expect(wallBudget.acceptedBridgeCount).toBe(0);
    expect(wallBudget.walls).toEqual(overloadedWalls);
    expect(wallBudget.diagnostics).toContain("door-host-budget-exceeded");

    const overloadedSymbols = Array.from({ length: 513 }, () => ({ ...doorLeaf }));
    const symbolBudget = consolidateDoorHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [left, right],
      symbolSegments: overloadedSymbols,
    });
    expect(symbolBudget.acceptedBridgeCount).toBe(0);
    expect(symbolBudget.walls).toEqual([left, right]);
    expect(symbolBudget.diagnostics).toContain("door-symbol-budget-exceeded");
  });
});
