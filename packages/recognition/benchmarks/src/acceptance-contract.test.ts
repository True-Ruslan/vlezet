import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateRecognitionBenchmarkBaselineV1 } from "../schema/baseline-v1";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const baselinePath = join(repositoryRoot, "packages/recognition/benchmarks/baselines/recognition-v1.json");
const workflowPath = join(repositoryRoot, ".github/workflows/recognition-benchmark.yml");
const packagePath = join(repositoryRoot, "package.json");

describe("M7.8A automated acceptance contract", () => {
  it("commits an explicit current-product baseline", () => {
    expect(existsSync(baselinePath)).toBe(true);
    const baseline = validateRecognitionBenchmarkBaselineV1(JSON.parse(readFileSync(baselinePath, "utf8")) as unknown);
    expect(baseline.productBaseSha).toBe("039ddba143cd03ddec0b090606dfdde752446014");
    expect(baseline.result.fixtures).toHaveLength(8);
  });

  it("scores both benchmark paths and uploads one checksummed evidence bundle", () => {
    const workflow = readFileSync(workflowPath, "utf8");
    expect(workflow).toContain("verify:fixtures");
    expect(workflow).toContain("benchmark:recognition:core");
    expect(workflow).toContain("score:source");
    expect(workflow).toContain("benchmark:recognition:evidence");
    expect(workflow).toContain("recognition-benchmark-evidence");
    expect(workflow).toContain("SHA256SUMS");
  });

  it("exposes explicit source and evidence commands", () => {
    const scripts = JSON.parse(readFileSync(packagePath, "utf8")).scripts as Record<string, string>;
    expect(scripts["benchmark:recognition:source-score"]).toBe("npm --prefix tools/recognition-benchmark run score:source");
    expect(scripts["benchmark:recognition:evidence"]).toBe("node tools/recognition-benchmark/run-evidence.mjs");
  });
});
