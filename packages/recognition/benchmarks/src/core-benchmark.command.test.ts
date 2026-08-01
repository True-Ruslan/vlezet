import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCoreRecognitionBenchmark } from "./core-benchmark";

const corpusRoot = fileURLToPath(new URL("../fixtures", import.meta.url));
const commandOutput = process.env.RECOGNITION_BENCHMARK_OUTPUT_DIR;
const commandEnabled = process.env.RECOGNITION_BENCHMARK_COMMAND === "1";

describe.skipIf(!commandEnabled)("Core Recognition Benchmark command", () => {
  it("scores all eight fixtures and writes repeatable artifacts", async () => {
    const temporary = commandOutput ? null : await mkdtemp(join(tmpdir(), "vlezet-core-benchmark-"));
    const firstDirectory = commandOutput ?? temporary!;
    const secondDirectory = temporary ? join(temporary, "repeat") : join(commandOutput!, "repeatability-check");
    try {
      const options = {
        corpusRoot,
        commitSha: process.env.RECOGNITION_BENCHMARK_COMMIT_SHA ?? "a".repeat(40),
        generatedAt: "2026-08-01T00:00:00.000Z",
      } as const;
      const first = await runCoreRecognitionBenchmark({ ...options, outputDirectory: firstDirectory });
      const second = await runCoreRecognitionBenchmark({ ...options, outputDirectory: secondDirectory });
      expect(first.fixtures).toHaveLength(8);
      expect(first.aggregate.fixtureCount).toBe(8);
      expect(first.aggregate.failedFixtureCount).toBe(0);
      expect(second.aggregate).toEqual(first.aggregate);
      const firstCanonical = await readFile(join(firstDirectory, "recognition-core-canonical.json"), "utf8");
      const secondCanonical = await readFile(join(secondDirectory, "recognition-core-canonical.json"), "utf8");
      expect(secondCanonical).toBe(firstCanonical);
      expect(await readFile(join(firstDirectory, "recognition-core-report.md"), "utf8")).toContain("Recognition Benchmark Report");
    } finally {
      if (temporary) await rm(temporary, { recursive: true, force: true });
      else await rm(secondDirectory, { recursive: true, force: true });
    }
  }, 30_000);
});
