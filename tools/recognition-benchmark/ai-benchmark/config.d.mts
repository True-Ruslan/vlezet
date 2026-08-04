export type AiBenchmarkConfigInput = Readonly<{
  modelIds: readonly string[];
  fixtureIds: readonly string[];
  repetitions: number;
  maximumTokens: number;
  timeoutMs: number;
  mode: "verification" | "disputed-zones";
}>;

export type AiBenchmarkConfig = Readonly<{
  schemaVersion: "recognition-ai-benchmark-config-v1";
  modelIds: readonly string[];
  fixtureIds: readonly string[];
  repetitions: number;
  maximumTokens: number;
  timeoutMs: number;
  mode: "verification" | "disputed-zones";
  qualified: false;
}>;

export const DEFAULT_AI_BENCHMARK_LIMITS: Readonly<{
  maximumModels: number;
  maximumFixtures: number;
  maximumRepetitions: number;
  maximumTokens: number;
  timeoutMs: number;
}>;

export function validateAiBenchmarkConfig(input: AiBenchmarkConfigInput): AiBenchmarkConfig;
