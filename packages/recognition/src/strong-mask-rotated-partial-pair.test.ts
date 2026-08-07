import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import { recoverStrongMaskRotatedWalls } from "./strong-mask-rotated-wall-recovery";
import type { StructuralMaskView } from "./wall-completion";

const WIDTH = 1502;
const HEIGHT = 1488;

type Point = Readonly<{ x: number; y: number }>;

function pointSegmentDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= Number.EPSILON) return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(
    point.x - (start.x + dx * ratio),
    point.y - (start.y + dy * ratio),
  );
}

function wall(id: string, start: Point, end: Point, thicknessPx = 28): RecognitionWallCandidate {
  return {
    id,
    start: { x: start.x / WIDTH, y: start.y / HEIGHT },
    end: { x: end.x / WIDTH, y: end.y / HEIGHT },
    estimatedThicknessPx: thicknessPx,
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

const longRail: DetectedLineSegment = { x1: 268, y1: 109, x2: 855, y2: 696 };
const partialPair: DetectedLineSegment = { x1: 243, y1: 135, x2: 584, y2: 476 };
const expectedStart = { x: 263, y: 130 };
const expectedEnd = { x: 830, y: 697 };
const anchor = wall("accepted-network", { x: 821, y: 732 }, { x: 874, y: 788 }, 28);

function maskForExpectedWall(coverage: (ratio: number) => boolean = () => true): StructuralMaskView {
  const dx = expectedEnd.x - expectedStart.x;
  const dy = expectedEnd.y - expectedStart.y;
  const lengthSquared = dx * dx + dy * dy;
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural: (x, y) => {
      const ratio = Math.max(0, Math.min(1, ((x - expectedStart.x) * dx + (y - expectedStart.y) * dy) / lengthSquared));
      if (!coverage(ratio)) return false;
      return pointSegmentDistance({ x, y }, expectedStart, expectedEnd) <= 20;
    },
  };
}

function run(input: Readonly<{
  segments?: readonly DetectedLineSegment[];
  primaryWalls?: readonly RecognitionWallCandidate[];
  mask?: StructuralMaskView;
}> = {}) {
  return recoverStrongMaskRotatedWalls({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    primaryWalls: input.primaryWalls ?? [anchor],
    segments: input.segments ?? [longRail, partialPair],
    mask: input.mask ?? maskForExpectedWall(),
  });
}

describe("strong-mask rotated partial-pair recovery", () => {
  it("recovers the full rotated wall span when one long rail has a substantial partial mate and continuous mask support", () => {
    const result = run();

    expect(result.recoveredCount).toBe(1);
    const recovered = result.recoveredWalls[0]!;
    const start = { x: recovered.start.x * WIDTH, y: recovered.start.y * HEIGHT };
    const end = { x: recovered.end.x * WIDTH, y: recovered.end.y * HEIGHT };
    const directError = pointSegmentDistance(expectedStart, start, end)
      + pointSegmentDistance(expectedEnd, start, end);
    expect(directError).toBeLessThan(18);
    expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeGreaterThan(740);
    expect(recovered.evidence.reasons).toContain("strong-mask-rotated-partial-pair");
  });

  it("rejects a long rail when the paired support covers too little of its span", () => {
    const result = run({
      segments: [
        longRail,
        { x1: 243, y1: 135, x2: 420, y2: 312 },
      ],
    });

    expect(result.recoveredCount).toBe(0);
  });

  it("rejects the partial pair when full-span structural continuity is broken", () => {
    const result = run({
      mask: maskForExpectedWall((ratio) => ratio < 0.72),
    });

    expect(result.recoveredCount).toBe(0);
  });

  it("rejects the partial pair when it cannot attach to the accepted wall network", () => {
    const farAnchor = wall("far-network", { x: 1200, y: 100 }, { x: 1300, y: 200 }, 28);
    const result = run({ primaryWalls: [farAnchor] });

    expect(result.recoveredCount).toBe(0);
  });

  it("does not use the partial-pair path for axis-aligned rails", () => {
    const horizontalRail = { x1: 200, y1: 300, x2: 1000, y2: 300 };
    const horizontalMate = { x1: 220, y1: 330, x2: 700, y2: 330 };
    const horizontalAnchor = wall("horizontal-network", { x: 990, y: 300 }, { x: 1200, y: 300 }, 30);
    const result = run({
      segments: [horizontalRail, horizontalMate],
      primaryWalls: [horizontalAnchor],
      mask: {
        widthPx: WIDTH,
        heightPx: HEIGHT,
        isStructural: (_x, y) => Math.abs(y - 315) <= 18,
      },
    });

    expect(result.recoveredCount).toBe(0);
  });
});
