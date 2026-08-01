import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const toolDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(toolDirectory, "../..");
const outputDirectory = resolve(toolDirectory, "artifacts/core");
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(command, [
  "--filter",
  "@vlezet/recognition",
  "exec",
  "vitest",
  "run",
  "benchmarks/src/core-benchmark.command.ts",
  "--reporter=verbose",
], {
  cwd: repositoryRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    RECOGNITION_BENCHMARK_OUTPUT_DIR: outputDirectory,
    RECOGNITION_BENCHMARK_COMMIT_SHA: process.env.RECOGNITION_BENCHMARK_COMMIT_SHA ?? process.env.GITHUB_SHA,
  },
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
