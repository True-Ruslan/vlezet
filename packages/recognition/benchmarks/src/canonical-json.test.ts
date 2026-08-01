import type { RecognitionBenchmarkResultV1 } from "../schema/result-v1";
import { describe, expect, it } from "vitest";
import { canonicalBenchmarkJson } from "./canonical-json";

function measured(value: number) {
  return { status: "measured" as const, value };
}

function fixture(fixtureId: string, diagnostics: readonly string[]): RecognitionBenchmarkResultV1["fixtures"][number] {
  return {
    fixtureId,
    failed: false,
    diagnostics,
    metrics: {
      wallGeometryF1: measured(0.123456789),
      wallTopologyF1: measured(0.5),
      openingF1: measured(0.5),
      exactZoneCount: measured(0),
      totalAreaAbsolutePercentageError: measured(0.2),
      roomAreaMedianAbsolutePercentageError: measured(0.3),
      incorrectHighConfidenceRate: measured(0.1),
      unknownHostOpenings: measured(2),
      staleDecisions: measured(0),
    },
    evidence: {
      wallGeometry: { truePositive: 1, falsePositive: 2, falseNegative: 3, precision: 1 / 3, recall: 0.25, f1: 2 / 7 },
      wallTopology: null,
      openings: null,
      roomDetection: null,
      roomIous: [0.987654321, 0.123456789],
      totalAreaAbsolutePercentageErrors: [0.2],
      roomAreaAbsolutePercentageErrors: [0.4, 0.1],
      highConfidencePredictionCount: 10,
      highConfidenceFalsePositiveCount: 1,
      unknownHostOpenings: 2,
      staleDecisions: 0,
    },
  };
}

function result(generatedAt: string, fixtures: RecognitionBenchmarkResultV1["fixtures"]): RecognitionBenchmarkResultV1 {
  return {
    schemaVersion: "recognition-benchmark-result-v1",
    corpusVersion: "recognition-corpus-v1",
    recognitionEngineVersion: "3",
    commitSha: "a".repeat(40),
    generatedAt,
    fixtures,
    aggregate: {
      fixtureCount: fixtures.length,
      failedFixtureCount: 0,
      metrics: {
        wallGeometryF1: measured(0.123456789),
        wallTopologyF1: measured(0.5),
        openingF1: measured(0.5),
        exactZoneCountRate: measured(0),
        totalAreaMedianAbsolutePercentageError: measured(0.2),
        roomAreaMedianAbsolutePercentageError: measured(0.3),
        incorrectHighConfidenceRate: measured(0.1),
        unknownHostOpenings: measured(2),
        staleDecisions: measured(0),
      },
    },
    baselineComparison: null,
  };
}

describe("canonical recognition benchmark JSON", () => {
  it("ignores generatedAt, sorts fixtures/diagnostics/arrays and rounds to six decimals", () => {
    const first = canonicalBenchmarkJson(result("2026-08-01T20:00:00.000Z", [
      fixture("z", ["z-diagnostic", "a-diagnostic"]),
      fixture("a", ["b", "a"]),
    ]));
    const second = canonicalBenchmarkJson(result("2027-01-01T00:00:00.000Z", [
      fixture("a", ["a", "b"]),
      fixture("z", ["a-diagnostic", "z-diagnostic"]),
    ]));
    expect(second).toBe(first);
    expect(first).not.toContain("generatedAt");
    expect(first.indexOf('"fixtureId": "a"')).toBeLessThan(first.indexOf('"fixtureId": "z"'));
    expect(first).toContain("0.123457");
    expect(first.endsWith("\n")).toBe(true);
  });

  it("is byte-identical across repeated calls", () => {
    const input = result("2026-08-01T20:00:00.000Z", [fixture("a", ["diagnostic"])]);
    expect(canonicalBenchmarkJson(input)).toBe(canonicalBenchmarkJson(input));
  });
});
