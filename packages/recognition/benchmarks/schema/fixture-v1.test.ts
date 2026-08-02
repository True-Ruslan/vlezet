import { describe, expect, it } from "vitest";
import { validateRecognitionBenchmarkFixtureV1, type RecognitionBenchmarkFixtureV1 } from "./fixture-v1";
import { validateRecognitionBenchmarkResultV1 } from "./result-v1";

function validFixture(): RecognitionBenchmarkFixtureV1 {
  return {
    schemaVersion: "recognition-benchmark-fixture-v1",
    id: "contract-fixture",
    description: "Synthetic contract fixture",
    provenance: { kind: "synthetic", note: "Created for contract tests.", license: null },
    tags: ["clean", "calibrated"],
    source: { fileName: "source.png", sha256: "a".repeat(64), cloudResponseFileName: null },
    calibration: { sourceWidthPx: 1000, sourceHeightPx: 800, millimetersPerPixel: 5, originPx: { x: 0, y: 0 } },
    tolerances: {
      wallEndpointMm: 120,
      wallOrientationDeg: 5,
      wallMinimumOverlapRatio: 0.7,
      wallLengthRelativeError: 0.2,
      junctionMm: 120,
      openingCenterMm: 150,
      openingWidthMm: 150,
      roomMinimumIoU: 0.75,
      labelAnchorMm: 500,
    },
    expectedJunctions: [
      { id: "j1", positionMm: { x: 0, y: 0 } },
      { id: "j2", positionMm: { x: 4000, y: 0 } },
    ],
    expectedWalls: [{
      id: "w1",
      startMm: { x: 0, y: 0 },
      endMm: { x: 4000, y: 0 },
      thicknessMm: 150,
      kind: "external",
      startJunctionId: "j1",
      endJunctionId: "j2",
    }],
    expectedOpenings: [{
      id: "o1",
      kind: "door",
      hostWallId: "w1",
      centerMm: { x: 2000, y: 0 },
      widthMm: 900,
      orientationDeg: 0,
      swing: { hinge: "start", side: "left" },
    }],
    expectedRooms: [{
      id: "r1",
      polygonMm: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }],
      name: "Комната",
      classification: "living",
      statedAreaM2: 12,
      computedAreaM2: 12,
    }],
    expectedLabels: [{ id: "l1", text: "Комната 12,0", anchorMm: { x: 2000, y: 1500 }, roomId: "r1" }],
    statedTotalAreaM2: 12,
    metricApplicability: {
      wallGeometry: true,
      wallTopology: true,
      openings: true,
      rooms: true,
      roomLabels: true,
      roomAreas: true,
      totalArea: true,
      confidence: true,
    },
  };
}

function validResult() {
  const fixtureMetrics = {
    wallGeometryF1: { status: "measured", value: 1 },
    wallTopologyF1: { status: "measured", value: 1 },
    openingF1: { status: "measured", value: 1 },
    exactZoneCount: { status: "measured", value: 1 },
    totalAreaAbsolutePercentageError: { status: "measured", value: 0 },
    roomAreaMedianAbsolutePercentageError: { status: "measured", value: 0 },
    incorrectHighConfidenceRate: { status: "measured", value: 0 },
    unknownHostOpenings: { status: "measured", value: 0 },
    staleDecisions: { status: "measured", value: 0 },
  } as const;
  return {
    schemaVersion: "recognition-benchmark-result-v1",
    corpusVersion: "recognition-corpus-v1",
    recognitionEngineVersion: "3",
    commitSha: "b".repeat(40),
    generatedAt: "2026-08-01T20:00:00.000Z",
    fixtures: [{
      fixtureId: "contract-fixture",
      failed: false,
      diagnostics: [],
      metrics: fixtureMetrics,
      evidence: {
        wallGeometry: { truePositive: 1, falsePositive: 0, falseNegative: 0, precision: 1, recall: 1, f1: 1 },
        wallTopology: { truePositive: 1, falsePositive: 0, falseNegative: 0, precision: 1, recall: 1, f1: 1 },
        openings: { truePositive: 1, falsePositive: 0, falseNegative: 0, precision: 1, recall: 1, f1: 1 },
        roomDetection: { truePositive: 1, falsePositive: 0, falseNegative: 0, precision: 1, recall: 1, f1: 1 },
        roomIous: [1],
        totalAreaAbsolutePercentageErrors: [0],
        roomAreaAbsolutePercentageErrors: [0],
        highConfidencePredictionCount: 1,
        highConfidenceFalsePositiveCount: 0,
        unknownHostOpenings: 0,
        staleDecisions: 0,
      },
    }],
    aggregate: {
      fixtureCount: 1,
      failedFixtureCount: 0,
      metrics: {
        wallGeometryF1: { status: "measured", value: 1 },
        wallTopologyF1: { status: "measured", value: 1 },
        openingF1: { status: "measured", value: 1 },
        exactZoneCountRate: { status: "measured", value: 1 },
        totalAreaMedianAbsolutePercentageError: { status: "measured", value: 0 },
        roomAreaMedianAbsolutePercentageError: { status: "measured", value: 0 },
        incorrectHighConfidenceRate: { status: "measured", value: 0 },
        unknownHostOpenings: { status: "measured", value: 0 },
        staleDecisions: { status: "measured", value: 0 },
      },
    },
    baselineComparison: null,
  } as const;
}

describe("recognition benchmark fixture v1", () => {
  it("accepts a calibrated fixture with wall, opening and room ground truth", () => {
    const fixture = validFixture();
    expect(validateRecognitionBenchmarkFixtureV1(fixture)).toEqual(fixture);
  });

  it("rejects duplicate wall ids", () => {
    const fixture = validFixture();
    const malformed = { ...fixture, expectedWalls: [...fixture.expectedWalls, { ...fixture.expectedWalls[0]! }] };
    expect(() => validateRecognitionBenchmarkFixtureV1(malformed)).toThrow();
  });

  it("rejects a zero-length wall", () => {
    const fixture = validFixture();
    const wall = fixture.expectedWalls[0]!;
    const malformed = { ...fixture, expectedWalls: [{ ...wall, endMm: wall.startMm }] };
    expect(() => validateRecognitionBenchmarkFixtureV1(malformed)).toThrow();
  });

  it("rejects an unknown opening host", () => {
    const fixture = validFixture();
    const opening = fixture.expectedOpenings[0]!;
    const malformed = { ...fixture, expectedOpenings: [{ ...opening, hostWallId: "missing" }] };
    expect(() => validateRecognitionBenchmarkFixtureV1(malformed)).toThrow();
  });

  it("rejects a self-intersecting room", () => {
    const fixture = validFixture();
    const room = fixture.expectedRooms[0]!;
    const malformed = {
      ...fixture,
      expectedRooms: [{
        ...room,
        polygonMm: [{ x: 0, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }, { x: 1000, y: 0 }],
      }],
    };
    expect(() => validateRecognitionBenchmarkFixtureV1(malformed)).toThrow();
  });

  it("rejects missing provenance notes", () => {
    const fixture = validFixture();
    const malformed = { ...fixture, provenance: { ...fixture.provenance, note: "" } };
    expect(() => validateRecognitionBenchmarkFixtureV1(malformed)).toThrow();
  });

  it("rejects door-swing metadata on a window", () => {
    const fixture = validFixture();
    const opening = fixture.expectedOpenings[0]!;
    const malformed = { ...fixture, expectedOpenings: [{ ...opening, kind: "window" }] };
    expect(() => validateRecognitionBenchmarkFixtureV1(malformed)).toThrow();
  });

  it("rejects an unknown junction", () => {
    const fixture = validFixture();
    const wall = fixture.expectedWalls[0]!;
    const malformed = { ...fixture, expectedWalls: [{ ...wall, startJunctionId: "missing" }] };
    expect(() => validateRecognitionBenchmarkFixtureV1(malformed)).toThrow();
  });

  it("rejects missing room ground truth while room metrics are enabled", () => {
    const fixture = validFixture();
    const malformed = { ...fixture, expectedRooms: [] };
    expect(() => validateRecognitionBenchmarkFixtureV1(malformed)).toThrow();
  });

  it("accepts explicitly disabled room metrics without room ground truth", () => {
    const fixture = validFixture();
    const candidate = {
      ...fixture,
      expectedRooms: [],
      expectedLabels: [],
      statedTotalAreaM2: null,
      metricApplicability: {
        ...fixture.metricApplicability,
        rooms: false,
        roomLabels: false,
        roomAreas: false,
        totalArea: false,
      },
    };
    expect(validateRecognitionBenchmarkFixtureV1(candidate).metricApplicability.rooms).toBe(false);
  });
});

describe("recognition benchmark result v1", () => {
  it("accepts a measured deterministic result", () => {
    const result = validResult();
    expect(validateRecognitionBenchmarkResultV1(result)).toEqual(result);
  });

  it("rejects a non-finite metric", () => {
    const result = validResult();
    const malformed = {
      ...result,
      aggregate: {
        ...result.aggregate,
        metrics: { ...result.aggregate.metrics, wallGeometryF1: { status: "measured", value: Number.NaN } },
      },
    };
    expect(() => validateRecognitionBenchmarkResultV1(malformed)).toThrow();
  });

  it("rejects an out-of-range F1", () => {
    const result = validResult();
    const malformed = {
      ...result,
      aggregate: {
        ...result.aggregate,
        metrics: { ...result.aggregate.metrics, wallGeometryF1: { status: "measured", value: 1.1 } },
      },
    };
    expect(() => validateRecognitionBenchmarkResultV1(malformed)).toThrow();
  });

  it("rejects duplicate fixture ids", () => {
    const result = validResult();
    const malformed = { ...result, fixtures: [...result.fixtures, { ...result.fixtures[0]! }] };
    expect(() => validateRecognitionBenchmarkResultV1(malformed)).toThrow();
  });

  it("rejects a fixture-count mismatch", () => {
    const result = validResult();
    const malformed = { ...result, aggregate: { ...result.aggregate, fixtureCount: 2 } };
    expect(() => validateRecognitionBenchmarkResultV1(malformed)).toThrow();
  });

  it("rejects a malformed commit SHA", () => {
    const result = validResult();
    expect(() => validateRecognitionBenchmarkResultV1({ ...result, commitSha: "head" })).toThrow();
  });
});
