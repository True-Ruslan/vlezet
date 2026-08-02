import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "../../src/model";
import type { RecognitionBenchmarkFixtureV1 } from "../schema/fixture-v1";
import type {
  BenchmarkCountMetric,
  BenchmarkMetricValue,
  RecognitionFixtureEvidenceV1,
  RecognitionFixtureResultV1,
} from "../schema/result-v1";
import { matchOpenings } from "./match-openings";
import { matchWalls } from "./match-walls";
import { scoreConfidence } from "./score-confidence";
import { scoreReconciliation } from "./score-reconciliation";
import { scoreRooms, type BenchmarkRoomPredictionV1 } from "./score-rooms";
import { scoreWallTopology } from "./score-wall-topology";

export type RecognitionFixtureScoringInput = Readonly<{
  fixture: RecognitionBenchmarkFixtureV1;
  wallPredictions: readonly RecognitionWallCandidate[];
  openingPredictions: readonly RecognitionOpeningCandidate[];
  roomPredictions: readonly BenchmarkRoomPredictionV1[];
  reconciliationSnapshot: unknown;
  failure: Error | string | null;
}>;

function measured(value: number): BenchmarkMetricValue {
  return { status: "measured", value: Number(value.toFixed(12)) };
}

function notApplicable(): BenchmarkMetricValue {
  return { status: "not-applicable" };
}

function zeroCount(falseNegative: number): BenchmarkCountMetric {
  return {
    truePositive: 0,
    falsePositive: 0,
    falseNegative,
    precision: falseNegative === 0 ? 1 : 0,
    recall: falseNegative === 0 ? 1 : 0,
    f1: falseNegative === 0 ? 1 : 0,
  };
}

function failedResult(input: RecognitionFixtureScoringInput): RecognitionFixtureResultV1 {
  const { fixture } = input;
  const wallGeometry = fixture.metricApplicability.wallGeometry ? zeroCount(fixture.expectedWalls.length) : null;
  const wallTopology = fixture.metricApplicability.wallTopology ? zeroCount(fixture.expectedWalls.length) : null;
  const openings = fixture.metricApplicability.openings ? zeroCount(fixture.expectedOpenings.length) : null;
  const roomDetection = fixture.metricApplicability.rooms ? zeroCount(fixture.expectedRooms.length) : null;
  const diagnostics = [input.failure instanceof Error ? input.failure.message : String(input.failure ?? "fixture failed")];
  return {
    fixtureId: fixture.id,
    failed: true,
    diagnostics,
    metrics: {
      wallGeometryF1: wallGeometry ? measured(wallGeometry.f1) : notApplicable(),
      wallTopologyF1: wallTopology ? measured(wallTopology.f1) : notApplicable(),
      openingF1: openings ? measured(openings.f1) : notApplicable(),
      exactZoneCount: roomDetection ? measured(0) : notApplicable(),
      totalAreaAbsolutePercentageError: notApplicable(),
      roomAreaMedianAbsolutePercentageError: notApplicable(),
      incorrectHighConfidenceRate: fixture.metricApplicability.confidence ? measured(0) : notApplicable(),
      unknownHostOpenings: fixture.metricApplicability.openings ? measured(0) : notApplicable(),
      staleDecisions: measured(0),
    },
    evidence: {
      wallGeometry,
      wallTopology,
      openings,
      roomDetection,
      roomIous: [],
      totalAreaAbsolutePercentageErrors: [],
      roomAreaAbsolutePercentageErrors: [],
      highConfidencePredictionCount: 0,
      highConfidenceFalsePositiveCount: 0,
      unknownHostOpenings: 0,
      staleDecisions: 0,
    },
  };
}

export function scoreRecognitionFixture(input: RecognitionFixtureScoringInput): RecognitionFixtureResultV1 {
  if (input.failure) return failedResult(input);

  const wallMatches = matchWalls({ fixture: input.fixture, predictions: input.wallPredictions });
  const wallTopology = input.fixture.metricApplicability.wallTopology
    ? scoreWallTopology({ fixture: input.fixture, predictions: input.wallPredictions })
    : null;
  const openingMatches = input.fixture.metricApplicability.openings
    ? matchOpenings({
        fixture: input.fixture,
        predictions: input.openingPredictions,
        wallPredictions: input.wallPredictions,
        wallMatches,
      })
    : null;
  const roomScore = scoreRooms({ fixture: input.fixture, predictions: input.roomPredictions });

  const matchedPredictionKeys = new Set<string>([
    ...wallMatches.matches.map((match) => `wall:${match.predictedIndex}`),
    ...(openingMatches?.matches.map((match) => `opening:${match.predictedIndex}`) ?? []),
    ...roomScore.matches.map((match) => `room:${match.predictedIndex}`),
  ]);
  const confidence = scoreConfidence({
    matchedPredictionKeys,
    predictions: [
      ...input.wallPredictions.map((prediction, index) => ({ key: `wall:${index}`, confidence: prediction.confidence })),
      ...input.openingPredictions.map((prediction, index) => ({ key: `opening:${index}`, confidence: prediction.confidence })),
      ...input.roomPredictions.map((prediction, index) => ({ key: `room:${index}`, confidence: prediction.confidence })),
    ],
  });
  const reconciliation = scoreReconciliation(input.reconciliationSnapshot);
  const diagnostics: string[] = [];
  if (reconciliation.staleDecisionCount > 0) diagnostics.push(`stale-decisions:${reconciliation.staleDecisionCount}`);
  if (reconciliation.missingPendingDecisionCount > 0) diagnostics.push(`missing-decisions:${reconciliation.missingPendingDecisionCount}`);
  if (reconciliation.duplicateCandidateIdCount > 0) diagnostics.push(`duplicate-candidate-ids:${reconciliation.duplicateCandidateIdCount}`);
  if (reconciliation.unknownDiagnosticReferenceCount > 0) diagnostics.push(`unknown-diagnostic-references:${reconciliation.unknownDiagnosticReferenceCount}`);
  if (reconciliation.malformedDecisionCount > 0) diagnostics.push(`malformed-decisions:${reconciliation.malformedDecisionCount}`);
  for (const unknown of openingMatches?.unknownHostOpenings ?? []) {
    const host = unknown.hostWallCandidateId === null
      ? null
      : input.wallPredictions.find((wall) => wall.id === unknown.hostWallCandidateId) ?? null;
    diagnostics.push([
      "unknown-host-opening",
      unknown.openingId,
      unknown.hostWallCandidateId ?? "null",
      host ? `${host.start.x},${host.start.y}->${host.end.x},${host.end.y}` : "missing-host-candidate",
      host?.confidence ?? "unknown-confidence",
      host?.evidence.reasons.join("+") ?? "unknown-evidence",
    ].join(":"));
  }

  const evidence: RecognitionFixtureEvidenceV1 = {
    wallGeometry: input.fixture.metricApplicability.wallGeometry ? wallMatches.metrics : null,
    wallTopology: wallTopology?.edges ?? null,
    openings: openingMatches?.combined ?? null,
    roomDetection: roomScore.roomDetection,
    roomIous: roomScore.matches.map((match) => match.iou),
    totalAreaAbsolutePercentageErrors: roomScore.totalAreaAbsolutePercentageError.status === "measured"
      ? [roomScore.totalAreaAbsolutePercentageError.value]
      : [],
    roomAreaAbsolutePercentageErrors: roomScore.matches.map((match) => match.absoluteAreaPercentageError),
    highConfidencePredictionCount: confidence.highConfidenceTruePositiveCount + confidence.highConfidenceFalsePositiveCount,
    highConfidenceFalsePositiveCount: confidence.highConfidenceFalsePositiveCount,
    unknownHostOpenings: openingMatches?.unknownHostOpeningCount ?? 0,
    staleDecisions: reconciliation.staleDecisionCount,
  };

  return {
    fixtureId: input.fixture.id,
    failed: false,
    diagnostics,
    metrics: {
      wallGeometryF1: input.fixture.metricApplicability.wallGeometry ? measured(wallMatches.metrics.f1) : notApplicable(),
      wallTopologyF1: wallTopology ? measured(wallTopology.topologyF1) : notApplicable(),
      openingF1: openingMatches ? measured(openingMatches.combined.f1) : notApplicable(),
      exactZoneCount: roomScore.exactZoneCount,
      totalAreaAbsolutePercentageError: roomScore.totalAreaAbsolutePercentageError,
      roomAreaMedianAbsolutePercentageError: roomScore.roomAreaMedianAbsolutePercentageError,
      incorrectHighConfidenceRate: input.fixture.metricApplicability.confidence
        ? measured(confidence.incorrectHighConfidenceRate)
        : notApplicable(),
      unknownHostOpenings: openingMatches ? measured(openingMatches.unknownHostOpeningCount) : notApplicable(),
      staleDecisions: measured(reconciliation.staleDecisionCount),
    },
    evidence,
  };
}
