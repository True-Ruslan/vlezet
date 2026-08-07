import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import { reconsolidateDoorHostResiduals } from "./door-host-residual-reconsolidation";

const WIDTH = 1502;
const HEIGHT = 1488;

type Point = Readonly<{ x: number; y: number }>;

function wall(input: Readonly<{
  id: string;
  start: Point;
  end: Point;
  thicknessPx?: number;
  reasons?: readonly string[];
}>): RecognitionWallCandidate {
  return {
    id: input.id,
    start: { x: input.start.x / WIDTH, y: input.start.y / HEIGHT },
    end: { x: input.end.x / WIDTH, y: input.end.y / HEIGHT },
    estimatedThicknessPx: input.thicknessPx ?? 25.6,
    confidence: "medium",
    evidence: {
      localScore: 0.72,
      cloudScore: null,
      reasons: [...(input.reasons ?? [
        "architectural-line-filter",
        "paired-parallel-edges",
        "primary-structural-component",
        "topology-edge",
      ])],
    },
    origin: "local",
    conflict: null,
  };
}

const recoveredHost = wall({
  id: "strong-mask-door-host",
  start: { x: 1072.4, y: 605.2 },
  end: { x: 1292.7, y: 816.7 },
  reasons: [
    "architectural-line-filter",
    "paired-parallel-edges",
    "strong-mask-rotated-door-host",
    "same-side-structural-rail-pair",
    "perpendicular-door-leaf-evidence",
    "topology-edge",
  ],
});

const containedResidual = wall({
  id: "bath-residual",
  start: { x: 1192.7, y: 726.3 },
  end: { x: 1285.0, y: 818.5 },
  thicknessPx: 24.4,
});

function run(walls: readonly RecognitionWallCandidate[]) {
  return reconsolidateDoorHostResiduals({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: walls,
    openings: [],
  });
}

describe("strong-mask door-host residual overlap cleanup", () => {
  it("blocks a shorter topology residual that is almost fully contained on the same physical axis as a recovered door host", () => {
    const result = run([recoveredHost, containedResidual]);

    expect(result.reconsolidatedCount).toBe(1);
    expect(result.walls.find(({ id }) => id === recoveredHost.id)?.conflict).toBeNull();
    expect(result.walls.find(({ id }) => id === containedResidual.id)).toMatchObject({
      confidence: "low",
      conflict: "unsupported",
    });
    expect(result.walls.find(({ id }) => id === containedResidual.id)?.evidence.reasons)
      .toContain("strong-mask-door-host-residual-overlap-veto");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "strong-mask-door-host-residual-overlap-veto",
      candidateId: containedResidual.id,
    }));
  });

  it("keeps a nearby parallel wall when its axis is physically distinct from the recovered door host", () => {
    const nearby = wall({
      id: "nearby-parallel-wall",
      start: { x: 1049.5, y: 628.0 },
      end: { x: 1270.0, y: 839.5 },
      thicknessPx: 28,
    });

    const result = run([recoveredHost, nearby]);

    expect(result.reconsolidatedCount).toBe(0);
    expect(result.walls).toEqual([recoveredHost, nearby]);
  });

  it("keeps a crossing wall even when its midpoint lies near the recovered host", () => {
    const crossing = wall({
      id: "crossing-wall",
      start: { x: 1170, y: 760 },
      end: { x: 1270, y: 650 },
      thicknessPx: 24,
    });

    const result = run([recoveredHost, crossing]);

    expect(result.reconsolidatedCount).toBe(0);
    expect(result.walls).toEqual([recoveredHost, crossing]);
  });

  it("keeps a short endpoint continuation that is not substantially contained by the recovered host", () => {
    const continuation = wall({
      id: "endpoint-continuation",
      start: { x: 1285.0, y: 818.5 },
      end: { x: 1297.4, y: 830.9 },
      thicknessPx: 24.4,
    });

    const result = run([recoveredHost, continuation]);

    expect(result.reconsolidatedCount).toBe(0);
    expect(result.walls).toEqual([recoveredHost, continuation]);
  });

  it("does not suppress overlap when the covering host lacks strong rotated door-host provenance", () => {
    const ordinaryHost = wall({
      id: "ordinary-host",
      start: { x: 1072.4, y: 605.2 },
      end: { x: 1292.7, y: 816.7 },
    });

    const result = run([ordinaryHost, containedResidual]);

    expect(result.reconsolidatedCount).toBe(0);
    expect(result.walls).toEqual([ordinaryHost, containedResidual]);
  });
});
