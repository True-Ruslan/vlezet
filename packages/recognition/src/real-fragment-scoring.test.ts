import { describe, expect, it } from "vitest";
import {
  matchRealWallCoverage,
  scoreRealWallGeometry,
} from "../../../tools/recognition-benchmark/score-real-geometry.mjs";
import { scoreFailureExpectations } from "../../../tools/recognition-benchmark/score-failure-expectations.mjs";

const fixture = {
  id: "fragmented-real-plan",
  tags: [],
  calibration: {
    sourceWidthPx: 1000,
    sourceHeightPx: 800,
    millimetersPerPixel: 10,
    originPx: { x: 0, y: 0 },
  },
  tolerances: {
    wallEndpointMm: 180,
    wallOrientationDeg: 8,
    wallMinimumOverlapRatio: 0.68,
    wallLengthRelativeError: 0.25,
    openingCenterMm: 220,
    openingWidthMm: 220,
  },
  expectedWalls: [
    {
      id: "external-left",
      startMm: { x: 1000, y: 1000 },
      endMm: { x: 1000, y: 7000 },
      thicknessMm: 320,
      kind: "external",
    },
    {
      id: "balcony-thin-wall",
      startMm: { x: 7000, y: 1000 },
      endMm: { x: 7000, y: 7000 },
      thicknessMm: 110,
      kind: "balcony-boundary",
    },
  ],
  expectedOpenings: [],
  failureExpectations: {
    schemaVersion: "recognition-failure-expectations-v1",
    mustDetect: [{ id: "balcony-thin-wall", kind: "wall" }],
    mustNotDetectRegions: [
      {
        id: "sanitary-symbol-zone",
        kind: "wall",
        polygonNormalized: [
          { x: 0.08, y: 0.2 },
          { x: 0.35, y: 0.2 },
          { x: 0.35, y: 0.6 },
          { x: 0.08, y: 0.6 },
        ],
        reason: "Only unmatched interior symbol axes are forbidden.",
      },
    ],
    knownAmbiguities: [],
  },
} as const;

function wall(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  conflict: null | "unsupported" = null,
) {
  return {
    id,
    start: { x: x1 / 1000, y: y1 / 800 },
    end: { x: x2 / 1000, y: y2 / 800 },
    estimatedThicknessPx: 20,
    confidence: conflict ? "low" as const : "medium" as const,
    evidence: { localScore: 0.7, cloudScore: null, reasons: ["test"] },
    origin: "local" as const,
    conflict,
  };
}

const externalLeft = wall("external-left-prediction", 100, 100, 100, 700);
const balconyFragments = [
  wall("balcony-a", 700, 100, 700, 360),
  wall("balcony-b", 700, 365, 700, 700),
];

describe("fragment-aware M7.9 real geometry scoring", () => {
  it("matches one expected wall through the union of deterministic collinear fragments", () => {
    const match = matchRealWallCoverage({
      fixture,
      expectedWall: fixture.expectedWalls[1],
      predictions: balconyFragments,
    });
    expect(match.coverageRatio).toBeGreaterThan(0.98);
    expect(match.matched).toBe(true);
    expect(match.predictedIds).toEqual(["balcony-a", "balcony-b"]);
  });

  it("scores active fragmented geometry without counting unsupported diagnostics as false walls", () => {
    const score = scoreRealWallGeometry({
      fixture,
      predictions: [
        externalLeft,
        ...balconyFragments,
        wall("unsupported-sink", 180, 300, 300, 300, "unsupported"),
      ],
    });
    expect(score.metrics).toEqual(expect.objectContaining({
      truePositive: 2,
      falsePositive: 0,
      falseNegative: 0,
      precision: 1,
      recall: 1,
      f1: 1,
    }));
    expect(score.matchedPredictionIds).toEqual([
      "balcony-a",
      "balcony-b",
      "external-left-prediction",
    ]);
  });

  it("does not report a real structural wall merely because a broad negative zone touches it", () => {
    const score = scoreFailureExpectations({
      fixture,
      recognitionResult: {
        walls: [externalLeft, ...balconyFragments],
        openings: [],
      },
    });
    expect(score.failures.some((failure) => failure.code === "forbidden-wall-region-hit")).toBe(false);
    expect(score.passed).toBe(true);
  });

  it("ignores unsupported diagnostic contours inside forbidden regions", () => {
    const score = scoreFailureExpectations({
      fixture,
      recognitionResult: {
        walls: [
          externalLeft,
          ...balconyFragments,
          wall("unsupported-sink", 180, 300, 300, 300, "unsupported"),
        ],
        openings: [],
      },
    });
    expect(score.failures.some((failure) => failure.candidateId === "unsupported-sink")).toBe(false);
  });

  it("requires substantial unmatched centerline occupancy inside a forbidden region", () => {
    const touching = wall("touching-edge", 20, 300, 90, 300);
    const interior = wall("interior-symbol", 150, 320, 300, 320);
    const score = scoreFailureExpectations({
      fixture,
      recognitionResult: {
        walls: [externalLeft, ...balconyFragments, touching, interior],
        openings: [],
      },
    });
    expect(score.failures.some((failure) => failure.candidateId === "touching-edge")).toBe(false);
    expect(score.failures).toContainEqual(expect.objectContaining({
      code: "forbidden-wall-region-hit",
      candidateId: "interior-symbol",
    }));
  });
});
