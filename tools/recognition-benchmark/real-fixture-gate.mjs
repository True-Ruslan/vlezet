import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  enforceRealFixtureGate,
  scoreFailureExpectations,
} from "./score-failure-expectations.mjs";

const toolDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(toolDirectory, "../..");
const DEFAULT_FIXTURES_ROOT = join(
  repositoryRoot,
  "packages/recognition/benchmarks/real-analogues/fixtures",
);
const DEFAULT_PREDICTIONS_ROOT = join(toolDirectory, "artifacts/real-source/predictions");
const DEFAULT_BENCHMARK_RESULT = join(toolDirectory, "artifacts/real-source/recognition-real-source-result.json");
const DEFAULT_OUTPUT_PATH = join(toolDirectory, "artifacts/real-source/recognition-real-gate.json");

async function readJson(path, label) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (cause) {
    throw new Error(`${label} is missing at ${path}.`, { cause });
  }
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new Error(`${label} contains invalid JSON at ${path}.`, { cause });
  }
}

async function fixtureIds(root) {
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && /^real-plan-\d{3}-anonymized$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

export async function runRealFixtureGate(input = {}) {
  const fixturesRoot = resolve(input.fixturesRoot ?? DEFAULT_FIXTURES_ROOT);
  const predictionsRoot = resolve(input.predictionsRoot ?? DEFAULT_PREDICTIONS_ROOT);
  const benchmarkResultPath = resolve(input.benchmarkResultPath ?? DEFAULT_BENCHMARK_RESULT);
  const outputPath = input.outputPath === null
    ? null
    : resolve(input.outputPath ?? DEFAULT_OUTPUT_PATH);
  const benchmarkResult = input.benchmarkResult
    ?? await readJson(benchmarkResultPath, "Real Source Benchmark result");
  const ids = await fixtureIds(fixturesRoot);
  if (ids.length !== 12) {
    throw new Error(`M7.9 real fixture gate requires exactly 12 fixtures; found ${ids.length}.`);
  }

  const scenarioScores = [];
  for (const fixtureId of ids) {
    const fixtureDirectory = join(fixturesRoot, fixtureId);
    const fixture = await readJson(join(fixtureDirectory, "fixture.json"), `${fixtureId} fixture`);
    const failureExpectations = await readJson(
      join(fixtureDirectory, "failure-expectations.json"),
      `${fixtureId} failure expectations`,
    );
    const recognitionResult = await readJson(
      join(predictionsRoot, `${fixtureId}.json`),
      `${fixtureId} prediction`,
    );
    scenarioScores.push(scoreFailureExpectations({
      fixture: { ...fixture, failureExpectations },
      recognitionResult,
    }));
  }

  let gate;
  let failureMessage = null;
  try {
    gate = enforceRealFixtureGate({
      benchmarkResult,
      scenarioScores,
      thresholds: input.thresholds,
    });
  } catch (cause) {
    gate = null;
    failureMessage = cause instanceof Error ? cause.message : String(cause);
  }

  const report = {
    schemaVersion: "recognition-real-fixture-gate-v1",
    passed: gate !== null,
    fixtureCount: ids.length,
    gate,
    scenarioScores,
    failureMessage,
  };
  if (outputPath) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  if (!gate) throw new Error(failureMessage ?? "M7.9 real fixture gate failed.");
  return report;
}

async function main() {
  const report = await runRealFixtureGate({
    benchmarkResultPath: process.argv[2] ?? DEFAULT_BENCHMARK_RESULT,
    fixturesRoot: process.argv[3] ?? DEFAULT_FIXTURES_ROOT,
    predictionsRoot: process.argv[4] ?? DEFAULT_PREDICTIONS_ROOT,
    outputPath: process.argv[5] ?? DEFAULT_OUTPUT_PATH,
  });
  process.stdout.write(
    `M7.9 real fixture gate passed: ${report.fixtureCount} fixtures, ${report.scenarioScores.reduce((total, score) => total + score.mustDetectPassed, 0)} critical detections.\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((cause) => {
    process.stderr.write(`${cause instanceof Error ? cause.message : "M7.9 real fixture gate failed."}\n`);
    process.exitCode = 1;
  });
}
