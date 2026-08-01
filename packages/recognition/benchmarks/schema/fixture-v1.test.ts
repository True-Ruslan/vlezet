import { describe, expect, it } from "vitest";
import {
  validateRecognitionBenchmarkFixtureV1,
  type RecognitionBenchmarkFixtureV1,
} from "./fixture-v1";
import { validateRecognitionBenchmarkResultV1 } from "./result-v1";

function validFixture(): RecognitionBenchmarkFixtureV1 {
  return {
    schemaVersion: "recognition-benchmark-fixture-v1",
    id: "contract-fixture",
    description: "Synthetic contract fixture",
    provenance: {
      kind: "synthetic",
      note: "Created only for benchmark contract tests.",
      license: null,
    },
    tags: ["clean", "calibrated"],
    source: {
      fileName: "source.png",
      sha256: "a".repeat(64),
      cloudResponseFileName: null,
    },
    calibration: {
      sourceWidthPx: 1000,
      sourceHeightPx: 800,
      millimetersPerPixel: 5,
      originPx: { x: 0, y: 0 },
    },
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
      { id: "j1", pointMm: { x: 0, y: 0 } },
      { id: "j2", pointMm: { x: 4000, y: 0 } },
      { id: "j3", pointMm: { x: 4000, y: 3000 } },
      { id: "j4", pointMm: { x: 0, y: 3000 } },
    ],
    expectedWalls: [
      {
        id: "w1",
        startMm: { x: 0, y: 0 },
        endMm: { x: 4000, y: 0 },
        thicknessMm: 150,
        kind: "external",
        startJunctionId: "j1",
        endJunctionId: "j2",
      },
    ],
    expectedOpenings: [
      {
        id: "o1",
        kind: "door",
        hostWallId: "w1",
        centerMm: { x: 2000, y: 0 },
        widthMm: 900,
        orientationDeg: 0,
        swing: { hinge: "start", side: "left" },
      },
    ],
    expectedRooms: [
      {
        id: "r1",
        polygonMm: [
          { x: 0, y: 0 },
          { x: 4000, y: 0 },
          { x: 4000, y: 3000 },
          { x: 0, y: 3000 },
        ],
        name: "Комната",
        classification: "living",
        statedAreaM2: 12,
        computedAreaM2: 12,
      },
    ],
    expectedLabels: [
      {
        id: "l1",
        text: "Комната 12,0",
        anchorMm: { x: 2000, y: 1500 },
        roomId: "r1",
      },
    ],
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
  return {
    schemaVersion: "recognition-benchmark-result-v1",
    corpusVersion: "recognition-corpus-v1",
    recognitionEngineVersion: "3",
    commitSha: "b".repeat(40),
    generatedAt: "2026-08-01T20:00:00.000Z",
    fixtures: [
      {
        fixtureId: "contract-fixture",
        failed: false,
        diagnostics: [],
        metrics: {
          wallGeometryF1: { status: "measured", value: 1 },
          wallTopologyF1: { status: "measured", value: 1 },
          openingF1: { status: "measured", value: 1 },
          exactZoneCount: { status: "measured", value: 1 },
          totalAreaAbsolutePercentageError: { status: "measured", value: 0 },
          roomAreaMedianAbsolutePercentageError: { status: "measured", value: 0 },
          incorrectHighConfidenceRate: { status: "measured", value: 0 },
          unknownHostOpenings: { status: "measured", value: 0 },
          staleDecisions: { status: "measured", value: 0 },
        },
      },
    ],
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
  };
}

describe("recognition benchmark fixture v1", () => {
  it("accepts a calibrated fixture with one wall, opening and room", () => {
    const fixture = validFixture();
    expect(validateRecognitionBenchmarkFixtureV1(fixture)).toEqual(fixture);
  });

  it.each([
    ["duplicate wall ids", (fixture: any) => fixture.expectedWalls.push({ ...fixture.expectedWalls[0] })],
    ["zero-length wall", (fixture: any) => fixture.expectedWalls[0].endMm = fixture.expectedWalls[0].startMm],
    ["unknown opening host", (fixture: any) => fixture.expectedOpenings[0].hostWallId = "missing"],
    ["self-intersecting room", (fixture: any) => fixture.expectedRooms[0].polygonMm = [{ x: 0, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }, { x: 1000, y: 0 }]],
    ["missing provenance note", (fixture: any) => fixture.provenance.note = ""],
    ["window swing", (fixture: any) => { fixture.expectedOpenings[0].kind = "window"; fixture.expectedOpenings[0].swing = { hinge: "start", side: "left" }; }],
    ["unknown junction", (fixture: any) => fixture.expectedWalls[0].startJunctionId = "missing"],
    ["missing room ground truth", (fixture: any) => fixture.expectedRooms = []],
  ])("rejects %s", (_name, mutate) => {
    const fixture = structuredClone(validFixture()) as any;
    mutate(fixture);
    expect(() => validateRecognitionBenchmarkFixtureV1(fixture)).toThrow();
  });

  it("accepts explicitly disabled room metrics without room ground truth", () => {
    const fixture = structuredClone(validFixture()) as any;
    fixture.expectedRooms = [];
    fixture.expectedLabels = [];
    fixture.statedTotalAreaM2 = null;
    fixture.metricApplicability.rooms = false;
    fixture.metricApplicability.roomLabels = false;
    fixture.metricApplicability.roomAreas = false;
    fixture.metricApplicability.totalArea = false;
    expect(validateRecognitionBenchmarkFixtureV1(fixture).metricApplicability.rooms).toBe(false);
  });
});

describe("recognition benchmark result v1", () => {
  it("accepts a measured deterministic result", () => {
    const result = validResult();
    expect(validateRecognitionBenchmarkResultV1(result)).toEqual(result);
  });

  it.each([
    ["non-finite metric", (result: any) => result.aggregate.metrics.wallGeometryF1.value = Number.NaN],
    ["out-of-range F1", (result: any) => result.aggregate.metrics.wallGeometryF1.value = 1.1],
    ["duplicate fixture ids", (result: any) => result.fixtures.push(structuredClone(result.fixtures[0]))],
    ["fixture count mismatch", (result: any) => result.aggregate.fixtureCount = 2],
    ["malformed commit SHA", (result: any) => result.commitSha = "head"],
  ])("rejects %s", (_name, mutate) => {
    const result = structuredClone(validResult()) as any;
    mutate(result);
    expect(() => validateRecognitionBenchmarkResultV1(result)).toThrow();
  });
});
