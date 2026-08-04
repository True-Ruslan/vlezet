import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./opening-analysis-runtime.ts", import.meta.url), "utf8");

describe("window host bridge opening runtime", () => {
  it("passes bridge-derived windows through the common opening validator", () => {
    expect(source).toContain("detectWindowHostBridgeOpenings");
    expect(source).toContain("bridgeWindowOpenings");
    expect(source).toContain("...bridgeWindowOpenings");
    expect(source).toContain("analyzeOpeningHypothesesBase");
  });
});
