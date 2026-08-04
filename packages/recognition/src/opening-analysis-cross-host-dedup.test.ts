import { describe, expect, it } from "vitest";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";
import { validateOpeningHypotheses } from "./opening-analysis-runtime";

const WIDTH = 1000;
const HEIGHT = 600;

function wall(id: string, y: number, x1: number, x2: number): RecognitionWallCandidate {
  return {
    id,
    start: { x: x1 / WIDTH, y: y / HEIGHT },
    end: { x: x2 / WIDTH, y: y / HEIGHT },
    estimatedThicknessPx: 20,
    confidence: "medium",
    evidence: { localScore: 0.74, cloudScore: null, reasons: ["topology-edge"] },
    origin: "local",
    conflict: null,
  };
}

function opening(id: string, hostWallCandidateId: string, y: number): RecognitionOpeningCandidate {
  return {
    id,
    kind: "window",
    hostWallCandidateId,
    center: { x: 350 / WIDTH, y: y / HEIGHT },
    widthPx: 100,
    orientationDeg: 0,
    confidence: "medium",
    evidence: {
      localScore: id === "strong" ? 0.76 : 0.72,
      cloudScore: null,
      reasons: [id === "strong" ? "paired-window-rails" : "mask-supported-window-gap"],
    },
    origin: "local",
    conflict: null,
  };
}

describe("cross-host opening deduplication", () => {
  it("keeps one opening when equivalent windows use overlapping collinear host walls", () => {
    const result = validateOpeningHypotheses({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("host-a", 200, 100, 500),
        wall("host-b", 200, 200, 600),
      ],
      hypotheses: [
        opening("weak", "host-a", 200),
        opening("strong", "host-b", 200),
      ],
    });

    expect(result.rejections).toEqual([]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      id: "strong",
      hostWallCandidateId: "host-b",
      kind: "window",
    });
    expect(result.candidates[0]?.evidence.reasons).toEqual(expect.arrayContaining([
      "paired-window-rails",
      "mask-supported-window-gap",
      "opening-hypothesis-deduplicated",
    ]));
  });

  it("keeps separate openings on nearby parallel but non-collinear walls", () => {
    const result = validateOpeningHypotheses({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("host-a", 200, 100, 500),
        wall("host-b", 220, 200, 600),
      ],
      hypotheses: [
        opening("weak", "host-a", 200),
        opening("strong", "host-b", 220),
      ],
    });

    expect(result.rejections).toEqual([]);
    expect(result.candidates).toHaveLength(2);
  });
});
