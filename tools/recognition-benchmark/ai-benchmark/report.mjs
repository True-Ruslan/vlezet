import { scoreAiBenchmarkRuns } from "./score.mjs";
import { redactAiBenchmarkText } from "./openrouter-client.mjs";

function safeError(value) {
  if (value == null) return null;
  return redactAiBenchmarkText(value instanceof Error ? value.message : String(value));
}

export function buildAiBenchmarkReport({ config, runs, commitSha = null }) {
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
    qualified: false,
    models,
    runs: normalizedRuns,
  };
}

export function canonicalAiBenchmarkJson(report) {
  return `${JSON.stringify(report, null, 2)}\n`;
}
