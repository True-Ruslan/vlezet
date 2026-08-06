import { describe, expect, it, vi } from "vitest";
import { validateAiBenchmarkConfig } from "../../../tools/recognition-benchmark/ai-benchmark/config.mjs";
import { createOpenRouterBenchmarkClient } from "../../../tools/recognition-benchmark/ai-benchmark/openrouter-client.mjs";

describe("paid AI proposal benchmark boundary", () => {
  it("recognizes proposal discovery only as an explicit bounded mode", () => {
    expect(validateAiBenchmarkConfig({
      modelIds: ["google/gemini-2.5-flash"],
      fixtureIds: ["real-plan-001-anonymized"],
      repetitions: 1,
      maximumTokens: 2048,
      timeoutMs: 90_000,
      mode: "proposal-discovery-stage1",
    })).toMatchObject({
      mode: "proposal-discovery-stage1",
      qualified: false,
    });
  });

  it("fails before network access when the paid secret is absent", () => {
    const fetcher = vi.fn();
    expect(() => createOpenRouterBenchmarkClient({ apiKey: "", fetcher })).toThrow(/OPENROUTER_API_KEY/i);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
