import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./local-recognition-engine.ts", import.meta.url), "utf8");

describe("M7.10 thin structural recovery integration", () => {
  it("creates separate pre-morphology and thick structural mask views", () => {
    expect(source).toContain("const thinInkMaskView");
    expect(source).toContain("structuralBinary?.data");
    expect(source).toContain("const structuralMaskView");
    expect(source.indexOf("const thinInkMaskView")).toBeLessThan(source.indexOf("cv.morphologyEx(structuralBinary"));
  });

  it("recovers bounded thin components after primary fusion and before thick-wall consolidation", () => {
    expect(source).toContain("recoverThinStructuralWalls");
    expect(source).toContain("const thinStructuralRecovery = recoverThinStructuralWalls({");
    expect(source).toContain("primaryWalls: analysisWalls");
    expect(source).toContain("segments: symbolSegments");
    expect(source).toContain("inkMask: thinInkMaskView");
    const fusion = source.indexOf("const wallEvidenceFusion = useStructuralRegionEvidence");
    const recovery = source.indexOf("const thinStructuralRecovery = recoverThinStructuralWalls({");
    const thick = source.indexOf("const thickWallConsolidation = consolidateThickWallSiblings({");
    expect(recovery).toBeGreaterThan(fusion);
    expect(thick).toBeGreaterThan(recovery);
  });

  it("records recovery evidence without changing AI or Apply authority", () => {
    expect(source).toContain("thinRecoveredWallCount");
    expect(source).toContain("thinAcceptedComponentCount");
    expect(source).toContain("thinDominantFrameDeg");
    expect(source).toContain("thinRecoveryDiagnosticCodes");
    expect(source).toContain('code: "thin-structural-component-recovery"');
    expect(source).not.toContain("autoApplyThinWalls");
  });
});
