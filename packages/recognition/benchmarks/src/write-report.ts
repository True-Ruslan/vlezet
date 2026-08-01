import type { BenchmarkMetricValue, RecognitionBenchmarkResultV1 } from "../schema/result-v1";

function formatMetric(metric: BenchmarkMetricValue): string {
  return metric.status === "not-applicable" ? "not applicable" : metric.value.toFixed(6);
}

const AGGREGATE_ROWS = [
  ["Wall geometry F1", "wallGeometryF1"],
  ["Wall topology F1", "wallTopologyF1"],
  ["Opening F1", "openingF1"],
  ["Exact zone-count rate", "exactZoneCountRate"],
  ["Median total-area error", "totalAreaMedianAbsolutePercentageError"],
  ["Median room-area error", "roomAreaMedianAbsolutePercentageError"],
  ["Incorrect high-confidence rate", "incorrectHighConfidenceRate"],
  ["Unknown-host openings", "unknownHostOpenings"],
  ["Stale decisions", "staleDecisions"],
] as const;

export function renderRecognitionBenchmarkMarkdown(result: RecognitionBenchmarkResultV1): string {
  const lines = [
    "# Recognition Benchmark Report",
    "",
    "| Identity | Value |",
    "|---|---:|",
    `| Corpus | \`${result.corpusVersion}\` |`,
    `| Engine | \`${result.recognitionEngineVersion}\` |`,
    `| Commit | \`${result.commitSha}\` |`,
    `| Fixtures | ${result.aggregate.fixtureCount} |`,
    `| Failed fixtures | ${result.aggregate.failedFixtureCount} |`,
    "",
    "## Aggregate metrics",
    "",
    "| Metric | Value |",
    "|---|---:|",
    ...AGGREGATE_ROWS.map(([label, key]) => `| ${label} | ${formatMetric(result.aggregate.metrics[key])} |`),
    "",
    "## Fixtures",
    "",
    "| Fixture | Status | Wall F1 | Topology F1 | Opening F1 | Exact zones | Total-area error | High-confidence error | Unknown hosts |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|",
    ...[...result.fixtures]
      .sort((first, second) => first.fixtureId.localeCompare(second.fixtureId))
      .map((fixture) => `| ${fixture.fixtureId} | ${fixture.failed ? "FAILED" : "PASS"} | ${formatMetric(fixture.metrics.wallGeometryF1)} | ${formatMetric(fixture.metrics.wallTopologyF1)} | ${formatMetric(fixture.metrics.openingF1)} | ${formatMetric(fixture.metrics.exactZoneCount)} | ${formatMetric(fixture.metrics.totalAreaAbsolutePercentageError)} | ${formatMetric(fixture.metrics.incorrectHighConfidenceRate)} | ${formatMetric(fixture.metrics.unknownHostOpenings)} |`),
  ];
  if (result.baselineComparison) {
    lines.push(
      "",
      "## Baseline comparison",
      "",
      `Baseline source: \`${result.baselineComparison.baselineSourceSha}\``,
      "",
      "| Metric | Baseline | Current | Delta | Status |",
      "|---|---:|---:|---:|---|",
      ...result.baselineComparison.metrics.map((metric) => `| ${metric.metric} | ${metric.baseline.toFixed(6)} | ${metric.current.toFixed(6)} | ${metric.absoluteDelta.toFixed(6)} | ${metric.status} |`),
    );
  }
  return `${lines.join("\n")}\n`;
}
