import type { RecognitionWallCandidate } from "../../src/model";
import type {
  BenchmarkJunctionV1,
  BenchmarkWallV1,
  RecognitionBenchmarkFixtureV1,
} from "../schema/fixture-v1";
import { describe, expect, it } from "vitest";
import { derivePredictedTopology, scoreWallTopology } from "./score-wall-topology";

const SPAN_MM = 10_000;
const calibration = {
  sourceWidthPx: 1000,
  sourceHeightPx: 1000,
  millimetersPerPixel: 10,
  originPx: { x: 0, y: 0 },
} as const;

function prediction(id: string, startX: number, startY: number, endX: number, endY: number): RecognitionWallCandidate {
  return {
    id,
    start: { x: startX / SPAN_MM, y: startY / SPAN_MM },
    end: { x: endX / SPAN_MM, y: endY / SPAN_MM },
    estimatedThicknessPx: 15,
    confidence: "medium",
    evidence: { localScore: 0.7, cloudScore: null, reasons: ["benchmark-test"] },
    origin: "local",
    conflict: null,
  };
}

function wall(
  id: string,
  start: Readonly<{ x: number; y: number }>,
  end: Readonly<{ x: number; y: number }>,
  startJunctionId: string,
  endJunctionId: string,
): BenchmarkWallV1 {
  return {
    id,
    startMm: start,
    endMm: end,
    thicknessMm: 150,
    kind: "partition",
    startJunctionId,
    endJunctionId,
  };
}

function fixture(walls: readonly BenchmarkWallV1[], junctions: readonly BenchmarkJunctionV1[], tolerance = 120): RecognitionBenchmarkFixtureV1 {
  return {
    schemaVersion: "recognition-benchmark-fixture-v1",
    id: "topology-fixture",
    description: "Synthetic topology fixture",
    provenance: { kind: "synthetic", note: "Created for topology tests.", license: null },
    tags: ["clean", "calibrated"],
    source: { fileName: "source.png", sha256: "a".repeat(64), cloudResponseFileName: null },
    calibration,
    tolerances: {
      wallEndpointMm: tolerance,
      wallOrientationDeg: 5,
      wallMinimumOverlapRatio: 0.7,
      wallLengthRelativeError: 0.2,
      junctionMm: tolerance,
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
      wallTopology: true,
      openings: false,
      rooms: false,
      roomLabels: false,
      roomAreas: false,
      totalArea: false,
      confidence: false,
    },
  };
}

describe("predicted wall topology", () => {
  it("clusters endpoints within tolerance", () => {
    const topology = derivePredictedTopology({
      predictions: [
        prediction("p1", 1000, 1000, 2000, 1000),
        prediction("p2", 2110, 1000, 3000, 1000),
      ],
      calibration,
      junctionToleranceMm: 120,
    });
    expect(topology.junctions).toHaveLength(3);
    expect(topology.edges).toHaveLength(2);
  });

  it("uses transitive connected-component clustering", () => {
    const topology = derivePredictedTopology({
      predictions: [
        prediction("p1", 1000, 1000, 1000, 3000),
        prediction("p2", 1100, 1000, 2000, 3000),
        prediction("p3", 1200, 1000, 3000, 3000),
      ],
      calibration,
      junctionToleranceMm: 110,
    });
    expect(topology.junctions.some((junction) => junction.memberKeys.length === 3)).toBe(true);
  });

  it("keeps stable junction IDs when prediction order changes", () => {
    const predictions = [
      prediction("p1", 1000, 1000, 2000, 1000),
      prediction("p2", 2110, 1000, 3000, 1000),
    ];
    const first = derivePredictedTopology({ predictions, calibration, junctionToleranceMm: 120 });
    const second = derivePredictedTopology({ predictions: [...predictions].reverse(), calibration, junctionToleranceMm: 120 });
    expect(second.junctions.map((junction) => junction.id)).toEqual(first.junctions.map((junction) => junction.id));
  });

  it("reports a wall whose endpoints collapse into one junction as a self-loop", () => {
    const topology = derivePredictedTopology({
      predictions: [prediction("p1", 1000, 1000, 1100, 1000)],
      calibration,
      junctionToleranceMm: 120,
    });
    expect(topology.edges).toEqual([]);
    expect(topology.selfLoopWallIndices).toEqual([0]);
  });

  it("keeps duplicate predicted edges explicit", () => {
    const topology = derivePredictedTopology({
      predictions: [
        prediction("p1", 1000, 1000, 5000, 1000),
        prediction("p2", 1000, 1000, 5000, 1000),
      ],
      calibration,
      junctionToleranceMm: 120,
    });
    expect(topology.edges).toHaveLength(2);
    expect(topology.duplicateEdgeWallIndices).toEqual([1]);
  });
});

describe("wall topology scoring", () => {
  it("loses edge credit when close geometry has wrong connectivity", () => {
    const expectedWalls = [
      wall("w1", { x: 1000, y: 1000 }, { x: 5000, y: 1000 }, "a", "b"),
      wall("w2", { x: 5000, y: 1000 }, { x: 5000, y: 5000 }, "b", "c"),
    ];
    const expectedJunctions = [
      { id: "a", positionMm: { x: 1000, y: 1000 } },
      { id: "b", positionMm: { x: 5000, y: 1000 } },
      { id: "c", positionMm: { x: 5000, y: 5000 } },
    ];
    const score = scoreWallTopology({
      fixture: fixture(expectedWalls, expectedJunctions, 120),
      predictions: [
        prediction("p1", 1000, 1000, 4900, 1000),
        prediction("p2", 5100, 1000, 5000, 5000),
      ],
    });
    expect(score.edges.truePositive).toBeLessThan(2);
    expect(score.topologyF1).toBeLessThan(1);
  });

  it("uses one-to-one optimal junction assignment", () => {
    const expectedWalls = [
      wall("w1", { x: 1000, y: 1000 }, { x: 5000, y: 1000 }, "a1", "a2"),
      wall("w2", { x: 1000, y: 1100 }, { x: 5000, y: 1100 }, "b1", "b2"),
    ];
    const expectedJunctions = [
      { id: "a1", positionMm: { x: 1000, y: 1000 } },
      { id: "a2", positionMm: { x: 5000, y: 1000 } },
      { id: "b1", positionMm: { x: 1000, y: 1100 } },
      { id: "b2", positionMm: { x: 5000, y: 1100 } },
    ];
    const score = scoreWallTopology({
      fixture: fixture(expectedWalls, expectedJunctions, 100),
      predictions: [
        prediction("flexible", 1000, 1000, 5000, 1000),
        prediction("only-first", 1000, 950, 5000, 950),
      ],
    });
    expect(score.junctions.truePositive).toBe(4);
    expect(score.edges.truePositive).toBe(2);
  });
});
