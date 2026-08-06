import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLiveProposalBenchmark } from "./proposal-live-runner.mjs";

function draft() {
  return {
    id: "draft",
    projectId: "project",
    referenceAssetId: "asset",
    referenceRevision: "fixture-v1",
    engineVersion: "5",
    status: "local-complete",
    walls: [
      { id: "wall-door", start: { x: 0.1, y: 0.5 }, end: { x: 0.9, y: 0.5 }, estimatedThicknessPx: 20, conflict: null },
      { id: "wall-window", start: { x: 0.1, y: 0.08 }, end: { x: 0.9, y: 0.08 }, estimatedThicknessPx: 20, conflict: null },
      { id: "wall-washbasin", start: { x: 0.45, y: 0.75 }, end: { x: 0.55, y: 0.75 }, estimatedThicknessPx: 30, conflict: "unsupported" },
    ],
    openings: [],
  };
}

function fixture() {
  return {
    fixtureId: "real-plan-001-anonymized",
    sourceImageDataUrl: "data:image/png;base64,AAAA",
    context: {
      localDraft: draft(),
      localEvidence: {
        widthPx: 1000,
        heightPx: 600,
        clutterEvidence: [{ wallCandidateId: "wall-washbasin", reasonCodes: ["structural-clutter-veto"] }],
      },
      rejectedOpenings: [
        {
          candidate: {
            kind: "door",
            hostWallCandidateId: "wall-door",
            center: { x: 0.5, y: 0.5 },
            widthPx: 100,
            orientationDeg: 0,
          },
        },
        {
          candidate: {
            kind: "window",
            hostWallCandidateId: "wall-window",
            center: { x: 0.5, y: 0.08 },
            widthPx: 120,
            orientationDeg: 0,
          },
        },
      ],
      groundTruth: {
        washbasinWallCandidateIds: ["wall-washbasin"],
        protectedStrongWallIds: ["wall-door", "wall-window"],
        forbiddenRegions: [{ x: 0.8, y: 0.8, width: 0.1, height: 0.1 }],
      },
    },
  };
}

function sanitized(requestId, overrides = {}) {
  const values = [
    {
      rawProposalId: "any-door-id",
      kind: "door",
      state: "eligible",
      geometry: { kind: "opening", center: { x: 0.5, y: 0.5 }, widthNormalized: 0.1, orientationDeg: 0 },
      targetLocalCandidateId: null,
      hostWallCandidateId: "wall-door",
      deterministicConfidence: "medium",
      evidence: { providerReasons: ["door-leaf", "visible-gap"], validatorReasons: ["host-wall-validated"] },
      provider: { requestId },
      localDraftFingerprint: "recognition-local-draft-v1:" + "a".repeat(64),
    },
    {
      rawProposalId: "arbitrary-window-id",
      kind: "window",
      state: "eligible",
      geometry: { kind: "opening", center: { x: 0.5, y: 0.08 }, widthNormalized: 0.12, orientationDeg: 0 },
      targetLocalCandidateId: null,
      hostWallCandidateId: "wall-window",
      deterministicConfidence: "medium",
      evidence: { providerReasons: ["parallel-window-rails"], validatorReasons: ["host-wall-validated"] },
      provider: { requestId },
      localDraftFingerprint: "recognition-local-draft-v1:" + "a".repeat(64),
    },
    {
      rawProposalId: "arbitrary-advisory-id",
      kind: "local-wall-review",
      state: "eligible",
      geometry: null,
      targetLocalCandidateId: "wall-washbasin",
      hostWallCandidateId: null,
      deterministicConfidence: "low",
      evidence: { providerReasons: ["sanitary-symbol-overlap"], validatorReasons: ["advisory-only"] },
      provider: { requestId },
      localDraftFingerprint: "recognition-local-draft-v1:" + "a".repeat(64),
    },
  ];
  return values.map((item, index) => index === (overrides.index ?? -1) ? { ...item, ...overrides.value } : item);
}

function config(overrides = {}) {
  return {
    schemaVersion: "recognition-ai-benchmark-config-v1",
    modelIds: ["vendor/model-a"],
    fixtureIds: ["real-plan-001-anonymized"],
    repetitions: 3,
    maximumTokens: 2048,
    timeoutMs: 90000,
    maximumCostUsd: 3,
    mode: "proposal-discovery-stage1",
    qualified: false,
    ...overrides,
  };
}

function adapters(options = {}) {
  const calls = { describe: 0, prepare: 0, request: [], sanitize: 0 };
  return {
    calls,
    describeModel: async () => {
      calls.describe += 1;
      return { contextLength: 32768, maximumCompletionTokens: 4096, supportsReasoning: true };
    },
    prepareProposal: async ({ requestId }) => {
      calls.prepare += 1;
      return {
        request: {
          mode: "proposal-discovery-stage1",
          requestId,
          referenceRevision: "fixture-v1",
          localDraftFingerprint: "recognition-local-draft-v1:" + "a".repeat(64),
        },
      };
    },
    requestProposal: async (input) => {
      assert.equal(input.maximumTokens, 2048);
      assert.equal(input.maximumPromptTokens, 32768 - 2048);
      calls.request.push(input);
      if (options.failRequestAt === calls.request.length) throw new Error("Bearer sk-or-v1-secret failed");
      return {
        latencyMs: 1234,
        usage: { promptTokens: 1000, completionTokens: 200, totalTokens: 1200, costUsd: 0.05 },
        safetyViolations: [],
        batch: { requestId: input.request.requestId },
        providerRoute: {
          providerId: "openrouter-direct",
          requestedModelId: input.modelId,
          resolvedModelId: input.modelId,
          fallbacksAllowed: false,
          reasoningDisabled: true,
        },
      };
    },
    sanitizeProposal: async ({ request, envelope }) => {
      calls.sanitize += 1;
      const first = sanitized(request.requestId, options.firstOverride ?? {});
      const second = options.replayMismatch
        ? sanitized(request.requestId, { index: 0, value: { geometry: { kind: "opening", center: { x: 0.54, y: 0.5 }, widthNormalized: 0.1, orientationDeg: 0 } } })
        : structuredClone(first);
      return {
        first,
        second,
        firstDiagnostics: [],
        secondDiagnostics: [],
        draftUnchanged: options.draftUnchanged ?? true,
        envelope,
      };
    },
  };
}

test("rejects fewer than three repetitions before any paid adapter is called", async () => {
  const api = adapters();
  await assert.rejects(
    runLiveProposalBenchmark({ config: config({ repetitions: 2 }), fixtures: [fixture()], ...api }),
    /at least 3 repetitions before any paid request/i,
  );
  assert.equal(api.calls.describe, 0);
  assert.equal(api.calls.request.length, 0);
});

test("runs three bounded proposal repetitions through preparation, provider and real-sanitizer adapter", async () => {
  const api = adapters();
  const report = await runLiveProposalBenchmark({
    config: config(), fixtures: [fixture()], commitSha: "b".repeat(40), ...api,
  });
  assert.equal(report.schemaVersion, "recognition-ai-benchmark-report-v1");
  assert.equal(report.qualified, false);
  assert.equal(report.runs.length, 3);
  assert.equal(api.calls.prepare, 3);
  assert.equal(api.calls.sanitize, 3);
  assert.equal(api.calls.request.length, 3);
  assert.ok(api.calls.request.every((call) => call.disableReasoning === true));
  assert.ok(api.calls.request.every((call) => call.providerMaxPrice.prompt > 0));
  assert.ok(api.calls.request.every((call) => call.allocationUsd === 1));
  for (const run of report.runs) {
    assert.equal(run.schemaFailure, false);
    assert.equal(run.proposalEvaluation.recoveredDoorTruePositiveCount, 1);
    assert.equal(run.proposalEvaluation.recoveredWindowTruePositiveCount, 1);
    assert.equal(run.proposalEvaluation.eligibleWashbasinAdvisoryCount, 1);
    assert.equal(run.proposalEvaluation.replayMismatchCount, 0);
    assert.equal(run.proposalEvaluation.directLocalMutationCount, 0);
    assert.equal(run.proposalEvaluation.sanitizerAcceptedCount, 3);
    assert.equal(run.proposalEvaluation.sanitizerTruePositiveCount, 3);
    assert.equal(run.proposalEvaluation.providerRoute.fallbacksAllowed, false);
    assert.equal(run.proposalEvaluation.providerRoute.reasoningDisabled, true);
  }
});

test("matches live proposals by sanitized geometry and host rather than provider-chosen raw ids", async () => {
  const report = await runLiveProposalBenchmark({ config: config(), fixtures: [fixture()], ...adapters() });
  assert.equal(report.runs[0].proposalEvaluation.recoveredDoorFalsePositiveCount, 0);
  assert.equal(report.runs[0].proposalEvaluation.recoveredDoorFalseNegativeCount, 0);
  assert.equal(report.runs[0].proposalEvaluation.recoveredWindowFalsePositiveCount, 0);
  assert.equal(report.runs[0].proposalEvaluation.recoveredWindowFalseNegativeCount, 0);
});

test("records an off-target eligible opening as false positive and missed expected opening", async () => {
  const api = adapters({
    firstOverride: {
      index: 0,
      value: { geometry: { kind: "opening", center: { x: 0.7, y: 0.5 }, widthNormalized: 0.1, orientationDeg: 0 } },
    },
  });
  const report = await runLiveProposalBenchmark({ config: config(), fixtures: [fixture()], ...api });
  assert.equal(report.runs[0].proposalEvaluation.recoveredDoorTruePositiveCount, 0);
  assert.equal(report.runs[0].proposalEvaluation.recoveredDoorFalsePositiveCount, 1);
  assert.equal(report.runs[0].proposalEvaluation.recoveredDoorFalseNegativeCount, 1);
});

test("detects sanitizer replay mismatch and draft mutation", async () => {
  const report = await runLiveProposalBenchmark({
    config: config(), fixtures: [fixture()], ...adapters({ replayMismatch: true, draftUnchanged: false }),
  });
  assert.equal(report.runs[0].proposalEvaluation.replayMismatchCount, 1);
  assert.equal(report.runs[0].proposalEvaluation.directLocalMutationCount, 1);
});

test("provider failures are recorded fail-closed and secrets are redacted", async () => {
  const report = await runLiveProposalBenchmark({
    config: config(), fixtures: [fixture()], ...adapters({ failRequestAt: 2 }),
  });
  assert.equal(report.runs[1].schemaFailure, true);
  assert.equal(report.runs[1].proposalEvaluation, null);
  assert.doesNotMatch(report.runs[1].error, /sk-or-v1-secret/);
  assert.match(report.runs[1].error, /\[REDACTED\]/);
  assert.equal(report.runs.filter((run) => !run.schemaFailure).length, 2);
});

test("writes only sanitized benchmark evidence", async () => {
  const directory = mkdtempSync(join(tmpdir(), "vlezet-live-proposal-"));
  try {
    const outputPath = join(directory, "recognition-ai-benchmark.json");
    await runLiveProposalBenchmark({
      config: config(), fixtures: [fixture()], outputPath, ...adapters(),
    });
    const text = readFileSync(outputPath, "utf8");
    assert.doesNotMatch(text, /data:image|base64|authorization|bearer|rawProviderResponse|sourceImageDataUrl|overlayImageDataUrl/i);
    assert.match(text, /recognition-ai-benchmark-report-v1/);
    assert.match(text, /sanitizedProposals/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("requires every configured fixture to have a prepared public context", async () => {
  await assert.rejects(
    runLiveProposalBenchmark({
      config: config({ fixtureIds: ["real-plan-002-anonymized"] }), fixtures: [fixture()], ...adapters(),
    }),
    /missing prepared live proposal fixtures/i,
  );
});
