import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "../../src/model";
import type { BenchmarkOpeningV1, RecognitionBenchmarkFixtureV1 } from "../schema/fixture-v1";
import type { BenchmarkCountMetric, BenchmarkMetricValue } from "../schema/result-v1";
import { normalizedPointToReferenceMm, stablePointKey } from "./coordinates";
import type { WallMatchResult } from "./match-walls";
import { solveOptimalAssignment, type AssignmentEdge } from "./optimal-assignment";

export type OpeningMatch = Readonly<{
  expectedOpeningId: string;
  predictedIndex: number;
  centerErrorMm: number;
  widthErrorMm: number;
}>;

export type OpeningMatchResult = Readonly<{
  matches: readonly OpeningMatch[];
  combined: BenchmarkCountMetric;
  doors: BenchmarkCountMetric;
  windows: BenchmarkCountMetric;
  hostWallAccuracy: BenchmarkMetricValue;
  unknownHostOpeningCount: number;
  duplicateOpeningCount: number;
}>;

type PairMeasurement = Readonly<{
  expectedIndex: number;
  predictedIndex: number;
  expectedOpeningId: string;
  expectedKind: "door" | "window";
  centerErrorMm: number;
  widthErrorMm: number;
  resolvedHostWallId: string | null;
  expectedHostWallId: string;
  geometryAndTypeAdmissible: boolean;
  fullyAdmissible: boolean;
  tieKey: string;
}>;

function countMetric(truePositive: number, falsePositive: number, falseNegative: number): BenchmarkCountMetric {
  const precisionDenominator = truePositive + falsePositive;
  const recallDenominator = truePositive + falseNegative;
  const precision = precisionDenominator === 0 ? (falseNegative === 0 ? 1 : 0) : truePositive / precisionDenominator;
  const recall = recallDenominator === 0 ? 1 : truePositive / recallDenominator;
  const f1 = precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall);
  return { truePositive, falsePositive, falseNegative, precision, recall, f1 };
}

function predictionWidthMm(prediction: RecognitionOpeningCandidate, fixture: RecognitionBenchmarkFixtureV1): number | null {
  if (prediction.widthPx === null || !Number.isFinite(prediction.widthPx) || prediction.widthPx <= 0) return null;
  return prediction.widthPx * fixture.calibration.millimetersPerPixel;
}

function wallHostResolution(input: Readonly<{
  wallPredictions: readonly RecognitionWallCandidate[];
  wallMatches: WallMatchResult;
}>): ReadonlyMap<string, string> {
  const ids = new Set<string>();
  for (const prediction of input.wallPredictions) {
    if (!prediction.id.trim() || ids.has(prediction.id)) throw new Error("Wall predictions должны иметь уникальные непустые IDs.");
    ids.add(prediction.id);
  }
  const result = new Map<string, string>();
  for (const match of input.wallMatches.matches) {
    const prediction = input.wallPredictions[match.predictedIndex];
    if (!prediction) throw new Error(`Wall match ссылается на отсутствующий predictedIndex ${match.predictedIndex}.`);
    result.set(prediction.id, match.expectedWallId);
  }
  return result;
}

function measurePair(
  expected: BenchmarkOpeningV1,
  prediction: RecognitionOpeningCandidate,
  expectedIndex: number,
  predictedIndex: number,
  fixture: RecognitionBenchmarkFixtureV1,
  resolvedHostWallId: string | null,
): PairMeasurement {
  const centerMm = normalizedPointToReferenceMm(prediction.center, fixture.calibration);
  const centerErrorMm = Math.hypot(centerMm.x - expected.centerMm.x, centerMm.y - expected.centerMm.y);
  const widthMm = predictionWidthMm(prediction, fixture);
  const widthErrorMm = widthMm === null ? Number.POSITIVE_INFINITY : Math.abs(widthMm - expected.widthMm);
  const kindMatches = prediction.kind === expected.kind;
  const geometryAndTypeAdmissible = kindMatches
    && centerErrorMm <= fixture.tolerances.openingCenterMm
    && widthErrorMm <= fixture.tolerances.openingWidthMm;
  const fullyAdmissible = geometryAndTypeAdmissible && resolvedHostWallId === expected.hostWallId;
  return {
    expectedIndex,
    predictedIndex,
    expectedOpeningId: expected.id,
    expectedKind: expected.kind,
    centerErrorMm,
    widthErrorMm,
    resolvedHostWallId,
    expectedHostWallId: expected.hostWallId,
    geometryAndTypeAdmissible,
    fullyAdmissible,
    tieKey: `${expected.id}|${prediction.kind}|${stablePointKey(centerMm)}|${widthMm ?? "unknown"}|${resolvedHostWallId ?? "unknown"}`,
  };
}

function assignmentEdges(measurements: readonly PairMeasurement[], mode: "geometry" | "full"): AssignmentEdge[] {
  return measurements
    .filter((measurement) => mode === "full" ? measurement.fullyAdmissible : measurement.geometryAndTypeAdmissible)
    .map((measurement) => ({
      leftIndex: measurement.expectedIndex,
      rightIndex: measurement.predictedIndex,
      costKey: [measurement.centerErrorMm, measurement.widthErrorMm],
      tieKey: measurement.tieKey,
    }));
}

function typedMetric(
  kind: "door" | "window",
  fixture: RecognitionBenchmarkFixtureV1,
  predictions: readonly RecognitionOpeningCandidate[],
  matches: readonly OpeningMatch[],
): BenchmarkCountMetric {
  const expectedCount = fixture.expectedOpenings.filter((opening) => opening.kind === kind).length;
  const predictedCount = predictions.filter((opening) => opening.kind === kind).length;
  const expectedKindById = new Map(fixture.expectedOpenings.map((opening) => [opening.id, opening.kind]));
  const truePositive = matches.filter((match) => expectedKindById.get(match.expectedOpeningId) === kind).length;
  return countMetric(truePositive, predictedCount - truePositive, expectedCount - truePositive);
}

export function matchOpenings(input: Readonly<{
  fixture: RecognitionBenchmarkFixtureV1;
  predictions: readonly RecognitionOpeningCandidate[];
  wallPredictions: readonly RecognitionWallCandidate[];
  wallMatches: WallMatchResult;
}>): OpeningMatchResult {
  const resolvedWalls = wallHostResolution(input);
  const measurements: PairMeasurement[] = [];
  for (let expectedIndex = 0; expectedIndex < input.fixture.expectedOpenings.length; expectedIndex += 1) {
    for (let predictedIndex = 0; predictedIndex < input.predictions.length; predictedIndex += 1) {
      const prediction = input.predictions[predictedIndex]!;
      const resolvedHostWallId = prediction.hostWallCandidateId === null
        ? null
        : resolvedWalls.get(prediction.hostWallCandidateId) ?? null;
      measurements.push(measurePair(
        input.fixture.expectedOpenings[expectedIndex]!,
        prediction,
        expectedIndex,
        predictedIndex,
        input.fixture,
        resolvedHostWallId,
      ));
    }
  }

  const assignments = solveOptimalAssignment({
    leftCount: input.fixture.expectedOpenings.length,
    rightCount: input.predictions.length,
    edges: assignmentEdges(measurements, "full"),
  });
  const byPair = new Map(measurements.map((measurement) => [`${measurement.expectedIndex}:${measurement.predictedIndex}`, measurement]));
  const matches = assignments.map(({ leftIndex, rightIndex }): OpeningMatch => {
    const measurement = byPair.get(`${leftIndex}:${rightIndex}`);
    if (!measurement?.fullyAdmissible) throw new Error("Opening assignment ссылается на недопустимую пару.");
    return {
      expectedOpeningId: measurement.expectedOpeningId,
      predictedIndex: rightIndex,
      centerErrorMm: measurement.centerErrorMm,
      widthErrorMm: measurement.widthErrorMm,
    };
  }).sort((first, second) => first.expectedOpeningId.localeCompare(second.expectedOpeningId) || first.predictedIndex - second.predictedIndex);

  const matchedPredicted = new Set(assignments.map((assignment) => assignment.rightIndex));
  const matchedExpected = new Set(assignments.map((assignment) => assignment.leftIndex));
  const unmatchedPredictedIndices = input.predictions
    .map((_prediction, index) => index)
    .filter((index) => !matchedPredicted.has(index));
  const duplicateOpeningCount = unmatchedPredictedIndices.filter((predictedIndex) =>
    measurements.some((measurement) =>
      measurement.predictedIndex === predictedIndex
      && measurement.fullyAdmissible
      && matchedExpected.has(measurement.expectedIndex),
    ),
  ).length;

  const geometryAssignments = solveOptimalAssignment({
    leftCount: input.fixture.expectedOpenings.length,
    rightCount: input.predictions.length,
    edges: assignmentEdges(measurements, "geometry"),
  });
  const correctHostCount = geometryAssignments.filter(({ leftIndex, rightIndex }) => {
    const measurement = byPair.get(`${leftIndex}:${rightIndex}`);
    return measurement?.resolvedHostWallId === measurement?.expectedHostWallId;
  }).length;
  const hostWallAccuracy: BenchmarkMetricValue = geometryAssignments.length === 0
    ? { status: "not-applicable" }
    : { status: "measured", value: correctHostCount / geometryAssignments.length };

  const unknownHostOpeningCount = input.predictions.filter((prediction) =>
    prediction.hostWallCandidateId === null || !resolvedWalls.has(prediction.hostWallCandidateId),
  ).length;
  const combined = countMetric(
    matches.length,
    input.predictions.length - matches.length,
    input.fixture.expectedOpenings.length - matches.length,
  );

  return {
    matches,
    combined,
    doors: typedMetric("door", input.fixture, input.predictions, matches),
    windows: typedMetric("window", input.fixture, input.predictions, matches),
    hostWallAccuracy,
    unknownHostOpeningCount,
    duplicateOpeningCount,
  };
}
