import { describe, expect, it } from "vitest";
import { analyzeOpeningHypotheses } from "./opening-analysis";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";
import { consolidateDoorHostWalls } from "./door-host-consolidation";

const WIDTH = 1000;
const HEIGHT = 600;

type DoorResultWithHypotheses = ReturnType<typeof consolidateDoorHostWalls> & Readonly<{
  openingHypotheses?: readonly RecognitionOpeningCandidate[];
}>;

function wall(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): RecognitionWallCandidate {
  return {
    id,
    start: { x: x1 / WIDTH, y: y1 / HEIGHT },
    end: { x: x2 / WIDTH, y: y2 / HEIGHT },
    estimatedThicknessPx: 20,
    confidence: "medium",
    evidence: { localScore: 0.72, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
    origin: "local",
    conflict: null,
  };
}

function consolidate(symbolSegments: readonly DetectedLineSegment[]): DoorResultWithHypotheses {
  return consolidateDoorHostWalls({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [
      wall("left", 100, 300, 430, 300),
      wall("right", 570, 300, 900, 300),
    ],
    symbolSegments,
  }) as DoorResultWithHypotheses;
}

describe("door host opening hypotheses", () => {
  it("emits one deterministic door hypothesis for the exact bridged gap", () => {
    const result = consolidate([{ x1: 430, y1: 300, x2: 500, y2: 410 }]);

    expect(result.openingHypotheses).toHaveLength(1);
    expect(result.openingHypotheses?.[0]).toMatchObject({
      id: "local-door-opening-left--right",
      kind: "door",
      hostWallCandidateId: "local-door-host-left--right",
      center: { x: 0.5, y: 0.5 },
      widthPx: 140,
      orientationDeg: 0,
      confidence: "medium",
      origin: "local",
      conflict: null,
    });
    expect(result.openingHypotheses?.[0]?.evidence.reasons).toEqual(expect.arrayContaining([
      "door-leaf-anchored",
      "door-symbol-host-bridge",
      "door-gap-from-bridge",
    ]));
  });

  it("passes bridge hypotheses through the common host/span/overlap validator", () => {
    const result = consolidate([{ x1: 430, y1: 300, x2: 500, y2: 410 }]);
    const input = {
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: result.walls,
      wallSegments: [] as const,
      symbolSegments: [] as const,
      additionalHypotheses: result.openingHypotheses ?? [],
    };

    const analysis = analyzeOpeningHypotheses(input);

    expect(analysis.rejections).toEqual([]);
    expect(analysis.candidates).toHaveLength(1);
    expect(analysis.candidates[0]).toMatchObject({
      kind: "door",
      hostWallCandidateId: "local-door-host-left--right",
      widthPx: 140,
      confidence: "medium",
      conflict: null,
    });
    expect(analysis.candidates[0]?.evidence.reasons).toEqual(expect.arrayContaining([
      "host-wall-validated",
      "opening-span-validated",
    ]));
  });

  it("does not emit an opening for unsupported gaps or enclosure-like symbols", () => {
    expect(consolidate([]).openingHypotheses ?? []).toEqual([]);
    expect(consolidate([
      { x1: 430, y1: 300, x2: 430, y2: 370 },
      { x1: 430, y1: 370, x2: 570, y2: 370 },
      { x1: 570, y1: 370, x2: 570, y2: 300 },
    ]).openingHypotheses ?? []).toEqual([]);
  });

  it("keeps rotated bridge geometry and host identity deterministic", () => {
    const result = consolidateDoorHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("rotated-first", 100, 100, 300, 300),
        wall("rotated-second", 430, 430, 570, 570),
      ],
      symbolSegments: [{ x1: 300, y1: 300, x2: 300, y2: 430 }],
    }) as DoorResultWithHypotheses;

    expect(result.openingHypotheses).toHaveLength(1);
    expect(result.openingHypotheses?.[0]?.hostWallCandidateId)
      .toBe("local-door-host-rotated-first--rotated-second");
    expect(result.openingHypotheses?.[0]?.center.x).toBeCloseTo(0.365, 3);
    expect(result.openingHypotheses?.[0]?.center.y).toBeCloseTo(0.365, 3);
    expect(result.openingHypotheses?.[0]?.orientationDeg).toBeCloseTo(45, 3);
    expect(result.openingHypotheses?.[0]?.widthPx).toBeCloseTo(Math.hypot(130, 130), 3);
  });
});
