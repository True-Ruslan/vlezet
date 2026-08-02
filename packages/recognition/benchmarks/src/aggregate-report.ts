import type {
  BenchmarkCountMetric,
  BenchmarkMetricValue,
  RecognitionAggregateResultV1,
  RecognitionFixtureResultV1,
} from "../schema/result-v1";

function measured(value: number): BenchmarkMetricValue {
  return { status: "measured", value: Number(value.toFixed(12)) };
}

function notApplicable(): BenchmarkMetricValue {
  return { status: "not-applicable" };
}

function countMetric(truePositive: number, falsePositive: number, falseNegative: number): BenchmarkCountMetric {
  const precisionDenominator = truePositive + falsePositive;
  const recallDenominator = truePositive + falseNegative;
  const precision = precisionDenominator === 0 ? (falseNegative === 0 ? 1 : 0) : truePositive / precisionDenominator;
  const recall = recallDenominator === 0 ? 1 : truePositive / recallDenominator;
  const f1 = precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall);
  return { truePositive, falsePositive, falseNegative, precision, recall, f1 };
}

function aggregateCounts(values: readonly (BenchmarkCountMetric | null)[]): BenchmarkMetricValue {
  const applicable = values.filter((value): value is BenchmarkCountMetric => value !== null);
  if (applicable.length === 0) return notApplicable();
  const totals = applicable.reduce((sum, value) => ({
    truePositive: sum.truePositive + value.truePositive,
    falsePositive: sum.falsePositive + value.falsePositive,
    falseNegative: sum.falseNegative + value.falseNegative,
  }), { truePositive: 0, falsePositive: 0, falseNegative: 0 });
  return measured(countMetric(totals.truePositive, totals.falsePositive, totals.falseNegative).f1);
}

function median(values: readonly number[]): BenchmarkMetricValue {
  if (values.length === 0) return notApplicable();
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
  return measured(value);
}

function measuredValues(fixtures: readonly RecognitionFixtureResultV1[], key: keyof RecognitionFixtureResultV1["metrics"]): number[] {
  return fixtures.flatMap((fixture) => {
    const value = fixture.metrics[key];
    return value.status === "measured" ? [value.value] : [];
  });
}

export function aggregateRecognitionResults(fixtures: readonly RecognitionFixtureResultV1[]): RecognitionAggregateResultV1 {
  const highConfidencePredictionCount = fixtures.reduce((sum, fixture) => sum + fixture.evidence.highConfidencePredictionCount, 0);
  const highConfidenceFalsePositiveCount = fixtures.reduce((sum, fixture) => sum + fixture.evidence.highConfidenceFalsePositiveCount, 0);
  const exactZoneValues = measuredValues(fixtures, "exactZoneCount");
  return {
    fixtureCount: fixtures.length,
    failedFixtureCount: fixtures.filter((fixture) => fixture.failed).length,
    metrics: {
      wallGeometryF1: aggregateCounts(fixtures.map((fixture) => fixture.evidence.wallGeometry)),
      wallTopologyF1: aggregateCounts(fixtures.map((fixture) => fixture.evidence.wallTopology)),
      openingF1: aggregateCounts(fixtures.map((fixture) => fixture.evidence.openings)),
      exactZoneCountRate: exactZoneValues.length === 0
        ? notApplicable()
        : measured(exactZoneValues.reduce((sum, value) => sum + value, 0) / exactZoneValues.length),
      totalAreaMedianAbsolutePercentageError: median(fixtures.flatMap((fixture) => fixture.evidence.totalAreaAbsolutePercentageErrors)),
      roomAreaMedianAbsolutePercentageError: median(fixtures.flatMap((fixture) => fixture.evidence.roomAreaAbsolutePercentageErrors)),
      incorrectHighConfidenceRate: highConfidencePredictionCount === 0
        ? measured(0)
        : measured(highConfidenceFalsePositiveCount / highConfidencePredictionCount),
      unknownHostOpenings: measured(fixtures.reduce((sum, fixture) => sum + fixture.evidence.unknownHostOpenings, 0)),
      staleDecisions: measured(fixtures.reduce((sum, fixture) => sum + fixture.evidence.staleDecisions, 0)),
    },
  };
}
