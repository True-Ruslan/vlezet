import type { RecognitionBenchmarkResultV1 } from "../schema/result-v1";

function roundNumber(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Canonical benchmark JSON cannot contain non-finite numbers.");
  const rounded = Number(value.toFixed(6));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function canonicalValue(value: unknown, key: string | null = null): unknown {
  if (typeof value === "number") return roundNumber(value);
  if (Array.isArray(value)) {
    const entries = value.map((entry) => canonicalValue(entry));
    if (entries.every((entry) => typeof entry === "string")) {
      return [...entries].sort((first, second) => (first as string).localeCompare(second as string));
    }
    if (entries.every((entry) => typeof entry === "number") && [
      "roomIous", "totalAreaAbsolutePercentageErrors", "roomAreaAbsolutePercentageErrors",
    ].includes(key ?? "")) {
      return [...entries].sort((first, second) => (first as number) - (second as number));
    }
    return entries;
  }
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const currentKey of Object.keys(input).sort((first, second) => first.localeCompare(second))) {
    if (currentKey === "generatedAt") continue;
    output[currentKey] = canonicalValue(input[currentKey], currentKey);
  }
  return output;
}

export function canonicalBenchmarkJson(result: RecognitionBenchmarkResultV1): string {
  const fixtures = [...result.fixtures]
    .sort((first, second) => first.fixtureId.localeCompare(second.fixtureId))
    .map((fixture) => ({ ...fixture, diagnostics: [...fixture.diagnostics].sort((first, second) => first.localeCompare(second)) }));
  const baselineComparison = result.baselineComparison
    ? { ...result.baselineComparison, metrics: [...result.baselineComparison.metrics].sort((first, second) => first.metric.localeCompare(second.metric)) }
    : null;
  return `${JSON.stringify(canonicalValue({ ...result, fixtures, baselineComparison }), null, 2)}\n`;
}
