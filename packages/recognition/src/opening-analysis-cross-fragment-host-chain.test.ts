import { describe, expect, it } from "vitest";
import type {
  RecognitionOpeningCandidate,
  RecognitionWallCandidate,
} from "./model";
import { validateOpeningHypotheses } from "./opening-analysis";

const WIDTH = 1000;
const HEIGHT = 1000;

function wall(id: string, startY: number, endY: number): RecognitionWallCandidate {
  return {
    id,
    start: { x: 0.4, y: startY / HEIGHT },
    end: { x: 0.4, y: endY / HEIGHT },
    estimatedThicknessPx: 20,
    confidence: "medium",
    evidence: {
      localScore: 0.74,
      cloudScore: null,
      reasons: ["filled-wall-region-evidence"],
    },
    origin: "local",
    conflict: null,
  };
}

function opening(hostWallCandidateId: string): RecognitionOpeningCandidate {
  return {
    id: "cross-fragment-window",
    kind: "window",
    hostWallCandidateId,
    center: { x: 0.4, y: 364 / HEIGHT },
    widthPx: 148,
    orientationDeg: 90,
    confidence: "medium",
    evidence: {
      localScore: 0.76,
      cloudScore: null,
      reasons: ["paired-window-rails", "window-host-proposal-evidence"],
    },
    origin: "local",
    conflict: null,
  };
}

describe("opening validation across a collinear host chain", () => {
  it("accepts an opening crossing a fragment boundary when the connected chain supplies the span and margins", () => {
    const result = validateOpeningHypotheses({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("upper-host", 80, 300),
        wall("lower-host", 302, 900),
      ],
      hypotheses: [opening("lower-host")],
    });

    expect(result.rejections).toEqual([]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.evidence.reasons).toContain("host-wall-chain-validated");
  });

  it("rejects the same opening when the collinear fragment gap is too large for one host chain", () => {
    const result = validateOpeningHypotheses({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("upper-host", 80, 270),
        wall("lower-host", 302, 900),
      ],
      hypotheses: [opening("lower-host")],
    });

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.code).toBe("opening-outside-host-span");
  });

  it("still rejects a connected chain that does not provide the minimum end margin", () => {
    const result = validateOpeningHypotheses({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("upper-host", 286, 300),
        wall("lower-host", 302, 900),
      ],
      hypotheses: [opening("lower-host")],
    });

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.code).toBe("opening-end-margin");
  });
});
