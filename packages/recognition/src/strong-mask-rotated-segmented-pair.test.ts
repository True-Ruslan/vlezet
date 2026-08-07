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

const northRails: readonly DetectedLineSegment[] = [
  { x1: 389, y1: 698, x2: 634, y2: 943 },
  { x1: 365, y1: 723, x2: 609, y2: 967 },
];
const southRails: readonly DetectedLineSegment[] = [
  { x1: 736, y1: 1094, x2: 881, y2: 1239 },
  { x1: 762, y1: 1070, x2: 884, y2: 1192 },
];
const expectedStart = { x: 386, y: 719 };
const expectedEnd = { x: 886, y: 1219 };
const anchor = wall("southeast-network", { x: 876, y: 1227 }, { x: 1285, y: 818 });

function segmentedMask(extraGap = false): StructuralMaskView {
  const dx = expectedEnd.x - expectedStart.x;
  const dy = expectedEnd.y - expectedStart.y;
  const lengthSquared = dx * dx + dy * dy;
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural: (x, y) => {
      const ratio = Math.max(0, Math.min(1, ((x - expectedStart.x) * dx + (y - expectedStart.y) * dy) / lengthSquared));
      if (ratio > 0.46 && ratio < 0.74) return false;
      if (extraGap && ratio > 0.18 && ratio < 0.27) return false;
      return pointSegmentDistance({ x, y }, expectedStart, expectedEnd) <= 21;
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
    segments: input.segments ?? [...northRails, ...southRails],
    mask: input.mask ?? segmentedMask(),
  });
}

describe("strong-mask rotated segmented-pair recovery", () => {
  it("recovers one full rotated host across a single opening-sized structural gap", () => {
    const result = run();

    expect(result.recoveredCount).toBe(1);
    const recovered = result.recoveredWalls[0]!;
    const start = { x: recovered.start.x * WIDTH, y: recovered.start.y * HEIGHT };
    const end = { x: recovered.end.x * WIDTH, y: recovered.end.y * HEIGHT };
    expect(pointSegmentDistance(expectedStart, start, end)).toBeLessThan(8);
    expect(pointSegmentDistance(expectedEnd, start, end)).toBeLessThan(8);
    expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeGreaterThan(660);
    expect(recovered.evidence.reasons).toContain("strong-mask-rotated-segmented-pair");
  });

  it("does not recover from only one paired wall fragment", () => {
    expect(run({ segments: northRails }).recoveredCount).toBe(0);
  });

  it("rejects fragments that do not share one collinear wall axis", () => {
    const shiftedSouth = southRails.map((segment) => ({
      ...segment,
      x1: segment.x1 + 70,
      x2: segment.x2 + 70,
    }));
    expect(run({ segments: [...northRails, ...shiftedSouth] }).recoveredCount).toBe(0);
  });

  it("rejects a host whose structural mask contains a second independent gap", () => {
    expect(run({ mask: segmentedMask(true) }).recoveredCount).toBe(0);
  });

  it("rejects a segmented host that cannot attach to the accepted wall network", () => {
    const farAnchor = wall("far-network", { x: 1200, y: 100 }, { x: 1300, y: 200 });
    expect(run({ primaryWalls: [farAnchor] }).recoveredCount).toBe(0);
  });

  it("does not use segmented-pair recovery for axis-aligned rails", () => {
    const segments: readonly DetectedLineSegment[] = [
      { x1: 200, y1: 300, x2: 480, y2: 300 },
      { x1: 200, y1: 335, x2: 480, y2: 335 },
      { x1: 700, y1: 300, x2: 980, y2: 300 },
      { x1: 700, y1: 335, x2: 980, y2: 335 },
    ];
    const horizontalAnchor = wall("horizontal-network", { x: 970, y: 318 }, { x: 1200, y: 318 }, 35);
    const mask: StructuralMaskView = {
      widthPx: WIDTH,
      heightPx: HEIGHT,
      isStructural: (x, y) => Math.abs(y - 318) <= 21 && !(x > 500 && x < 680),
    };
    expect(run({ segments, primaryWalls: [horizontalAnchor], mask }).recoveredCount).toBe(0);
  });
});
