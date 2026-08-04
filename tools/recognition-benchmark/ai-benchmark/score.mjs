function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function responseMap(run) {
  const result = new Map();
  for (const wall of run.response?.walls ?? []) result.set(`wall:${wall.id}`, wall.confidence);
  for (const opening of run.response?.openings ?? []) {
    result.set(`opening:${opening.id}`, `${opening.kind}:${opening.confidence}`);
  }
  return result;
}

function localCandidateKeys(run) {
  return [
    ...(run.localSummary?.walls ?? []).map((candidate) => `wall:${candidate.id}`),
    ...(run.localSummary?.openings ?? []).map((candidate) => `opening:${candidate.id}`),
  ];
}

function ratio(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function scoreAiBenchmarkRuns(runs) {
  if (!Array.isArray(runs) || runs.length === 0) throw new Error("AI benchmark scoring requires at least one run.");
  let schemaFailures = 0;
  let safetyViolationCount = 0;
  let highConfidenceDenominator = 0;
  let highConfidenceConfirmed = 0;
  let falseDowngradeCount = 0;
  let unsupportedDenominator = 0;
  let unsupportedConfirmed = 0;
  let openingClassificationDenominator = 0;
  let openingClassificationCorrect = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalTokens = 0;
  let totalCostUsd = 0;
  let completeCost = true;
  const latencies = [];

  for (const run of runs) {
    if (run.schemaFailure) schemaFailures += 1;
    safetyViolationCount += Array.isArray(run.safetyViolations) ? run.safetyViolations.length : 0;
    if (typeof run.latencyMs === "number" && Number.isFinite(run.latencyMs)) latencies.push(run.latencyMs);
    const responseWalls = new Map((run.response?.walls ?? []).map((candidate) => [candidate.id, candidate]));
    const responseOpenings = new Map((run.response?.openings ?? []).map((candidate) => [candidate.id, candidate]));

    for (const candidate of run.localSummary?.walls ?? []) {
      if (candidate.conflict === "unsupported") {
        unsupportedDenominator += 1;
        if (responseWalls.has(candidate.id)) unsupportedConfirmed += 1;
      }
      if (candidate.conflict == null && candidate.confidence === "high") {
        highConfidenceDenominator += 1;
        const returned = responseWalls.get(candidate.id);
        if (returned?.confidence === "high") highConfidenceConfirmed += 1;
        else falseDowngradeCount += 1;
      }
    }
    for (const candidate of run.localSummary?.openings ?? []) {
      if (candidate.conflict === "unsupported") {
        unsupportedDenominator += 1;
        if (responseOpenings.has(candidate.id)) unsupportedConfirmed += 1;
      }
      if (candidate.conflict == null && candidate.confidence === "high") {
        highConfidenceDenominator += 1;
        const returned = responseOpenings.get(candidate.id);
        if (returned?.confidence === "high") highConfidenceConfirmed += 1;
        else falseDowngradeCount += 1;
      }
    }

    for (const [candidateId, expectedKind] of Object.entries(run.expectedOpeningKinds ?? {})) {
      openingClassificationDenominator += 1;
      if (responseOpenings.get(candidateId)?.kind === expectedKind) openingClassificationCorrect += 1;
    }

    if (run.usage) {
      if (Number.isFinite(run.usage.promptTokens)) totalPromptTokens += run.usage.promptTokens;
      if (Number.isFinite(run.usage.completionTokens)) totalCompletionTokens += run.usage.completionTokens;
      if (Number.isFinite(run.usage.totalTokens)) totalTokens += run.usage.totalTokens;
      if (Number.isFinite(run.usage.costUsd)) totalCostUsd += run.usage.costUsd;
      else completeCost = false;
    } else {
      completeCost = false;
    }
  }

  const groups = new Map();
  for (const run of runs) {
    const key = `${run.modelId}\u0000${run.fixtureId}`;
    const group = groups.get(key) ?? [];
    group.push(run);
    groups.set(key, group);
  }
  let stableCandidateCount = 0;
  let stableCandidateDenominator = 0;
  for (const group of groups.values()) {
    const ordered = [...group].sort((first, second) => first.repetition - second.repetition);
    const keys = new Set(ordered.flatMap(localCandidateKeys));
    const maps = ordered.map(responseMap);
    for (const key of keys) {
      stableCandidateDenominator += 1;
      const firstValue = maps[0]?.get(key) ?? "omitted";
      if (maps.every((map) => (map.get(key) ?? "omitted") === firstValue)) stableCandidateCount += 1;
    }
  }

  return {
    schemaVersion: "recognition-ai-benchmark-score-v1",
    runCount: runs.length,
    schemaFailureRate: ratio(schemaFailures, runs.length),
    safetyViolationCount,
    highConfidenceConfirmationRate: ratio(highConfidenceConfirmed, highConfidenceDenominator),
    falseDowngradeRate: ratio(falseDowngradeCount, highConfidenceDenominator),
    unsupportedConfirmationRate: ratio(unsupportedConfirmed, unsupportedDenominator),
    openingClassificationAccuracy: ratio(openingClassificationCorrect, openingClassificationDenominator),
    stableDecisionRate: ratio(stableCandidateCount, stableCandidateDenominator),
    medianLatencyMs: median(latencies),
    totalPromptTokens,
    totalCompletionTokens,
    totalTokens,
    totalCostUsd: completeCost ? totalCostUsd : null,
    qualified: false,
  };
}
