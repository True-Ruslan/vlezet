import type {
  AiLocalSummary,
  AiVerificationResponse,
} from "./openrouter-client.mjs";

export type AiBenchmarkUsage = Readonly<{
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
}>;

export type AiBenchmarkRun = Readonly<{
  modelId: string;
  fixtureId: string;
  repetition: number;
  latencyMs: number;
  usage: AiBenchmarkUsage | null;
  response: AiVerificationResponse;
  localSummary: AiLocalSummary;
  expectedOpeningKinds: Readonly<Record<string, "door" | "window" | "unknown-opening">>;
  schemaFailure: boolean;
  safetyViolations: readonly string[];
}>;

export type AiBenchmarkScore = Readonly<{
  schemaVersion: "recognition-ai-benchmark-score-v1";
  runCount: number;
  schemaFailureRate: number;
  safetyViolationCount: number;
  highConfidenceConfirmationRate: number;
  falseDowngradeRate: number;
  unsupportedConfirmationRate: number;
  openingClassificationAccuracy: number;
  stableDecisionRate: number;
  medianLatencyMs: number | null;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCostUsd: number | null;
  qualified: false;
}>;

export function scoreAiBenchmarkRuns(runs: readonly AiBenchmarkRun[]): AiBenchmarkScore;
