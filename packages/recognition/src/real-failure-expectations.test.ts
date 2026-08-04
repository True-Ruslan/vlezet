import { describe, expect, it } from "vitest";
import {
  enforceRealFixtureGate,
  scoreFailureExpectations,
} from "../../../tools/recognition-benchmark/score-failure-expectations.mjs";

const fixture = {
  id: "real-plan-001-anonymized",
  tags: ["rotation-invariance"],
  calibration: {
    sourceWidthPx: 1000,
    sourceHeightPx: 800,
    millimetersPerPixel: 10,
    originPx: { x: 0, y: 0 },
  },
  tolerances: {
    wallEndpointMm: 220,
    wallAngleDeg: 10,
    openingCenterMm: 220,
    openingWidthMm: 220,
  },
  expectedWalls: [
    {
      id: "balcony-thin-wall",
      startMm: { x: 7000, y: 1000 },
      endMm: { x: 7000, y: 6000 },
      thicknessMm: 110,
      kind: "balcony-boundary",
    },
    {
      id: "thick-load-bearing-wall",
      startMm: { x: 1000, y: 3500 },
      endMm: { x: 6500, y: 3500 },
      thicknessMm: 360,
      kind: "partition",
    },
  ],
  expectedOpenings: [
    {
      id: "loggia-window",
      kind: "window",
      hostWallId: "balcony-thin-wall",
      centerMm: { x: 7000, y: 4200 },
      widthMm: 1200,
      orientationDeg: 90,
      swing: null,
    },
  ],
  failureExpectations: {
    schemaVersion: "recognition-failure-expectations-v1",
    mustDetect: [
      { id: "balcony-thin-wall", kind: "wall" },
      { id: "loggia-window", kind: "window" },
    ],
    mustNotDetectRegions: [
      {
        id: "kitchen-sink-symbol",
        kind: "wall",
        polygonNormalized: [
          { x: 0.45, y: 0.6 },
          { x: 0.58, y: 0.6 },
          { x: 0.58, y: 0.75 },
          { x: 0.45, y: 0.75 },
        ],
        reason: "Kitchen fixture symbol must not become a wall.",
      },
    ],
    knownAmbiguities: [],
  },
} as const;

function wall(
  id: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
  thicknessPx = 20,
) {
  return {
    id,
    start,
    end,
    estimatedThicknessPx: thicknessPx,
    confidence: "medium" as const,
    evidence: { localScore: 0.75, cloudScore: null, reasons: ["test"] },
    origin: "local" as const,
    conflict: null,
  };
}

function opening(hostWallCandidateId: string | null) {
  return {
    id: "predicted-window",
    kind: "window" as const,
    hostWallCandidateId,
    center: { x: 0.7, y: 0.525 },
    widthPx: 120,
    orientationDeg: 90,
    confidence: "medium" as const,
    evidence: { localScore: 0.8, cloudScore: null, reasons: ["test"] },
    origin: "local" as const,
    conflict: null,
  };
}

const thinWall = wall(
  "predicted-thin-wall",
  { x: 0.7, y: 0.125 },
  { x: 0.7, y: 0.75 },
  11,
);
const thickWall = wall(
  "predicted-thick-wall",
  { x: 0.1, y: 0.4375 },
  { x: 0.65, y: 0.4375 },
  36,
);

function cleanRecognition() {
  return {
    walls: [thinWall, thickWall],
    openings: [opening(thinWall.id)],
  };
}

function aggregateResult(overrides: Record<string, unknown> = {}) {
  return {
    aggregate: {
      fixtureCount: 12,
      failedFixtureCount: 0,
      metrics: {
        wallGeometryF1: { status: "measured", value: 0.93 },
        openingF1: { status: "measured", value: 0.91 },
        unknownHostOpenings: { status: "measured", value: 0 },
        incorrectHighConfidenceRate: { status: "measured", value: 0 },
        staleDecisions: { status: "measured", value: 0 },
        ...overrides,
      },
    },
  };
}

describe("M7.9 real fixture failure expectations", () => {
  it("passes when critical wall, window and forbidden-region expectations hold", () => {
    const score = scoreFailureExpectations({ fixture, recognitionResult: cleanRecognition() });
    expect(score.passed).toBe(true);
    expect(score.failures).toEqual([]);
    expect(score.mustDetectPassed).toBe(2);
  });

  it("fails even when aggregate F1 is high if the thin loggia wall is missed", () => {
    const recognitionResult = cleanRecognition();
    recognitionResult.walls = [thickWall];
    recognitionResult.openings = [];
    const score = scoreFailureExpectations({ fixture, recognitionResult });
    expect(score.failures).toContainEqual(expect.objectContaining({
      code: "must-detect-wall-missed",
      expectationId: "balcony-thin-wall",
    }));
    expect(() => enforceRealFixtureGate({
      benchmarkResult: aggregateResult(),
      scenarioScores: [score],
    })).toThrow(/balcony-thin-wall/i);
  });

  it("fails when a designated window is missed despite passing aggregate opening F1", () => {
    const recognitionResult = cleanRecognition();
    recognitionResult.openings = [];
    const score = scoreFailureExpectations({ fixture, recognitionResult });
    expect(score.failures).toContainEqual(expect.objectContaining({
      code: "must-detect-opening-missed",
      expectationId: "loggia-window",
    }));
  });

  it("fails when a false wall intersects a forbidden kitchen or sanitary region", () => {
    const recognitionResult = cleanRecognition();
    recognitionResult.walls.push(wall(
      "sink-symbol-wall",
      { x: 0.46, y: 0.67 },
      { x: 0.57, y: 0.67 },
      8,
    ));
    const score = scoreFailureExpectations({ fixture, recognitionResult });
    expect(score.failures).toContainEqual(expect.objectContaining({
      code: "forbidden-wall-region-hit",
      expectationId: "kitchen-sink-symbol",
      candidateId: "sink-symbol-wall",
    }));
  });

  it("fails when one thick wall is represented by two substantial parallel axes", () => {
    const recognitionResult = cleanRecognition();
    recognitionResult.walls = [
      thinWall,
      wall("thick-axis-a", { x: 0.1, y: 0.425 }, { x: 0.65, y: 0.425 }, 20),
      wall("thick-axis-b", { x: 0.1, y: 0.45 }, { x: 0.65, y: 0.45 }, 20),
    ];
    const score = scoreFailureExpectations({ fixture, recognitionResult });
    expect(score.failures).toContainEqual(expect.objectContaining({
      code: "duplicate-thick-wall-axis",
      expectationId: "thick-load-bearing-wall",
    }));
  });

  it("fails when an accepted opening has no existing host wall", () => {
    const recognitionResult = cleanRecognition();
    recognitionResult.openings = [opening("unknown-wall")];
    const score = scoreFailureExpectations({ fixture, recognitionResult });
    expect(score.failures).toContainEqual(expect.objectContaining({
      code: "unknown-opening-host",
      candidateId: "predicted-window",
    }));
  });

  it("reports orientation failure for a rotated diagonal-plan prediction", () => {
    const recognitionResult = cleanRecognition();
    recognitionResult.walls = [
      wall("rotated-thin", { x: 0.125, y: 0.7 }, { x: 0.75, y: 0.7 }, 11),
      thickWall,
    ];
    recognitionResult.openings = [];
    const score = scoreFailureExpectations({ fixture, recognitionResult });
    expect(score.failures).toContainEqual(expect.objectContaining({
      code: "orientation-invariance-failed",
    }));
  });

  it("enforces aggregate and safety thresholds as well as scenario scores", () => {
    const passingScore = scoreFailureExpectations({ fixture, recognitionResult: cleanRecognition() });
    expect(enforceRealFixtureGate({
      benchmarkResult: aggregateResult(),
      scenarioScores: [passingScore],
    })).toMatchObject({ passed: true, scenarioCount: 1 });
    expect(() => enforceRealFixtureGate({
      benchmarkResult: aggregateResult({
        wallGeometryF1: { status: "measured", value: 0.7 },
      }),
      scenarioScores: [passingScore],
    })).toThrow(/wallGeometryF1/i);
  });
});
