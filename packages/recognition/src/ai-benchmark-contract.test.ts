import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_AI_BENCHMARK_LIMITS,
  validateAiBenchmarkConfig,
} from "../../../tools/recognition-benchmark/ai-benchmark/config.mjs";
import {
  createOpenRouterBenchmarkClient,
  normalizeVerificationResponse,
  redactAiBenchmarkText,
} from "../../../tools/recognition-benchmark/ai-benchmark/openrouter-client.mjs";
import { scoreAiBenchmarkRuns } from "../../../tools/recognition-benchmark/ai-benchmark/score.mjs";

const localSummary = {
  walls: [
    {
      id: "wall-a",
      start: { x: 0.1, y: 0.2 },
      end: { x: 0.8, y: 0.2 },
      estimatedThicknessPx: 24,
      confidence: "high",
      conflict: null,
      evidence: { localScore: 0.9, cloudScore: null, reasons: ["test"] },
      origin: "local",
    },
    {
      id: "wall-unsupported",
      start: { x: 0.3, y: 0.4 },
      end: { x: 0.4, y: 0.4 },
      estimatedThicknessPx: 8,
      confidence: "low",
      conflict: "unsupported",
      evidence: { localScore: 0.3, cloudScore: null, reasons: ["test"] },
      origin: "local",
    },
  ],
  openings: [
    {
      id: "opening-a",
      kind: "door",
      hostWallCandidateId: "wall-a",
      center: { x: 0.45, y: 0.2 },
      widthPx: 90,
      orientationDeg: 0,
      confidence: "medium",
      conflict: null,
      evidence: { localScore: 0.75, cloudScore: null, reasons: ["test"] },
      origin: "local",
    },
  ],
} as const;

describe("M7.9 bounded AI benchmark", () => {
  it("accepts only bounded manual benchmark configurations", () => {
    expect(DEFAULT_AI_BENCHMARK_LIMITS).toEqual(expect.objectContaining({
      maximumModels: 3,
      maximumFixtures: 12,
      maximumRepetitions: 5,
      maximumTokens: 2048,
      timeoutMs: 90_000,
      maximumCostUsd: 5,
      maximumPromptPricePerMillionUsd: 3,
      maximumCompletionPricePerMillionUsd: 15,
    }));
    expect(validateAiBenchmarkConfig({
      modelIds: ["google/gemini-2.5-flash"],
      fixtureIds: ["real-plan-001-anonymized"],
      repetitions: 3,
      maximumTokens: 2048,
      timeoutMs: 90_000,
      maximumCostUsd: 5,
      mode: "disputed-zones",
    })).toMatchObject({
      repetitions: 3,
      maximumTokens: 2048,
      maximumCostUsd: 5,
      maximumPromptPricePerMillionUsd: 3,
      maximumCompletionPricePerMillionUsd: 15,
      qualified: false,
    });
    expect(() => validateAiBenchmarkConfig({
      modelIds: ["a", "b", "c", "d"],
      fixtureIds: ["fixture"],
      repetitions: 1,
      maximumTokens: 512,
      timeoutMs: 10_000,
      maximumCostUsd: 1,
      mode: "verification",
    })).toThrow(/models/i);
    expect(() => validateAiBenchmarkConfig({
      modelIds: ["model"],
      fixtureIds: ["fixture"],
      repetitions: 6,
      maximumTokens: 2048,
      timeoutMs: 90_000,
      maximumCostUsd: 1,
      mode: "verification",
    })).toThrow(/repetitions/i);
    for (const maximumCostUsd of [0, -1, 5.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => validateAiBenchmarkConfig({
        modelIds: ["model"],
        fixtureIds: ["fixture"],
        repetitions: 1,
        maximumTokens: 512,
        timeoutMs: 10_000,
        maximumCostUsd,
        mode: "verification",
      })).toThrow(/cost/i);
    }
  });

  it("fails before any network request when the secret is absent", () => {
    const fetcher = vi.fn();
    expect(() => createOpenRouterBenchmarkClient({ apiKey: "", fetcher })).toThrow(/OPENROUTER_API_KEY/i);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("applies bounded provider price and routing guards before the paid request", async () => {
    let requestBody: unknown = null;
    const fetcher = vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
      requestBody = JSON.parse(String(init?.body ?? ""));
      return {
        ok: true,
        status: 200,
        async text() { return ""; },
        async json() {
          return {
            choices: [{ message: { content: JSON.stringify({ walls: [], openings: [] }) } }],
            usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12, cost: 0.001 },
          };
        },
      };
    });
    const client = createOpenRouterBenchmarkClient({ apiKey: "test-key", fetcher });

    await client.verify({
      modelId: "google/gemini-2.5-flash",
      imageDataUrl: "data:image/png;base64,AA==",
      localSummary,
      maximumTokens: 128,
      timeoutMs: 1_000,
      mode: "verification",
      providerMaxPrice: { prompt: 3, completion: 15, image: 0.01, request: 0.01 },
      disableReasoning: true,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(requestBody).toMatchObject({
      provider: {
        sort: "price",
        allow_fallbacks: false,
        data_collection: "deny",
        require_parameters: true,
        max_price: { prompt: 3, completion: 15, image: 0.01, request: 0.01 },
      },
      reasoning: { effort: "none", exclude: true },
    });
  });

  it("normalizes verification-only responses without permitting geometry mutation", () => {
    expect(normalizeVerificationResponse({
      walls: [{ id: "wall-a", confidence: "high", score: 0.96 }],
      openings: [{ id: "opening-a", kind: "door", confidence: "high", score: 0.93 }],
    }, localSummary)).toEqual({
      walls: [{ id: "wall-a", confidence: "high", score: 0.96 }],
      openings: [{ id: "opening-a", kind: "door", confidence: "high", score: 0.93 }],
    });
    expect(() => normalizeVerificationResponse({
      walls: [{ id: "unknown-wall", confidence: "high", score: 0.9 }],
      openings: [],
    }, localSummary)).toThrow(/unknown-wall/i);
    expect(() => normalizeVerificationResponse({
      walls: [{ id: "wall-a", confidence: "high", score: 0.9, start: { x: 0, y: 0 } }],
      openings: [],
    }, localSummary)).toThrow(/geometry|start/i);
  });

  it("redacts OpenRouter secrets and bearer headers from every diagnostic", () => {
    const secret = "sk-or-v1-1234567890abcdef";
    const redacted = redactAiBenchmarkText(`Authorization: Bearer ${secret}; key=${secret}`);
    expect(redacted).not.toContain(secret);
    expect(redacted).not.toMatch(/Bearer\s+sk-/i);
    expect(redacted).toContain("[REDACTED]");
  });

  it("scores repeated verification runs and never qualifies a model automatically", () => {
    const runs = [
      {
        modelId: "google/gemini-2.5-flash",
        fixtureId: "real-plan-001-anonymized",
        repetition: 1,
        latencyMs: 1000,
        usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120, costUsd: 0.001 },
        response: {
          walls: [{ id: "wall-a", confidence: "high", score: 0.95 }],
          openings: [{ id: "opening-a", kind: "door", confidence: "high", score: 0.92 }],
        },
        localSummary,
        expectedOpeningKinds: { "opening-a": "door" },
        schemaFailure: false,
        safetyViolations: [],
      },
      {
        modelId: "google/gemini-2.5-flash",
        fixtureId: "real-plan-001-anonymized",
        repetition: 2,
        latencyMs: 1200,
        usage: { promptTokens: 105, completionTokens: 18, totalTokens: 123, costUsd: null },
        response: {
          walls: [{ id: "wall-a", confidence: "high", score: 0.94 }],
          openings: [{ id: "opening-a", kind: "door", confidence: "high", score: 0.9 }],
        },
        localSummary,
        expectedOpeningKinds: { "opening-a": "door" },
        schemaFailure: false,
        safetyViolations: [],
      },
    ];
    expect(scoreAiBenchmarkRuns(runs)).toMatchObject({
      schemaFailureRate: 0,
      safetyViolationCount: 0,
      highConfidenceConfirmationRate: 1,
      unsupportedConfirmationRate: 0,
      openingClassificationAccuracy: 1,
      stableDecisionRate: 1,
      medianLatencyMs: 1100,
      totalPromptTokens: 205,
      totalCompletionTokens: 38,
      qualified: false,
    });
  });

  it("counts unsupported confirmations and unstable decisions as explicit regressions", () => {
    const score = scoreAiBenchmarkRuns([
      {
        modelId: "model",
        fixtureId: "fixture",
        repetition: 1,
        latencyMs: 500,
        usage: null,
        response: {
          walls: [
            { id: "wall-a", confidence: "high", score: 0.9 },
            { id: "wall-unsupported", confidence: "high", score: 0.9 },
          ],
          openings: [],
        },
        localSummary,
        expectedOpeningKinds: {},
        schemaFailure: false,
        safetyViolations: [],
      },
      {
        modelId: "model",
        fixtureId: "fixture",
        repetition: 2,
        latencyMs: 700,
        usage: null,
        response: { walls: [], openings: [] },
        localSummary,
        expectedOpeningKinds: {},
        schemaFailure: false,
        safetyViolations: [],
      },
    ]);
    expect(score.unsupportedConfirmationRate).toBeGreaterThan(0);
    expect(score.stableDecisionRate).toBeLessThan(1);
    expect(score.qualified).toBe(false);
  });
});
