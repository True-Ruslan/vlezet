import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const engineSource = readFileSync(new URL("./local-recognition-engine.ts", import.meta.url), "utf8");

describe("region-first local recognition", () => {
  it("extracts thick structural regions before supplemental wall Canny and Hough", () => {
    expect(engineSource).toContain("extractStructuralWallRegions");
    expect(engineSource).toContain("structuralRegionEvidence");
    expect(engineSource).toContain("useStructuralRegionEvidence");

    const regionExtraction = engineSource.indexOf("extractStructuralWallRegions({");
    const wallCanny = engineSource.indexOf("cv.Canny(strictBlurred");
    const wallHough = engineSource.indexOf("edges: strictEdges");

    expect(regionExtraction).toBeGreaterThan(-1);
    expect(wallCanny).toBeGreaterThan(regionExtraction);
    expect(wallHough).toBeGreaterThan(wallCanny);
  });

  it("runs strict Hough as bounded supplemental evidence even when regions exist", () => {
    expect(engineSource).toContain("fuseRecognitionWallEvidence");
    expect(engineSource).toContain("strictSupplementalSegments");
    expect(engineSource).toContain("const wallEvidenceFusion = useStructuralRegionEvidence");
    expect(engineSource).toContain("primaryWalls: strictWalls");
    expect(engineSource).toContain("supplementalWalls,");

    const fallbackBranch = engineSource.indexOf("if (!useStructuralRegionEvidence)");
    const strictCanny = engineSource.indexOf("cv.Canny(strictBlurred");
    const strictHough = engineSource.indexOf("edges: strictEdges");
    const permissiveCanny = engineSource.indexOf("cv.Canny(permissiveBlurred");

    expect(strictCanny).toBeGreaterThan(-1);
    expect(strictHough).toBeGreaterThan(strictCanny);
    expect(fallbackBranch).toBeGreaterThan(strictHough);
    expect(permissiveCanny).toBeGreaterThan(fallbackBranch);
  });

  it("records primary regions and accepted supplemental Hough evidence separately", () => {
    expect(engineSource).toContain("structuralRegionCount");
    expect(engineSource).toContain("supplementalCandidateCount");
    expect(engineSource).toContain("acceptedSupplementalCount");
    expect(engineSource).toContain("wallEvidenceFusionDiagnosticCodes");
    expect(engineSource).toContain('"regions+supplemental" as const');
    expect(engineSource).toContain('code: "topology-anchored-hough-supplement"');
  });

  it("stabilizes region walls before host consolidation and opening analysis", () => {
    expect(engineSource).toContain("consolidateThickWallSiblings");
    expect(engineSource).toContain("applyStructuralClutterVeto");
    expect(engineSource).toContain("const structuralMaskView");
    expect(engineSource).toContain("const thickWallConsolidation = consolidateThickWallSiblings({");
    expect(engineSource).toContain("const structuralClutterVeto = applyStructuralClutterVeto({");
    expect(engineSource).toContain("structuralMask: structuralMaskView");

    const fusion = engineSource.indexOf("const wallEvidenceFusion = useStructuralRegionEvidence");
    const thickWalls = engineSource.indexOf("const thickWallConsolidation = consolidateThickWallSiblings({");
    const clutter = engineSource.indexOf("const structuralClutterVeto = applyStructuralClutterVeto({");
    const hostConsolidation = engineSource.indexOf("const windowHostConsolidation = consolidateWindowHostWalls({");
    const sanitation = engineSource.indexOf("const topologySanity = sanitizeRecognitionWallTopology({");
    const openings = engineSource.indexOf("const openingAnalysis = analyzeOpeningHypotheses({");

    expect(fusion).toBeGreaterThan(-1);
    expect(thickWalls).toBeGreaterThan(fusion);
    expect(clutter).toBeGreaterThan(thickWalls);
    expect(hostConsolidation).toBeGreaterThan(clutter);
    expect(sanitation).toBeGreaterThan(hostConsolidation);
    expect(openings).toBeGreaterThan(sanitation);
  });

  it("records thick-wall, clutter and mask-window evidence in debug output", () => {
    expect(engineSource).toContain("thickWallMergedGroupCount");
    expect(engineSource).toContain("thickWallConsolidationDiagnosticCodes");
    expect(engineSource).toContain("structuralClutterBlockedCount");
    expect(engineSource).toContain("structuralClutterDiagnosticCodes");
    expect(engineSource).toContain("maskSupportedWindowCount");
    expect(engineSource).toContain('code: "mask-supported-window-recovery"');
  });

  it("preserves topology-calibrated high confidence instead of forcing every region wall to medium", () => {
    expect(engineSource).toContain("confidence: candidate.confidence");
    expect(engineSource).toContain('candidate.confidence === "high" ? 0.88');
    expect(engineSource).not.toContain('confidence: candidate.confidence === "low" ? "low" : "medium"');
  });

  it("does not bypass the recognition package runtime completion gate", () => {
    expect(engineSource).toContain('from "@vlezet/recognition"');
    expect(engineSource).not.toContain("experimentalCompleteWallCenterlines");
    expect(engineSource).not.toContain('from "@vlezet/recognition/src/wall-completion"');
  });
});
