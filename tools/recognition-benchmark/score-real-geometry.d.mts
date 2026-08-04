export type RealWallCoverageMatch = Readonly<{
  expectedWallId: string;
  matched: boolean;
  coverageMm: number;
  coverageRatio: number;
  predictedIds: readonly string[];
  measurements: readonly Readonly<Record<string, unknown>>[];
}>;

export type RealWallGeometryScore = Readonly<{
  matches: readonly RealWallCoverageMatch[];
  matchedExpectedWallIds: readonly string[];
  unmatchedExpectedWallIds: readonly string[];
  matchedPredictionIds: readonly string[];
  unmatchedPredictionIds: readonly string[];
  metrics: Readonly<{
    truePositive: number;
    falsePositive: number;
    falseNegative: number;
    precision: number;
    recall: number;
    f1: number;
  }>;
}>;

export function realFixtureCalibration(fixture: Readonly<Record<string, unknown>>): Readonly<{
  sourceWidthPx: number;
  sourceHeightPx: number;
  millimetersPerPixel: number;
  originPx: Readonly<{ x: number; y: number }>;
}>;

export function matchRealWallCoverage(input: Readonly<{
  fixture: Readonly<Record<string, unknown>>;
  expectedWall: Readonly<Record<string, unknown>>;
  predictions: readonly Readonly<Record<string, unknown>>[];
}>): RealWallCoverageMatch;

export function predictionMatchesRealExpectedWall(input: Readonly<{
  fixture: Readonly<Record<string, unknown>>;
  prediction: Readonly<Record<string, unknown>>;
  expectedWall: Readonly<Record<string, unknown>>;
}>): boolean;

export function predictionMatchesRealExpectedWallNetwork(input: Readonly<{
  fixture: Readonly<Record<string, unknown>>;
  prediction: Readonly<Record<string, unknown>>;
}>): boolean;

export function scoreRealWallGeometry(input: Readonly<{
  fixture: Readonly<Record<string, unknown>>;
  predictions: readonly Readonly<Record<string, unknown>>[];
}>): RealWallGeometryScore;