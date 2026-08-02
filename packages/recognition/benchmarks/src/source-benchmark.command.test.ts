import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCAL_RECOGNITION_ENGINE_VERSION, validateRecognitionDraft } from "../../src/index";
import { validateRecognitionBenchmarkResultV1 } from "../schema/result-v1";
import { describe, expect, it } from "vitest";
import { aggregateRecognitionResults } from "./aggregate-report";
import { canonicalBenchmarkJson } from "./canonical-json";
import { loadRecognitionBenchmarkCorpus } from "./load-corpus";
import { scoreRecognitionFixture } from "./score-fixture";
import { renderRecognitionSourceOverlaySvg } from "./source-overlay-svg";
import { renderRecognitionBenchmarkMarkdown } from "./write-report";

const commandEnabled = process.env.RECOGNITION_SOURCE_BENCHMARK_COMMAND === "1";
const corpusRoot = fileURLToPath(new URL("../fixtures", import.meta.url));

describe.skipIf(!commandEnabled)("Source Recognition Benchmark command", () => {
  it("scores all browser predictions and writes deterministic source artifacts", async () => {
    const predictionsDirectory = process.env.RECOGNITION_SOURCE_PREDICTIONS_DIR;
    const outputDirectory = process.env.RECOGNITION_SOURCE_OUTPUT_DIR;
    const commitSha = process.env.RECOGNITION_BENCHMARK_COMMIT_SHA;
    if (!predictionsDirectory || !outputDirectory || !commitSha) {
      throw new Error("Source Benchmark command requires prediction, output and commit SHA environment values.");
    }

    const corpus = await loadRecognitionBenchmarkCorpus(corpusRoot);
    const fixtures = [];
    await mkdir(outputDirectory, { recursive: true });
    for (const entry of corpus) {
      try {
        const draft = validateRecognitionDraft(JSON.parse(await readFile(join(predictionsDirectory, `${entry.fixture.id}.json`), "utf8")) as unknown);
        fixtures.push(scoreRecognitionFixture({
          fixture: entry.fixture,
          wallPredictions: draft.walls,
          openingPredictions: draft.openings,
          roomPredictions: [],
          reconciliationSnapshot: draft,
          failure: null,
        }));
        const sourceBase64 = (await readFile(entry.sourcePath)).toString("base64");
        await writeFile(
          join(outputDirectory, `${entry.fixture.id}.svg`),
          renderRecognitionSourceOverlaySvg({ fixture: entry.fixture, draft, sourceBase64 }),
          "utf8",
        );
      } catch (cause) {
        fixtures.push(scoreRecognitionFixture({
          fixture: entry.fixture,
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
      corpusVersion: "recognition-corpus-v1",
      recognitionEngineVersion: LOCAL_RECOGNITION_ENGINE_VERSION,
      commitSha,
      generatedAt: "2026-08-01T00:00:00.000Z",
      fixtures,
      aggregate: aggregateRecognitionResults(fixtures),
      baselineComparison: null,
    });
    expect(result.fixtures).toHaveLength(8);
    expect(result.aggregate.failedFixtureCount).toBe(0);
    for (const entry of corpus) {
      expect((await readFile(join(outputDirectory, `${entry.fixture.id}.svg`), "utf8"))).toContain("data-layer=\"expected-walls\"");
    }
    await writeFile(join(outputDirectory, "recognition-source-result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
    await writeFile(join(outputDirectory, "recognition-source-canonical.json"), canonicalBenchmarkJson(result), "utf8");
    await writeFile(join(outputDirectory, "recognition-source-report.md"), renderRecognitionBenchmarkMarkdown(result), "utf8");
  }, 30_000);
});
