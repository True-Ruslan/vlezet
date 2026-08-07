export type AiBenchmarkMode = "verification" | "disputed-zones" | "proposal-discovery-stage1";

export type AiBenchmarkConfig = Readonly<{
  schemaVersion: "recognition-ai-benchmark-config-v1";
  modelIds: readonly string[];
  fixtureIds: readonly string[];
  repetitions: number;
  maximumTokens: number;
  timeoutMs: number;
  maximumCostUsd: number;
  maximumPromptPricePerMillionUsd: number;
  maximumCompletionPricePerMillionUsd: number;
  mode: AiBenchmarkMode;
  qualified: false;
}>;

export type AiBenchmarkExecutionStopReason =
  | "usage-cost-missing"
  | "cost-budget-exceeded"
  | "cost-budget-reached"
  | "usage-cost-unobservable-after-request-error"
  | null;

export type AiBenchmarkExecution = Readonly<{
  plannedRunCount: number;
  completedRunCount: number;
  maximumCostUsd: number;
  observedCostUsd: number;
  complete: boolean;
  stopReason: AiBenchmarkExecutionStopReason;
}>;

export type AiBenchmarkModelSummary = Readonly<{
  modelId: string;
  score: Readonly<{
    stableDecisionRate: number;
    schemaFailureRate: number;
    safetyViolationCount: number;
  }>;
}>;

export type AiBenchmarkReport = Readonly<{
  execution: AiBenchmarkExecution;
  models: readonly AiBenchmarkModelSummary[];
}> & Readonly<Record<string, unknown>>;

export type AiBenchmarkFetchResponse = Readonly<{
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export type AiBenchmarkFetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<AiBenchmarkFetchResponse>;

export type RunAiBenchmarkInput = Readonly<{
  config?: AiBenchmarkConfig;
  environment?: Readonly<Record<string, string | undefined>>;
  fixturesRoot?: string;
  predictionsRoot?: string;
  outputPath?: string;
  apiKey?: string;
  fetcher?: AiBenchmarkFetcher;
  commitSha?: string;
}>;

export function configFromEnvironment(
  environment?: Readonly<Record<string, string | undefined>>,
): AiBenchmarkConfig;

export function runAiBenchmark(input?: RunAiBenchmarkInput): Promise<AiBenchmarkReport>;
