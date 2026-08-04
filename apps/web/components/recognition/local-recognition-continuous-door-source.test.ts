import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./local-recognition-engine.ts", import.meta.url), "utf8");

describe("continuous-host door production contract", () => {
  it("passes mask-backed continuous door hypotheses through the common validator", () => {
    expect(source).toContain("detectContinuousHostDoorOpenings");
    expect(source).toContain("continuousDoorOpenings.openingHypotheses");
    expect(source).toContain("mask: structuralMaskView");
  });
});
