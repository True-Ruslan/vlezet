import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scoreAiBenchmarkRuns } from "./ai-benchmark/score.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const gatePath = join(directory, "ai-proposal-gate.mjs");

function run(proposalEvaluation) {
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
    proposalEvaluation,
  };
}

test("publishes a deterministic proposal gate entrypoint", () => {
  assert.equal(existsSync(gatePath), true);
});

test("aggregates proposal recovery and merge-blocking safety counters", () => {
  const score = scoreAiBenchmarkRuns([run({
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
  })]);

  assert.equal(score.recoveredDoorTruePositiveCount, 1);
  assert.equal(score.recoveredWindowTruePositiveCount, 1);
  assert.equal(score.eligibleWashbasinAdvisoryCount, 1);
  assert.equal(score.sanitizerAcceptancePrecision, 1);
  assert.equal(score.replayDeterminismRate, 1);
  assert.equal(score.eligibleUnknownHostOpeningCount, 0);
  assert.equal(score.directLocalMutationCount, 0);
});
