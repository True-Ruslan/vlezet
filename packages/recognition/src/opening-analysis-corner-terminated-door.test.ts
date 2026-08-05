import { describe, expect, it } from "vitest";
import type {
  RecognitionOpeningCandidate,
  RecognitionWallCandidate,
} from "./model";
import { validateOpeningHypotheses } from "./opening-analysis-runtime-with-window-proposals";

const WIDTH = 1000;
const HEIGHT = 800;

function wall(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  conflict: RecognitionWallCandidate["conflict"] = null,
): RecognitionWallCandidate {
  return {
    id,
    start: { x: x1 / WIDTH, y: y1 / HEIGHT },
    end: { x: x2 / WIDTH, y: y2 / HEIGHT },
    estimatedThicknessPx: 20,
    confidence: conflict === null ? "medium" : "low",
    evidence: {
      localScore: 0.74,
      cloudScore: null,
      reasons: ["filled-wall-region-evidence", "topology-edge"],
    },
    origin: "local",
    conflict,
  };
}

function doorCandidate(exactProposal = true): RecognitionOpeningCandidate {
  return {
    id: exactProposal ? "corner-door-proposal" : "ordinary-corner-door",
    kind: "door",
    hostWallCandidateId: "vertical-host",
    center: { x: 0.85, y: 392 / HEIGHT },
    widthPx: 90,
    orientationDeg: 90,
    confidence: "medium",
    evidence: {
      localScore: 0.76,
      cloudScore: null,
      reasons: exactProposal
        ? [
            "continuous-host-mask-door-gap",
            "door-leaf-anchored",
            "perpendicular-door-leaf",
          ]
        : ["door-leaf-anchored", "wall-gap"],
    },
    origin: "local",
    conflict: null,
  };
}

function validate(
  anchors: readonly RecognitionWallCandidate[],
  candidate = doorCandidate(),
) {
  return validateOpeningHypotheses({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [
      wall("vertical-host", 850, 330, 850, 710),
      ...anchors,
    ],
    hypotheses: [candidate],
  });
}

describe("corner-terminated exact doors", () => {
  it("accepts a strongly evidenced door starting at an active perpendicular corner", () => {
    const result = validate([
      wall("top-anchor", 500, 330, 900, 330),
    ]);

    expect(result.rejections).toEqual([]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.evidence.reasons).toContain("perpendicular-corner-terminated");
  });

  it("keeps the end-margin rejection without a perpendicular anchor", () => {
    const result = validate([]);

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.code).toBe("opening-end-margin");
  });

  it("does not grant the exception to a generic door hypothesis", () => {
    const result = validate([
      wall("top-anchor", 500, 330, 900, 330),
    ], doorCandidate(false));

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.code).toBe("opening-end-margin");
  });

  it("rejects an unsupported perpendicular anchor", () => {
    const result = validate([
      wall("unsupported-anchor", 500, 330, 900, 330, "unsupported"),
    ]);

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.code).toBe("opening-end-margin");
  });
});
