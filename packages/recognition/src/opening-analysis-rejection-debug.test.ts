import { describe, expect, it } from "vitest";
import { validateOpeningHypotheses } from "./opening-analysis";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";

const wall: RecognitionWallCandidate = {
  id: "wall-debug",
  start: { x: 0.1, y: 0.5 },
  end: { x: 0.9, y: 0.5 },
  estimatedThicknessPx: 20,
  confidence: "medium",
  evidence: { localScore: 0.8, cloudScore: null, reasons: ["test-wall"] },
  origin: "local",
  conflict: null,
};

const opening: RecognitionOpeningCandidate = {
  id: "opening-debug",
  kind: "door",
  hostWallCandidateId: wall.id,
  center: { x: 0.15, y: 0.5 },
  widthPx: 80,
  orientationDeg: 0,
  confidence: "medium",
  evidence: { localScore: 0.75, cloudScore: null, reasons: ["door-leaf-anchored"] },
  origin: "local",
  conflict: null,
};

describe("opening rejection debug evidence", () => {
  it("retains the immutable rejected hypothesis for exact-head diagnosis", () => {
    const result = validateOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [wall],
      hypotheses: [opening],
      options: { minimumEndMarginPx: 40 },
    });

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toEqual([
      expect.objectContaining({
        candidateId: opening.id,
        hostWallCandidateId: wall.id,
        code: "opening-end-margin",
        candidate: opening,
      }),
    ]);
  });
});
