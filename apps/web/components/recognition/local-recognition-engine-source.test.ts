import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workerSource = readFileSync(new URL("./recognition.worker.ts", import.meta.url), "utf8");
const engineSource = readFileSync(new URL("./local-recognition-engine.ts", import.meta.url), "utf8");

describe("shared local recognition engine extraction", () => {
  it("keeps the Worker as a protocol adapter", () => {
    expect(workerSource).toContain('import { runLocalRecognitionEngine } from "./local-recognition-engine"');
    expect(workerSource).toContain("context.onmessage = async");
    expect(workerSource).toContain('request.type !== "recognize"');
    expect(workerSource).toContain('type: "progress"');
    expect(workerSource).toContain('type: "result"');
    expect(workerSource).toContain('type: "error"');
    expect(workerSource).not.toContain("cv.Canny");
    expect(workerSource).not.toContain("cv.HoughLinesP");
    expect(workerSource).not.toContain("MIN_STRICT_WALLS");
  });

  it("extracts Hough evidence from a thick-ink structural mask", () => {
    expect(engineSource).toContain('import cvModule from "@techstark/opencv-js"');
    expect(engineSource).toContain("const MIN_STRICT_WALLS = 3");
    expect(engineSource).toContain("cv.THRESH_BINARY_INV | cv.THRESH_OTSU");
    expect(engineSource).toContain("cv.getStructuringElement(");
    expect(engineSource).toContain("cv.MORPH_RECT");
    expect(engineSource).toContain("cv.morphologyEx(structuralBinary, structuralMask, cv.MORPH_OPEN, structuralKernel)");
    expect(engineSource).toContain("cv.GaussianBlur(structuralMask, strictBlurred");
    expect(engineSource).toContain("cv.GaussianBlur(structuralMask, permissiveBlurred");
    expect(engineSource).toContain("new cv.Size(5, 5)");
    expect(engineSource).toContain("new cv.Size(3, 3)");
    expect(engineSource).toContain("cv.Canny(strictBlurred, strictEdges, 50, 150, 3, false)");
    expect(engineSource).toContain("cv.Canny(permissiveBlurred, permissiveEdges, 25, 90, 3, false)");
    expect(engineSource).toContain("appendHoughSegments({");
    expect(engineSource.match(/appendHoughSegments\(\{/g)).toHaveLength(2);
    expect(engineSource).toContain("for (let offset = 0; offset + 3 < lines.data32S.length; offset += 4)");
    expect(engineSource).not.toContain("row < lines.rows");
    const structuralMask = engineSource.indexOf("cv.morphologyEx(structuralBinary, structuralMask");
    const firstCanny = engineSource.indexOf("cv.Canny(strictBlurred");
    const finalDeduplication = engineSource.lastIndexOf("deduplicateDetectedSegments(");
    const wallAnalysis = engineSource.indexOf("analyzeWallCandidates({");
    expect(structuralMask).toBeGreaterThan(-1);
    expect(structuralMask).toBeLessThan(firstCanny);
    expect(finalDeduplication).toBeGreaterThan(-1);
    expect(finalDeduplication).toBeLessThan(wallAnalysis);
  });

  it("keeps topology-aware recognition and pixel evidence in the shared engine", () => {
    expect(engineSource).toContain("analyzeWallCandidates");
    expect(engineSource).toContain("pairedCenterlineCount");
    expect(engineSource).toContain("topologyEdgeCount");
    expect(engineSource).toContain("buildOpeningHypotheses");
    expect(engineSource).toContain("rescaleRecognitionPixelEvidence");
    expect(engineSource).toContain("resolveOpenCvModule");
    expect(engineSource).toContain('code: "multi-pass-source-normalisation"');
  });

  it("defers local opening candidates until M7.8C host-wall validation", () => {
    expect(engineSource).toContain("const openingHypotheses = buildOpeningHypotheses({");
    expect(engineSource).toContain("const analysisOpenings: ReturnType<typeof buildOpeningHypotheses> = []");
    expect(engineSource).toContain('code: "opening-classification-deferred"');
    expect(engineSource).not.toContain("unknown-host-openings-rejected");
  });

  it("deletes every temporary OpenCV matrix", () => {
    for (const matrix of [
      "permissiveLines",
      "strictLines",
      "permissiveEdges",
      "strictEdges",
      "permissiveBlurred",
      "strictBlurred",
      "structuralKernel",
      "structuralMask",
      "structuralBinary",
      "gray",
      "source",
    ]) {
      expect(engineSource).toContain(`${matrix}?.delete()`);
    }
  });

  it("supports deterministic draft IDs without detaching the browser Crypto method", () => {
    expect(engineSource).toContain("createDraftId?: () => string");
    expect(engineSource).toContain("options.createDraftId?.() ?? crypto.randomUUID()");
    expect(engineSource).not.toContain("(options.createDraftId ?? crypto.randomUUID)()");
  });

  it("preserves the existing progress phases", () => {
    expect(engineSource).toContain("onProgress?: (progress: LocalRecognitionProgress) => void");
    for (const progress of ["0.05", "0.25", "0.5", "0.72", "0.9", "1"]) {
      expect(engineSource).toContain(`progress: ${progress}`);
    }
  });
});
