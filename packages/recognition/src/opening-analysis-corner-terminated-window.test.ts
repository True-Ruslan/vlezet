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

function windowCandidate(exactProposal = true): RecognitionOpeningCandidate {
  return {
    id: exactProposal ? "corner-window-proposal" : "ordinary-corner-window",
    kind: "window",
    hostWallCandidateId: "vertical-host",
    center: { x: 0.85, y: 534 / HEIGHT },
    widthPx: 95,
    orientationDeg: 90,
    confidence: "medium",
    evidence: {
      localScore: 0.76,
      cloudScore: null,
      reasons: exactProposal
        ? ["paired-window-rails", "window-host-proposal-evidence"]
        : ["paired-window-rails", "wall-gap"],
    },
    origin: "local",
    conflict: null,
  };
}

function validate(
  anchors: readonly RecognitionWallCandidate[],
  candidate = windowCandidate(),
) {
  return validateOpeningHypotheses({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [
      wall("vertical-host", 850, 320, 850, 590),
      ...anchors,
    ],
    hypotheses: [candidate],
  });
}

describe("corner-terminated exact windows", () => {
  it("accepts an exact window proposal ending at an active perpendicular corner", () => {
    const result = validate([
      wall("bottom-anchor", 100, 590, 900, 590),
    ]);

    expect(result.rejections).toEqual([]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.evidence.reasons).toContain("perpendicular-corner-terminated");
  });

  it("keeps the end-margin rejection without a perpendicular corner anchor", () => {
    const result = validate([]);

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.code).toBe("opening-end-margin");
  });

  it("rejects an anchor that does not terminate the host near the opening edge", () => {
    const result = validate([
      wall("distant-anchor", 100, 630, 900, 630),
    ]);

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.code).toBe("opening-end-margin");
  });

  it("rejects an unsupported perpendicular anchor", () => {
    const result = validate([
      wall("unsupported-anchor", 100, 590, 900, 590, "unsupported"),
    ]);

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.code).toBe("opening-end-margin");
  });

  it("does not grant the corner exception to a generic window hypothesis", () => {
    const result = validate([
      wall("bottom-anchor", 100, 590, 900, 590),
    ], windowCandidate(false));

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.code).toBe("opening-end-margin");
  });
});
