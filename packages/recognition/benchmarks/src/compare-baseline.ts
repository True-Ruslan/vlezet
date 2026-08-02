import type {
  BenchmarkMetricValue,
  RecognitionBaselineComparisonV1,
  RecognitionBaselineMetricComparisonV1,
  RecognitionBenchmarkResultV1,
} from "../schema/result-v1";

const METRICS = [
  "wallGeometryF1",
  "wallTopologyF1",
  "openingF1",
  "exactZoneCountRate",
  "totalAreaMedianAbsolutePercentageError",
  "roomAreaMedianAbsolutePercentageError",
  "incorrectHighConfidenceRate",
  "unknownHostOpenings",
  "staleDecisions",
] as const;

type AggregateMetricName = (typeof METRICS)[number];

const LOWER_IS_BETTER = new Set<AggregateMetricName>([
  "totalAreaMedianAbsolutePercentageError",
  "roomAreaMedianAbsolutePercentageError",
  "incorrectHighConfidenceRate",
  "unknownHostOpenings",
  "staleDecisions",
]);
const EPSILON = 1e-12;

function fixtureIds(result: RecognitionBenchmarkResultV1): readonly string[] {
  return result.fixtures.map((fixture) => fixture.fixtureId).sort((first, second) => first.localeCompare(second));
}

function measured(value: BenchmarkMetricValue, metric: string, side: string): number {
  if (value.status !== "measured") throw new Error(`${side} metric ${metric} is not measured.`);
  if (!Number.isFinite(value.value)) throw new Error(`${side} metric ${metric} is non-finite.`);
  return value.value;
}

function comparison(
  metric: AggregateMetricName,
  currentValue: number,
  baselineValue: number,
): RecognitionBaselineMetricComparisonV1 {
  const absoluteDelta = currentValue - baselineValue;
  const signedImprovement = LOWER_IS_BETTER.has(metric) ? -absoluteDelta : absoluteDelta;
  const status = signedImprovement > EPSILON
    ? "improvement"
    : signedImprovement < -EPSILON
      ? "regression"
      : "unchanged";
  return {
    metric,
    baseline: baselineValue,
    current: currentValue,
    absoluteDelta,
    relativeDelta: baselineValue === 0 ? null : absoluteDelta / Math.abs(baselineValue),
    status,
  };
}

function compareMetric(
  metric: AggregateMetricName,
  currentValue: BenchmarkMetricValue,
  baselineValue: BenchmarkMetricValue,
): RecognitionBaselineMetricComparisonV1 | null {
  if (currentValue.status === "not-applicable" && baselineValue.status === "not-applicable") return null;
  if (currentValue.status !== baselineValue.status) {
    throw new Error(`Recognition benchmark metric applicability changed for ${metric}; explicit baseline migration required.`);
  }
  return comparison(
    metric,
    measured(currentValue, metric, "current"),
    measured(baselineValue, metric, "baseline"),
  );
}

export function compareRecognitionBaseline(
  current: RecognitionBenchmarkResultV1,
  baseline: RecognitionBenchmarkResultV1,
): RecognitionBaselineComparisonV1 {
  if (current.schemaVersion !== "recognition-benchmark-result-v1" || baseline.schemaVersion !== "recognition-benchmark-result-v1") {
    throw new Error("Benchmark result schema mismatch; explicit schema migration required.");
  }
  if (current.corpusVersion !== baseline.corpusVersion) {
    throw new Error("Benchmark corpus version mismatch; explicit corpus migration required.");
  }
  if (baseline.commitSha === "0".repeat(40)) throw new Error("Baseline uses an uncommitted all-zero marker.");
  const currentFixtures = fixtureIds(current);
  const baselineFixtures = fixtureIds(baseline);
  if (currentFixtures.join("\n") !== baselineFixtures.join("\n")) {
    throw new Error("Benchmark fixture set changed; explicit corpus migration required.");
  }

  const metrics = METRICS
    .map((metric) => compareMetric(metric, current.aggregate.metrics[metric], baseline.aggregate.metrics[metric]))
    .filter((entry): entry is RecognitionBaselineMetricComparisonV1 => entry !== null);
  const regressions = metrics.filter((entry) => entry.status === "regression");
  if (regressions.length > 0) {
    throw new Error(`Recognition benchmark regression: ${regressions.map((entry) => entry.metric).join(", ")}.`);
  }
  return { baselineSourceSha: baseline.commitSha, metrics };
}
