import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import { recoverStrongMaskRotatedDoorHosts } from "./strong-mask-rotated-door-host-recovery";
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
  return Math.hypot(point.x - (start.x + dx * ratio), point.y - (start.y + dy * ratio));
}

function wall(id: string, start: Point, end: Point, thicknessPx = 35): RecognitionWallCandidate {
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

const seed = wall("room-divider-seed", { x: 821, y: 732 }, { x: 874, y: 788 }, 35);
const structuralSegments: readonly DetectedLineSegment[] = [
  { x1: 566, y1: 497, x2: 685, y2: 616 },
  { x1: 770, y1: 700, x2: 826, y2: 757 },
  { x1: 831, y1: 720, x2: 985, y2: 566 },
];
const doorLeaf: DetectedLineSegment = { x1: 636, y1: 667, x2: 706, y2: 594 };
const expectedStart = { x: 586, y: 497 };
const expectedEnd = { x: 874, y: 786 };

function doorGapMask(fillGap = false): StructuralMaskView {
  const dx = expectedEnd.x - expectedStart.x;
  const dy = expectedEnd.y - expectedStart.y;
  const lengthSquared = dx * dx + dy * dy;
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural: (x, y) => {
      const ratio = Math.max(0, Math.min(1, ((x - expectedStart.x) * dx + (y - expectedStart.y) * dy) / lengthSquared));
      if (!fillGap && ratio > 0.37 && ratio < 0.64) return false;
      return pointSegmentDistance({ x, y }, expectedStart, expectedEnd) <= 20;
    },
  };
}

function run(input: Readonly<{
  primaryWalls?: readonly RecognitionWallCandidate[];
  structural?: readonly DetectedLineSegment[];
  symbols?: readonly DetectedLineSegment[];
  mask?: StructuralMaskView;
}> = {}) {
  return recoverStrongMaskRotatedDoorHosts({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    primaryWalls: input.primaryWalls ?? [seed],
    structuralSegments: input.structural ?? structuralSegments,
    symbolSegments: input.symbols ?? [doorLeaf],
    mask: input.mask ?? doorGapMask(),
  });
}

describe("strong-mask rotated door host recovery", () => {
  it("recovers a rotated partition host from an existing centerline seed, two same-side rails, one mask gap and a perpendicular door leaf", () => {
    const result = run();

    expect(result.recoveredCount).toBe(1);
    const recovered = result.recoveredWalls[0]!;
    const start = { x: recovered.start.x * WIDTH, y: recovered.start.y * HEIGHT };
    const end = { x: recovered.end.x * WIDTH, y: recovered.end.y * HEIGHT };
    expect(pointSegmentDistance(expectedStart, start, end)).toBeLessThan(12);
    expect(pointSegmentDistance(expectedEnd, start, end)).toBeLessThan(12);
    expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeGreaterThan(380);
    expect(recovered.evidence.reasons).toContain("strong-mask-rotated-door-host");
    expect(recovered.evidence.reasons).toContain("perpendicular-door-leaf-evidence");
  });

  it("rejects the same rail geometry when no perpendicular door leaf is present", () => {
    expect(run({ symbols: [] }).recoveredCount).toBe(0);
  });

  it("rejects the host when the supposed door gap is structurally filled", () => {
    expect(run({ mask: doorGapMask(true) }).recoveredCount).toBe(0);
  });

  it("rejects rails that do not share the seeded wall axis", () => {
    const shifted = structuralSegments.map((segment, index) => index === 0
      ? { ...segment, y1: segment.y1 + 70, y2: segment.y2 + 70 }
      : segment);
    expect(run({ structural: shifted }).recoveredCount).toBe(0);
  });

  it("rejects the evidence when the accepted seed is not on the recovered partition", () => {
    const farSeed = wall("far-seed", { x: 1200, y: 100 }, { x: 1300, y: 200 }, 35);
    expect(run({ primaryWalls: [farSeed] }).recoveredCount).toBe(0);
  });

  it("does not use the rotated door-host path for axis-aligned partitions", () => {
    const horizontalSeed = wall("horizontal-seed", { x: 780, y: 500 }, { x: 900, y: 500 }, 35);
    const horizontalStructural: readonly DetectedLineSegment[] = [
      { x1: 300, y1: 518, x2: 520, y2: 518 },
      { x1: 650, y1: 518, x2: 820, y2: 518 },
    ];
    const verticalLeaf: DetectedLineSegment = { x1: 560, y1: 500, x2: 560, y2: 590 };
    const horizontalMask: StructuralMaskView = {
      widthPx: WIDTH,
      heightPx: HEIGHT,
      isStructural: (x, y) => Math.abs(y - 500) <= 20 && !(x > 530 && x < 640),
    };
    expect(run({
      primaryWalls: [horizontalSeed],
      structural: horizontalStructural,
      symbols: [verticalLeaf],
      mask: horizontalMask,
    }).recoveredCount).toBe(0);
  });
});
