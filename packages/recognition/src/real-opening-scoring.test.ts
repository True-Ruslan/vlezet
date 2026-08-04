import { describe, expect, it } from "vitest";
import { scoreRealOpenings } from "../../../tools/recognition-benchmark/score-real-openings.mjs";

const fixture = {
  id: "fragmented-opening-plan",
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
      id: "balcony-thin-wall",
      startMm: { x: 7000, y: 1000 },
      endMm: { x: 7000, y: 7000 },
      thicknessMm: 110,
      kind: "balcony-boundary",
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
} as const;

function wall(id: string, y1: number, y2: number, conflict: null | "unsupported" = null) {
  return {
    id,
    start: { x: 0.7, y: y1 / 800 },
    end: { x: 0.7, y: y2 / 800 },
    estimatedThicknessPx: 11,
    confidence: conflict ? "low" as const : "medium" as const,
    evidence: { localScore: 0.7, cloudScore: null, reasons: ["test"] },
    origin: "local" as const,
    conflict,
  };
}

function opening(
  id: string,
  hostWallCandidateId: string | null,
  kind: "door" | "window" = "window",
  conflict: null | "unsupported" = null,
) {
  return {
    id,
    kind,
    hostWallCandidateId,
    center: { x: 0.7, y: 0.525 },
    widthPx: 120,
    orientationDeg: 90,
    confidence: conflict ? "low" as const : "medium" as const,
    evidence: { localScore: 0.8, cloudScore: null, reasons: ["test"] },
    origin: "local" as const,
    conflict,
  };
}

const hostFragments = [
  wall("host-a", 100, 360),
  wall("host-b", 365, 700),
];

describe("fragment-aware M7.9 opening scoring", () => {
  it("matches an opening whose host is a valid fragment of the expected wall", () => {
    const score = scoreRealOpenings({
      fixture,
      wallPredictions: hostFragments,
      openingPredictions: [opening("window-a", "host-b")],
    });
    expect(score.metrics).toEqual(expect.objectContaining({
      truePositive: 1,
      falsePositive: 0,
      falseNegative: 0,
      f1: 1,
    }));
    expect(score.unknownHostOpeningCount).toBe(0);
    expect(score.matchedPredictionIds).toEqual(["window-a"]);
  });

  it("ignores rejected diagnostic openings in recognition F1", () => {
    const score = scoreRealOpenings({
      fixture,
      wallPredictions: hostFragments,
      openingPredictions: [
        opening("window-a", "host-b"),
        opening("unsupported-door", "host-a", "door", "unsupported"),
      ],
    });
    expect(score.metrics.f1).toBe(1);
    expect(score.unmatchedPredictionIds).toEqual([]);
  });

  it("counts an active opening with a missing host as both unmatched and unsafe", () => {
    const score = scoreRealOpenings({
      fixture,
      wallPredictions: hostFragments,
      openingPredictions: [opening("window-a", "unknown-host")],
    });
    expect(score.metrics).toMatchObject({ truePositive: 0, falsePositive: 1, falseNegative: 1, f1: 0 });
    expect(score.unknownHostOpeningCount).toBe(1);
  });

  it("does not match the wrong opening kind even at the correct position", () => {
    const score = scoreRealOpenings({
      fixture,
      wallPredictions: hostFragments,
      openingPredictions: [opening("door-a", "host-b", "door")],
    });
    expect(score.metrics.f1).toBe(0);
  });
});
