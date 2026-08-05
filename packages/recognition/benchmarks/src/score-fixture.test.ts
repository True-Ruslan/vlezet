import type { RecognitionDraft, RecognitionOpeningCandidate, RecognitionWallCandidate } from "../../src/model";
import type { RecognitionBenchmarkFixtureV1 } from "../schema/fixture-v1";
import { describe, expect, it } from "vitest";
import { scoreRecognitionFixture, type RecognitionFixtureScoringInput } from "./score-fixture";

const SPAN_MM = 10_000;

function wall(id: string, yMm = 1000): RecognitionWallCandidate {
  return {
    id,
    start: { x: 0.1, y: yMm / SPAN_MM },
    end: { x: 0.9, y: yMm / SPAN_MM },
    estimatedThicknessPx: 15,
    confidence: "high",
    evidence: { localScore: 0.9, cloudScore: null, reasons: ["test"] },
    origin: "local",
    conflict: null,
  };
}

function opening(id: string, hostWallCandidateId: string): RecognitionOpeningCandidate {
  return {
    id,
    kind: "door",
    hostWallCandidateId,
    center: { x: 0.3, y: 0.1 },
    widthPx: 90,
    orientationDeg: 0,
    confidence: "high",
    evidence: { localScore: 0.9, cloudScore: null, reasons: ["test"] },
    origin: "local",
    conflict: null,
  };
}

function fixture(options: Readonly<{ rooms?: boolean; openings?: boolean }> = {}): RecognitionBenchmarkFixtureV1 {
  const rooms = options.rooms ?? true;
  const openings = options.openings ?? true;
  return {
    schemaVersion: "recognition-benchmark-fixture-v1",
    id: "fixture-score",
    description: "Synthetic fixture scorer contract",
    provenance: { kind: "synthetic", note: "Created for scorer tests.", license: null },
    tags: ["clean", "calibrated"],
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
    ],
    expectedWalls: [{
      id: "w1",
      startMm: { x: 1000, y: 1000 },
      endMm: { x: 9000, y: 1000 },
      thicknessMm: 150,
      kind: "external",
      startJunctionId: "j1",
      endJunctionId: "j2",
    }],
    expectedOpenings: openings ? [{
      id: "o1",
      kind: "door",
      hostWallId: "w1",
      centerMm: { x: 3000, y: 1000 },
      widthMm: 900,
      orientationDeg: 0,
      swing: null,
    }] : [],
    expectedRooms: rooms ? [{
      id: "r1",
      polygonMm: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }],
      name: "Комната",
      classification: "living",
      statedAreaM2: 1,
      computedAreaM2: 1,
    }] : [],
    expectedLabels: [],
    statedTotalAreaM2: rooms ? 1 : null,
    metricApplicability: {
      wallGeometry: true,
      wallTopology: true,
      openings,
      rooms,
      roomLabels: false,
      roomAreas: rooms,
      totalArea: rooms,
      confidence: true,
    },
  };
}

function reconciliationSnapshot(wallId: string, openingId: string | null): RecognitionDraft {
  const wallCandidate = wall(wallId);
  const openingCandidates = openingId ? [opening(openingId, wallId)] : [];
  return {
    id: "draft",
    projectId: "project",
    referenceAssetId: "asset",
    referenceRevision: "revision",
    engineVersion: "3",
    status: "local-complete",
    walls: [wallCandidate],
    openings: openingCandidates,
    roomLabels: [],
    diagnostics: [],
    decisions: Object.fromEntries([wallCandidate, ...openingCandidates].map((candidate) => [candidate.id, "pending" as const])),
    source: { local: true, cloud: false },
    aiProposals: [],
    proposalDecisions: {},
    aiProposalMetadata: null,
    createdAt: "2026-08-01T20:00:00.000Z",
    updatedAt: "2026-08-01T20:00:00.000Z",
  };
}

function scoringInput(options: Readonly<{ rooms?: boolean; openings?: boolean; candidatePrefix?: string }> = {}): RecognitionFixtureScoringInput {
  const prefix = options.candidatePrefix ?? "candidate";
  const wallPrediction = wall(`${prefix}-wall`);
  const openingPredictions = options.openings === false ? [] : [opening(`${prefix}-opening`, wallPrediction.id)];
  return {
    fixture: fixture({ rooms: options.rooms, openings: options.openings }),
    wallPredictions: [wallPrediction],
    openingPredictions,
    roomPredictions: [],
    reconciliationSnapshot: reconciliationSnapshot(wallPrediction.id, openingPredictions[0]?.id ?? null),
    failure: null,
  };
}

describe("recognition fixture scoring", () => {
  it("emits every enabled metric and honest zero room recall", () => {
    const result = scoreRecognitionFixture(scoringInput());
    expect(result.failed).toBe(false);
    expect(result.metrics.wallGeometryF1).toEqual({ status: "measured", value: 1 });
    expect(result.metrics.wallTopologyF1).toEqual({ status: "measured", value: 1 });
    expect(result.metrics.openingF1).toEqual({ status: "measured", value: 1 });
    expect(result.metrics.exactZoneCount).toEqual({ status: "measured", value: 0 });
    expect(result.evidence.roomDetection).toMatchObject({ truePositive: 0, falseNegative: 1, recall: 0 });
    expect(result.metrics.staleDecisions).toEqual({ status: "measured", value: 0 });
  });

  it("represents disabled metrics as not-applicable", () => {
    const result = scoreRecognitionFixture(scoringInput({ rooms: false, openings: false }));
    expect(result.metrics.openingF1).toEqual({ status: "not-applicable" });
    expect(result.metrics.exactZoneCount).toEqual({ status: "not-applicable" });
    expect(result.metrics.totalAreaAbsolutePercentageError).toEqual({ status: "not-applicable" });
    expect(result.evidence.openings).toBeNull();
    expect(result.evidence.roomDetection).toBeNull();
  });

  it("retains a failed fixture with diagnostics and false-negative evidence", () => {
    const input = scoringInput();
    const result = scoreRecognitionFixture({ ...input, failure: new Error("engine failed") });
    expect(result.failed).toBe(true);
    expect(result.diagnostics).toContain("engine failed");
    expect(result.evidence.wallGeometry).toMatchObject({ truePositive: 0, falseNegative: 1 });
    expect(result.evidence.roomDetection).toMatchObject({ truePositive: 0, falseNegative: 1 });
  });

  it("does not use ephemeral candidate IDs as score evidence", () => {
    const first = scoreRecognitionFixture(scoringInput({ candidatePrefix: "alpha" }));
    const second = scoreRecognitionFixture(scoringInput({ candidatePrefix: "unrelated-id" }));
    expect(second.metrics).toEqual(first.metrics);
    expect(second.evidence).toEqual(first.evidence);
  });
});
