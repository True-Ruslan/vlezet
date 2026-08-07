import { describe, expect, it } from "vitest";
import { rescaleRecognitionPixelEvidence } from "./index";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";

const WIDTH = 1000;
const HEIGHT = 600;

function wall(
  id: string,
  x1: number,
  x2: number,
  reasons: readonly string[] = ["topology-edge", "filled-wall-region-evidence"],
): RecognitionWallCandidate {
  return {
    id,
    start: { x: x1 / WIDTH, y: 100 / HEIGHT },
    end: { x: x2 / WIDTH, y: 100 / HEIGHT },
    estimatedThicknessPx: 30,
    confidence: "medium",
    evidence: { localScore: 0.72, cloudScore: null, reasons: [...reasons] },
    origin: "local",
    conflict: null,
  };
}

const opening: RecognitionOpeningCandidate = {
  id: "entrance",
  kind: "door",
  hostWallCandidateId: "door-residual-after",
  center: { x: 435 / WIDTH, y: 100 / HEIGHT },
  widthPx: 90,
  orientationDeg: 0,
  confidence: "medium",
  evidence: {
    localScore: 0.78,
    cloudScore: null,
    reasons: ["host-wall-validated", "opening-span-validated", "perpendicular-door-leaf"],
  },
  origin: "local",
  conflict: null,
};

describe("public source-scale boundary", () => {
  it("reconsolidates a validated sandwiched door residual before source-pixel scaling", () => {
    const result = rescaleRecognitionPixelEvidence({
      walls: [
        wall("left", 100, 330),
        wall(
          "door-residual-after",
          330,
          590,
          [
            "door-host-residual",
            "door-leaf-anchored",
            "door-symbol-host-bridge",
            "filled-wall-region-evidence",
            "topology-edge",
          ],
        ),
        wall("right", 590, 900),
      ],
      openings: [opening],
      analysisWidthPx: WIDTH,
      analysisHeightPx: HEIGHT,
      sourceWidthPx: WIDTH * 2,
      sourceHeightPx: HEIGHT * 2,
    });

    expect(result.walls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "door-residual-after",
        conflict: "unsupported",
        estimatedThicknessPx: 60,
      }),
      expect.objectContaining({
        id: "door-residual-after-split-before",
        conflict: null,
        estimatedThicknessPx: 60,
      }),
      expect.objectContaining({
        id: "door-residual-after-split-after",
        conflict: null,
        estimatedThicknessPx: 60,
      }),
    ]));
    expect(result.openings).toEqual([
      expect.objectContaining({
        id: "entrance",
        hostWallCandidateId: "door-residual-after-split-before",
        widthPx: 180,
      }),
    ]);
  });
});
