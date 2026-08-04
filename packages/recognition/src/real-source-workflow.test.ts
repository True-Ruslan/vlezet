import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../../.github/workflows/recognition-benchmark.yml", import.meta.url),
  "utf8",
);

describe("M7.9 required real source benchmark workflow", () => {
  it("generates and verifies the public twelve-fixture corpus before recognition", () => {
    expect(source).toContain("Generate public real-plan analogue fixtures");
    expect(source).toContain("Verify public real-plan analogue fixtures");
    expect(source).toContain("Assert no private source bytes are committed");
  });

  it("runs, scores and gates the real OpenCV predictions separately", () => {
    expect(source).toContain("Run real source OpenCV benchmark");
    expect(source).toContain("Score real source benchmark");
    expect(source).toContain("Enforce real fixture scenario gate");
    expect(source).toContain("recognition-real-source.spec.mjs");
    expect(source).toContain("benchmark:recognition:real-source-score");
    expect(source).toContain("benchmark:recognition:real:gate");
  });

  it("preserves real predictions, overlays, debug and gate evidence", () => {
    expect(source).toContain("tools/recognition-benchmark/artifacts/real-source");
    expect(source).toContain("recognition-benchmark-evidence");
  });

  it("never exposes or uses the OpenRouter secret in deterministic CI", () => {
    expect(source).not.toContain("OPENROUTER_API_KEY");
    expect(source).not.toContain("secrets.");
  });
});
