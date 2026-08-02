import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateRecognitionBenchmarkBaselineV1 } from "../schema/baseline-v1";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const baselinePath = join(repositoryRoot, "packages/recognition/benchmarks/baselines/recognition-v1.json");
const workflowPath = join(repositoryRoot, ".github/workflows/recognition-benchmark.yml");
const packagePath = join(repositoryRoot, "package.json");

describe("M7.8 recognition benchmark acceptance contract", () => {
  it("commits an explicit region-first baseline derived from the accepted M7.8A product base", () => {
    expect(existsSync(baselinePath)).toBe(true);
    const baseline = validateRecognitionBenchmarkBaselineV1(JSON.parse(readFileSync(baselinePath, "utf8")) as unknown);
    expect(baseline.productBaseSha).toBe("d6e8668c5ad0780a0a28d9c1fef6e9d37e9bbe4d");
    expect(baseline.harnessSourceSha).toBe("50e3ffdfd58a5562830b0805ebb589cf8b9684c4");
    expect(baseline.result.recognitionEngineVersion).toBe("5");
    expect(baseline.result.fixtures).toHaveLength(9);
    expect(baseline.result.fixtures.at(-1)?.fixtureId).toBe("clutter-symbol-regression");
  });

  it("scores both benchmark paths and uploads one checksummed evidence bundle", () => {
    const workflow = readFileSync(workflowPath, "utf8");
    expect(workflow).toContain("verify:fixtures");
    expect(workflow).toContain("benchmark:recognition:core");
    expect(workflow).toContain("score:source");
    expect(workflow).toContain("benchmark:recognition:evidence");
    expect(workflow).toContain("recognition-benchmark-evidence");
    expect(workflow).toContain("tools/recognition-benchmark/artifacts/evidence");
  });

  it("exposes explicit source and evidence commands", () => {
    const scripts = JSON.parse(readFileSync(packagePath, "utf8")).scripts as Record<string, string>;
    expect(scripts["benchmark:recognition:source-score"]).toBe("npm --prefix tools/recognition-benchmark run score:source");
    expect(scripts["benchmark:recognition:evidence"]).toBe("node tools/recognition-benchmark/run-evidence.mjs");
  });
});
