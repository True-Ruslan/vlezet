export type RealOpeningScore = Readonly<{
  matches: readonly Readonly<Record<string, unknown>>[];
  matchedPredictionIds: readonly string[];
  unmatchedPredictionIds: readonly string[];
  unmatchedExpectedOpeningIds: readonly string[];
  unknownHostOpenings: readonly Readonly<{
    openingId: string;
    hostWallCandidateId: string | null;
  }>[];
  unknownHostOpeningCount: number;
  metrics: Readonly<{
    truePositive: number;
    falsePositive: number;
    falseNegative: number;
    precision: number;
    recall: number;
    f1: number;
  }>;
}>;

export function scoreRealOpenings(input: Readonly<{
  fixture: Readonly<Record<string, unknown>>;
  wallPredictions: readonly Readonly<Record<string, unknown>>[];
  openingPredictions: readonly Readonly<Record<string, unknown>>[];
}>): RealOpeningScore;
