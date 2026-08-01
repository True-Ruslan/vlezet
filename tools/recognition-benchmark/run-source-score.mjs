import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const toolDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(toolDirectory, "../..");
const predictionsDirectory = resolve(toolDirectory, "artifacts/source/predictions");
const outputDirectory = resolve(toolDirectory, "artifacts/source");
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(command, [
  "--filter",
  "@vlezet/recognition",
  "exec",
  "vitest",
  "run",
  "benchmarks/src/source-benchmark.command.test.ts",
  "--reporter=verbose",
], {
  cwd: repositoryRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    RECOGNITION_SOURCE_BENCHMARK_COMMAND: "1",
    RECOGNITION_SOURCE_PREDICTIONS_DIR: predictionsDirectory,
    RECOGNITION_SOURCE_OUTPUT_DIR: outputDirectory,
    RECOGNITION_BENCHMARK_COMMIT_SHA: process.env.RECOGNITION_BENCHMARK_COMMIT_SHA ?? process.env.GITHUB_SHA,
  },
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
