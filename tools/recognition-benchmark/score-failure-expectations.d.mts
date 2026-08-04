export type RealFixtureScenarioFailure = Readonly<{
  code: string;
  fixtureId: string;
  expectationId?: string;
  candidateId?: string;
  candidateIds?: readonly string[];
  message: string;
}>;

export type RealFixtureScenarioScore = Readonly<{
  fixtureId: string;
  passed: boolean;
  mustDetectPassed: number;
  mustDetectTotal: number;
  forbiddenRegionCount: number;
  failures: readonly RealFixtureScenarioFailure[];
}>;

export type RealFixtureInput = Readonly<Record<string, unknown>>;
export type RealRecognitionResultInput = Readonly<{
  walls: readonly Readonly<Record<string, unknown>>[];
  openings: readonly Readonly<Record<string, unknown>>[];
}>;
export type RealBenchmarkResultInput = Readonly<{
  aggregate: Readonly<{
    fixtureCount?: number;
    failedFixtureCount?: number;
    metrics: Readonly<Record<string, unknown>>;
  }>;
}>;

export function scoreFailureExpectations(input: Readonly<{
  fixture: RealFixtureInput;
  recognitionResult: RealRecognitionResultInput;
}>): RealFixtureScenarioScore;

export function enforceRealFixtureGate(input: Readonly<{
  benchmarkResult: RealBenchmarkResultInput;
  scenarioScores: readonly RealFixtureScenarioScore[];
  thresholds?: Partial<Readonly<{
    minimumWallGeometryF1: number;
    minimumOpeningF1: number;
    maximumUnknownHostOpenings: number;
    maximumIncorrectHighConfidenceRate: number;
    maximumStaleDecisions: number;
  }>>;
}>): Readonly<{
  passed: true;
  scenarioCount: number;
  thresholds: Record<string, number>;
  aggregate: Record<string, number>;
}>;

export const DEFAULT_THRESHOLDS: Readonly<Record<string, number>>;
