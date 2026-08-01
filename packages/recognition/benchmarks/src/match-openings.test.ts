import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "../../src/model";
import type { RecognitionBenchmarkFixtureV1 } from "../schema/fixture-v1";
import type { WallMatchResult } from "./match-walls";
import { describe, expect, it } from "vitest";
import { matchOpenings } from "./match-openings";

const SPAN_MM = 10_000;

function wallCandidate(id: string, yMm: number): RecognitionWallCandidate {
  return {
    id,
    start: { x: 0.1, y: yMm / SPAN_MM },
    end: { x: 0.9, y: yMm / SPAN_MM },
    estimatedThicknessPx: 15,
    confidence: "medium",
    evidence: { localScore: 0.7, cloudScore: null, reasons: ["benchmark-test"] },
    origin: "local",
    conflict: null,
  };
}

function openingCandidate(
  id: string,
  kind: RecognitionOpeningCandidate["kind"],
  hostWallCandidateId: string | null,
  xMm = 3000,
  yMm = 1000,
  widthMm = 900,
): RecognitionOpeningCandidate {
  return {
    id,
    kind,
    hostWallCandidateId,
    center: { x: xMm / SPAN_MM, y: yMm / SPAN_MM },
    widthPx: widthMm / 10,
    orientationDeg: 0,
    confidence: "medium",
    evidence: { localScore: 0.7, cloudScore: null, reasons: ["benchmark-test"] },
    origin: "local",
    conflict: null,
  };
}

function fixture(): RecognitionBenchmarkFixtureV1 {
  return {
    schemaVersion: "recognition-benchmark-fixture-v1",
    id: "openings-fixture",
    description: "Synthetic opening matcher fixture",
    provenance: { kind: "synthetic", note: "Created for opening matcher tests.", license: null },
    tags: ["openings-heavy", "calibrated"],
    source: { fileName: "source.png", sha256: "a".repeat(64), cloudResponseFileName: null },
    calibration: { sourceWidthPx: 1000, sourceHeightPx: 1000, millimetersPerPixel: 10, originPx: { x: 0, y: 0 } },
    tolerances: {
      wallEndpointMm: 120,
      wallOrientationDeg: 5,
      wallMinimumOverlapRatio: 0.7,
      wallLengthRelativeError: 0.2,
      junctionMm: 120,
      openingCenterMm: 150,
      openingWidthMm: 150,
      roomMinimumIoU: 0.75,
      labelAnchorMm: 500,
    },
    expectedJunctions: [
      { id: "j1", positionMm: { x: 1000, y: 1000 } },
      { id: "j2", positionMm: { x: 9000, y: 1000 } },
      { id: "j3", positionMm: { x: 1000, y: 5000 } },
      { id: "j4", positionMm: { x: 9000, y: 5000 } },
    ],
    expectedWalls: [
      { id: "w1", startMm: { x: 1000, y: 1000 }, endMm: { x: 9000, y: 1000 }, thicknessMm: 150, kind: "external", startJunctionId: "j1", endJunctionId: "j2" },
      { id: "w2", startMm: { x: 1000, y: 5000 }, endMm: { x: 9000, y: 5000 }, thicknessMm: 150, kind: "partition", startJunctionId: "j3", endJunctionId: "j4" },
    ],
    expectedOpenings: [
      { id: "o1", kind: "door", hostWallId: "w1", centerMm: { x: 3000, y: 1000 }, widthMm: 900, orientationDeg: 0, swing: null },
    ],
    expectedRooms: [],
    expectedLabels: [],
    statedTotalAreaM2: null,
    metricApplicability: {
      wallGeometry: true,
      wallTopology: false,
      openings: true,
      rooms: false,
      roomLabels: false,
      roomAreas: false,
      totalArea: false,
      confidence: false,
    },
  };
}

function wallContext(): Readonly<{
  wallPredictions: readonly RecognitionWallCandidate[];
  wallMatches: WallMatchResult;
}> {
  const wallPredictions = [wallCandidate("opaque-local-a", 1000), wallCandidate("opaque-local-b", 5000)];
  return {
    wallPredictions,
    wallMatches: {
      matches: [
        { expectedWallId: "w1", predictedIndex: 0, endpointDistanceMm: 0, orientationDeltaDeg: 0, overlapRatio: 1, relativeLengthError: 0 },
        { expectedWallId: "w2", predictedIndex: 1, endpointDistanceMm: 0, orientationDeltaDeg: 0, overlapRatio: 1, relativeLengthError: 0 },
      ],
      unmatchedExpectedWallIds: [],
      unmatchedPredictedIndices: [],
      metrics: { truePositive: 2, falsePositive: 0, falseNegative: 0, precision: 1, recall: 1, f1: 1 },
      duplicatePredictionCount: 0,
    },
  };
}

describe("recognition opening matching", () => {
  it("matches correct type, position, width and host", () => {
    const context = wallContext();
    const result = matchOpenings({
      fixture: fixture(),
      predictions: [openingCandidate("p1", "door", "opaque-local-a")],
      ...context,
    });
    expect(result.combined).toEqual({ truePositive: 1, falsePositive: 0, falseNegative: 0, precision: 1, recall: 1, f1: 1 });
    expect(result.doors.f1).toBe(1);
    expect(result.hostWallAccuracy).toEqual({ status: "measured", value: 1 });
  });

  it("treats a wrong type as false positive plus false negative", () => {
    const context = wallContext();
    const result = matchOpenings({
      fixture: fixture(),
      predictions: [openingCandidate("p1", "window", "opaque-local-a")],
      ...context,
    });
    expect(result.combined).toMatchObject({ truePositive: 0, falsePositive: 1, falseNegative: 1, f1: 0 });
    expect(result.doors.falseNegative).toBe(1);
    expect(result.windows.falsePositive).toBe(1);
  });

  it("treats a correct geometric opening on the wrong host as FP plus FN", () => {
    const context = wallContext();
    const result = matchOpenings({
      fixture: fixture(),
      predictions: [openingCandidate("p1", "door", "opaque-local-b")],
      ...context,
    });
    expect(result.combined).toMatchObject({ truePositive: 0, falsePositive: 1, falseNegative: 1 });
    expect(result.hostWallAccuracy).toEqual({ status: "measured", value: 0 });
  });

  it("counts a null host explicitly", () => {
    const context = wallContext();
    const result = matchOpenings({
      fixture: fixture(),
      predictions: [openingCandidate("p1", "door", null)],
      ...context,
    });
    expect(result.unknownHostOpeningCount).toBe(1);
  });

  it("resolves host through matched wall index rather than ID similarity", () => {
    const context = wallContext();
    const result = matchOpenings({
      fixture: fixture(),
      predictions: [openingCandidate("p1", "door", "opaque-local-a")],
      ...context,
    });
    expect(result.matches[0]?.expectedOpeningId).toBe("o1");
  });

  it("keeps duplicate openings as false positives", () => {
    const context = wallContext();
    const result = matchOpenings({
      fixture: fixture(),
      predictions: [
        openingCandidate("p1", "door", "opaque-local-a"),
        openingCandidate("p2", "door", "opaque-local-a"),
      ],
      ...context,
    });
    expect(result.combined).toMatchObject({ truePositive: 1, falsePositive: 1, falseNegative: 0 });
    expect(result.duplicateOpeningCount).toBe(1);
  });

  it("is invariant to prediction order", () => {
    const context = wallContext();
    const predictions = [
      openingCandidate("matched", "door", "opaque-local-a"),
      openingCandidate("extra", "window", "opaque-local-a", 7000, 1000, 1200),
    ];
    const forward = matchOpenings({ fixture: fixture(), predictions, ...context });
    const reverse = matchOpenings({ fixture: fixture(), predictions: [...predictions].reverse(), ...context });
    expect(reverse.combined).toEqual(forward.combined);
    expect(reverse.doors).toEqual(forward.doors);
    expect(reverse.windows).toEqual(forward.windows);
  });
});
