import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_AI_BENCHMARK_LIMITS } from "./config.mjs";

const REPORT_SCHEMA = "recognition-ai-benchmark-report-v1";
const CONFIG_SCHEMA = "recognition-ai-benchmark-config-v1";
const SCORE_SCHEMA = "recognition-ai-benchmark-score-v1";
const OUTPUT_SCHEMA = "recognition-ai-verification-qualification-v1";
const MIN_REPETITIONS = 3;
const COST_EPSILON_USD = 1e-9;
const ALLOWED_MODES = new Set(["verification", "disputed-zones"]);

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const toolDirectory = resolve(moduleDirectory, "..");
const DEFAULT_INPUT_PATH = resolve(toolDirectory, "artifacts/ai/recognition-ai-benchmark.json");
const DEFAULT_OUTPUT_PATH = resolve(toolDirectory, "artifacts/ai/recognition-ai-verification-qualification.json");

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function text(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function stringList(value, label) {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    throw new Error(`${label} must be a non-empty string array.`);
  }
  const result = value.map((entry) => entry.trim());
  if (new Set(result).size !== result.length) throw new Error(`${label} must not contain duplicates.`);
  return result;
}

function nonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer.`);
  return value;
}

function positiveInteger(value, label) {
  const result = nonNegativeInteger(value, label);
  if (result === 0) throw new Error(`${label} must be positive.`);
  return result;
}

function finiteNonNegative(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number.`);
  }
  return value;
}

function finiteMetric(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function nearlyEqual(first, second, epsilon = COST_EPSILON_USD) {
  return Math.abs(first - second) <= epsilon;
}

function block(blockers, message) {
  if (!blockers.includes(message)) blockers.push(message);
}

function normalizeUsage(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const promptTokens = value.promptTokens;
  const completionTokens = value.completionTokens;
  const totalTokens = value.totalTokens;
  const costUsd = value.costUsd;
  if (
    !Number.isInteger(promptTokens) || promptTokens < 0
    || !Number.isInteger(completionTokens) || completionTokens < 0
    || !Number.isInteger(totalTokens) || totalTokens < promptTokens + completionTokens
    || typeof costUsd !== "number" || !Number.isFinite(costUsd) || costUsd < 0
  ) return null;
  return { promptTokens, completionTokens, totalTokens, costUsd };
}

function normalizeSafetyViolations(value) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) return null;
  return value.map((entry) => entry.trim()).filter(Boolean);
}

function modelFixtureKey(modelId, fixtureId) {
  return `${modelId}\u0000${fixtureId}`;
}

function fixedPricePolicyIsSafe(config) {
  return config.maximumPromptPricePerMillionUsd === DEFAULT_AI_BENCHMARK_LIMITS.maximumPromptPricePerMillionUsd
    && config.maximumCompletionPricePerMillionUsd === DEFAULT_AI_BENCHMARK_LIMITS.maximumCompletionPricePerMillionUsd;
}

function reviewMetrics(score) {
  return {
    stableDecisionRate: finiteMetric(score.stableDecisionRate),
    openingClassificationAccuracy: finiteMetric(score.openingClassificationAccuracy),
    highConfidenceConfirmationRate: finiteMetric(score.highConfidenceConfirmationRate),
    falseDowngradeRate: finiteMetric(score.falseDowngradeRate),
    medianLatencyMs: finiteMetric(score.medianLatencyMs),
  };
}

export function evaluateVerificationBenchmarkQualification(input) {
  const report = object(input, "AI benchmark report");
  if (report.schemaVersion !== REPORT_SCHEMA) {
    throw new Error(`AI benchmark report must use ${REPORT_SCHEMA}.`);
  }
  if (report.qualified !== false) throw new Error("AI benchmark report must remain qualified=false.");

  const config = object(report.config, "AI benchmark report config");
  if (config.schemaVersion !== CONFIG_SCHEMA) throw new Error(`AI benchmark config must use ${CONFIG_SCHEMA}.`);
  if (config.qualified !== false) throw new Error("AI benchmark config must remain qualified=false.");
  if (!ALLOWED_MODES.has(config.mode)) throw new Error("Verification qualification accepts only verification or disputed-zones reports.");

  const modelIds = stringList(config.modelIds, "config.modelIds");
  const fixtureIds = stringList(config.fixtureIds, "config.fixtureIds");
  const repetitions = positiveInteger(config.repetitions, "config.repetitions");
  const maximumCostUsd = finiteNonNegative(config.maximumCostUsd, "config.maximumCostUsd");
  if (maximumCostUsd <= 0) throw new Error("config.maximumCostUsd must be positive.");

  const globalBlockers = [];
  if (maximumCostUsd > DEFAULT_AI_BENCHMARK_LIMITS.maximumCostUsd) {
    block(globalBlockers, `Hard benchmark cost cap exceeds $${DEFAULT_AI_BENCHMARK_LIMITS.maximumCostUsd}.`);
  }
  if (!fixedPricePolicyIsSafe(config)) {
    block(globalBlockers, "Provider price ceiling does not match the fixed benchmark safety policy.");
  }

  const expectedRunCount = modelIds.length * fixtureIds.length * repetitions;
  if (!Array.isArray(report.runs)) throw new Error("AI benchmark report runs must be an array.");
  const knownModels = new Set(modelIds);
  const knownFixtures = new Set(fixtureIds);
  const groups = new Map();
  let observedRunCostUsd = 0;
  let completeRunCost = true;

  report.runs.forEach((rawRun, index) => {
    const run = object(rawRun, `runs[${index}]`);
    const modelId = text(run.modelId, `runs[${index}].modelId`);
    const fixtureId = text(run.fixtureId, `runs[${index}].fixtureId`);
    if (!knownModels.has(modelId)) throw new Error(`runs[${index}] references unexpected model '${modelId}'.`);
    if (!knownFixtures.has(fixtureId)) throw new Error(`runs[${index}] references unexpected fixture '${fixtureId}'.`);
    const repetition = positiveInteger(run.repetition, `runs[${index}].repetition`);
    if (repetition > repetitions) throw new Error(`runs[${index}].repetition is outside 1..${repetitions}.`);
    const key = modelFixtureKey(modelId, fixtureId);
    const group = groups.get(key) ?? new Map();
    if (group.has(repetition)) {
      throw new Error(`Duplicate repetition ${repetition} for model '${modelId}' and fixture '${fixtureId}'.`);
    }
    const usage = normalizeUsage(run.usage);
    if (usage) observedRunCostUsd += usage.costUsd;
    else completeRunCost = false;
    group.set(repetition, {
      repetition,
      latencyMs: finiteMetric(run.latencyMs),
      usage,
      schemaFailure: run.schemaFailure === true,
      safetyViolations: normalizeSafetyViolations(run.safetyViolations),
      error: run.error == null ? null : String(run.error),
    });
    groups.set(key, group);
  });

  const execution = object(report.execution, "AI benchmark execution");
  const plannedRunCount = nonNegativeInteger(execution.plannedRunCount, "execution.plannedRunCount");
  const completedRunCount = nonNegativeInteger(execution.completedRunCount, "execution.completedRunCount");
  const executionMaximumCostUsd = finiteNonNegative(execution.maximumCostUsd, "execution.maximumCostUsd");
  const executionObservedCostUsd = finiteNonNegative(execution.observedCostUsd, "execution.observedCostUsd");
  if (plannedRunCount !== expectedRunCount) block(globalBlockers, "Execution planned run count does not match the configured run grid.");
  if (completedRunCount !== report.runs.length) block(globalBlockers, "Execution completed run count does not match the recorded runs.");
  if (execution.complete !== true || execution.stopReason !== null) block(globalBlockers, "Benchmark execution is incomplete or stopped fail-closed.");
  if (!nearlyEqual(executionMaximumCostUsd, maximumCostUsd)) block(globalBlockers, "Execution cost cap does not match the validated config.");
  if (!completeRunCost) block(globalBlockers, "Observed cost cannot be proven because at least one run has incomplete usage.");
  else if (!nearlyEqual(round(observedRunCostUsd), round(executionObservedCostUsd))) {
    block(globalBlockers, "Execution observed cost does not match the sum of recorded run spend.");
  }
  if (executionObservedCostUsd > maximumCostUsd + COST_EPSILON_USD) block(globalBlockers, "Observed spend exceeds the hard benchmark cost cap.");

  if (!Array.isArray(report.models)) throw new Error("AI benchmark report models must be an array.");
  const modelReports = new Map();
  report.models.forEach((rawModel, index) => {
    const model = object(rawModel, `models[${index}]`);
    const modelId = text(model.modelId, `models[${index}].modelId`);
    if (!knownModels.has(modelId)) throw new Error(`models[${index}] references unexpected model '${modelId}'.`);
    if (modelReports.has(modelId)) throw new Error(`Duplicate model report '${modelId}'.`);
    modelReports.set(modelId, object(model.score, `models[${index}].score`));
  });

  const models = modelIds.map((modelId) => {
    const blockers = [...globalBlockers];
    let runCount = 0;
    let completeFixtureCount = 0;
    let modelCostUsd = 0;
    let completeModelCost = true;

    if (repetitions < MIN_REPETITIONS) {
      block(blockers, `Manual model review requires at least ${MIN_REPETITIONS} repetitions per model and fixture.`);
    }

    for (const fixtureId of fixtureIds) {
      const group = groups.get(modelFixtureKey(modelId, fixtureId)) ?? new Map();
      const missing = Array.from({ length: repetitions }, (_, index) => index + 1).filter((value) => !group.has(value));
      if (missing.length > 0) {
        block(blockers, `Fixture '${fixtureId}' is missing repetitions: ${missing.join(", ")}.`);
      } else {
        completeFixtureCount += 1;
      }
      for (const current of [...group.values()].sort((first, second) => first.repetition - second.repetition)) {
        runCount += 1;
        if (current.schemaFailure || current.error !== null) block(blockers, `Fixture '${fixtureId}' contains a schema or provider failure.`);
        if (current.safetyViolations === null) block(blockers, `Fixture '${fixtureId}' contains malformed safety evidence.`);
        else if (current.safetyViolations.length > 0) block(blockers, `Fixture '${fixtureId}' contains a safety violation.`);
        if (current.latencyMs === null || current.latencyMs < 0) block(blockers, `Fixture '${fixtureId}' must report finite non-negative latency.`);
        if (!current.usage) {
          completeModelCost = false;
          block(blockers, `Fixture '${fixtureId}' must report complete cost and token usage.`);
        } else {
          modelCostUsd += current.usage.costUsd;
        }
      }
    }

    const score = modelReports.get(modelId);
    if (!score) {
      block(blockers, "Model score is missing from the benchmark report.");
      return {
        modelId,
        eligibleForManualReview: false,
        blockers: blockers.sort(),
        requiredRepetitions: repetitions,
        fixtureCount: fixtureIds.length,
        completeFixtureCount,
        runCount,
        costUsd: completeModelCost ? round(modelCostUsd) : null,
        reviewMetrics: {
          stableDecisionRate: null,
          openingClassificationAccuracy: null,
          highConfidenceConfirmationRate: null,
          falseDowngradeRate: null,
          medianLatencyMs: null,
        },
      };
    }

    if (score.schemaVersion !== SCORE_SCHEMA) block(blockers, `Model score must use ${SCORE_SCHEMA}.`);
    if (score.qualified !== false) block(blockers, "Model score must remain qualified=false.");
    if (score.runCount !== runCount) block(blockers, "Model score run count does not match recorded runs.");
    if (finiteMetric(score.schemaFailureRate) !== 0) block(blockers, "Model score contains schema failures.");
    if (finiteMetric(score.safetyViolationCount) !== 0) block(blockers, "Model score contains safety violations.");
    if (finiteMetric(score.unsupportedConfirmationRate) !== 0) block(blockers, "Model confirmed one or more locally unsupported candidates.");
    const scoredCost = finiteMetric(score.totalCostUsd);
    if (!completeModelCost || scoredCost === null || !nearlyEqual(round(modelCostUsd), round(scoredCost))) {
      block(blockers, "Model score spend does not match complete recorded run usage.");
    }

    const metrics = reviewMetrics(score);
    for (const [name, value] of Object.entries(metrics)) {
      if (value === null) block(blockers, `Review metric '${name}' is missing or non-finite.`);
    }

    return {
      modelId,
      eligibleForManualReview: blockers.length === 0,
      blockers: blockers.sort(),
      requiredRepetitions: repetitions,
      fixtureCount: fixtureIds.length,
      completeFixtureCount,
      runCount,
      costUsd: completeModelCost ? round(modelCostUsd) : null,
      reviewMetrics: metrics,
    };
  });

  const reportMechanicallyComplete = globalBlockers.length === 0
    && models.every((model) => model.eligibleForManualReview);

  return {
    schemaVersion: OUTPUT_SCHEMA,
    sourceReportSchemaVersion: REPORT_SCHEMA,
    sourceCommitSha: typeof report.commitSha === "string" && report.commitSha.trim() ? report.commitSha.trim() : null,
    qualified: false,
    selectedModelId: null,
    automaticModelSelectionAllowed: false,
    manualReviewRequired: true,
    reportMechanicallyComplete,
    blockers: [...globalBlockers].sort(),
    execution: {
      plannedRunCount,
      completedRunCount,
      maximumCostUsd,
      observedCostUsd: executionObservedCostUsd,
    },
    models,
  };
}

export function canonicalVerificationQualificationJson(result) {
  return `${JSON.stringify(result, null, 2)}\n`;
}

export async function runVerificationQualificationCli(args = process.argv.slice(2)) {
  const inputPath = resolve(args[0] ?? DEFAULT_INPUT_PATH);
  const outputPath = resolve(args[1] ?? DEFAULT_OUTPUT_PATH);
  const report = JSON.parse(await readFile(inputPath, "utf8"));
  const result = evaluateVerificationBenchmarkQualification(report);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, canonicalVerificationQualificationJson(result), "utf8");
}

async function main() {
  await runVerificationQualificationCli();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((cause) => {
    process.stderr.write(`${cause instanceof Error ? cause.message : String(cause)}\n`);
    process.exitCode = 1;
  });
}
