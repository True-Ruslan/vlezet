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

describe("Stage 1 AI benchmark workflow boundaries", () => {
  it("keeps deterministic proposal recovery on pull requests without paid credentials", () => {
    expect(deterministicSource).toContain("pull_request:");
    expect(deterministicSource).toContain("benchmark:recognition:ai-proposal-gate");
    expect(deterministicSource).not.toContain("secrets.OPENROUTER_API_KEY");
  });

  it("keeps Stage 1 paid discovery manual-only with explicit bounds", () => {
    expect(paidSource).toContain("workflow_dispatch:");
    expect(paidSource).not.toMatch(/^\s{2}(push|pull_request|pull_request_target|schedule):/m);
    expect(paidSource).toContain("proposal-discovery-stage1");
    expect(paidSource).toContain("proposal_fixtures:");
    expect(paidSource).toContain("Stage 1 requires at least 3");
    expect(paidSource).toContain("AI_BENCHMARK_MAX_COST_USD: \"5\"");
  });

  it("runs deterministic OpenCV evidence before either paid mode", () => {
    const localIndex = paidSource.indexOf("Run real source OpenCV benchmark");
    const verificationIndex = paidSource.indexOf("Run bounded OpenRouter verification benchmark");
    const proposalIndex = paidSource.indexOf("Run bounded Stage 1 live proposal benchmark");
    expect(localIndex).toBeGreaterThanOrEqual(0);
    expect(verificationIndex).toBeGreaterThan(localIndex);
    expect(proposalIndex).toBeGreaterThan(localIndex);
  });

  it("keeps verification and Stage 1 qualification separate and scans all normalized evidence", () => {
    expect(paidSource).toContain("Evaluate verification benchmark qualification");
    expect(paidSource).toContain("Prepare Stage 1 proposal qualification artifact");
    expect(paidSource).toContain("automatic selection remains disabled");
    expect(paidSource).toContain("tools/recognition-benchmark/artifacts/ai/*.json");
    expect(paidSource).toContain("tools/recognition-benchmark/artifacts/ai/*.md");
    expect(paidSource).toContain("data:image");
    expect(paidSource).toContain("rawProviderResponse");
  });
});
