import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import { registerStructuralSegmentsForActiveWalls } from "./recognition-runtime-context";
import { applyStructuralClutterVeto } from "./structural-clutter-veto-runtime";
import type { StructuralMaskView } from "./wall-completion";

const WIDTH = 800;
const HEIGHT = 800;

type Point = Readonly<{ x: number; y: number }>;

function pointSegmentDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= Number.EPSILON) return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + dx * ratio), point.y - (start.y + dy * ratio));
}

function wall(id: string, start: Point, end: Point): RecognitionWallCandidate {
  return {
    id,
    start: { x: start.x / WIDTH, y: start.y / HEIGHT },
    end: { x: end.x / WIDTH, y: end.y / HEIGHT },
    estimatedThicknessPx: 20,
    confidence: "medium",
    evidence: {
      localScore: 0.72,
      cloudScore: null,
      reasons: ["primary-structural-component", "topology-edge"],
    },
    origin: "local",
    conflict: null,
  };
}

const anchor = wall("accepted-anchor", { x: 645, y: 645 }, { x: 760, y: 760 });
const structuralSegments: DetectedLineSegment[] = [
  { x1: 93, y1: 107, x2: 293, y2: 307 },
  { x1: 107, y1: 93, x2: 307, y2: 293 },
  { x1: 413, y1: 427, x2: 643, y2: 657 },
  { x1: 427, y1: 413, x2: 657, y2: 643 },
];

function mask(): StructuralMaskView {
  const start = { x: 100, y: 100 };
  const end = { x: 650, y: 650 };
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural: (x, y) => pointSegmentDistance({ x, y }, start, end) <= 18,
  };
}

describe("structural clutter runtime rotated-wall recovery", () => {
  it("replays registered structural segments and accepts only the strong-mask rotated chain", () => {
    registerStructuralSegmentsForActiveWalls(
      [anchor],
      structuralSegments,
      WIDTH,
      HEIGHT,
    );

    const result = applyStructuralClutterVeto({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [anchor],
      symbolSegments: [],
      mask: mask(),
    });

    expect(result.walls).toEqual(expect.arrayContaining([
      anchor,
      expect.objectContaining({
        id: expect.stringMatching(/^strong-mask-rotated-/),
        conflict: null,
        evidence: expect.objectContaining({
          reasons: expect.arrayContaining(["strong-mask-rotated-wall-chain"]),
        }),
      }),
    ]));
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "strong-mask-rotated-wall-chain",
    }));
  });
});
