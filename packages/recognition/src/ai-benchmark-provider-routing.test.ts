import { describe, expect, it } from "vitest";
import type {
  AiBenchmarkFetchInit,
  AiBenchmarkFetcher,
} from "../../../tools/recognition-benchmark/ai-benchmark/openrouter-client.mjs";
import { createOpenRouterBenchmarkClient } from "../../../tools/recognition-benchmark/ai-benchmark/openrouter-client.mjs";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("OpenRouter paid benchmark routing boundary", () => {
  it("disables fallback and reasoning, enforces max prices and performs no hidden repair request", async () => {
    const calls: Array<readonly [string, AiBenchmarkFetchInit | undefined]> = [];
    const fetcher: AiBenchmarkFetcher = async (url, init) => {
      calls.push([url, init]);
      return jsonResponse({
        choices: [{ message: { content: JSON.stringify({ walls: [], openings: [] }) }],
        usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12, cost: 0.001 },
      });
    };
    const client = createOpenRouterBenchmarkClient({ apiKey: "test-key", fetcher });

    await client.verify({
      modelId: "google/gemini-2.5-flash",
      imageDataUrl: "data:image/png;base64,AA==",
      localSummary: { walls: [], openings: [] },
      maximumTokens: 100,
      timeoutMs: 10_000,
      mode: "verification",
      providerMaxPrice: {
        prompt: 0.2,
        completion: 10,
        image: 0.01,
        request: 0.01,
      },
      disableReasoning: true,
    });

    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call).toBeDefined();
    const [, init] = call!;
    const request = JSON.parse(String(init?.body));
    expect(request.provider).toEqual({
      require_parameters: true,
      allow_fallbacks: false,
      sort: "price",
      max_price: {
        prompt: 0.2,
        completion: 10,
        image: 0.01,
        request: 0.01,
      },
    });
    expect(request.reasoning).toEqual({ effort: "none", exclude: true });
    expect(request).not.toHaveProperty("plugins");
  });
});
