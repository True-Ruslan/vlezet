import assert from "node:assert/strict";
import test from "node:test";
import { scoreAiBenchmarkRuns } from "./ai-benchmark/score.mjs";
import { enforceAiProposalGate } from "./ai-proposal-gate.mjs";

function proposalEvaluation(overrides = {}) {
  return {
    recoveredDoorTruePositiveCount: 1,
    recoveredDoorFalsePositiveCount: 0,
    recoveredDoorFalseNegativeCount: 0,
    recoveredWindowTruePositiveCount: 1,
    recoveredWindowFalsePositiveCount: 0,
    recoveredWindowFalseNegativeCount: 0,
    eligibleWashbasinAdvisoryCount: 1,
    sanitizerAcceptedCount: 3,
    sanitizerTruePositiveCount: 3,
    eligibleUnknownHostOpeningCount: 0,
    eligibleOutsideHostOpeningCount: 0,
    directLocalMutationCount: 0,
    staleDecisionCount: 0,
    protectedStrongWallAdvisoryCount: 0,
    forbiddenRegionEligibleProposalCount: 0,
    replayCount: 2,
    replayMismatchCount: 0,
    ...overrides,
  };
}

function run(evaluation) {
  return {
    modelId: "recorded/provider-model",
    fixtureId: "recorded-fixture",
    repetition: 1,
    latencyMs: 0,
    usage: null,
    response: { walls: [], openings: [] },
    localSummary: { walls: [], openings: [] },
    expectedOpeningKinds: {},
    schemaFailure: false,
    safetyViolations: [],
    proposalEvaluation: evaluation,
  };
}

function report(overrides = {}) {
  return {
    schemaVersion: "recognition-ai-proposal-gate-report-v1",
    fixtureCount: 1,
    score: scoreAiBenchmarkRuns([run(proposalEvaluation(overrides))]),
  };
}

test("aggregates proposal recovery and merge-blocking safety counters", () => {
  const score = report().score;
  assert.equal(score.recoveredDoorTruePositiveCount, 1);
  assert.equal(score.recoveredWindowTruePositiveCount, 1);
  assert.equal(score.eligibleWashbasinAdvisoryCount, 1);
  assert.equal(score.sanitizerAcceptancePrecision, 1);
  assert.equal(score.replayDeterminismRate, 1);
  assert.equal(score.eligibleUnknownHostOpeningCount, 0);
  assert.equal(score.directLocalMutationCount, 0);
});

test("accepts material recovery only when every safety counter remains zero", () => {
  assert.equal(enforceAiProposalGate(report()).fixtureCount, 1);
});

test("rejects missing recovery, false results and every non-zero safety counter", () => {
  const invalidCases = [
    { recoveredDoorTruePositiveCount: 0 },
    { recoveredDoorFalsePositiveCount: 1 },
    { recoveredDoorFalseNegativeCount: 1 },
    { recoveredWindowTruePositiveCount: 0 },
    { recoveredWindowFalsePositiveCount: 1 },
    { recoveredWindowFalseNegativeCount: 1 },
    { eligibleWashbasinAdvisoryCount: 0, sanitizerAcceptedCount: 2, sanitizerTruePositiveCount: 2 },
    { eligibleUnknownHostOpeningCount: 1 },
    { eligibleOutsideHostOpeningCount: 1 },
    { directLocalMutationCount: 1 },
    { staleDecisionCount: 1 },
    { protectedStrongWallAdvisoryCount: 1 },
    { forbiddenRegionEligibleProposalCount: 1 },
    { replayMismatchCount: 1 },
    { replayCount: 1 },
    { sanitizerTruePositiveCount: 2 },
  ];
  for (const invalid of invalidCases) {
    assert.throws(() => enforceAiProposalGate(report(invalid)), /AI proposal gate failed/);
  }
});

test("rejects empty or incompatible reports", () => {
  assert.throws(() => enforceAiProposalGate(null), /unsupported schema/);
  assert.throws(() => enforceAiProposalGate({
    schemaVersion: "recognition-ai-proposal-gate-report-v1",
    fixtureCount: 0,
    score: null,
  }), /incomplete/);
});
