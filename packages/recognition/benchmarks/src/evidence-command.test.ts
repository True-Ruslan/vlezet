import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const benchmarkDirectory = dirname(fileURLToPath(new URL("../../../../tools/recognition-benchmark/run-evidence.mjs", import.meta.url)));
const commandPath = join(benchmarkDirectory, "run-evidence.mjs");
const sha = "a".repeat(40);
const measured = (value: number) => ({ status: "measured", value });

function result(baselineComparison: unknown) {
  return {
    schemaVersion: "recognition-benchmark-result-v1",
    corpusVersion: "recognition-corpus-v1",
    recognitionEngineVersion: "3",
    commitSha: sha,
    generatedAt: "2026-08-01T00:00:00.000Z",
    fixtures: Array.from({ length: 8 }, (_, index) => ({
      fixtureId: `fixture-${index}`,
      failed: false,
      diagnostics: [],
      metrics: {},
      evidence: {},
    })),
    aggregate: {
      fixtureCount: 8,
      failedFixtureCount: 0,
      metrics: {
        wallGeometryF1: measured(0.2),
        wallTopologyF1: measured(0.2),
        openingF1: measured(0),
        exactZoneCountRate: measured(0),
        totalAreaMedianAbsolutePercentageError: measured(1),
        roomAreaMedianAbsolutePercentageError: { status: "not-applicable" },
        incorrectHighConfidenceRate: measured(1),
        unknownHostOpenings: measured(0),
        staleDecisions: measured(0),
      },
    },
    baselineComparison,
  };
}

describe("recognition benchmark evidence command", () => {
  it("combines scored results and eight overlays into self-contained checksums", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "vlezet-recognition-evidence-"));
    try {
      const corePath = join(temporary, "core.json");
      const sourcePath = join(temporary, "source.json");
      const overlaysDirectory = join(temporary, "source-overlays");
      const outputDirectory = join(temporary, "evidence");
      await mkdir(overlaysDirectory, { recursive: true });
      await writeFile(corePath, JSON.stringify(result({
        baselineSourceSha: "b".repeat(40),
        metrics: [],
      })), "utf8");
      await writeFile(sourcePath, JSON.stringify(result(null)), "utf8");
      for (let index = 0; index < 8; index += 1) {
        await writeFile(
          join(overlaysDirectory, `fixture-${index}.svg`),
          `<svg xmlns="http://www.w3.org/2000/svg"><title>fixture-${index}</title></svg>\n`,
          "utf8",
        );
      }

      const command = spawnSync(process.execPath, [commandPath], {
        encoding: "utf8",
        env: {
          ...process.env,
          RECOGNITION_CORE_RESULT_PATH: corePath,
          RECOGNITION_SOURCE_RESULT_PATH: sourcePath,
          RECOGNITION_SOURCE_OVERLAYS_DIR: overlaysDirectory,
          RECOGNITION_EVIDENCE_OUTPUT_DIR: outputDirectory,
        },
      });

      expect(command.status, `${command.stdout}\n${command.stderr}`).toBe(0);
      const evidence = JSON.parse(await readFile(join(outputDirectory, "recognition-benchmark-evidence.json"), "utf8"));
      expect(evidence).toMatchObject({
        schemaVersion: "recognition-benchmark-evidence-v1",
        commitSha: sha,
        fixtureCount: 8,
        overlayFiles: Array.from({ length: 8 }, (_, index) => `overlays/fixture-${index}.svg`),
      });
      expect(await readFile(join(outputDirectory, "recognition-benchmark-summary.md"), "utf8")).toContain("Core baseline comparison");
      expect(await readFile(join(outputDirectory, "overlays/fixture-0.svg"), "utf8")).toContain("<svg");
      const checksums = await readFile(join(outputDirectory, "SHA256SUMS"), "utf8");
      expect(checksums).toContain("recognition-core-result.json");
      expect(checksums).toContain("recognition-source-result.json");
      expect(checksums).toContain("recognition-benchmark-evidence.json");
      expect(checksums).toContain("recognition-benchmark-summary.md");
      expect(checksums).toContain("overlays/fixture-0.svg");
      expect(checksums).toContain("overlays/fixture-7.svg");

      const verification = spawnSync("sha256sum", ["-c", "SHA256SUMS"], {
        cwd: outputDirectory,
        encoding: "utf8",
      });
      expect(verification.status, `${verification.stdout}\n${verification.stderr}`).toBe(0);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
});
