export type VerificationQualificationReviewMetrics = Readonly<{
  stableDecisionRate: number | null;
  openingClassificationAccuracy: number | null;
  highConfidenceConfirmationRate: number | null;
  falseDowngradeRate: number | null;
  medianLatencyMs: number | null;
}>;

export type VerificationQualificationModel = Readonly<{
  modelId: string;
  eligibleForManualReview: boolean;
  blockers: readonly string[];
  requiredRepetitions: number;
  fixtureCount: number;
  completeFixtureCount: number;
  runCount: number;
  costUsd: number | null;
  reviewMetrics: VerificationQualificationReviewMetrics;
}>;

export type VerificationQualificationResult = Readonly<{
  schemaVersion: "recognition-ai-verification-qualification-v1";
  sourceReportSchemaVersion: "recognition-ai-benchmark-report-v1";
  sourceCommitSha: string | null;
  qualified: false;
  selectedModelId: null;
  automaticModelSelectionAllowed: false;
  manualReviewRequired: true;
  reportMechanicallyComplete: boolean;
  blockers: readonly string[];
  execution: Readonly<{
    plannedRunCount: number;
    completedRunCount: number;
    maximumCostUsd: number;
    observedCostUsd: number;
  }>;
  models: readonly VerificationQualificationModel[];
}>;

export function evaluateVerificationBenchmarkQualification(input: unknown): VerificationQualificationResult;
export function canonicalVerificationQualificationJson(result: VerificationQualificationResult): string;
export function runVerificationQualificationCli(args?: readonly string[]): Promise<void>;
