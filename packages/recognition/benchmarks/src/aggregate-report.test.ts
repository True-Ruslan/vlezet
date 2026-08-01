import type { RecognitionFixtureResultV1 } from "../schema/result-v1";
import { describe, expect, it } from "vitest";
import { aggregateRecognitionResults } from "./aggregate-report";

function measured(value: number) {
  return { status: "measured" as const, value };
}

function notApplicable() {
  return { status: "not-applicable" as const };
}

function fixtureResult(input: Readonly<{
  id: string;
  wall?: readonly [number, number, number];
  room?: readonly [number, number, number] | null;
  exactZoneCount?: number | null;
  totalAreaError?: number | null;
  roomAreaErrors?: readonly number[];
  failed?: boolean;
}>): RecognitionFixtureResultV1 {
  const wall = input.wall ?? [0, 0, 0];
  const room = input.room === undefined ? null : input.room;
  const wallMetric = { truePositive: wall[0], falsePositive: wall[1], falseNegative: wall[2], precision: 0, recall: 0, f1: 0 };
  const roomMetric = room ? { truePositive: room[0], falsePositive: room[1], falseNegative: room[2], precision: 0, recall: 0, f1: 0 } : null;
  return {
    fixtureId: input.id,
    failed: input.failed ?? false,
    diagnostics: input.failed ? ["failed"] : [],
    metrics: {
      wallGeometryF1: measured(0),
      wallTopologyF1: notApplicable(),
      openingF1: notApplicable(),
      exactZoneCount: input.exactZoneCount === null || input.exactZoneCount === undefined ? notApplicable() : measured(input.exactZoneCount),
      totalAreaAbsolutePercentageError: input.totalAreaError === null || input.totalAreaError === undefined ? notApplicable() : measured(input.totalAreaError),
      roomAreaMedianAbsolutePercentageError: input.roomAreaErrors?.length ? measured(input.roomAreaErrors[0]!) : notApplicable(),
      incorrectHighConfidenceRate: measured(0),
      unknownHostOpenings: measured(0),
      staleDecisions: measured(0),
    },
    evidence: {
      wallGeometry: wallMetric,
      wallTopology: null,
      openings: null,
      roomDetection: roomMetric,
      roomIous: [],
      totalAreaAbsolutePercentageErrors: input.totalAreaError === null || input.totalAreaError === undefined ? [] : [input.totalAreaError],
      roomAreaAbsolutePercentageErrors: [...(input.roomAreaErrors ?? [])],
      highConfidencePredictionCount: 0,
      highConfidenceFalsePositiveCount: 0,
      unknownHostOpenings: 0,
      staleDecisions: 0,
    },
  };
}

describe("recognition aggregate report", () => {
  it("computes micro F1 from summed entity counts rather than averaging fixture F1", () => {
    const aggregate = aggregateRecognitionResults([
      fixtureResult({ id: "a", wall: [9, 1, 1] }),
      fixtureResult({ id: "b", wall: [1, 9, 9] }),
    ]);
    expect(aggregate.metrics.wallGeometryF1).toEqual({ status: "measured", value: 0.5 });
  });

  it("uses all measured error values for medians", () => {
    const aggregate = aggregateRecognitionResults([
      fixtureResult({ id: "a", totalAreaError: 0.1, roomAreaErrors: [0.1, 0.7] }),
      fixtureResult({ id: "b", totalAreaError: 0.3, roomAreaErrors: [0.3] }),
    ]);
    expect(aggregate.metrics.totalAreaMedianAbsolutePercentageError).toEqual({ status: "measured", value: 0.2 });
    expect(aggregate.metrics.roomAreaMedianAbsolutePercentageError).toEqual({ status: "measured", value: 0.3 });
  });

  it("includes failed room-enabled fixtures in exact-zone denominator", () => {
    const aggregate = aggregateRecognitionResults([
      fixtureResult({ id: "pass", room: [1, 0, 0], exactZoneCount: 1 }),
      fixtureResult({ id: "fail", room: [0, 0, 1], exactZoneCount: 0, failed: true }),
    ]);
    expect(aggregate.failedFixtureCount).toBe(1);
    expect(aggregate.metrics.exactZoneCountRate).toEqual({ status: "measured", value: 0.5 });
  });

  it("excludes only explicit not-applicable values", () => {
    const aggregate = aggregateRecognitionResults([
      fixtureResult({ id: "room", room: [1, 0, 0], exactZoneCount: 1 }),
      fixtureResult({ id: "no-room", room: null, exactZoneCount: null }),
    ]);
    expect(aggregate.metrics.exactZoneCountRate).toEqual({ status: "measured", value: 1 });
  });
});
