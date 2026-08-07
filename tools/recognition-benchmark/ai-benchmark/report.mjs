import { scoreAiBenchmarkRuns } from "./score.mjs";
import { redactAiBenchmarkText } from "./openrouter-client.mjs";

function safeError(value) {
  if (value == null) return null;
  return redactAiBenchmarkText(value instanceof Error ? value.message : String(value));
}

function observedCost(runs) {
  return runs.reduce((sum, run) => {
    const cost = run.usage?.costUsd;
    return typeof cost === "number" && Number.isFinite(cost) && cost >= 0 ? sum + cost : sum;
  }, 0);
}

function normalizedExecution(config, runs, execution) {
  const plannedRunCount = config.modelIds.length * config.fixtureIds.length * config.repetitions;
  return {
    plannedRunCount,
    completedRunCount: runs.length,
    maximumCostUsd: config.maximumCostUsd,
    observedCostUsd: execution?.observedCostUsd ?? observedCost(runs),
    complete: execution?.complete ?? runs.length === plannedRunCount,
    stopReason: execution?.stopReason ?? null,
  };
}

export function buildAiBenchmarkReport({ config, runs, execution = null, commitSha = null }) {
  const normalizedRuns = runs.map((run) => ({
    modelId: run.modelId,
    fixtureId: run.fixtureId,
    repetition: run.repetition,
    latencyMs: run.latencyMs,
    usage: run.usage,
    response: run.response,
    expectedOpeningKinds: run.expectedOpeningKinds,
    schemaFailure: Boolean(run.schemaFailure),
    safetyViolations: [...(run.safetyViolations ?? [])].map(redactAiBenchmarkText),
    proposalEvaluation: run.proposalEvaluation ?? null,
    error: safeError(run.error),
  })).sort((first, second) =>
    first.modelId.localeCompare(second.modelId)
    || first.fixtureId.localeCompare(second.fixtureId)
    || first.repetition - second.repetition);
  const models = [...new Set(runs.map((run) => run.modelId))].sort().map((modelId) => {
    const modelRuns = runs.filter((run) => run.modelId === modelId);
    return { modelId, score: scoreAiBenchmarkRuns(modelRuns) };
  });
  return {
    schemaVersion: "recognition-ai-benchmark-report-v1",
    commitSha,
    config: { ...config, qualified: false },
    execution: normalizedExecution(config, runs, execution),
    qualified: false,
    models,
    runs: normalizedRuns,
  };
}

export function canonicalAiBenchmarkJson(report) {
  return `${JSON.stringify(report, null, 2)}\n`;
}
