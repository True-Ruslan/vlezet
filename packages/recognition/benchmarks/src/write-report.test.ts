import type { RecognitionBenchmarkResultV1 } from "../schema/result-v1";
import { describe, expect, it } from "vitest";
import { renderRecognitionBenchmarkMarkdown } from "./write-report";

const notApplicable = { status: "not-applicable" as const };
const measured = (value: number) => ({ status: "measured" as const, value });

function result(): RecognitionBenchmarkResultV1 {
  return {
    schemaVersion: "recognition-benchmark-result-v1",
    corpusVersion: "recognition-corpus-v1",
    recognitionEngineVersion: "3",
    commitSha: "a".repeat(40),
    generatedAt: "2026-08-01T20:00:00.000Z",
    fixtures: [{
      fixtureId: "clean-studio",
      failed: false,
      diagnostics: [],
      metrics: {
        wallGeometryF1: measured(0.75),
        wallTopologyF1: measured(0.5),
        openingF1: measured(0.25),
        exactZoneCount: measured(0),
        totalAreaAbsolutePercentageError: notApplicable,
        roomAreaMedianAbsolutePercentageError: notApplicable,
        incorrectHighConfidenceRate: measured(0.1),
        unknownHostOpenings: measured(1),
        staleDecisions: measured(0),
      },
      evidence: {
        wallGeometry: { truePositive: 3, falsePositive: 1, falseNegative: 1, precision: 0.75, recall: 0.75, f1: 0.75 },
        wallTopology: null,
        openings: null,
        roomDetection: null,
        roomIous: [],
        totalAreaAbsolutePercentageErrors: [],
        roomAreaAbsolutePercentageErrors: [],
        highConfidencePredictionCount: 10,
        highConfidenceFalsePositiveCount: 1,
        unknownHostOpenings: 1,
        staleDecisions: 0,
      },
    }],
    aggregate: {
      fixtureCount: 1,
      failedFixtureCount: 0,
      metrics: {
        wallGeometryF1: measured(0.75),
        wallTopologyF1: measured(0.5),
        openingF1: measured(0.25),
        exactZoneCountRate: measured(0),
        totalAreaMedianAbsolutePercentageError: notApplicable,
        roomAreaMedianAbsolutePercentageError: notApplicable,
        incorrectHighConfidenceRate: measured(0.1),
        unknownHostOpenings: measured(1),
        staleDecisions: measured(0),
      },
    },
    baselineComparison: null,
  };
}

describe("recognition benchmark Markdown report", () => {
  it("contains identity, aggregate metrics and every fixture", () => {
    const report = renderRecognitionBenchmarkMarkdown(result());
    expect(report).toContain("recognition-corpus-v1");
    expect(report).toContain("Engine | `3`");
    expect(report).toContain("Fixtures | 1");
    expect(report).toContain("Wall geometry F1 | 0.750000");
    expect(report).toContain("clean-studio");
    expect(report).toContain("not applicable");
    expect(report.endsWith("\n")).toBe(true);
  });
});
