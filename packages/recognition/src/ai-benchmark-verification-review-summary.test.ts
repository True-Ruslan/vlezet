import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  renderVerificationQualificationMarkdown,
  runVerificationQualificationCli,
} from "../../../tools/recognition-benchmark/ai-benchmark/verification-qualification.mjs";

const temporaryRoots: string[] = [];

function qualification(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "recognition-ai-verification-qualification-v1" as const,
    sourceReportSchemaVersion: "recognition-ai-benchmark-report-v1" as const,
    sourceCommitSha: "exact-head-sha",
    qualified: false as const,
    selectedModelId: null,
    automaticModelSelectionAllowed: false as const,
    manualReviewRequired: true as const,
    reportMechanicallyComplete: true,
    blockers: [] as string[],
    execution: {
      plannedRunCount: 3,
      completedRunCount: 3,
      maximumCostUsd: 5,
      observedCostUsd: 0.03,
    },
    models: [{
      modelId: "google/gemini-2.5-flash",
      eligibleForManualReview: true,
      blockers: [] as string[],
      requiredRepetitions: 3,
      fixtureCount: 1,
      completeFixtureCount: 1,
      runCount: 3,
      costUsd: 0.03,
      reviewMetrics: {
        stableDecisionRate: 0.9,
        openingClassificationAccuracy: 0.8,
        highConfidenceConfirmationRate: 0.75,
        falseDowngradeRate: 0.25,
        medianLatencyMs: 850,
      },
    }],
    ...overrides,
  };
}

function benchmarkReport() {
  const runs = [1, 2, 3].map((repetition) => ({
    modelId: "google/gemini-2.5-flash",
    fixtureId: "fixture-a",
    repetition,
    latencyMs: 850,
    usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120, costUsd: 0.01 },
    response: { walls: [], openings: [] },
    expectedOpeningKinds: {},
    schemaFailure: false,
    safetyViolations: [],
    error: null,
  }));
  return {
    schemaVersion: "recognition-ai-benchmark-report-v1",
    commitSha: "exact-head-sha",
    config: {
      schemaVersion: "recognition-ai-benchmark-config-v1",
      modelIds: ["google/gemini-2.5-flash"],
      fixtureIds: ["fixture-a"],
      repetitions: 3,
      maximumTokens: 2048,
      timeoutMs: 90_000,
      maximumCostUsd: 5,
      maximumPromptPricePerMillionUsd: 3,
      maximumCompletionPricePerMillionUsd: 15,
      mode: "disputed-zones",
      qualified: false,
    },
    execution: {
      plannedRunCount: 3,
      completedRunCount: 3,
      maximumCostUsd: 5,
      observedCostUsd: 0.03,
      complete: true,
      stopReason: null,
    },
    qualified: false,
    models: [{
      modelId: "google/gemini-2.5-flash",
      score: {
        schemaVersion: "recognition-ai-benchmark-score-v1",
        runCount: 3,
        schemaFailureRate: 0,
        safetyViolationCount: 0,
        highConfidenceConfirmationRate: 0.75,
        falseDowngradeRate: 0.25,
        unsupportedConfirmationRate: 0,
        openingClassificationAccuracy: 0.8,
        stableDecisionRate: 0.9,
        medianLatencyMs: 850,
        totalPromptTokens: 300,
        totalCompletionTokens: 60,
        totalTokens: 360,
        totalCostUsd: 0.03,
        qualified: false,
      },
    }],
    runs,
  };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("verification benchmark human-review summary", () => {
  it("renders mechanical eligibility, spend and review-only metrics without selecting a model", () => {
    const markdown = renderVerificationQualificationMarkdown(qualification());

    expect(markdown).toContain("# Vlezet AI verification review");
    expect(markdown).toContain("exact-head-sha");
    expect(markdown).toContain("Mechanically eligible for manual review");
    expect(markdown).toContain("$0.030000 / $5.00");
    expect(markdown).toContain("google/gemini-2.5-flash");
    expect(markdown).toContain("90.0%");
    expect(markdown).toContain("80.0%");
    expect(markdown).toContain("75.0%");
    expect(markdown).toContain("25.0%");
    expect(markdown).toContain("850 ms");
    expect(markdown).toContain("Manual product review is required");
    expect(markdown).toContain("No model is selected automatically");
    expect(markdown).not.toMatch(/qualified\s*[:=]\s*true|selectedModelId\s*[:=]\s*[^n]/i);
  });

  it("surfaces blockers and escapes markdown table/control characters", () => {
    const markdown = renderVerificationQualificationMarkdown(qualification({
      reportMechanicallyComplete: false,
      blockers: ["execution | incomplete\nretry"],
      models: [{
        ...qualification().models[0],
        modelId: "model|unsafe\nlabel",
        eligibleForManualReview: false,
        blockers: ["schema | failure\nobserved"],
      }],
    }));

    expect(markdown).toContain("Mechanically blocked");
    expect(markdown).toContain("execution \\| incomplete retry");
    expect(markdown).toContain("model\\|unsafe label");
    expect(markdown).toContain("schema \\| failure observed");
    expect(markdown).not.toMatch(/\nlabel|\nfailure|\nincomplete/);
  });

  it("never renders secret-like or source-image material from unsupported extra fields", () => {
    const markdown = renderVerificationQualificationMarkdown(qualification({
      rawProviderResponse: "Authorization: Bearer sk-or-v1-secret",
      sourceImageDataUrl: "data:image/png;base64,PRIVATE",
    }));

    expect(markdown).not.toMatch(/data:image|base64|Authorization|Bearer|sk-or-v1-|rawProviderResponse|sourceImageDataUrl/i);
  });

  it("CLI writes the markdown review beside the canonical qualification JSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "vlezet-ai-review-summary-"));
    temporaryRoots.push(root);
    const inputPath = join(root, "benchmark.json");
    const outputPath = join(root, "qualification.json");
    await import("node:fs/promises").then(({ writeFile }) => writeFile(inputPath, JSON.stringify(benchmarkReport()), "utf8"));

    await runVerificationQualificationCli([inputPath, outputPath]);

    const markdownPath = join(root, "qualification.md");
    const markdown = await readFile(markdownPath, "utf8");
    expect(markdown).toContain("# Vlezet AI verification review");
    expect(markdown).toContain("No model is selected automatically");
  });

  it("publishes the sanitized review to GitHub Step Summary and scans JSON plus Markdown artifacts", () => {
    const workflow = readFileSync(
      new URL("../../../.github/workflows/recognition-ai-benchmark.yml", import.meta.url),
      "utf8",
    );

    expect(workflow).toContain("recognition-ai-verification-qualification.md");
    expect(workflow).toContain("$GITHUB_STEP_SUMMARY");
    expect(workflow).toMatch(/artifacts\/ai\/\*\.json/);
    expect(workflow).toMatch(/artifacts\/ai\/\*\.md/);
    expect(workflow).not.toMatch(/^\s{2}(push|pull_request|schedule):/m);
  });
});
