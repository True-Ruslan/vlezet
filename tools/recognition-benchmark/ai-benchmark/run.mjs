import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAiBenchmarkConfig } from "./config.mjs";
import {
  createOpenRouterBenchmarkClient,
  redactAiBenchmarkText,
} from "./openrouter-client.mjs";
import {
  buildAiBenchmarkReport,
  canonicalAiBenchmarkJson,
} from "./report.mjs";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const toolDirectory = resolve(moduleDirectory, "..");
const repositoryRoot = resolve(toolDirectory, "../..");
const DEFAULT_FIXTURES_ROOT = join(
  repositoryRoot,
  "packages/recognition/benchmarks/real-analogues/fixtures",
);
const DEFAULT_PREDICTIONS_ROOT = join(toolDirectory, "artifacts/real-source/predictions");
const DEFAULT_OUTPUT_PATH = join(toolDirectory, "artifacts/ai/recognition-ai-benchmark.json");
const DEFAULT_REPRESENTATIVE_FIXTURES = [
  "real-plan-001-anonymized",
  "real-plan-002-anonymized",
  "real-plan-008-anonymized",
];

function commaList(value, fallback) {
  if (typeof value !== "string" || value.trim().length === 0) return fallback;
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function integerEnvironment(value, fallback) {
  if (typeof value !== "string" || value.trim().length === 0) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`Expected an integer, received '${value}'.`);
  return parsed;
}

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

function expectedOpeningKinds(fixture, localSummary) {
  const calibration = fixture.calibration;
  const tolerancePx = Math.max(
    20,
    (fixture.tolerances?.openingCenterMm ?? 280) / calibration.millimetersPerPixel,
  );
  const expected = (fixture.expectedOpenings ?? []).map((opening) => ({
    kind: opening.kind,
    x: calibration.originPx.x + opening.centerMm.x / calibration.millimetersPerPixel,
    y: calibration.originPx.y + opening.centerMm.y / calibration.millimetersPerPixel,
  }));
  const result = {};
  for (const opening of localSummary.openings ?? []) {
    const x = opening.center.x * calibration.sourceWidthPx;
    const y = opening.center.y * calibration.sourceHeightPx;
    const candidates = expected
      .map((entry) => ({ entry, distance: Math.hypot(entry.x - x, entry.y - y) }))
      .filter((entry) => entry.distance <= tolerancePx)
      .sort((first, second) => first.distance - second.distance);
    if (candidates[0]) result[opening.id] = candidates[0].entry.kind;
  }
  return result;
}

function safetyViolationsFromError(error) {
  const message = redactAiBenchmarkText(error instanceof Error ? error.message : String(error));
  const violations = [];
  if (/unknown candidate|unknown wall|unknown opening/i.test(message)) violations.push("unknown-candidate-id");
  if (/forbidden geometry|coordinates|thickness|host wall|orientation|start|end/i.test(message)) {
    violations.push("geometry-authority-violation");
  }
  return { message, violations };
}

export function configFromEnvironment(environment = process.env) {
  return validateAiBenchmarkConfig({
    modelIds: commaList(environment.AI_BENCHMARK_MODELS, ["google/gemini-2.5-flash"]),
    fixtureIds: commaList(environment.AI_BENCHMARK_FIXTURES, DEFAULT_REPRESENTATIVE_FIXTURES),
    repetitions: integerEnvironment(environment.AI_BENCHMARK_REPETITIONS, 3),
    maximumTokens: integerEnvironment(environment.AI_BENCHMARK_MAX_TOKENS, 2048),
    timeoutMs: integerEnvironment(environment.AI_BENCHMARK_TIMEOUT_MS, 90_000),
    mode: environment.AI_BENCHMARK_MODE === "verification" ? "verification" : "disputed-zones",
  });
}

export async function runAiBenchmark(input = {}) {
  const config = input.config ?? configFromEnvironment(input.environment);
  const fixturesRoot = resolve(input.fixturesRoot ?? DEFAULT_FIXTURES_ROOT);
  const predictionsRoot = resolve(input.predictionsRoot ?? DEFAULT_PREDICTIONS_ROOT);
  const outputPath = resolve(input.outputPath ?? DEFAULT_OUTPUT_PATH);
  const apiKey = input.apiKey ?? input.environment?.OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY ?? "";
  const client = createOpenRouterBenchmarkClient({ apiKey, fetcher: input.fetcher });
  const prepared = [];

  for (const fixtureId of config.fixtureIds) {
    const directory = join(fixturesRoot, fixtureId);
    const fixture = await readJson(join(directory, "fixture.json"), `${fixtureId} fixture`);
    const localSummary = await readJson(
      join(predictionsRoot, `${fixtureId}.json`),
      `${fixtureId} local prediction`,
    );
    const source = await readFile(join(directory, "source.png"));
    prepared.push({
      fixtureId,
      fixture,
      localSummary,
      imageDataUrl: `data:image/png;base64,${source.toString("base64")}`,
      expectedOpeningKinds: expectedOpeningKinds(fixture, localSummary),
    });
  }

  const runs = [];
  for (const modelId of config.modelIds) {
    for (const preparedFixture of prepared) {
      for (let repetition = 1; repetition <= config.repetitions; repetition += 1) {
        const startedAt = Date.now();
        try {
          const result = await client.verify({
            modelId,
            imageDataUrl: preparedFixture.imageDataUrl,
            localSummary: preparedFixture.localSummary,
            maximumTokens: config.maximumTokens,
            timeoutMs: config.timeoutMs,
            mode: config.mode,
          });
          runs.push({
            modelId,
            fixtureId: preparedFixture.fixtureId,
            repetition,
            latencyMs: result.latencyMs,
            usage: result.usage,
            response: result.response,
            localSummary: preparedFixture.localSummary,
            expectedOpeningKinds: preparedFixture.expectedOpeningKinds,
            schemaFailure: false,
            safetyViolations: [],
            error: null,
          });
        } catch (cause) {
          const failure = safetyViolationsFromError(cause);
          runs.push({
            modelId,
            fixtureId: preparedFixture.fixtureId,
            repetition,
            latencyMs: Date.now() - startedAt,
            usage: null,
            response: { walls: [], openings: [] },
            localSummary: preparedFixture.localSummary,
            expectedOpeningKinds: preparedFixture.expectedOpeningKinds,
            schemaFailure: true,
            safetyViolations: failure.violations,
            error: failure.message,
          });
        }
      }
    }
  }

  const report = buildAiBenchmarkReport({
    config,
    runs,
    commitSha: input.commitSha ?? input.environment?.GITHUB_SHA ?? process.env.GITHUB_SHA ?? null,
  });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, canonicalAiBenchmarkJson(report), "utf8");
  return report;
}

async function main() {
  const report = await runAiBenchmark();
  for (const model of report.models) {
    process.stdout.write(
      `${model.modelId}: stable=${model.score.stableDecisionRate.toFixed(3)}, schema-fail=${model.score.schemaFailureRate.toFixed(3)}, safety=${model.score.safetyViolationCount}, qualified=false\n`,
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((cause) => {
    process.stderr.write(`${redactAiBenchmarkText(cause instanceof Error ? cause.message : String(cause))}\n`);
    process.exitCode = 1;
  });
}
