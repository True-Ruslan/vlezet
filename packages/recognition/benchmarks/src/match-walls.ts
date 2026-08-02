import type { RecognitionWallCandidate } from "../../src/model";
import type { RecognitionBenchmarkFixtureV1, BenchmarkPointMm, BenchmarkWallV1 } from "../schema/fixture-v1";
import type { BenchmarkCountMetric } from "../schema/result-v1";
import { normalizedPointToReferenceMm, stableSegmentKey } from "./coordinates";
import { solveOptimalAssignment, type AssignmentEdge } from "./optimal-assignment";

export type WallMatch = Readonly<{
  expectedWallId: string;
  predictedIndex: number;
  endpointDistanceMm: number;
  orientationDeltaDeg: number;
  overlapRatio: number;
  relativeLengthError: number;
}>;

export type WallMatchResult = Readonly<{
  matches: readonly WallMatch[];
  unmatchedExpectedWallIds: readonly string[];
  unmatchedPredictedIndices: readonly number[];
  metrics: BenchmarkCountMetric;
  duplicatePredictionCount: number;
}>;

type SegmentMm = Readonly<{
  start: BenchmarkPointMm;
  end: BenchmarkPointMm;
  length: number;
  tangent: BenchmarkPointMm;
}>;

type PairMeasurement = Readonly<{
  expectedIndex: number;
  predictedIndex: number;
  expectedWallId: string;
  endpointDistanceMm: number;
  orientationDeltaDeg: number;
  overlapRatio: number;
  relativeLengthError: number;
  predictedKey: string;
  admissible: boolean;
}>;

function finiteSegment(start: BenchmarkPointMm, end: BenchmarkPointMm, label: string): SegmentMm {
  const values = [start.x, start.y, end.x, end.y];
  if (values.some((value) => !Number.isFinite(value))) throw new Error(`${label} содержит неконечные координаты.`);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0) throw new Error(`${label} имеет нулевую длину.`);
  return { start, end, length, tangent: { x: dx / length, y: dy / length } };
}

function distance(first: BenchmarkPointMm, second: BenchmarkPointMm): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function dot(point: BenchmarkPointMm, axis: BenchmarkPointMm): number {
  return point.x * axis.x + point.y * axis.y;
}

function relative(point: BenchmarkPointMm, origin: BenchmarkPointMm): BenchmarkPointMm {
  return { x: point.x - origin.x, y: point.y - origin.y };
}

function endpointDistance(expected: SegmentMm, predicted: SegmentMm): number {
  const direct = (distance(expected.start, predicted.start) + distance(expected.end, predicted.end)) / 2;
  const reverse = (distance(expected.start, predicted.end) + distance(expected.end, predicted.start)) / 2;
  return Math.min(direct, reverse);
}

function segmentOrientationDeg(segment: SegmentMm): number {
  return ((Math.atan2(segment.tangent.y, segment.tangent.x) * 180 / Math.PI) + 180) % 180;
}

function orientationDelta(expected: SegmentMm, predicted: SegmentMm): number {
  const raw = Math.abs(segmentOrientationDeg(expected) - segmentOrientationDeg(predicted)) % 180;
  return Math.min(raw, 180 - raw);
}

function projectedOverlapRatio(expected: SegmentMm, predicted: SegmentMm): number {
  const first = dot(relative(predicted.start, expected.start), expected.tangent);
  const second = dot(relative(predicted.end, expected.start), expected.tangent);
  const predictedMinimum = Math.min(first, second);
  const predictedMaximum = Math.max(first, second);
  const overlap = Math.max(0, Math.min(expected.length, predictedMaximum) - Math.max(0, predictedMinimum));
  return overlap / Math.min(expected.length, predicted.length);
}

function predictionSegment(
  prediction: RecognitionWallCandidate,
  fixture: RecognitionBenchmarkFixtureV1,
  index: number,
): SegmentMm {
  return finiteSegment(
    normalizedPointToReferenceMm(prediction.start, fixture.calibration),
    normalizedPointToReferenceMm(prediction.end, fixture.calibration),
    `Предсказанная стена ${index + 1}`,
  );
}

function expectedSegment(wall: BenchmarkWallV1): SegmentMm {
  return finiteSegment(wall.startMm, wall.endMm, `Ожидаемая стена ${wall.id}`);
}

function measurePair(
  expectedWall: BenchmarkWallV1,
  expected: SegmentMm,
  predicted: SegmentMm,
  expectedIndex: number,
  predictedIndex: number,
  fixture: RecognitionBenchmarkFixtureV1,
): PairMeasurement {
  const endpointDistanceMm = endpointDistance(expected, predicted);
  const orientationDeltaDeg = orientationDelta(expected, predicted);
  const overlapRatio = projectedOverlapRatio(expected, predicted);
  const relativeLengthError = Math.abs(predicted.length - expected.length) / expected.length;
  const tolerances = fixture.tolerances;
  return {
    expectedIndex,
    predictedIndex,
    expectedWallId: expectedWall.id,
    endpointDistanceMm,
    orientationDeltaDeg,
    overlapRatio,
    relativeLengthError,
    predictedKey: stableSegmentKey(predicted.start, predicted.end),
    admissible:
      endpointDistanceMm <= tolerances.wallEndpointMm
      && orientationDeltaDeg <= tolerances.wallOrientationDeg
      && overlapRatio >= tolerances.wallMinimumOverlapRatio
      && relativeLengthError <= tolerances.wallLengthRelativeError,
  };
}

function countMetric(truePositive: number, falsePositive: number, falseNegative: number): BenchmarkCountMetric {
  const precisionDenominator = truePositive + falsePositive;
  const recallDenominator = truePositive + falseNegative;
  const precision = precisionDenominator === 0 ? (falseNegative === 0 ? 1 : 0) : truePositive / precisionDenominator;
  const recall = recallDenominator === 0 ? 1 : truePositive / recallDenominator;
  const f1 = precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall);
  return { truePositive, falsePositive, falseNegative, precision, recall, f1 };
}

export function matchWalls(input: Readonly<{
  fixture: RecognitionBenchmarkFixtureV1;
  predictions: readonly RecognitionWallCandidate[];
}>): WallMatchResult {
  const expectedSegments = input.fixture.expectedWalls.map(expectedSegment);
  const predictedSegments = input.predictions.map((prediction, index) => predictionSegment(prediction, input.fixture, index));
  const measurements: PairMeasurement[] = [];

  for (let expectedIndex = 0; expectedIndex < expectedSegments.length; expectedIndex += 1) {
    for (let predictedIndex = 0; predictedIndex < predictedSegments.length; predictedIndex += 1) {
      measurements.push(measurePair(
        input.fixture.expectedWalls[expectedIndex]!,
        expectedSegments[expectedIndex]!,
        predictedSegments[predictedIndex]!,
        expectedIndex,
        predictedIndex,
        input.fixture,
      ));
    }
  }

  const admissible = measurements.filter((measurement) => measurement.admissible);
  const assignmentEdges: AssignmentEdge[] = admissible.map((measurement) => ({
    leftIndex: measurement.expectedIndex,
    rightIndex: measurement.predictedIndex,
    costKey: [
      measurement.endpointDistanceMm,
      measurement.orientationDeltaDeg,
      1 - measurement.overlapRatio,
      measurement.relativeLengthError,
    ],
    tieKey: `${measurement.expectedWallId}|${measurement.predictedKey}`,
  }));
  const assignments = solveOptimalAssignment({
    leftCount: expectedSegments.length,
    rightCount: predictedSegments.length,
    edges: assignmentEdges,
  });

  const byPair = new Map(measurements.map((measurement) => [
    `${measurement.expectedIndex}:${measurement.predictedIndex}`,
    measurement,
  ]));
  const matches = assignments.map(({ leftIndex, rightIndex }): WallMatch => {
    const measurement = byPair.get(`${leftIndex}:${rightIndex}`);
    if (!measurement?.admissible) throw new Error("Assignment ссылается на недопустимую пару стен.");
    return {
      expectedWallId: measurement.expectedWallId,
      predictedIndex: rightIndex,
      endpointDistanceMm: measurement.endpointDistanceMm,
      orientationDeltaDeg: measurement.orientationDeltaDeg,
      overlapRatio: measurement.overlapRatio,
      relativeLengthError: measurement.relativeLengthError,
    };
  }).sort((first, second) => first.expectedWallId.localeCompare(second.expectedWallId) || first.predictedIndex - second.predictedIndex);

  const matchedExpected = new Set(assignments.map((assignment) => assignment.leftIndex));
  const matchedPredicted = new Set(assignments.map((assignment) => assignment.rightIndex));
  const unmatchedExpectedWallIds = input.fixture.expectedWalls
    .filter((_wall, index) => !matchedExpected.has(index))
    .map((wall) => wall.id)
    .sort((first, second) => first.localeCompare(second));
  const unmatchedPredictedIndices = input.predictions
    .map((_prediction, index) => index)
    .filter((index) => !matchedPredicted.has(index));
  const matchedExpectedByIndex = new Set(assignments.map((assignment) => assignment.leftIndex));
  const duplicatePredictionCount = unmatchedPredictedIndices.filter((predictedIndex) =>
    admissible.some((measurement) => measurement.predictedIndex === predictedIndex && matchedExpectedByIndex.has(measurement.expectedIndex)),
  ).length;

  return {
    matches,
    unmatchedExpectedWallIds,
    unmatchedPredictedIndices,
    metrics: countMetric(matches.length, unmatchedPredictedIndices.length, unmatchedExpectedWallIds.length),
    duplicatePredictionCount,
  };
}
