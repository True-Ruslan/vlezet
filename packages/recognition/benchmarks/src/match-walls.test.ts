import type { RecognitionWallCandidate } from "../../src/model";
import type {
  BenchmarkJunctionV1,
  BenchmarkWallV1,
  RecognitionBenchmarkFixtureV1,
} from "../schema/fixture-v1";
import { describe, expect, it } from "vitest";
import { matchWalls } from "./match-walls";

const SOURCE_SPAN_MM = 10_000;

function point(xMm: number, yMm: number) {
  return { x: xMm / SOURCE_SPAN_MM, y: yMm / SOURCE_SPAN_MM };
}

function prediction(
  id: string,
  startMm: Readonly<{ x: number; y: number }>,
  endMm: Readonly<{ x: number; y: number }>,
): RecognitionWallCandidate {
  return {
    id,
    start: point(startMm.x, startMm.y),
    end: point(endMm.x, endMm.y),
    estimatedThicknessPx: 15,
    confidence: "medium",
    evidence: { localScore: 0.7, cloudScore: null, reasons: ["benchmark-test"] },
    origin: "local",
    conflict: null,
  };
}

function fixture(
  walls: readonly BenchmarkWallV1[],
  junctions: readonly BenchmarkJunctionV1[],
  wallEndpointMm = 120,
): RecognitionBenchmarkFixtureV1 {
  return {
    schemaVersion: "recognition-benchmark-fixture-v1",
    id: "wall-matching",
    description: "Synthetic wall matcher fixture",
    provenance: { kind: "synthetic", note: "Created for wall matcher tests.", license: null },
    tags: ["clean", "calibrated"],
    source: { fileName: "source.png", sha256: "a".repeat(64), cloudResponseFileName: null },
    calibration: { sourceWidthPx: 1000, sourceHeightPx: 1000, millimetersPerPixel: 10, originPx: { x: 0, y: 0 } },
    tolerances: {
      wallEndpointMm,
      wallOrientationDeg: 5,
      wallMinimumOverlapRatio: 0.7,
      wallLengthRelativeError: 0.2,
      junctionMm: 120,
      openingCenterMm: 150,
      openingWidthMm: 150,
      roomMinimumIoU: 0.75,
      labelAnchorMm: 500,
    },
    expectedJunctions: junctions,
    expectedWalls: walls,
    expectedOpenings: [],
    expectedRooms: [],
    expectedLabels: [],
    statedTotalAreaM2: null,
    metricApplicability: {
      wallGeometry: true,
      wallTopology: false,
      openings: false,
      rooms: false,
      roomLabels: false,
      roomAreas: false,
      totalArea: false,
      confidence: false,
    },
  };
}

function horizontalWall(
  id: string,
  y: number,
  startJunctionId: string,
  endJunctionId: string,
): BenchmarkWallV1 {
  return {
    id,
    startMm: { x: 1000, y },
    endMm: { x: 5000, y },
    thicknessMm: 150,
    kind: "partition",
    startJunctionId,
    endJunctionId,
  };
}

function junctionsFor(walls: readonly BenchmarkWallV1[]): BenchmarkJunctionV1[] {
  return walls.flatMap((wall) => [
    { id: wall.startJunctionId, positionMm: wall.startMm },
    { id: wall.endJunctionId, positionMm: wall.endMm },
  ]);
}

describe("wall geometry matching", () => {
  it("matches a reversed predicted wall direction", () => {
    const wall = horizontalWall("w1", 1000, "j1", "j2");
    const result = matchWalls({
      fixture: fixture([wall], junctionsFor([wall])),
      predictions: [prediction("p1", wall.endMm, wall.startMm)],
    });
    expect(result.metrics).toEqual({
      truePositive: 1,
      falsePositive: 0,
      falseNegative: 0,
      precision: 1,
      recall: 1,
      f1: 1,
    });
    expect(result.matches[0]?.endpointDistanceMm).toBe(0);
  });

  it("rejects endpoint distance outside tolerance", () => {
    const wall = horizontalWall("w1", 1000, "j1", "j2");
    const result = matchWalls({
      fixture: fixture([wall], junctionsFor([wall]), 120),
      predictions: [prediction("p1", { x: 1000, y: 1201 }, { x: 5000, y: 1201 })],
    });
    expect(result.metrics).toMatchObject({ truePositive: 0, falsePositive: 1, falseNegative: 1, f1: 0 });
  });

  it("rejects poor projected overlap even when orientation matches", () => {
    const wall = horizontalWall("w1", 1000, "j1", "j2");
    const result = matchWalls({
      fixture: fixture([wall], junctionsFor([wall]), 5000),
      predictions: [prediction("p1", { x: 4500, y: 1000 }, { x: 5500, y: 1000 })],
    });
    expect(result.matches).toHaveLength(0);
  });

  it("does not let one prediction satisfy two expected walls", () => {
    const walls = [
      horizontalWall("w1", 1000, "j1", "j2"),
      horizontalWall("w2", 1100, "j3", "j4"),
    ];
    const result = matchWalls({
      fixture: fixture(walls, junctionsFor(walls), 100),
      predictions: [prediction("p1", { x: 1000, y: 1050 }, { x: 5000, y: 1050 })],
    });
    expect(result.matches).toHaveLength(1);
    expect(result.unmatchedExpectedWallIds).toHaveLength(1);
  });

  it("is invariant to prediction order", () => {
    const walls = [
      horizontalWall("w1", 1000, "j1", "j2"),
      horizontalWall("w2", 2000, "j3", "j4"),
    ];
    const predictions = [
      prediction("p1", walls[0]!.startMm, walls[0]!.endMm),
      prediction("p2", walls[1]!.startMm, walls[1]!.endMm),
    ];
    const forward = matchWalls({ fixture: fixture(walls, junctionsFor(walls)), predictions });
    const reverse = matchWalls({ fixture: fixture(walls, junctionsFor(walls)), predictions: [...predictions].reverse() });
    expect(reverse.metrics).toEqual(forward.metrics);
    expect(reverse.matches.map((match) => match.expectedWallId).sort())
      .toEqual(forward.matches.map((match) => match.expectedWallId).sort());
  });

  it("uses the global optimum instead of greedy cheapest-first matching", () => {
    const walls = [
      horizontalWall("w1", 1000, "j1", "j2"),
      horizontalWall("w2", 1100, "j3", "j4"),
    ];
    const result = matchWalls({
      fixture: fixture(walls, junctionsFor(walls), 100),
      predictions: [
        prediction("flexible", { x: 1000, y: 1000 }, { x: 5000, y: 1000 }),
        prediction("only-first", { x: 1000, y: 950 }, { x: 5000, y: 950 }),
      ],
    });
    expect(result.metrics.truePositive).toBe(2);
    expect(result.unmatchedExpectedWallIds).toEqual([]);
    expect(result.unmatchedPredictedIndices).toEqual([]);
  });

  it("reports an unmatched duplicate prediction explicitly", () => {
    const wall = horizontalWall("w1", 1000, "j1", "j2");
    const result = matchWalls({
      fixture: fixture([wall], junctionsFor([wall])),
      predictions: [
        prediction("p1", wall.startMm, wall.endMm),
        prediction("p2", wall.startMm, wall.endMm),
      ],
    });
    expect(result.metrics).toEqual({
      truePositive: 1,
      falsePositive: 1,
      falseNegative: 0,
      precision: 0.5,
      recall: 1,
      f1: 2 / 3,
    });
    expect(result.duplicatePredictionCount).toBe(1);
  });
});
