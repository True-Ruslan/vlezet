import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { canonicalProposalQualificationJson, evaluateLiveProposalQualification } from './proposal-qualification.mjs';

const ZERO = {
  eligibleUnknownHostOpeningCount: 0,
  eligibleOutsideHostOpeningCount: 0,
  directLocalMutationCount: 0,
  staleDecisionCount: 0,
  protectedStrongWallAdvisoryCount: 0,
  forbiddenRegionEligibleProposalCount: 0,
  replayMismatchCount: 0,
};

function proposalSet(x = 0.5) {
  const opening = (kind, hostWallCandidateId, center, widthNormalized, reasons) => ({
    kind,
    state: 'eligible',
    targetLocalCandidateId: null,
    hostWallCandidateId,
    geometry: { kind: 'opening', center, widthNormalized, orientationDeg: 0 },
    deterministicConfidence: 'medium',
    providerReasons: reasons,
    validatorReasons: ['host-wall-validated'],
  });
  return [
    opening('door', 'wall-door-host', { x, y: 0.5 }, 0.1, ['door-leaf', 'visible-gap']),
    opening('window', 'wall-window-host', { x: 0.5, y: 0.08 }, 0.14, ['parallel-window-rails']),
    {
      kind: 'local-wall-review',
      state: 'eligible',
      targetLocalCandidateId: 'wall-washbasin-clutter',
      hostWallCandidateId: null,
      geometry: null,
      deterministicConfidence: 'low',
      providerReasons: ['sanitary-symbol-overlap'],
      validatorReasons: ['advisory-only'],
    },
  ];
}

function run(repetition, changes = {}) {
  const proposalEvaluation = {
    recoveredDoorTruePositiveCount: 1,
    recoveredDoorFalsePositiveCount: 0,
    recoveredDoorFalseNegativeCount: 0,
    recoveredWindowTruePositiveCount: 1,
    recoveredWindowFalsePositiveCount: 0,
    recoveredWindowFalseNegativeCount: 0,
    eligibleWashbasinAdvisoryCount: 1,
    sanitizerAcceptedCount: 3,
    sanitizerTruePositiveCount: 3,
    ...ZERO,
    replayCount: 2,
    sanitizedProposals: proposalSet(),
    providerRoute: {
      providerId: 'openrouter-direct',
      requestedModelId: 'vendor/model-a',
      resolvedModelId: 'vendor/model-a',
      fallbacksAllowed: false,
      reasoningDisabled: true,
    },
    ...changes.proposalEvaluation,
  };
  return {
    modelId: 'vendor/model-a',
    fixtureId: 'real-plan-001-anonymized',
    repetition,
    latencyMs: 1200 + repetition,
    usage: { promptTokens: 1000, completionTokens: 200, totalTokens: 1200, costUsd: 0.05 },
    schemaFailure: false,
    safetyViolations: [],
    error: null,
    ...changes,
    proposalEvaluation,
  };
}

function report(changes = {}) {
  return {
    schemaVersion: 'recognition-ai-benchmark-report-v1',
    commitSha: 'a'.repeat(40),
    config: {
      schemaVersion: 'recognition-ai-benchmark-config-v1',
      modelIds: ['vendor/model-a'],
      fixtureIds: ['real-plan-001-anonymized'],
      repetitions: 3,
      maximumTokens: 2048,
      timeoutMs: 90000,
      maximumCostUsd: 5,
      mode: 'proposal-discovery-stage1',
      qualified: false,
    },
    qualified: false,
    models: [],
    runs: [run(1), run(2), run(3)],
    ...changes,
  };
}

function blockers(result) { return result.models[0].blockers.join('\n'); }

test('stable three-repeat series is eligible only for manual review', () => {
  const result = evaluateLiveProposalQualification(report());
  assert.equal(result.qualified, false);
  assert.equal(result.selectedModelId, null);
  assert.equal(result.manualReviewRequired, true);
  assert.equal(result.automaticModelSelectionAllowed, false);
  assert.equal(result.models[0].eligibleForManualReview, true);
  assert.deepEqual(result.models[0].blockers, []);
  assert.equal(result.models[0].stableProposalSetRate, 1);
  assert.equal(result.models[0].falseProposalRate, 0);
  assert.equal(result.models[0].totalCostUsd, 0.15);
});

test('fewer than three repetitions is blocked', () => {
  const result = evaluateLiveProposalQualification(report({
    config: { ...report().config, repetitions: 2 },
    runs: [run(1), run(2)],
  }));
  assert.equal(result.models[0].eligibleForManualReview, false);
  assert.match(blockers(result), /at least 3 repetitions/i);
});

test('duplicate repetition is rejected', () => {
  assert.throws(() => evaluateLiveProposalQualification(report({ runs: [run(1), run(1), run(3)] })), /duplicate repetition 1/i);
});

test('unstable sanitized proposal set is blocked', () => {
  const result = evaluateLiveProposalQualification(report({
    runs: [run(1), run(2), run(3, { proposalEvaluation: { sanitizedProposals: proposalSet(0.52) } })],
  }));
  assert.equal(result.models[0].eligibleForManualReview, false);
  assert.match(blockers(result), /unstable sanitized proposal set/i);
});

test('safety violation and direct mutation block qualification', () => {
  const unsafe = run(2, {
    safetyViolations: ['geometry-authority-violation'],
    proposalEvaluation: { directLocalMutationCount: 1 },
  });
  const result = evaluateLiveProposalQualification(report({ runs: [run(1), unsafe, run(3)] }));
  assert.match(blockers(result), /safety violation/i);
  assert.match(blockers(result), /direct local mutations/i);
});

test('missing route and incomplete cost block qualification', () => {
  const incomplete = run(2, {
    usage: { promptTokens: 1000, completionTokens: 200, totalTokens: 1200, costUsd: null },
    proposalEvaluation: { providerRoute: null },
  });
  const result = evaluateLiveProposalQualification(report({ runs: [run(1), incomplete, run(3)] }));
  assert.match(blockers(result), /provider route/i);
  assert.match(blockers(result), /complete cost/i);
});

test('hard report-wide cost budget is enforced', () => {
  const costly = (repetition) => run(repetition, {
    usage: { promptTokens: 1000, completionTokens: 200, totalTokens: 1200, costUsd: 2 },
  });
  const result = evaluateLiveProposalQualification(report({ runs: [costly(1), costly(2), costly(3)] }));
  assert.equal(result.budgetWithinLimit, false);
  assert.match(blockers(result), /hard cost budget/i);
});

test('material door and window recovery are required', () => {
  const empty = (repetition) => run(repetition, {
    proposalEvaluation: { recoveredDoorTruePositiveCount: 0, recoveredWindowTruePositiveCount: 0 },
  });
  const result = evaluateLiveProposalQualification(report({ runs: [empty(1), empty(2), empty(3)] }));
  assert.match(blockers(result), /recovered door/i);
  assert.match(blockers(result), /recovered window/i);
});

test('canonical artifact excludes secret and source-image fields', () => {
  const json = canonicalProposalQualificationJson(evaluateLiveProposalQualification(report()));
  assert.doesNotMatch(json, /data:image|base64|authorization|bearer|provider_headers|rawProviderResponse|sourceImageDataUrl|overlayImageDataUrl/i);
  assert.match(json, /"qualified": false/);
  assert.match(json, /"selectedModelId": null/);
});

test('CLI writes sanitized output and fails closed on invalid input', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vlezet-proposal-qualification-'));
  try {
    const input = join(directory, 'benchmark.json');
    const output = join(directory, 'qualification.json');
    const executable = new URL('./proposal-qualification.mjs', import.meta.url).pathname;
    writeFileSync(input, JSON.stringify(report()), 'utf8');
    const success = spawnSync(process.execPath, [executable, input, output], { encoding: 'utf8' });
    assert.equal(success.status, 0, success.stderr);
    assert.equal(JSON.parse(readFileSync(output, 'utf8')).models[0].eligibleForManualReview, true);
    writeFileSync(input, '{}', 'utf8');
    const failure = spawnSync(process.execPath, [executable, input, output], { encoding: 'utf8' });
    assert.notEqual(failure.status, 0);
    assert.match(failure.stderr, /benchmark report/i);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('duplicate config entries are rejected', () => {
  assert.throws(() => evaluateLiveProposalQualification(report({
    config: { ...report().config, modelIds: ['vendor/model-a', 'vendor/model-a'] },
  })), /config\.modelIds.*duplicates/i);
});

test('deterministic high confidence is rejected', () => {
  const invalid = proposalSet();
  invalid[0] = { ...invalid[0], deterministicConfidence: 'high' };
  assert.throws(() => evaluateLiveProposalQualification(report({
    runs: [run(1), run(2, { proposalEvaluation: { sanitizedProposals: invalid } }), run(3)],
  })), /cannot have deterministic high confidence/i);
});

test('provider route drift across repetitions is blocked', () => {
  const drifted = run(2, { proposalEvaluation: { providerRoute: {
    providerId: 'openrouter-direct',
    requestedModelId: 'vendor/model-a',
    resolvedModelId: 'vendor/model-a-alt-route',
    fallbacksAllowed: false,
    reasoningDisabled: true,
  } } });
  const result = evaluateLiveProposalQualification(report({ runs: [run(1), drifted, run(3)] }));
  assert.match(blockers(result), /one explicit and stable provider\/model route/i);
});
