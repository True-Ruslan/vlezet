import { describe, expect, it, vi } from "vitest";
import {
  classifyOpenRouterVerificationModel,
  OpenRouterDirectProvider,
} from "./openrouter-provider";

const signal = new AbortController().signal;

function highConfidenceSummary(count: number) {
  return {
    walls: Array.from({ length: count }, (_, index) => ({
      id: `wall-${index + 1}`,
      start: { x: 0.1, y: 0.1 + index * 0.05 },
      end: { x: 0.9, y: 0.1 + index * 0.05 },
      estimatedThicknessPx: 20,
      confidence: "high" as const,
      evidence: { localScore: 0.9, cloudScore: null, reasons: ["structural-region"] },
      origin: "local" as const,
      conflict: null,
    })),
    openings: [],
  };
}

describe("OpenRouter verification model profiles", () => {
  it("classifies Gemini 2.5 Flash aliases as unqualified for floor-plan verification", () => {
    for (const modelId of [
      "google/gemini-2.5-flash",
      "google/gemini-2.5-flash:free",
      "gemini-2.5-flash",
      "google/gemini-2.5-flash-preview-05-20",
    ]) {
      expect(classifyOpenRouterVerificationModel(modelId)).toBe("unqualified-for-floor-plan-verification");
    }
    expect(classifyOpenRouterVerificationModel("google/gemini-2.5-pro")).toBe("unreviewed");
    expect(classifyOpenRouterVerificationModel("anthropic/claude-sonnet-4.6")).toBe("unreviewed");
  });

  it("adds an informational warning when Gemini confirms less than 40 percent of local high-confidence candidates", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        walls: [{ id: "wall-1", confidence: "high", score: 0.96 }],
        openings: [],
      }) } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
    const provider = new OpenRouterDirectProvider({
      apiKey: "key",
      modelId: "google/gemini-2.5-flash",
      fetcher,
    });

    const result = await provider.recognize({
      imageDataUrl: "data:image/png;base64,AAAA",
      imageWidthPx: 1000,
      imageHeightPx: 800,
      localSummary: highConfidenceSummary(5),
    }, signal);

    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "weak-ai-verification-profile",
      severity: "warning",
      candidateId: null,
      message: expect.stringMatching(/не исправляет геометрию/i),
    }));
  });

  it("does not warn when the same model confirms at least 40 percent", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        walls: [
          { id: "wall-1", confidence: "high", score: 0.96 },
          { id: "wall-2", confidence: "high", score: 0.93 },
        ],
        openings: [],
      }) } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
    const provider = new OpenRouterDirectProvider({
      apiKey: "key",
      modelId: "google/gemini-2.5-flash",
      fetcher,
    });

    const result = await provider.recognize({
      imageDataUrl: "data:image/png;base64,AAAA",
      imageWidthPx: 1000,
      imageHeightPx: 800,
      localSummary: highConfidenceSummary(5),
    }, signal);

    expect(result.diagnostics?.some((diagnostic) => diagnostic.code === "weak-ai-verification-profile") ?? false)
      .toBe(false);
  });

  it("does not apply a Gemini-specific warning to an unreviewed model", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ walls: [], openings: [] }) } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
    const provider = new OpenRouterDirectProvider({
      apiKey: "key",
      modelId: "google/gemini-2.5-pro",
      fetcher,
    });

    const result = await provider.recognize({
      imageDataUrl: "data:image/png;base64,AAAA",
      imageWidthPx: 1000,
      imageHeightPx: 800,
      localSummary: highConfidenceSummary(5),
    }, signal);

    expect(result.diagnostics?.some((diagnostic) => diagnostic.code === "weak-ai-verification-profile") ?? false)
      .toBe(false);
  });
});
