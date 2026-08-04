import { describe, expect, it } from "vitest";
import { predictionMatchesRealExpectedWallNetwork } from "../../../../tools/recognition-benchmark/score-real-geometry.mjs";

const fixture = {
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
};

function prediction(startXPx: number, endXPx: number) {
  return {
    id: "combined-wall",
    start: { x: startXPx / 1000, y: 0.5 },
    end: { x: endXPx / 1000, y: 0.5 },
    estimatedThicknessPx: 22,
    conflict: null,
  };
}

describe("real wall network scoring", () => {
  it("matches one prediction against a contiguous collinear expected-wall network", () => {
    expect(predictionMatchesRealExpectedWallNetwork({
      fixture,
      prediction: prediction(100, 520),
    })).toBe(true);
  });

  it("does not combine expected sections separated by a large structural gap", () => {
    expect(predictionMatchesRealExpectedWallNetwork({
      fixture: {
        ...fixture,
        expectedWalls: [
          fixture.expectedWalls[0],
          {
            ...fixture.expectedWalls[1],
            startMm: { x: 4000, y: 3000 },
            endMm: { x: 5200, y: 3000 },
          },
        ],
      },
      prediction: prediction(100, 520),
    })).toBe(false);
  });

  it("does not combine nearby but parallel expected walls on different axes", () => {
    expect(predictionMatchesRealExpectedWallNetwork({
      fixture: {
        ...fixture,
        expectedWalls: [
          fixture.expectedWalls[0],
          {
            ...fixture.expectedWalls[1],
            startMm: { x: 3000, y: 3500 },
            endMm: { x: 5200, y: 3500 },
          },
        ],
      },
      prediction: prediction(100, 520),
    })).toBe(false);
  });
});
