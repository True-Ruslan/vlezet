import type { RecognitionBenchmarkFixtureV1 } from "../schema/fixture-v1";
import { describe, expect, it } from "vitest";
import {
  rasterRoomIoU,
  scoreRooms,
  type BenchmarkRoomPredictionV1,
} from "./score-rooms";

const squareA = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 1000 },
  { x: 0, y: 1000 },
] as const;
const squareB = [
  { x: 1500, y: 0 },
  { x: 2500, y: 0 },
  { x: 2500, y: 1000 },
  { x: 1500, y: 1000 },
] as const;
const lShape = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 400 },
  { x: 400, y: 400 },
  { x: 400, y: 1000 },
  { x: 0, y: 1000 },
] as const;

function fixture(options: Readonly<{
  roomsEnabled?: boolean;
  statedTotalAreaM2?: number | null;
  secondRoom?: boolean;
  firstStatedAreaM2?: number | null;
}> = {}): RecognitionBenchmarkFixtureV1 {
  const roomsEnabled = options.roomsEnabled ?? true;
  const expectedRooms = roomsEnabled ? [
    {
      id: "r1",
      polygonMm: squareA,
      name: "Комната",
      classification: "living" as const,
      statedAreaM2: options.firstStatedAreaM2 ?? 1,
      computedAreaM2: 1,
    },
    ...(options.secondRoom ? [{
      id: "r2",
      polygonMm: squareB,
      name: "Кухня",
      classification: "kitchen" as const,
      statedAreaM2: 1,
      computedAreaM2: 1,
    }] : []),
  ] : [];
  return {
    schemaVersion: "recognition-benchmark-fixture-v1",
    id: "rooms-fixture",
    description: "Synthetic room scoring fixture",
    provenance: { kind: "synthetic", note: "Created for room scoring tests.", license: null },
    tags: ["labels-and-areas", "calibrated"],
    source: { fileName: "source.png", sha256: "a".repeat(64), cloudResponseFileName: null },
    calibration: { sourceWidthPx: 1000, sourceHeightPx: 1000, millimetersPerPixel: 10, originPx: { x: 0, y: 0 } },
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
    expectedJunctions: [],
    expectedWalls: [],
    expectedOpenings: [],
    expectedRooms,
    expectedLabels: [],
    statedTotalAreaM2: roomsEnabled ? (options.statedTotalAreaM2 ?? expectedRooms.reduce((sum, room) => sum + (room.statedAreaM2 ?? room.computedAreaM2), 0)) : null,
    metricApplicability: {
      wallGeometry: false,
      wallTopology: false,
      openings: false,
      rooms: roomsEnabled,
      roomLabels: false,
      roomAreas: roomsEnabled,
      totalArea: roomsEnabled,
      confidence: false,
    },
  };
}

function prediction(
  id: string,
  polygonMm: BenchmarkRoomPredictionV1["polygonMm"],
  name = "Комната",
  classification: BenchmarkRoomPredictionV1["classification"] = "living",
  statedAreaM2: number | null = null,
): BenchmarkRoomPredictionV1 {
  return { id, polygonMm, name, classification, statedAreaM2, confidence: "medium" };
}

describe("benchmark room raster IoU", () => {
  it("returns one for identical rectangles and L-shapes", () => {
    expect(rasterRoomIoU(squareA, squareA)).toBe(1);
    expect(rasterRoomIoU(lShape, lShape)).toBe(1);
  });

  it("returns zero for disjoint polygons", () => {
    expect(rasterRoomIoU(squareA, squareB)).toBe(0);
  });
});

describe("recognition room scoring", () => {
  it("reports exact zone count and perfect one-to-one room detection", () => {
    const score = scoreRooms({ fixture: fixture({ secondRoom: true }), predictions: [
      prediction("p1", squareA),
      prediction("p2", squareB, "Кухня", "kitchen"),
    ] });
    expect(score.exactZoneCount).toEqual({ status: "measured", value: 1 });
    expect(score.roomDetection).toMatchObject({ truePositive: 2, falsePositive: 0, falseNegative: 0, f1: 1 });
  });

  it("reports zero recall rather than not-applicable when room predictions are absent", () => {
    const score = scoreRooms({ fixture: fixture(), predictions: [] });
    expect(score.exactZoneCount).toEqual({ status: "measured", value: 0 });
    expect(score.roomDetection).toMatchObject({ truePositive: 0, falseNegative: 1, recall: 0, f1: 0 });
  });

  it("returns not-applicable only when room metrics are explicitly disabled", () => {
    const score = scoreRooms({ fixture: fixture({ roomsEnabled: false }), predictions: [] });
    expect(score.roomDetection).toBeNull();
    expect(score.exactZoneCount).toEqual({ status: "not-applicable" });
    expect(score.totalAreaAbsolutePercentageError).toEqual({ status: "not-applicable" });
  });

  it("keeps stated and computed areas separate", () => {
    const predictedPolygon = [
      { x: 0, y: 0 },
      { x: 900, y: 0 },
      { x: 900, y: 1000 },
      { x: 0, y: 1000 },
    ];
    const score = scoreRooms({
      fixture: fixture({ statedTotalAreaM2: 1.2, firstStatedAreaM2: 1.2 }),
      predictions: [prediction("p1", predictedPolygon, "Комната", "living", 1.1)],
    });
    expect(score.computedPredictedTotalAreaM2).toBe(0.9);
    expect(score.matches[0]).toMatchObject({ expectedAreaM2: 1.2, predictedComputedAreaM2: 0.9, predictedStatedAreaM2: 1.1 });
    expect(score.totalAreaAbsolutePercentageError).toEqual({ status: "measured", value: 0.25 });
    expect(score.roomAreaMedianAbsolutePercentageError).toEqual({ status: "measured", value: 0.25 });
  });

  it("is one-to-one and invariant to prediction order", () => {
    const predictions = [
      prediction("p1", squareA),
      prediction("p2", squareB, "Кухня", "kitchen"),
      prediction("duplicate", squareA),
    ];
    const forward = scoreRooms({ fixture: fixture({ secondRoom: true }), predictions });
    const reverse = scoreRooms({ fixture: fixture({ secondRoom: true }), predictions: [...predictions].reverse() });
    expect(forward.roomDetection).toMatchObject({ truePositive: 2, falsePositive: 1, falseNegative: 0 });
    expect(reverse.roomDetection).toEqual(forward.roomDetection);
    expect(reverse.matches.map((match) => match.expectedRoomId).sort()).toEqual(forward.matches.map((match) => match.expectedRoomId).sort());
  });
});
