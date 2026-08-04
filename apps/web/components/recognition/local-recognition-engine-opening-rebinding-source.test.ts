import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./local-recognition-engine.ts", import.meta.url), "utf8");

describe("M7.10 post-topology opening host rebinding integration", () => {
  it("rebinds door hypotheses against active post-topology walls before opening validation", () => {
    expect(source).toContain("rebindOpeningHypothesesToWalls");
    expect(source).toContain("const reboundDoorOpenings = rebindOpeningHypothesesToWalls({");
    expect(source).toContain("wallCandidates: openingHostWalls");
    expect(source).toContain("hypotheses: doorHostConsolidation.openingHypotheses");
    expect(source).toContain("additionalHypotheses: reboundDoorOpenings.hypotheses");

    const topology = source.indexOf("const topologySanity = sanitizeRecognitionWallTopology({");
    const activeWalls = source.indexOf("const openingHostWalls = topologySanity.walls.filter");
    const rebinding = source.indexOf("const reboundDoorOpenings = rebindOpeningHypothesesToWalls({");
    const openingAnalysis = source.indexOf("const openingAnalysis = analyzeOpeningHypotheses({");
    expect(activeWalls).toBeGreaterThan(topology);
    expect(rebinding).toBeGreaterThan(activeWalls);
    expect(openingAnalysis).toBeGreaterThan(rebinding);
  });

  it("records rebound evidence and preserves fail-closed budget diagnostics", () => {
    expect(source).toContain("doorOpeningReboundCount");
    expect(source).toContain("doorOpeningRebindDiagnosticCodes");
    expect(source).toContain('code: "opening-host-rebound"');
    expect(source).toContain('code: "opening-host-rebind-budget"');
    expect(source).not.toContain("forceOpeningHostRebind");
  });
});
