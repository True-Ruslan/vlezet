import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LOCAL_RECOGNITION_ENGINE_VERSION, validateRecognitionDraft } from "../../src/index";
import type { BenchmarkMetricValue, RecognitionFixtureResultV1 } from "../schema/result-v1";
import { validateRecognitionBenchmarkResultV1 } from "../schema/result-v1";
import { scoreRealWallGeometry } from "../../../../tools/recognition-benchmark/score-real-geometry.mjs";
import { scoreRealOpenings } from "../../../../tools/recognition-benchmark/score-real-openings.mjs";
import { aggregateRecognitionResults } from "./aggregate-report";
import { canonicalBenchmarkJson } from "./canonical-json";
import { scoreRecognitionFixture } from "./score-fixture";
import { renderRecognitionSourceOverlaySvg } from "./source-overlay-svg";
import { renderRecognitionBenchmarkMarkdown } from "./write-report";

const commandEnabled = process.env.RECOGNITION_REAL_SOURCE_BENCHMARK_COMMAND === "1";
const corpusRoot = fileURLToPath(new URL("../real-analogues", import.meta.url));

function measured(value: number): BenchmarkMetricValue {
  return { status: "measured", value: Number(value.toFixed(12)) };
}

function realFixtureScore(
  fixture: Parameters<typeof scoreRecognitionFixture>[0]["fixture"],
  draft: ReturnType<typeof validateRecognitionDraft>,
): RecognitionFixtureResultV1 {
  const base = scoreRecognitionFixture({
    fixture,
    wallPredictions: draft.walls,
    openingPredictions: draft.openings,
    roomPredictions: [],
    reconciliationSnapshot: draft,
    failure: null,
  });
  const walls = scoreRealWallGeometry({ fixture, predictions: draft.walls });
  const openings = scoreRealOpenings({
    fixture,
    wallPredictions: draft.walls,
    openingPredictions: draft.openings,
  });
  const matchedKeys = new Set([
    ...walls.matchedPredictionIds.map((id) => `wall:${id}`),
    ...openings.matchedPredictionIds.map((id) => `opening:${id}`),
  ]);
  const activePredictions = [
    ...draft.walls.filter((candidate) => candidate.conflict === null).map((candidate) => ({
      key: `wall:${candidate.id}`,
      confidence: candidate.confidence,
    })),
    ...draft.openings.filter((candidate) => candidate.conflict === null).map((candidate) => ({
      key: `opening:${candidate.id}`,
      confidence: candidate.confidence,
    })),
  ];
  const highConfidencePredictionCount = activePredictions.filter((candidate) => candidate.confidence === "high").length;
  const highConfidenceFalsePositiveCount = activePredictions.filter((candidate) =>
    candidate.confidence === "high" && !matchedKeys.has(candidate.key)).length;
  const incorrectHighConfidenceRate = highConfidencePredictionCount === 0
    ? 0
    : highConfidenceFalsePositiveCount / highConfidencePredictionCount;
  const diagnostics = [
    ...base.diagnostics,
    ...openings.unknownHostOpenings.map((opening) =>
      `unknown-host-opening:${opening.openingId}:${opening.hostWallCandidateId ?? "null"}`),
  ];

  return {
    ...base,
    diagnostics,
    metrics: {
      ...base.metrics,
      wallGeometryF1: measured(walls.metrics.f1),
      openingF1: measured(openings.metrics.f1),
      incorrectHighConfidenceRate: measured(incorrectHighConfidenceRate),
      unknownHostOpenings: measured(openings.unknownHostOpeningCount),
    },
    evidence: {
      ...base.evidence,
      wallGeometry: walls.metrics,
      openings: openings.metrics,
      highConfidencePredictionCount,
      highConfidenceFalsePositiveCount,
      unknownHostOpenings: openings.unknownHostOpeningCount,
    },
  };
}

describe.skipIf(!commandEnabled)("Real Source Recognition Benchmark command", () => {
  it("scores all twelve public real-plan analogue predictions", async () => {
    const predictionsDirectory = process.env.RECOGNITION_REAL_SOURCE_PREDICTIONS_DIR;
    const outputDirectory = process.env.RECOGNITION_REAL_SOURCE_OUTPUT_DIR;
    const commitSha = process.env.RECOGNITION_BENCHMARK_COMMIT_SHA;
    if (!predictionsDirectory || !outputDirectory || !commitSha) {
      throw new Error("Real Source Benchmark requires prediction, output and commit SHA environment values.");
    }

    const manifest = JSON.parse(await readFile(join(corpusRoot, "analogue-manifest.json"), "utf8")) as {
      corpusVersion: string;
      fixtures: readonly { fixtureId: string }[];
    };
    const fixtureIds = manifest.fixtures.map((entry) => entry.fixtureId).sort();
    expect(fixtureIds).toHaveLength(12);
    await mkdir(outputDirectory, { recursive: true });
    const fixtures: RecognitionFixtureResultV1[] = [];

    for (const fixtureId of fixtureIds) {
      const fixtureDirectory = join(corpusRoot, "fixtures", fixtureId);
      const fixture = JSON.parse(await readFile(join(fixtureDirectory, "fixture.json"), "utf8"));
      try {
        const draft = validateRecognitionDraft(JSON.parse(
          await readFile(join(predictionsDirectory, `${fixtureId}.json`), "utf8"),
        ) as unknown);
        fixtures.push(realFixtureScore(fixture, draft));
        const sourceBase64 = (await readFile(join(fixtureDirectory, "source.png"))).toString("base64");
        await writeFile(
          join(outputDirectory, `${fixtureId}.svg`),
          renderRecognitionSourceOverlaySvg({ fixture, draft, sourceBase64 }),
          "utf8",
        );
      } catch (cause) {
        fixtures.push(scoreRecognitionFixture({
          fixture,
          wallPredictions: [],
          openingPredictions: [],
          roomPredictions: [],
          reconciliationSnapshot: null,
          failure: cause instanceof Error ? cause : new Error(String(cause)),
        }));
      }
    }

    const result = validateRecognitionBenchmarkResultV1({
      schemaVersion: "recognition-benchmark-result-v1",
      corpusVersion: manifest.corpusVersion,
      recognitionEngineVersion: LOCAL_RECOGNITION_ENGINE_VERSION,
      commitSha,
      generatedAt: "2026-08-04T00:00:00.000Z",
      fixtures,
      aggregate: aggregateRecognitionResults(fixtures),
      baselineComparison: null,
    });
    expect(result.fixtures).toHaveLength(12);
    expect(result.aggregate.failedFixtureCount).toBe(0);
    await writeFile(join(outputDirectory, "recognition-real-source-result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
    await writeFile(join(outputDirectory, "recognition-real-source-canonical.json"), canonicalBenchmarkJson(result), "utf8");
    await writeFile(join(outputDirectory, "recognition-real-source-report.md"), renderRecognitionBenchmarkMarkdown(result), "utf8");
  }, 45_000);
});
