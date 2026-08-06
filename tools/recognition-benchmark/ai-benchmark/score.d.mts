import type { AiLocalSummary } from "./openrouter-client.mjs";

export type AiBenchmarkUsage = Readonly<{
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
}>;

export type AiBenchmarkResponse = Readonly<{
  walls: readonly Readonly<{
    id: string;
    confidence: string;
    score: number;
  }>[];
  openings: readonly Readonly<{
    id: string;
    kind: string;
    confidence: string;
    score: number;
  }>[];
}>;

export type AiProposalEvaluation = Readonly<{
  recoveredDoorTruePositiveCount: number;
  recoveredDoorFalsePositiveCount: number;
  recoveredDoorFalseNegativeCount: number;
  recoveredWindowTruePositiveCount: number;
  recoveredWindowFalsePositiveCount: number;
  recoveredWindowFalseNegativeCount: number;
  eligibleWashbasinAdvisoryCount: number;
  sanitizerAcceptedCount: number;
  sanitizerTruePositiveCount: number;
  eligibleUnknownHostOpeningCount: number;
  eligibleOutsideHostOpeningCount: number;
  directLocalMutationCount: number;
  staleDecisionCount: number;
  protectedStrongWallAdvisoryCount: number;
  forbiddenRegionEligibleProposalCount: number;
  replayCount: number;
  replayMismatchCount: number;
}>;

export type AiBenchmarkRun = Readonly<{
  modelId: string;
  fixtureId: string;
  repetition: number;
  latencyMs: number;
  usage: AiBenchmarkUsage | null;
  response: AiBenchmarkResponse;
  localSummary: AiLocalSummary;
  expectedOpeningKinds: Readonly<Record<string, string>>;
  schemaFailure: boolean;
  safetyViolations: readonly string[];
  proposalEvaluation?: AiProposalEvaluation | null;
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
  recoveredDoorTruePositiveCount: number;
  recoveredDoorFalsePositiveCount: number;
  recoveredDoorFalseNegativeCount: number;
  recoveredWindowTruePositiveCount: number;
  recoveredWindowFalsePositiveCount: number;
  recoveredWindowFalseNegativeCount: number;
  eligibleWashbasinAdvisoryCount: number;
  sanitizerAcceptedCount: number;
  sanitizerTruePositiveCount: number;
  sanitizerAcceptancePrecision: number;
  eligibleUnknownHostOpeningCount: number;
  eligibleOutsideHostOpeningCount: number;
  directLocalMutationCount: number;
  staleDecisionCount: number;
  protectedStrongWallAdvisoryCount: number;
  forbiddenRegionEligibleProposalCount: number;
  replayCount: number;
  replayMismatchCount: number;
  replayDeterminismRate: number;
  qualified: false;
}>;

export function scoreAiBenchmarkRuns(runs: readonly AiBenchmarkRun[]): AiBenchmarkScore;
