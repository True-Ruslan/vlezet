import type { BenchmarkMetricValue, RecognitionBenchmarkResultV1 } from "../schema/result-v1";
import { describe, expect, it } from "vitest";
import { compareRecognitionBaseline } from "./compare-baseline";

function measured(value: number): BenchmarkMetricValue {
  return { status: "measured", value };
}

function result(overrides: Readonly<{
  commitSha?: string;
  corpusVersion?: string;
  wallGeometryF1?: number;
  totalAreaError?: number;
  fixtureIds?: readonly string[];
  roomAreaApplicable?: boolean;
}> = {}): RecognitionBenchmarkResultV1 {
  const fixtureIds = overrides.fixtureIds ?? ["a", "b"];
  const roomAreaMetric: BenchmarkMetricValue = overrides.roomAreaApplicable === false
    ? { status: "not-applicable" }
    : measured(0.3);
  return {
    schemaVersion: "recognition-benchmark-result-v1",
    corpusVersion: (overrides.corpusVersion ?? "recognition-corpus-v1") as "recognition-corpus-v1",
    recognitionEngineVersion: "3",
    commitSha: overrides.commitSha ?? "a".repeat(40),
    generatedAt: "2026-08-01T20:00:00.000Z",
    fixtures: fixtureIds.map((fixtureId) => ({
      fixtureId,
      failed: false,
      diagnostics: [],
      metrics: {
        wallGeometryF1: measured(overrides.wallGeometryF1 ?? 0.5),
        wallTopologyF1: measured(0.4),
        openingF1: measured(0.3),
        exactZoneCount: measured(0),
        totalAreaAbsolutePercentageError: measured(overrides.totalAreaError ?? 0.2),
        roomAreaMedianAbsolutePercentageError: roomAreaMetric,
        incorrectHighConfidenceRate: measured(0.1),
        unknownHostOpenings: measured(2),
        staleDecisions: measured(0),
      },
      evidence: {
        wallGeometry: { truePositive: 1, falsePositive: 1, falseNegative: 1, precision: 0.5, recall: 0.5, f1: 0.5 },
        wallTopology: null,
        openings: null,
        roomDetection: null,
        roomIous: [],
        totalAreaAbsolutePercentageErrors: [overrides.totalAreaError ?? 0.2],
        roomAreaAbsolutePercentageErrors: overrides.roomAreaApplicable === false ? [] : [0.3],
        highConfidencePredictionCount: 10,
        highConfidenceFalsePositiveCount: 1,
        unknownHostOpenings: 2,
        staleDecisions: 0,
      },
    })),
    aggregate: {
      fixtureCount: fixtureIds.length,
      failedFixtureCount: 0,
      metrics: {
        wallGeometryF1: measured(overrides.wallGeometryF1 ?? 0.5),
        wallTopologyF1: measured(0.4),
        openingF1: measured(0.3),
        exactZoneCountRate: measured(0),
        totalAreaMedianAbsolutePercentageError: measured(overrides.totalAreaError ?? 0.2),
        roomAreaMedianAbsolutePercentageError: roomAreaMetric,
        incorrectHighConfidenceRate: measured(0.1),
        unknownHostOpenings: measured(2),
        staleDecisions: measured(0),
      },
    },
    baselineComparison: null,
  };
}

describe("recognition baseline comparison", () => {
  it("accepts improvements and records metric directions", () => {
    const comparison = compareRecognitionBaseline(
      result({ wallGeometryF1: 0.6, totalAreaError: 0.1, commitSha: "b".repeat(40) }),
      result({ wallGeometryF1: 0.5, totalAreaError: 0.2 }),
    );
    expect(comparison.metrics.find((metric) => metric.metric === "wallGeometryF1")?.status).toBe("improvement");
    expect(comparison.metrics.find((metric) => metric.metric === "totalAreaMedianAbsolutePercentageError")?.status).toBe("improvement");
  });

  it("omits a metric that is not applicable in both runs", () => {
    const comparison = compareRecognitionBaseline(
      result({ commitSha: "b".repeat(40), roomAreaApplicable: false }),
      result({ roomAreaApplicable: false }),
    );
    expect(comparison.metrics.some((metric) => metric.metric === "roomAreaMedianAbsolutePercentageError")).toBe(false);
  });

  it("rejects a metric applicability change without an explicit migration", () => {
    expect(() => compareRecognitionBaseline(
      result({ commitSha: "b".repeat(40), roomAreaApplicable: false }),
      result({ roomAreaApplicable: true }),
    )).toThrow(/applicability/i);
  });

  it("throws when an F1 metric regresses", () => {
    expect(() => compareRecognitionBaseline(
      result({ wallGeometryF1: 0.49, commitSha: "b".repeat(40) }),
      result({ wallGeometryF1: 0.5 }),
    )).toThrow(/wallGeometryF1/);
  });

  it("throws when a lower-is-better error metric increases", () => {
    expect(() => compareRecognitionBaseline(
      result({ totalAreaError: 0.21, commitSha: "b".repeat(40) }),
      result({ totalAreaError: 0.2 }),
    )).toThrow(/totalAreaMedianAbsolutePercentageError/);
  });

  it("throws when a fixture disappears", () => {
    expect(() => compareRecognitionBaseline(
      result({ fixtureIds: ["a"], commitSha: "b".repeat(40) }),
      result({ fixtureIds: ["a", "b"] }),
    )).toThrow(/fixture/i);
  });

  it("throws on schema/corpus migration without an explicit migration", () => {
    const baseline = result();
    const current = { ...result({ commitSha: "b".repeat(40) }), schemaVersion: "future" };
    expect(() => compareRecognitionBaseline(current as unknown as RecognitionBenchmarkResultV1, baseline)).toThrow(/schema/i);
  });

  it("rejects an uncommitted all-zero baseline marker", () => {
    expect(() => compareRecognitionBaseline(
      result({ commitSha: "b".repeat(40) }),
      result({ commitSha: "0".repeat(40) }),
    )).toThrow(/uncommitted/i);
  });
});
