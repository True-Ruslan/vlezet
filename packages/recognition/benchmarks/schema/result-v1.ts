export type BenchmarkMetricValue =
  | Readonly<{ status: "measured"; value: number }>
  | Readonly<{ status: "not-applicable" }>;

export type BenchmarkCountMetric = Readonly<{
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
  f1: number;
}>;

export type RecognitionFixtureMetricsV1 = Readonly<{
  wallGeometryF1: BenchmarkMetricValue;
  wallTopologyF1: BenchmarkMetricValue;
  openingF1: BenchmarkMetricValue;
  exactZoneCount: BenchmarkMetricValue;
  totalAreaAbsolutePercentageError: BenchmarkMetricValue;
  roomAreaMedianAbsolutePercentageError: BenchmarkMetricValue;
  incorrectHighConfidenceRate: BenchmarkMetricValue;
  unknownHostOpenings: BenchmarkMetricValue;
  staleDecisions: BenchmarkMetricValue;
}>;

export type RecognitionAggregateMetricsV1 = Readonly<{
  wallGeometryF1: BenchmarkMetricValue;
  wallTopologyF1: BenchmarkMetricValue;
  openingF1: BenchmarkMetricValue;
  exactZoneCountRate: BenchmarkMetricValue;
  totalAreaMedianAbsolutePercentageError: BenchmarkMetricValue;
  roomAreaMedianAbsolutePercentageError: BenchmarkMetricValue;
  incorrectHighConfidenceRate: BenchmarkMetricValue;
  unknownHostOpenings: BenchmarkMetricValue;
  staleDecisions: BenchmarkMetricValue;
}>;

export type RecognitionFixtureResultV1 = Readonly<{
  fixtureId: string;
  failed: boolean;
  diagnostics: readonly string[];
  metrics: RecognitionFixtureMetricsV1;
}>;

export type RecognitionAggregateResultV1 = Readonly<{
  fixtureCount: number;
  failedFixtureCount: number;
  metrics: RecognitionAggregateMetricsV1;
}>;

export type RecognitionBaselineMetricComparisonV1 = Readonly<{
  metric: string;
  baseline: number;
  current: number;
  absoluteDelta: number;
  relativeDelta: number | null;
  status: "improvement" | "unchanged" | "regression";
}>;

export type RecognitionBaselineComparisonV1 = Readonly<{
  baselineSourceSha: string;
  metrics: readonly RecognitionBaselineMetricComparisonV1[];
}>;

export type RecognitionBenchmarkResultV1 = Readonly<{
  schemaVersion: "recognition-benchmark-result-v1";
  corpusVersion: "recognition-corpus-v1";
  recognitionEngineVersion: string;
  commitSha: string;
  generatedAt: string;
  fixtures: readonly RecognitionFixtureResultV1[];
  aggregate: RecognitionAggregateResultV1;
  baselineComparison: RecognitionBaselineComparisonV1 | null;
}>;

export class RecognitionBenchmarkResultValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecognitionBenchmarkResultValidationError";
  }
}

const FIXTURE_METRICS = [
  "wallGeometryF1",
  "wallTopologyF1",
  "openingF1",
  "exactZoneCount",
  "totalAreaAbsolutePercentageError",
  "roomAreaMedianAbsolutePercentageError",
  "incorrectHighConfidenceRate",
  "unknownHostOpenings",
  "staleDecisions",
] as const;

const AGGREGATE_METRICS = [
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

const RATE_METRICS = new Set<string>([
  "wallGeometryF1",
  "wallTopologyF1",
  "openingF1",
  "exactZoneCount",
  "exactZoneCountRate",
  "incorrectHighConfidenceRate",
]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RecognitionBenchmarkResultValidationError(`${label} должен быть объектом.`);
  }
  return value as Record<string, unknown>;
}

function list(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new RecognitionBenchmarkResultValidationError(`${label} должен быть списком.`);
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new RecognitionBenchmarkResultValidationError(`${label} должен быть непустой строкой.`);
  }
  return value.trim();
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RecognitionBenchmarkResultValidationError(`${label} должен быть конечным числом.`);
  }
  return value;
}

function nonNegative(value: unknown, label: string): number {
  const result = finite(value, label);
  if (result < 0) throw new RecognitionBenchmarkResultValidationError(`${label} не может быть отрицательным.`);
  return result;
}

function integer(value: unknown, label: string): number {
  const result = nonNegative(value, label);
  if (!Number.isInteger(result)) throw new RecognitionBenchmarkResultValidationError(`${label} должен быть целым числом.`);
  return result;
}

function sha(value: unknown, label: string): string {
  const result = text(value, label).toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(result)) throw new RecognitionBenchmarkResultValidationError(`${label} должен быть 40-символьным commit SHA.`);
  return result;
}

function timestamp(value: unknown, label: string): string {
  const result = text(value, label);
  if (Number.isNaN(Date.parse(result))) throw new RecognitionBenchmarkResultValidationError(`${label} содержит некорректную дату.`);
  return result;
}

function metric(value: unknown, label: string, rate: boolean): BenchmarkMetricValue {
  const input = record(value, label);
  if (input.status === "not-applicable") return { status: "not-applicable" };
  if (input.status !== "measured") throw new RecognitionBenchmarkResultValidationError(`${label}.status не поддерживается.`);
  const result = nonNegative(input.value, `${label}.value`);
  if (rate && result > 1) throw new RecognitionBenchmarkResultValidationError(`${label}.value должен быть от 0 до 1.`);
  return { status: "measured", value: result };
}

function metricSet<K extends string>(
  value: unknown,
  names: readonly K[],
  label: string,
): Record<K, BenchmarkMetricValue> {
  const input = record(value, label);
  const output = {} as Record<K, BenchmarkMetricValue>;
  for (const name of names) output[name] = metric(input[name], `${label}.${name}`, RATE_METRICS.has(name));
  return output;
}

export function validateBenchmarkCountMetric(value: unknown, label = "countMetric"): BenchmarkCountMetric {
  const input = record(value, label);
  const truePositive = integer(input.truePositive, `${label}.truePositive`);
  const falsePositive = integer(input.falsePositive, `${label}.falsePositive`);
  const falseNegative = integer(input.falseNegative, `${label}.falseNegative`);
  const precision = finite(input.precision, `${label}.precision`);
  const recall = finite(input.recall, `${label}.recall`);
  const f1 = finite(input.f1, `${label}.f1`);
  for (const [name, current] of [["precision", precision], ["recall", recall], ["f1", f1]] as const) {
    if (current < 0 || current > 1) throw new RecognitionBenchmarkResultValidationError(`${label}.${name} должен быть от 0 до 1.`);
  }
  return { truePositive, falsePositive, falseNegative, precision, recall, f1 };
}

function baselineComparison(value: unknown): RecognitionBaselineComparisonV1 | null {
  if (value === null) return null;
  const input = record(value, "baselineComparison");
  const metrics = list(input.metrics, "baselineComparison.metrics").map((entry, index): RecognitionBaselineMetricComparisonV1 => {
    const item = record(entry, `baselineComparison.metrics[${index}]`);
    const metricName = text(item.metric, `baselineComparison.metrics[${index}].metric`);
    if (!AGGREGATE_METRICS.includes(metricName as (typeof AGGREGATE_METRICS)[number])) {
      throw new RecognitionBenchmarkResultValidationError(`baselineComparison ссылается на отсутствующую метрику ${metricName}.`);
    }
    const relativeDelta = item.relativeDelta === null ? null : finite(item.relativeDelta, `baselineComparison.metrics[${index}].relativeDelta`);
    const status = item.status;
    if (status !== "improvement" && status !== "unchanged" && status !== "regression") {
      throw new RecognitionBenchmarkResultValidationError(`baselineComparison.metrics[${index}].status не поддерживается.`);
    }
    return {
      metric: metricName,
      baseline: finite(item.baseline, `baselineComparison.metrics[${index}].baseline`),
      current: finite(item.current, `baselineComparison.metrics[${index}].current`),
      absoluteDelta: finite(item.absoluteDelta, `baselineComparison.metrics[${index}].absoluteDelta`),
      relativeDelta,
      status,
    };
  });
  if (new Set(metrics.map((entry) => entry.metric)).size !== metrics.length) {
    throw new RecognitionBenchmarkResultValidationError("baselineComparison.metrics содержит повторы.");
  }
  return { baselineSourceSha: sha(input.baselineSourceSha, "baselineComparison.baselineSourceSha"), metrics };
}

export function validateRecognitionBenchmarkResultV1(value: unknown): RecognitionBenchmarkResultV1 {
  const input = record(value, "result");
  if (input.schemaVersion !== "recognition-benchmark-result-v1") {
    throw new RecognitionBenchmarkResultValidationError("Неподдерживаемая версия result schema.");
  }
  if (input.corpusVersion !== "recognition-corpus-v1") {
    throw new RecognitionBenchmarkResultValidationError("Неподдерживаемая версия corpus.");
  }

  const fixtures = list(input.fixtures, "fixtures").map((entry, index): RecognitionFixtureResultV1 => {
    const item = record(entry, `fixtures[${index}]`);
    if (typeof item.failed !== "boolean") throw new RecognitionBenchmarkResultValidationError(`fixtures[${index}].failed должен быть boolean.`);
    return {
      fixtureId: text(item.fixtureId, `fixtures[${index}].fixtureId`),
      failed: item.failed,
      diagnostics: list(item.diagnostics, `fixtures[${index}].diagnostics`).map((diagnostic, diagnosticIndex) => text(diagnostic, `fixtures[${index}].diagnostics[${diagnosticIndex}]`)),
      metrics: metricSet(item.metrics, FIXTURE_METRICS, `fixtures[${index}].metrics`) as RecognitionFixtureMetricsV1,
    };
  });
  if (new Set(fixtures.map((entry) => entry.fixtureId)).size !== fixtures.length) {
    throw new RecognitionBenchmarkResultValidationError("fixtures содержит повторяющиеся fixtureId.");
  }

  const aggregateInput = record(input.aggregate, "aggregate");
  const fixtureCount = integer(aggregateInput.fixtureCount, "aggregate.fixtureCount");
  const failedFixtureCount = integer(aggregateInput.failedFixtureCount, "aggregate.failedFixtureCount");
  if (fixtureCount !== fixtures.length) throw new RecognitionBenchmarkResultValidationError("aggregate.fixtureCount не совпадает с fixtures.length.");
  if (failedFixtureCount !== fixtures.filter((entry) => entry.failed).length) {
    throw new RecognitionBenchmarkResultValidationError("aggregate.failedFixtureCount не совпадает с fixtures.");
  }

  return {
    schemaVersion: "recognition-benchmark-result-v1",
    corpusVersion: "recognition-corpus-v1",
    recognitionEngineVersion: text(input.recognitionEngineVersion, "recognitionEngineVersion"),
    commitSha: sha(input.commitSha, "commitSha"),
    generatedAt: timestamp(input.generatedAt, "generatedAt"),
    fixtures,
    aggregate: {
      fixtureCount,
      failedFixtureCount,
      metrics: metricSet(aggregateInput.metrics, AGGREGATE_METRICS, "aggregate.metrics") as RecognitionAggregateMetricsV1,
    },
    baselineComparison: baselineComparison(input.baselineComparison),
  };
}
