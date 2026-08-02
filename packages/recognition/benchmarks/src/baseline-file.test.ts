import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RecognitionBenchmarkResultV1 } from "../schema/result-v1";
import { afterEach, describe, expect, it } from "vitest";
import { writeRecognitionBaseline } from "./baseline-file";

const directories: string[] = [];
const measured = (value: number) => ({ status: "measured" as const, value });

function result(): RecognitionBenchmarkResultV1 {
  return {
    schemaVersion: "recognition-benchmark-result-v1",
    corpusVersion: "recognition-corpus-v1",
    recognitionEngineVersion: "3",
    commitSha: "a".repeat(40),
    generatedAt: "2026-08-01T20:00:00.000Z",
    fixtures: [],
    aggregate: {
      fixtureCount: 0,
      failedFixtureCount: 0,
      metrics: {
        wallGeometryF1: measured(1),
        wallTopologyF1: measured(1),
        openingF1: measured(1),
        exactZoneCountRate: measured(1),
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

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("recognition baseline file", () => {
  it("refuses to write without the explicit environment gate", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vlezet-baseline-"));
    directories.push(directory);
    await expect(writeRecognitionBaseline({
      result: result(),
      path: join(directory, "baseline.json"),
      environment: {},
    })).rejects.toThrow(/RECOGNITION_BENCHMARK_WRITE_BASELINE/);
  });

  it("writes canonical JSON only with the explicit environment gate", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vlezet-baseline-"));
    directories.push(directory);
    const path = join(directory, "baseline.json");
    await writeRecognitionBaseline({
      result: result(),
      path,
      environment: { RECOGNITION_BENCHMARK_WRITE_BASELINE: "1" },
    });
    const content = await readFile(path, "utf8");
    expect(content).toContain('"commitSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"');
    expect(content).not.toContain("generatedAt");
  });
});
