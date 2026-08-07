import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  canonicalVerificationQualificationJson,
  evaluateVerificationBenchmarkQualification,
  runVerificationQualificationCli,
} from "../../../tools/recognition-benchmark/ai-benchmark/verification-qualification.mjs";

const temporaryRoots: string[] = [];

function score(runCount: number, overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "recognition-ai-benchmark-score-v1",
    runCount,
    schemaFailureRate: 0,
    safetyViolationCount: 0,
    highConfidenceConfirmationRate: 0.75,
    falseDowngradeRate: 0.25,
    unsupportedConfirmationRate: 0,
    openingClassificationAccuracy: 0.8,
    stableDecisionRate: 0.9,
    medianLatencyMs: 850,
    totalPromptTokens: runCount * 100,
    totalCompletionTokens: runCount * 20,
    totalTokens: runCount * 120,
    totalCostUsd: runCount * 0.01,
    qualified: false,
    ...overrides,
  };
}

function run(modelId: string, fixtureId: string, repetition: number, overrides: Record<string, unknown> = {}) {
  return {
    modelId,
    fixtureId,
    repetition,
    latencyMs: 700 + repetition * 10,
    usage: {
      promptTokens: 100,
      completionTokens: 20,
      totalTokens: 120,
      costUsd: 0.01,
    },
    response: {
      walls: [{ id: "wall-a", confidence: "high", score: 0.9 }],
      openings: [{ id: "opening-a", kind: "door", confidence: "medium", score: 0.8 }],
    },
    expectedOpeningKinds: { "opening-a": "door" },
    schemaFailure: false,
    safetyViolations: [],
    error: null,
    ...overrides,
  };
}

function report(options: Readonly<{
  repetitions?: number;
  fixtureIds?: readonly string[];
  runs?: readonly Record<string, unknown>[];
  executionComplete?: boolean;
  configOverrides?: Record<string, unknown>;
  scoreOverrides?: Record<string, unknown>;
}> = {}) {
  const modelId = "google/gemini-2.5-flash";
  const fixtureIds = [...(options.fixtureIds ?? ["fixture-a"] )];
  const repetitions = options.repetitions ?? 3;
  const runs = options.runs ?? fixtureIds.flatMap((fixtureId) =>
    Array.from({ length: repetitions }, (_, index) => run(modelId, fixtureId, index + 1)));
  const executionComplete = options.executionComplete ?? runs.length === fixtureIds.length * repetitions;
  const observedCostUsd = runs.reduce((sum, entry) => {
    const usage = entry.usage as { costUsd?: unknown } | undefined;
    return sum + (typeof usage?.costUsd === "number" ? usage.costUsd : 0);
  }, 0);
  return {
    schemaVersion: "recognition-ai-benchmark-report-v1",
    commitSha: "exact-head-sha",
    config: {
      schemaVersion: "recognition-ai-benchmark-config-v1",
      modelIds: [modelId],
      fixtureIds,
      repetitions,
      maximumTokens: 2048,
      timeoutMs: 90_000,
      maximumCostUsd: 5,
      maximumPromptPricePerMillionUsd: 3,
      maximumCompletionPricePerMillionUsd: 15,
      mode: "disputed-zones",
      qualified: false,
      ...options.configOverrides,
    },
    execution: {
      plannedRunCount: fixtureIds.length * repetitions,
      completedRunCount: runs.length,
      maximumCostUsd: 5,
      observedCostUsd,
      complete: executionComplete,
      stopReason: executionComplete ? null : "cost-budget-reached",
    },
    qualified: false,
    models: [{
      modelId,
      score: score(runs.length, options.scoreOverrides),
    }],
    runs,
  };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("verification benchmark qualification", () => {
  it("makes a complete safe 3-repeat benchmark eligible only for manual review", () => {
    const result = evaluateVerificationBenchmarkQualification(report());

    expect(result).toMatchObject({
      schemaVersion: "recognition-ai-verification-qualification-v1",
      sourceCommitSha: "exact-head-sha",
      qualified: false,
      selectedModelId: null,
      automaticModelSelectionAllowed: false,
      manualReviewRequired: true,
      reportMechanicallyComplete: true,
    });
    expect(result.models).toHaveLength(1);
    expect(result.models[0]).toMatchObject({
      modelId: "google/gemini-2.5-flash",
      eligibleForManualReview: true,
      blockers: [],
      requiredRepetitions: 3,
      fixtureCount: 1,
      completeFixtureCount: 1,
      runCount: 3,
      reviewMetrics: {
        stableDecisionRate: 0.9,
        openingClassificationAccuracy: 0.8,
        highConfidenceConfirmationRate: 0.75,
        falseDowngradeRate: 0.25,
        medianLatencyMs: 850,
      },
    });
  });

  it("blocks qualification evidence with fewer than three repetitions without inventing a quality threshold", () => {
    const result = evaluateVerificationBenchmarkQualification(report({ repetitions: 2 }));

    expect(result.models[0]?.eligibleForManualReview).toBe(false);
    expect(result.models[0]?.blockers.join("\n")).toMatch(/at least 3 repetitions/i);
    expect(result.models[0]?.reviewMetrics).toMatchObject({
      stableDecisionRate: 0.9,
      openingClassificationAccuracy: 0.8,
    });
  });

  it("fails closed on incomplete run grids, missing usage and execution stops", () => {
    const partialRuns = [
      run("google/gemini-2.5-flash", "fixture-a", 1),
      run("google/gemini-2.5-flash", "fixture-a", 2, { usage: null }),
    ];
    const result = evaluateVerificationBenchmarkQualification(report({
      runs: partialRuns,
      executionComplete: false,
    }));

    expect(result.reportMechanicallyComplete).toBe(false);
    expect(result.models[0]?.eligibleForManualReview).toBe(false);
    expect(result.models[0]?.blockers.join("\n")).toMatch(/missing repetitions|complete cost|execution/i);
  });

  it("blocks schema failures, safety violations and unsupported confirmations", () => {
    const unsafeRuns = [
      run("google/gemini-2.5-flash", "fixture-a", 1),
      run("google/gemini-2.5-flash", "fixture-a", 2, {
        schemaFailure: true,
        safetyViolations: ["geometry-authority-violation"],
        error: "provider failure",
      }),
      run("google/gemini-2.5-flash", "fixture-a", 3),
    ];
    const result = evaluateVerificationBenchmarkQualification(report({
      runs: unsafeRuns,
      scoreOverrides: {
        schemaFailureRate: 1 / 3,
        safetyViolationCount: 1,
        unsupportedConfirmationRate: 0.2,
        totalCostUsd: 0.03,
      },
    }));

    expect(result.models[0]?.eligibleForManualReview).toBe(false);
    expect(result.models[0]?.blockers.join("\n")).toMatch(/schema|safety|unsupported/i);
  });

  it("rejects unsafe price ceilings and inconsistent observed spend", () => {
    const result = evaluateVerificationBenchmarkQualification(report({
      configOverrides: { maximumPromptPricePerMillionUsd: 30 },
    }));
    expect(result.models[0]?.eligibleForManualReview).toBe(false);
    expect(result.models[0]?.blockers.join("\n")).toMatch(/price ceiling/i);

    const inconsistent = report();
    inconsistent.execution.observedCostUsd = 4.5;
    const spendResult = evaluateVerificationBenchmarkQualification(inconsistent);
    expect(spendResult.models[0]?.eligibleForManualReview).toBe(false);
    expect(spendResult.models[0]?.blockers.join("\n")).toMatch(/observed cost|spend/i);
  });

  it("rejects duplicate repetitions instead of silently deduplicating them", () => {
    const base = report();
    const duplicate = {
      ...base,
      runs: [...base.runs, { ...base.runs[0] }],
    };
    expect(() => evaluateVerificationBenchmarkQualification(duplicate)).toThrow(/duplicate repetition/i);
  });

  it("emits a canonical sanitized artifact without raw model responses or secret-like material", () => {
    const input = report();
    input.runs[0].response = {
      rawProviderResponse: "Authorization: Bearer sk-or-v1-secret",
      sourceImageDataUrl: "data:image/png;base64,PRIVATE",
    };
    const json = canonicalVerificationQualificationJson(
      evaluateVerificationBenchmarkQualification(input),
    );

    expect(json).toContain("recognition-ai-verification-qualification-v1");
    expect(json).not.toMatch(/data:image|base64|Authorization|Bearer|sk-or-v1-|rawProviderResponse|sourceImageDataUrl/i);
  });

  it("CLI writes the qualification artifact for a valid report and rejects the wrong schema", async () => {
    const root = await mkdtemp(join(tmpdir(), "vlezet-ai-verification-qualification-"));
    temporaryRoots.push(root);
    const inputPath = join(root, "benchmark.json");
    const outputPath = join(root, "qualification.json");
    await writeFile(inputPath, JSON.stringify(report()), "utf8");

    await expect(runVerificationQualificationCli([inputPath, outputPath])).resolves.toBeUndefined();
    expect(JSON.parse(await readFile(outputPath, "utf8"))).toMatchObject({
      schemaVersion: "recognition-ai-verification-qualification-v1",
      qualified: false,
      selectedModelId: null,
    });

    await writeFile(inputPath, JSON.stringify({ schemaVersion: "wrong" }), "utf8");
    await expect(runVerificationQualificationCli([inputPath, outputPath])).rejects.toThrow(/recognition-ai-benchmark-report-v1/i);
  });

  it("is wired into the manual workflow without adding paid PR or push triggers", () => {
    const workflow = readFileSync(
      new URL("../../../.github/workflows/recognition-ai-benchmark.yml", import.meta.url),
      "utf8",
    );
    const packageJson = JSON.parse(readFileSync(
      new URL("../../../package.json", import.meta.url),
      "utf8",
    )) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.["benchmark:recognition:ai-qualify"]).toContain("verification-qualification.mjs");
    expect(workflow).toContain("Evaluate verification benchmark qualification");
    expect(workflow).toContain("benchmark:recognition:ai-qualify");
    expect(workflow).toMatch(/Evaluate verification benchmark qualification[\s\S]*if: always\(\)/);
    expect(workflow).not.toMatch(/^\s{2}(push|pull_request|schedule):/m);
  });
});