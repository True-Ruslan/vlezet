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

function counter(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
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
  let recoveredDoorTruePositiveCount = 0;
  let recoveredDoorFalsePositiveCount = 0;
  let recoveredDoorFalseNegativeCount = 0;
  let recoveredWindowTruePositiveCount = 0;
  let recoveredWindowFalsePositiveCount = 0;
  let recoveredWindowFalseNegativeCount = 0;
  let eligibleWashbasinAdvisoryCount = 0;
  let sanitizerAcceptedCount = 0;
  let sanitizerTruePositiveCount = 0;
  let eligibleUnknownHostOpeningCount = 0;
  let eligibleOutsideHostOpeningCount = 0;
  let directLocalMutationCount = 0;
  let staleDecisionCount = 0;
  let protectedStrongWallAdvisoryCount = 0;
  let forbiddenRegionEligibleProposalCount = 0;
  let replayCount = 0;
  let replayMismatchCount = 0;
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

    const proposal = run.proposalEvaluation;
    if (proposal) {
      recoveredDoorTruePositiveCount += counter(proposal.recoveredDoorTruePositiveCount);
      recoveredDoorFalsePositiveCount += counter(proposal.recoveredDoorFalsePositiveCount);
      recoveredDoorFalseNegativeCount += counter(proposal.recoveredDoorFalseNegativeCount);
      recoveredWindowTruePositiveCount += counter(proposal.recoveredWindowTruePositiveCount);
      recoveredWindowFalsePositiveCount += counter(proposal.recoveredWindowFalsePositiveCount);
      recoveredWindowFalseNegativeCount += counter(proposal.recoveredWindowFalseNegativeCount);
      eligibleWashbasinAdvisoryCount += counter(proposal.eligibleWashbasinAdvisoryCount);
      sanitizerAcceptedCount += counter(proposal.sanitizerAcceptedCount);
      sanitizerTruePositiveCount += counter(proposal.sanitizerTruePositiveCount);
      eligibleUnknownHostOpeningCount += counter(proposal.eligibleUnknownHostOpeningCount);
      eligibleOutsideHostOpeningCount += counter(proposal.eligibleOutsideHostOpeningCount);
      directLocalMutationCount += counter(proposal.directLocalMutationCount);
      staleDecisionCount += counter(proposal.staleDecisionCount);
      protectedStrongWallAdvisoryCount += counter(proposal.protectedStrongWallAdvisoryCount);
      forbiddenRegionEligibleProposalCount += counter(proposal.forbiddenRegionEligibleProposalCount);
      replayCount += counter(proposal.replayCount);
      replayMismatchCount += counter(proposal.replayMismatchCount);
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
    recoveredDoorTruePositiveCount,
    recoveredDoorFalsePositiveCount,
    recoveredDoorFalseNegativeCount,
    recoveredWindowTruePositiveCount,
    recoveredWindowFalsePositiveCount,
    recoveredWindowFalseNegativeCount,
    eligibleWashbasinAdvisoryCount,
    sanitizerAcceptedCount,
    sanitizerTruePositiveCount,
    sanitizerAcceptancePrecision: ratio(sanitizerTruePositiveCount, sanitizerAcceptedCount),
    eligibleUnknownHostOpeningCount,
    eligibleOutsideHostOpeningCount,
    directLocalMutationCount,
    staleDecisionCount,
    protectedStrongWallAdvisoryCount,
    forbiddenRegionEligibleProposalCount,
    replayCount,
    replayMismatchCount,
    replayDeterminismRate: ratio(Math.max(0, replayCount - replayMismatchCount), replayCount),
    qualified: false,
  };
}
