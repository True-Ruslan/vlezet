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

export function scoreFailureExpectations(input: Readonly<{
  fixture: any;
  recognitionResult: Readonly<{ walls: readonly any[]; openings: readonly any[] }>;
}>): RealFixtureScenarioScore;

export function enforceRealFixtureGate(input: Readonly<{
  benchmarkResult: any;
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
