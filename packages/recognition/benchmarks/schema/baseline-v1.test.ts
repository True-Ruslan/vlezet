import { describe, expect, it } from "vitest";
import type { RecognitionBenchmarkResultV1 } from "./result-v1";
import { validateRecognitionBenchmarkBaselineV1 } from "./baseline-v1";

const measured = (value: number) => ({ status: "measured" as const, value });

function result(commitSha = "b".repeat(40)): RecognitionBenchmarkResultV1 {
  return {
    schemaVersion: "recognition-benchmark-result-v1",
    corpusVersion: "recognition-corpus-v1",
    recognitionEngineVersion: "3",
    commitSha,
    generatedAt: "2026-08-01T00:00:00.000Z",
    fixtures: [],
    aggregate: {
      fixtureCount: 0,
      failedFixtureCount: 0,
      metrics: {
        wallGeometryF1: measured(0),
        wallTopologyF1: measured(0),
        openingF1: measured(0),
        exactZoneCountRate: measured(0),
        totalAreaMedianAbsolutePercentageError: measured(0),
        roomAreaMedianAbsolutePercentageError: measured(0),
        incorrectHighConfidenceRate: measured(0),
        unknownHostOpenings: measured(0),
        staleDecisions: measured(0),
      },
    },
    baselineComparison: null,
  };
}

describe("recognition benchmark baseline v1", () => {
  it("records product base and harness source separately", () => {
    const baseline = {
      schemaVersion: "recognition-benchmark-baseline-v1",
      productBaseSha: "a".repeat(40),
      harnessSourceSha: "b".repeat(40),
      result: result(),
    };
    expect(validateRecognitionBenchmarkBaselineV1(baseline)).toEqual(baseline);
  });

  it("requires result.commitSha to equal harnessSourceSha", () => {
    expect(() => validateRecognitionBenchmarkBaselineV1({
      schemaVersion: "recognition-benchmark-baseline-v1",
      productBaseSha: "a".repeat(40),
      harnessSourceSha: "b".repeat(40),
      result: result("c".repeat(40)),
    })).toThrow(/harnessSourceSha/);
  });

  it.each(["productBaseSha", "harnessSourceSha"] as const)("rejects malformed %s", (key) => {
    const baseline = {
      schemaVersion: "recognition-benchmark-baseline-v1",
      productBaseSha: "a".repeat(40),
      harnessSourceSha: "b".repeat(40),
      result: result(),
      [key]: "head",
    };
    expect(() => validateRecognitionBenchmarkBaselineV1(baseline)).toThrow();
  });

  it("rejects an all-zero harness source", () => {
    expect(() => validateRecognitionBenchmarkBaselineV1({
      schemaVersion: "recognition-benchmark-baseline-v1",
      productBaseSha: "a".repeat(40),
      harnessSourceSha: "0".repeat(40),
      result: result("0".repeat(40)),
    })).toThrow(/zero/i);
  });
});
