import { describe, expect, it } from "vitest";
import { buildOpeningHypotheses } from "./openings";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";

const wall: RecognitionWallCandidate = {
  id: "wall-window",
  start: { x: 0.1, y: 0.5 },
  end: { x: 0.9, y: 0.5 },
  estimatedThicknessPx: 20,
  confidence: "medium",
  evidence: { localScore: 0.72, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
  origin: "local",
  conflict: null,
};

const structuralSegments: DetectedLineSegment[] = [
  { x1: 100, y1: 240, x2: 435, y2: 240 },
  { x1: 565, y1: 240, x2: 900, y2: 240 },
  { x1: 100, y1: 260, x2: 435, y2: 260 },
  { x1: 565, y1: 260, x2: 900, y2: 260 },
];

const windowSymbols: DetectedLineSegment[] = [
  { x1: 435, y1: 247, x2: 565, y2: 247 },
  { x1: 435, y1: 253, x2: 565, y2: 253 },
  { x1: 435, y1: 247, x2: 435, y2: 253 },
  { x1: 565, y1: 247, x2: 565, y2: 253 },
];

function expectWindow(openings: ReturnType<typeof buildOpeningHypotheses>): void {
  expect(openings).toHaveLength(1);
  expect(openings[0]).toMatchObject({
    kind: "window",
    hostWallCandidateId: "wall-window",
    center: { x: 0.5, y: 0.5 },
    widthPx: 130,
    confidence: "medium",
  });
  expect(openings[0]?.evidence.reasons).toContain("paired-cross-lines");
}

describe("window evidence separation", () => {
  it("uses structural wall edges for the gap and thin symbol lines only for classification", () => {
    expectWindow(buildOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [wall],
      wallSegments: structuralSegments,
      symbolSegments: windowSymbols,
    }));
  });

  it("does not let thin window rails bridge the wall gap in the legacy combined stream", () => {
    expectWindow(buildOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [wall],
      segments: [...structuralSegments, ...windowSymbols],
    }));
  });
});
