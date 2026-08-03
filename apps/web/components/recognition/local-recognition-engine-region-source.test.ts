import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const engineSource = readFileSync(new URL("./local-recognition-engine.ts", import.meta.url), "utf8");

describe("region-first local recognition", () => {
  it("extracts thick structural regions before wall Canny or Hough fallback", () => {
    expect(engineSource).toContain("extractStructuralWallRegions");
    expect(engineSource).toContain("structuralRegionEvidence");
    expect(engineSource).toContain("useStructuralRegionEvidence");

    const regionExtraction = engineSource.indexOf("extractStructuralWallRegions({");
    const wallCanny = engineSource.indexOf("cv.Canny(strictBlurred");
    const wallHough = engineSource.indexOf("appendHoughSegments({ edges: strictEdges");

    expect(regionExtraction).toBeGreaterThan(-1);
    expect(regionExtraction).toBeLessThan(wallCanny);
    expect(regionExtraction).toBeLessThan(wallHough);
  });

  it("keeps wall Hough behind a bounded fallback branch", () => {
    const fallbackBranch = engineSource.indexOf("if (!useStructuralRegionEvidence)");
    const wallCanny = engineSource.indexOf("cv.Canny(strictBlurred");
    const wallHough = engineSource.indexOf("appendHoughSegments({ edges: strictEdges");

    expect(fallbackBranch).toBeGreaterThan(-1);
    expect(fallbackBranch).toBeLessThan(wallCanny);
    expect(fallbackBranch).toBeLessThan(wallHough);
  });

  it("records region evidence separately from fallback Hough evidence", () => {
    expect(engineSource).toContain("structuralRegionCount");
    expect(engineSource).toContain('selectedMode: "regions"');
    expect(engineSource).toContain('code: "region-first-wall-evidence"');
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
