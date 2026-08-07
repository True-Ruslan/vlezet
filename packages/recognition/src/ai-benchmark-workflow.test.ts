import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const deterministicSource = readFileSync(
  new URL("../../../.github/workflows/recognition-benchmark.yml", import.meta.url),
  "utf8",
);
const paidSource = readFileSync(
  new URL("../../../.github/workflows/recognition-ai-benchmark.yml", import.meta.url),
  "utf8",
);

describe("AI benchmark workflow boundaries", () => {
  it("runs the deterministic proposal gate on pull requests without paid credentials", () => {
    expect(deterministicSource).toContain("pull_request:");
    expect(deterministicSource).toContain("benchmark:recognition:ai-proposal-gate");
    expect(deterministicSource).toContain("contents: read");
    expect(deterministicSource).not.toContain("secrets.OPENROUTER_API_KEY");
    expect(deterministicSource).not.toContain("OPENROUTER_API_KEY:");
    expect(deterministicSource).not.toContain("openrouter.ai");
  });

  it("keeps every paid OpenRouter mode manual-only and inaccessible to push or pull requests", () => {
    expect(paidSource).toContain("workflow_dispatch:");
    expect(paidSource).not.toMatch(/^\s{2}(push|pull_request|pull_request_target|schedule):/m);
    expect(paidSource).toContain("contents: read");
    expect(paidSource).toContain("proposal-discovery-stage1");
  });

  it("uses the GitHub secret without printing or persisting it", () => {
    expect(paidSource).toContain("secrets.OPENROUTER_API_KEY");
    expect(paidSource).toContain("OPENROUTER_API_KEY:");
    expect(paidSource).not.toMatch(/sk-or-v1-[A-Za-z0-9_-]{16,}/);
    expect(paidSource).not.toContain("echo $OPENROUTER_API_KEY");
    expect(paidSource).toContain("Assert produced evidence contains no secrets or source bytes");
    expect(paidSource).toContain("steps.artifact_safety.outcome == 'success'");
    expect(paidSource).toContain("grep -Eiq 'sk-or-v1-");
    for (const marker of [
      "Authorization",
      "data:image",
      "base64",
      "provider_headers",
      "sourceImageDataUrl",
      "overlayImageDataUrl",
      "rawProviderResponse",
    ]) {
      expect(paidSource).toContain(marker);
    }
  });

  it("keeps model, fixture, repetition, token, timeout and cost bounds explicit", () => {
    expect(paidSource).toContain("maximum 3");
    expect(paidSource).toContain("maximum 12");
    expect(paidSource).toContain("1-5");
    expect(paidSource).toContain("Stage 1 requires at least 3");
    expect(paidSource).toContain("AI_BENCHMARK_MAX_TOKENS: \"2048\"");
    expect(paidSource).toContain("AI_BENCHMARK_TIMEOUT_MS: \"90000\"");
    expect(paidSource).toContain("AI_BENCHMARK_MAX_COST_USD: \"5\"");
  });

  it("generates public fixtures, runs local OpenCV first and only then permits bounded paid analysis", () => {
    for (const marker of [
      "Generate public real-plan analogue fixtures",
      "Verify public real-plan analogue fixtures",
      "Assert no private source bytes are committed",
      "Run real source OpenCV benchmark",
      "Run bounded OpenRouter verification benchmark",
      "Run bounded Stage 1 live proposal benchmark",
    ]) {
      expect(paidSource).toContain(marker);
    }
    const localIndex = paidSource.indexOf("Run real source OpenCV benchmark");
    const verificationIndex = paidSource.indexOf("Run bounded OpenRouter verification benchmark");
    const proposalIndex = paidSource.indexOf("Run bounded Stage 1 live proposal benchmark");
    expect(localIndex).toBeGreaterThanOrEqual(0);
    expect(verificationIndex).toBeGreaterThan(localIndex);
    expect(proposalIndex).toBeGreaterThan(localIndex);
  });

  it("uploads only normalized evidence with finite retention", () => {
    expect(paidSource).toContain("recognition-ai-benchmark-evidence");
    expect(paidSource).toContain("retention-days: 14");
    expect(paidSource).toContain("tools/recognition-benchmark/artifacts/ai");
    expect(paidSource).not.toContain("packages/recognition/benchmarks/real-analogues/fixtures/**/source.png");
  });
});
