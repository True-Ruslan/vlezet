import { pointInPolygon, polygonSelfIntersects, signedPolygonArea } from "@vlezet/geometry";
import type { RecognitionConfidence } from "../../src/model";
import type {
  BenchmarkPointMm,
  BenchmarkRoomV1,
  RecognitionBenchmarkFixtureV1,
} from "../schema/fixture-v1";
import type { BenchmarkCountMetric, BenchmarkMetricValue } from "../schema/result-v1";
import { stablePointKey } from "./coordinates";
import { solveOptimalAssignment, type AssignmentEdge } from "./optimal-assignment";

export const ROOM_IOU_CELL_MM = 10;

export type BenchmarkRoomPredictionV1 = Readonly<{
  id: string;
  polygonMm: readonly BenchmarkPointMm[];
  name: string | null;
  classification: BenchmarkRoomV1["classification"];
  statedAreaM2: number | null;
  confidence: RecognitionConfidence;
}>;

export type RoomMatch = Readonly<{
  expectedRoomId: string;
  predictedIndex: number;
  iou: number;
  expectedAreaM2: number;
  predictedComputedAreaM2: number;
  predictedStatedAreaM2: number | null;
  absoluteAreaErrorM2: number;
  absoluteAreaPercentageError: number;
}>;

export type RoomScore = Readonly<{
  matches: readonly RoomMatch[];
  roomDetection: BenchmarkCountMetric | null;
  exactZoneCount: BenchmarkMetricValue;
  medianRoomIoU: BenchmarkMetricValue;
  computedPredictedTotalAreaM2: number;
  totalAreaAbsolutePercentageError: BenchmarkMetricValue;
  roomAreaMedianAbsolutePercentageError: BenchmarkMetricValue;
  roomAreaMedianAbsoluteErrorM2: BenchmarkMetricValue;
}>;

function validatePolygon(polygon: readonly BenchmarkPointMm[], label: string): readonly BenchmarkPointMm[] {
  if (polygon.length < 3) throw new Error(`${label} должен содержать минимум три вершины.`);
  if (polygon.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new Error(`${label} содержит неконечные координаты.`);
  }
  if (polygonSelfIntersects(polygon)) throw new Error(`${label} самопересекается.`);
  if (Math.abs(signedPolygonArea(polygon)) <= 0) throw new Error(`${label} имеет нулевую площадь.`);
  return polygon;
}

function polygonAreaM2(polygon: readonly BenchmarkPointMm[]): number {
  return Math.abs(signedPolygonArea(validatePolygon(polygon, "Полигон комнаты"))) / 1_000_000;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(12));
}

function bounds(polygons: readonly (readonly BenchmarkPointMm[])[]): Readonly<{
  minimumX: number;
  minimumY: number;
  maximumX: number;
  maximumY: number;
}> {
  const points = polygons.flat();
  return {
    minimumX: Math.floor(Math.min(...points.map((point) => point.x)) / ROOM_IOU_CELL_MM) * ROOM_IOU_CELL_MM,
    minimumY: Math.floor(Math.min(...points.map((point) => point.y)) / ROOM_IOU_CELL_MM) * ROOM_IOU_CELL_MM,
    maximumX: Math.ceil(Math.max(...points.map((point) => point.x)) / ROOM_IOU_CELL_MM) * ROOM_IOU_CELL_MM,
    maximumY: Math.ceil(Math.max(...points.map((point) => point.y)) / ROOM_IOU_CELL_MM) * ROOM_IOU_CELL_MM,
  };
}

/** Benchmark-only deterministic polygon approximation. It is not product room geometry authority. */
export function rasterRoomIoU(
  first: readonly BenchmarkPointMm[],
  second: readonly BenchmarkPointMm[],
): number {
  validatePolygon(first, "Первый полигон");
  validatePolygon(second, "Второй полигон");
  const area = bounds([first, second]);
  let intersectionCells = 0;
  let unionCells = 0;
  for (let y = area.minimumY + ROOM_IOU_CELL_MM / 2; y < area.maximumY; y += ROOM_IOU_CELL_MM) {
    for (let x = area.minimumX + ROOM_IOU_CELL_MM / 2; x < area.maximumX; x += ROOM_IOU_CELL_MM) {
      const point = { x, y };
      const inFirst = pointInPolygon(point, first);
      const inSecond = pointInPolygon(point, second);
      if (inFirst || inSecond) unionCells += 1;
      if (inFirst && inSecond) intersectionCells += 1;
    }
  }
  return roundMetric(intersectionCells / Math.max(1, unionCells));
}

function countMetric(truePositive: number, falsePositive: number, falseNegative: number): BenchmarkCountMetric {
  const precisionDenominator = truePositive + falsePositive;
  const recallDenominator = truePositive + falseNegative;
  const precision = precisionDenominator === 0 ? (falseNegative === 0 ? 1 : 0) : truePositive / precisionDenominator;
  const recall = recallDenominator === 0 ? 1 : truePositive / recallDenominator;
  const f1 = precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall);
  return { truePositive, falsePositive, falseNegative, precision, recall, f1 };
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function measuredOrNotApplicable(value: number | null): BenchmarkMetricValue {
  return value === null ? { status: "not-applicable" } : { status: "measured", value: roundMetric(value) };
}

function stablePolygonKey(polygon: readonly BenchmarkPointMm[]): string {
  const forward = polygon.map(stablePointKey);
  const reverse = [...forward].reverse();
  const rotations = (keys: readonly string[]) => keys.map((_key, index) => [...keys.slice(index), ...keys.slice(0, index)].join("|"));
  return [...rotations(forward), ...rotations(reverse)].sort((first, second) => first.localeCompare(second))[0]!;
}

export function scoreRooms(input: Readonly<{
  fixture: RecognitionBenchmarkFixtureV1;
  predictions: readonly BenchmarkRoomPredictionV1[];
}>): RoomScore {
  const roomsEnabled = input.fixture.metricApplicability.rooms;
  const computedPredictedTotalAreaM2 = roundMetric(input.predictions.reduce((sum, prediction, index) => {
    if (!prediction.id.trim()) throw new Error(`Room prediction ${index + 1} имеет пустой id.`);
    return sum + polygonAreaM2(prediction.polygonMm);
  }, 0));
  if (!roomsEnabled) {
    return {
      matches: [],
      roomDetection: null,
      exactZoneCount: { status: "not-applicable" },
      medianRoomIoU: { status: "not-applicable" },
      computedPredictedTotalAreaM2,
      totalAreaAbsolutePercentageError: { status: "not-applicable" },
      roomAreaMedianAbsolutePercentageError: { status: "not-applicable" },
      roomAreaMedianAbsoluteErrorM2: { status: "not-applicable" },
    };
  }

  const predictionIds = new Set<string>();
  for (const prediction of input.predictions) {
    if (predictionIds.has(prediction.id)) throw new Error("Room predictions должны иметь уникальные IDs.");
    predictionIds.add(prediction.id);
  }

  const pairIou = new Map<string, number>();
  const edges: AssignmentEdge[] = [];
  for (let expectedIndex = 0; expectedIndex < input.fixture.expectedRooms.length; expectedIndex += 1) {
    const expected = input.fixture.expectedRooms[expectedIndex]!;
    for (let predictedIndex = 0; predictedIndex < input.predictions.length; predictedIndex += 1) {
      const prediction = input.predictions[predictedIndex]!;
      const iou = rasterRoomIoU(expected.polygonMm, prediction.polygonMm);
      pairIou.set(`${expectedIndex}:${predictedIndex}`, iou);
      if (iou >= input.fixture.tolerances.roomMinimumIoU) {
        edges.push({
          leftIndex: expectedIndex,
          rightIndex: predictedIndex,
          costKey: [1 - iou],
          tieKey: `${expected.id}|${stablePolygonKey(prediction.polygonMm)}`,
        });
      }
    }
  }
  const assignments = solveOptimalAssignment({
    leftCount: input.fixture.expectedRooms.length,
    rightCount: input.predictions.length,
    edges,
  });
  const matches = assignments.map(({ leftIndex, rightIndex }): RoomMatch => {
    const expected = input.fixture.expectedRooms[leftIndex]!;
    const prediction = input.predictions[rightIndex]!;
    const iou = pairIou.get(`${leftIndex}:${rightIndex}`);
    if (iou === undefined) throw new Error("Room assignment не имеет IoU evidence.");
    const expectedAreaM2 = expected.statedAreaM2 ?? expected.computedAreaM2;
    const predictedComputedAreaM2 = polygonAreaM2(prediction.polygonMm);
    const absoluteAreaErrorM2 = Math.abs(predictedComputedAreaM2 - expectedAreaM2);
    return {
      expectedRoomId: expected.id,
      predictedIndex: rightIndex,
      iou,
      expectedAreaM2,
      predictedComputedAreaM2: roundMetric(predictedComputedAreaM2),
      predictedStatedAreaM2: prediction.statedAreaM2,
      absoluteAreaErrorM2: roundMetric(absoluteAreaErrorM2),
      absoluteAreaPercentageError: roundMetric(absoluteAreaErrorM2 / expectedAreaM2),
    };
  }).sort((first, second) => first.expectedRoomId.localeCompare(second.expectedRoomId) || first.predictedIndex - second.predictedIndex);

  const roomDetection = countMetric(
    matches.length,
    input.predictions.length - matches.length,
    input.fixture.expectedRooms.length - matches.length,
  );
  const expectedTotalAreaM2 = input.fixture.statedTotalAreaM2;
  const totalAreaError = input.fixture.metricApplicability.totalArea && expectedTotalAreaM2 !== null
    ? Math.abs(computedPredictedTotalAreaM2 - expectedTotalAreaM2) / expectedTotalAreaM2
    : null;
  const roomAreaPercentErrors = input.fixture.metricApplicability.roomAreas
    ? matches.map((match) => match.absoluteAreaPercentageError)
    : [];
  const roomAreaAbsoluteErrors = input.fixture.metricApplicability.roomAreas
    ? matches.map((match) => match.absoluteAreaErrorM2)
    : [];

  return {
    matches,
    roomDetection,
    exactZoneCount: { status: "measured", value: input.predictions.length === input.fixture.expectedRooms.length ? 1 : 0 },
    medianRoomIoU: measuredOrNotApplicable(median(matches.map((match) => match.iou))),
    computedPredictedTotalAreaM2,
    totalAreaAbsolutePercentageError: measuredOrNotApplicable(totalAreaError),
    roomAreaMedianAbsolutePercentageError: measuredOrNotApplicable(median(roomAreaPercentErrors)),
    roomAreaMedianAbsoluteErrorM2: measuredOrNotApplicable(median(roomAreaAbsoluteErrors)),
  };
}
