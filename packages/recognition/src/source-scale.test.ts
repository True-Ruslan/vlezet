import { describe, expect, it } from "vitest";
import { rescaleRecognitionPixelEvidence, sourceRasterPixelScale } from "./source-scale";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";

const wall: RecognitionWallCandidate = {
  id: "wall",
  start: { x: 0.1, y: 0.2 },
  end: { x: 0.9, y: 0.2 },
  estimatedThicknessPx: 24,
  confidence: "high",
  evidence: { localScore: 0.9, cloudScore: null, reasons: ["parallel-edges"] },
  origin: "local",
  conflict: null,
};

const opening: RecognitionOpeningCandidate = {
  id: "opening",
  kind: "door",
  hostWallCandidateId: "wall",
  center: { x: 0.5, y: 0.2 },
  widthPx: 120,
  orientationDeg: 0,
  confidence: "medium",
  evidence: { localScore: 0.7, cloudScore: null, reasons: ["wall-gap"] },
  origin: "local",
  conflict: null,
};

describe("source raster pixel evidence", () => {
  it("rescales thickness and opening width from analysis pixels to source pixels", () => {
    const result = rescaleRecognitionPixelEvidence({
      walls: [wall],
      openings: [opening],
      analysisWidthPx: 2000,
      analysisHeightPx: 1000,
      sourceWidthPx: 8000,
      sourceHeightPx: 4000,
    });
    expect(result.walls[0]?.estimatedThicknessPx).toBe(96);
    expect(result.openings[0]?.widthPx).toBe(480);
  });

  it("rejects non-uniform analysis scaling that would corrupt metric evidence", () => {
    expect(() => sourceRasterPixelScale({ analysisWidthPx: 2000, analysisHeightPx: 1200, sourceWidthPx: 8000, sourceHeightPx: 4000 })).toThrow(/пропорции/i);
  });
});
