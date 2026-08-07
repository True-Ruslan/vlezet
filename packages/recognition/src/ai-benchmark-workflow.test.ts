import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../../.github/workflows/recognition-ai-benchmark.yml", import.meta.url),
  "utf8",
);

describe("M7.9 AI benchmark workflow", () => {
  it("is manual-only and never runs on push, pull request or schedule", () => {
    expect(source).toContain("workflow_dispatch:");
    expect(source).not.toMatch(/^\s{2}(push|pull_request|schedule):/m);
    expect(source).toContain("contents: read");
  });

  it("uses the GitHub secret without printing or persisting it", () => {
    expect(source).toContain("secrets.OPENROUTER_API_KEY");
    expect(source).toContain("OPENROUTER_API_KEY:");
    expect(source).not.toMatch(/sk-or-v1-[A-Za-z0-9_-]{16,}/);
    expect(source).not.toContain("echo $OPENROUTER_API_KEY");
    expect(source).toContain("Assert AI artifact contains no secrets");
    expect(source).toContain("grep -Eiq 'sk-or-v1-");
  });

  it("generates public fixtures, runs local OpenCV first and then bounded AI verification", () => {
    expect(source).toContain("Generate public real-plan analogue fixtures");
    expect(source).toContain("Verify public real-plan analogue fixtures");
    expect(source).toContain("Run real source OpenCV benchmark");
    expect(source).toContain("Run bounded OpenRouter benchmark");
    expect(source).toContain("AI_BENCHMARK_MAX_TOKENS: \"2048\"");
    expect(source).toContain("AI_BENCHMARK_TIMEOUT_MS: \"90000\"");
    expect(source).toContain("AI_BENCHMARK_MAX_COST_USD: \"5\"");
  });

  it("uploads only normalized benchmark evidence with finite retention", () => {
    expect(source).toContain("recognition-ai-benchmark-evidence");
    expect(source).toContain("retention-days: 14");
    expect(source).toContain("tools/recognition-benchmark/artifacts/ai");
  });
});
