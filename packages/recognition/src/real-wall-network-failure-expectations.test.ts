import { describe, expect, it } from "vitest";
import { scoreFailureExpectations } from "../../../tools/recognition-benchmark/score-failure-expectations.mjs";

const fixture = {
  id: "real-plan-network-test",
  tags: [],
  calibration: {
    sourceWidthPx: 1000,
    sourceHeightPx: 600,
    millimetersPerPixel: 10,
    originPx: { x: 0, y: 0 },
  },
  tolerances: {
    wallEndpointMm: 140,
    wallOrientationDeg: 6,
  },
  expectedWalls: [
    {
      id: "left-section",
      startMm: { x: 1000, y: 3000 },
      endMm: { x: 3000, y: 3000 },
      thicknessMm: 220,
    },
    {
      id: "right-section",
      startMm: { x: 3000, y: 3000 },
      endMm: { x: 5200, y: 3000 },
      thicknessMm: 220,
    },
  ],
  expectedOpenings: [],
  failureExpectations: {
    mustDetect: [],
    mustNotDetectRegions: [
      {
        id: "region-crossed-by-valid-network-wall",
        polygonNormalized: [
          { x: 0.15, y: 0.45 },
          { x: 0.47, y: 0.45 },
          { x: 0.47, y: 0.55 },
          { x: 0.15, y: 0.55 },
        ],
      },
    ],
    knownAmbiguities: [],
  },
};

const combinedWall = {
  id: "combined-wall",
  start: { x: 0.1, y: 0.5 },
  end: { x: 0.52, y: 0.5 },
  estimatedThicknessPx: 22,
  confidence: "high",
  evidence: { localScore: 0.88, cloudScore: null, reasons: ["test"] },
  origin: "local",
  conflict: null,
};

describe("real failure expectations for contiguous wall networks", () => {
  it("does not report a valid contiguous expected-wall network as forbidden clutter", () => {
    const score = scoreFailureExpectations({
      fixture,
      recognitionResult: { walls: [combinedWall], openings: [] },
    });

    expect(score.failures).not.toContainEqual(expect.objectContaining({
      code: "forbidden-wall-region-hit",
      candidateId: "combined-wall",
    }));
  });
});
