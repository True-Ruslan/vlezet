import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const engineSource = readFileSync(new URL("./local-recognition-engine.ts", import.meta.url), "utf8");

describe("region-first local recognition", () => {
  it("extracts thick structural regions before any Canny or Hough fallback", () => {
    expect(engineSource).toContain("extractStructuralWallRegions");
    expect(engineSource).toContain("structuralRegionEvidence");
    expect(engineSource).toContain("useStructuralRegionEvidence");

    const regionExtraction = engineSource.indexOf("extractStructuralWallRegions({");
    const firstCanny = engineSource.indexOf("cv.Canny(");
    const firstHough = engineSource.indexOf("cv.HoughLinesP(");

    expect(regionExtraction).toBeGreaterThan(-1);
    expect(regionExtraction).toBeLessThan(firstCanny);
    expect(regionExtraction).toBeLessThan(firstHough);
  });

  it("keeps Hough behind a bounded fallback branch", () => {
    const fallbackBranch = engineSource.indexOf("if (!useStructuralRegionEvidence)");
    const firstCanny = engineSource.indexOf("cv.Canny(");
    const firstHough = engineSource.indexOf("cv.HoughLinesP(");

    expect(fallbackBranch).toBeGreaterThan(-1);
    expect(fallbackBranch).toBeLessThan(firstCanny);
    expect(fallbackBranch).toBeLessThan(firstHough);
  });

  it("records region evidence separately from fallback Hough evidence", () => {
    expect(engineSource).toContain("structuralRegionCount");
    expect(engineSource).toContain('selectedMode: "regions"');
    expect(engineSource).toContain('code: "region-first-wall-evidence"');
  });

  it("runs evidence-gated completion only for region-first evidence", () => {
    expect(engineSource).toContain("DEFAULT_WALL_COMPLETION_OPTIONS");
    expect(engineSource).toContain("const completion = useStructuralRegionEvidence");
    expect(engineSource).toContain("? completeWallCenterlines({");
    expect(engineSource).toContain("mask: {");
    expect(engineSource).toContain("isStructural: (x, y) => {");
    expect(engineSource).toContain("if (x < 0 || y < 0 || x >= input.imageData.width || y >= input.imageData.height) return false");
    expect(engineSource).toContain(": null;");
  });

  it("exposes bounded completion debug evidence", () => {
    expect(engineSource).toContain("completionAcceptedCount");
    expect(engineSource).toContain("completionDiagnosticCodes");
    expect(engineSource).toContain("analysis.completionDiagnostics.map((diagnostic) => diagnostic.code)");
  });
});
