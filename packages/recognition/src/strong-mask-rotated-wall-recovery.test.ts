import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";
import { selectStrongMaskRotatedWallRecoveries } from "./strong-mask-rotated-wall-recovery";

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

function wall(input: Readonly<{
  id: string;
  start: Point;
  end: Point;
  thicknessPx?: number | null;
  reasons?: readonly string[];
}>): RecognitionWallCandidate {
  return {
    id: input.id,
    start: { x: input.start.x / WIDTH, y: input.start.y / HEIGHT },
    end: { x: input.end.x / WIDTH, y: input.end.y / HEIGHT },
    estimatedThicknessPx: input.thicknessPx === undefined ? 30 : input.thicknessPx,
    confidence: "medium",
    evidence: {
      localScore: 0.74,
      cloudScore: null,
      reasons: input.reasons
        ? [...input.reasons]
        : [
            "architectural-line-filter",
            "collinear-centerline-merge",
            "dominant-wall-thickness-band",
            "evidence:2",
            "paired-parallel-edges",
            "topology-edge",
          ],
    },
    origin: "local",
    conflict: null,
  };
}

const recovered = wall({
  id: "rotated-chain",
  start: { x: 100, y: 100 },
  end: { x: 500, y: 500 },
});
const anchor = wall({
  id: "accepted-network",
  start: { x: 480, y: 520 },
  end: { x: 700, y: 740 },
  reasons: ["primary-structural-component", "topology-edge"],
});

function maskForLine(
  start: Point,
  end: Point,
  coverage: (ratio: number) => boolean = () => true,
): StructuralMaskView {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural: (x, y) => {
      if (lengthSquared <= Number.EPSILON) return false;
      const ratio = Math.max(0, Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / lengthSquared));
      if (!coverage(ratio)) return false;
      return pointSegmentDistance({ x, y }, start, end) <= 20;
    },
  };
}

function select(input: Readonly<{
  replayWalls?: readonly RecognitionWallCandidate[];
  primaryWalls?: readonly RecognitionWallCandidate[];
  mask?: StructuralMaskView;
}> = {}) {
  return selectStrongMaskRotatedWallRecoveries({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    primaryWalls: input.primaryWalls ?? [anchor],
    replayWalls: input.replayWalls ?? [recovered],
    mask: input.mask ?? maskForLine({ x: 100, y: 100 }, { x: 500, y: 500 }),
  });
}

describe("strong-mask rotated wall recovery policy", () => {
  it("accepts a long merged rotated paired-edge chain with continuous structural support and a network anchor", () => {
    const result = select();

    expect(result.recoveredCount).toBe(1);
    expect(result.walls).toEqual(expect.arrayContaining([
      anchor,
      expect.objectContaining({
        id: "strong-mask-rotated-rotated-chain",
        confidence: "medium",
        conflict: null,
        evidence: expect.objectContaining({
          reasons: expect.arrayContaining(["strong-mask-rotated-wall-chain"]),
        }),
      }),
    ]));
  });

  it("rejects the same geometry when the structural corridor is empty", () => {
    const result = select({
      mask: { widthPx: WIDTH, heightPx: HEIGHT, isStructural: () => false },
    });

    expect(result.recoveredCount).toBe(0);
    expect(result.walls).toEqual([anchor]);
  });

  it("rejects a long candidate when structural continuity covers only part of the chain", () => {
    const result = select({
      mask: maskForLine({ x: 100, y: 100 }, { x: 500, y: 500 }, (ratio) => ratio <= 0.7),
    });

    expect(result.recoveredCount).toBe(0);
  });

  it("rejects an otherwise strong chain that is not anchored to the accepted wall network", () => {
    const farAnchor = wall({
      id: "far",
      start: { x: 650, y: 100 },
      end: { x: 750, y: 200 },
      reasons: ["primary-structural-component", "topology-edge"],
    });

    const result = select({ primaryWalls: [farAnchor] });

    expect(result.recoveredCount).toBe(0);
    expect(result.walls).toEqual([farAnchor]);
  });

  it("does not use the recovery path for axis-aligned candidates", () => {
    const horizontal = wall({
      id: "horizontal",
      start: { x: 100, y: 300 },
      end: { x: 650, y: 300 },
    });
    const horizontalAnchor = wall({
      id: "horizontal-anchor",
      start: { x: 630, y: 300 },
      end: { x: 760, y: 300 },
      reasons: ["primary-structural-component", "topology-edge"],
    });

    const result = select({
      replayWalls: [horizontal],
      primaryWalls: [horizontalAnchor],
      mask: maskForLine({ x: 100, y: 300 }, { x: 650, y: 300 }),
    });

    expect(result.recoveredCount).toBe(0);
  });

  it("requires merged paired-edge evidence rather than accepting a single weak rail", () => {
    const weak = wall({
      id: "weak",
      start: { x: 100, y: 100 },
      end: { x: 500, y: 500 },
      reasons: ["architectural-line-filter", "evidence:1", "topology-edge"],
    });

    const result = select({ replayWalls: [weak] });

    expect(result.recoveredCount).toBe(0);
  });

  it("does not add a relaxed replay candidate that is already represented by an accepted wall", () => {
    const duplicatePrimary = wall({
      id: "existing",
      start: { x: 105, y: 105 },
      end: { x: 495, y: 495 },
      reasons: ["primary-structural-component", "topology-edge"],
    });

    const result = select({ primaryWalls: [duplicatePrimary] });

    expect(result.recoveredCount).toBe(0);
    expect(result.walls).toEqual([duplicatePrimary]);
  });
});
