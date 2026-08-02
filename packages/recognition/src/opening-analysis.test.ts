import { describe, expect, it } from "vitest";
import {
  analyzeOpeningHypotheses,
  validateOpeningHypotheses,
  type OpeningHypothesisRejection,
} from "./opening-analysis";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";

const horizontalWall: RecognitionWallCandidate = {
  id: "wall-1",
  start: { x: 0.1, y: 0.5 },
  end: { x: 0.9, y: 0.5 },
  estimatedThicknessPx: 20,
  confidence: "medium",
  evidence: { localScore: 0.72, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
  origin: "local",
  conflict: null,
};

const baseEdges: DetectedLineSegment[] = [
  { x1: 100, y1: 240, x2: 450, y2: 240 },
  { x1: 100, y1: 260, x2: 450, y2: 260 },
  { x1: 550, y1: 240, x2: 900, y2: 240 },
  { x1: 550, y1: 260, x2: 900, y2: 260 },
];

function candidate(overrides: Partial<RecognitionOpeningCandidate> = {}): RecognitionOpeningCandidate {
  return {
    id: "opening-1",
    kind: "door",
    hostWallCandidateId: "wall-1",
    center: { x: 0.5, y: 0.5 },
    widthPx: 100,
    orientationDeg: 0,
    confidence: "medium",
    evidence: { localScore: 0.72, cloudScore: null, reasons: ["wall-gap", "door-arc-like-line"] },
    origin: "local",
    conflict: null,
    ...overrides,
  };
}

function rejectionCode(rejections: readonly OpeningHypothesisRejection[]): string | undefined {
  return rejections[0]?.code;
}

describe("opening analysis", () => {
  it("returns a bounded door attached to the surviving host wall", () => {
    const result = analyzeOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [horizontalWall],
      segments: [...baseEdges, { x1: 450, y1: 250, x2: 520, y2: 185 }],
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      kind: "door",
      hostWallCandidateId: "wall-1",
      confidence: "medium",
      conflict: null,
    });
    expect(result.candidates[0]?.evidence.reasons).toContain("host-wall-validated");
    expect(result.rejections).toEqual([]);
  });

  it("keeps an ambiguous but valid gap as low-confidence unknown", () => {
    const result = analyzeOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [horizontalWall],
      segments: baseEdges,
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.kind).toBe("unknown-opening");
    expect(result.candidates[0]?.confidence).toBe("low");
  });

  it("rejects a hypothesis that references an unknown host wall", () => {
    const result = validateOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [horizontalWall],
      hypotheses: [candidate({ hostWallCandidateId: "missing-wall" })],
    });

    expect(result.candidates).toEqual([]);
    expect(rejectionCode(result.rejections)).toBe("unknown-host-wall");
  });

  it("rejects a hypothesis whose center is outside the host wall span", () => {
    const result = validateOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [horizontalWall],
      hypotheses: [candidate({ center: { x: 0.96, y: 0.5 } })],
    });

    expect(result.candidates).toEqual([]);
    expect(rejectionCode(result.rejections)).toBe("opening-outside-host-span");
  });

  it("rejects a hypothesis whose endpoints enter the protected wall-end margin", () => {
    const result = validateOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [horizontalWall],
      hypotheses: [candidate({ center: { x: 0.15, y: 0.5 }, widthPx: 80 })],
      options: { minimumEndMarginPx: 40 },
    });

    expect(result.candidates).toEqual([]);
    expect(rejectionCode(result.rejections)).toBe("opening-end-margin");
  });

  it("rejects overlapping hypotheses on the same host wall deterministically", () => {
    const result = validateOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [horizontalWall],
      hypotheses: [
        candidate({ id: "opening-b", center: { x: 0.52, y: 0.5 } }),
        candidate({ id: "opening-a", center: { x: 0.5, y: 0.5 } }),
      ],
    });

    expect(result.candidates.map((item) => item.id)).toEqual(["opening-a"]);
    expect(result.rejections).toEqual([
      expect.objectContaining({ candidateId: "opening-b", code: "opening-overlap" }),
    ]);
  });

  it("orders accepted candidates by host and position rather than input order", () => {
    const result = validateOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [horizontalWall],
      hypotheses: [
        candidate({ id: "opening-right", center: { x: 0.7, y: 0.5 }, widthPx: 60 }),
        candidate({ id: "opening-left", center: { x: 0.3, y: 0.5 }, widthPx: 60 }),
      ],
    });

    expect(result.candidates.map((item) => item.id)).toEqual(["opening-left", "opening-right"]);
  });
});
