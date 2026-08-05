import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type {
  RecognitionOpeningCandidate,
  RecognitionWallCandidate,
} from "./model";
import type { StructuralMaskView } from "./wall-completion";
import { detectContinuousHostDoorOpenings } from "./continuous-door-host-analysis-runtime";
import { validateOpeningHypotheses } from "./opening-analysis-runtime-with-window-proposals";

const WIDTH = 1000;
const HEIGHT = 600;
const HOST_Y = 200;
const HOST_START_X = 100;
const HOST_END_X = 300;
const GAP_END_X = 380;
const FAR_ANCHOR_X = 420;

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

function terminalMask(options: Readonly<{
  farSupport?: boolean;
}> = {}): StructuralMaskView {
  const farSupport = options.farSupport !== false;
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural(x, y): boolean {
      if (Math.abs(y - HOST_Y) > 10) return false;
      if (x >= HOST_START_X && x <= HOST_END_X) return true;
      return farSupport && x >= GAP_END_X && x <= FAR_ANCHOR_X;
    },
  };
}

const terminalLeaf: DetectedLineSegment = {
  x1: HOST_END_X,
  y1: HOST_Y,
  x2: HOST_END_X,
  y2: HOST_Y + (GAP_END_X - HOST_END_X),
};

function detect(mask = terminalMask()) {
  return detectContinuousHostDoorOpenings({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [wall(
      "terminal-host",
      HOST_START_X,
      HOST_Y,
      HOST_END_X,
      HOST_Y,
    )],
    symbolSegments: [terminalLeaf],
    mask,
  });
}

function terminalDoorCandidate(exact = true): RecognitionOpeningCandidate {
  return {
    id: exact ? "terminal-door-proposal" : "generic-terminal-door",
    kind: "door",
    hostWallCandidateId: "terminal-host",
    center: {
      x: ((HOST_END_X + GAP_END_X) / 2) / WIDTH,
      y: HOST_Y / HEIGHT,
    },
    widthPx: GAP_END_X - HOST_END_X,
    orientationDeg: 0,
    confidence: "medium",
    evidence: {
      localScore: 0.74,
      cloudScore: null,
      reasons: exact
        ? [
            "continuous-host-mask-door-gap",
            "door-leaf-anchored",
            "perpendicular-door-leaf",
            "terminal-host-mask-door-gap",
          ]
        : ["door-leaf-anchored", "wall-gap"],
    },
    origin: "local",
    conflict: null,
  };
}

function validate(
  anchors: readonly RecognitionWallCandidate[],
  candidate = terminalDoorCandidate(),
) {
  return validateOpeningHypotheses({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [
      wall("terminal-host", HOST_START_X, HOST_Y, HOST_END_X, HOST_Y),
      ...anchors,
    ],
    hypotheses: [candidate],
  });
}

describe("terminal-host door recovery", () => {
  it("detects a door gap immediately beyond a leaf-anchored host endpoint", () => {
    const result = detect();

    expect(result.openingHypotheses).toHaveLength(1);
    const opening = result.openingHypotheses[0]!;
    expect(opening.kind).toBe("door");
    expect(opening.hostWallCandidateId).toBe("terminal-host");
    expect(opening.center.x * WIDTH).toBeCloseTo((HOST_END_X + GAP_END_X) / 2, 0);
    expect(opening.center.y * HEIGHT).toBeCloseTo(HOST_Y, 0);
    expect(opening.widthPx).toBeCloseTo(GAP_END_X - HOST_END_X, 0);
    expect(opening.evidence.reasons).toContain("terminal-host-mask-door-gap");
  });

  it("does not detect a terminal door without structural support beyond the gap", () => {
    expect(detect(terminalMask({ farSupport: false })).openingHypotheses).toEqual([]);
  });

  it("accepts the exact terminal door only when an active perpendicular wall closes the far side", () => {
    const result = validate([
      wall("far-anchor", FAR_ANCHOR_X, 100, FAR_ANCHOR_X, 300),
    ]);

    expect(result.rejections).toEqual([]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.evidence.reasons).toContain("perpendicular-far-side-terminated");
  });

  it("keeps the outside-span rejection without the far-side perpendicular wall", () => {
    const result = validate([]);

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.code).toBe("opening-outside-host-span");
  });

  it("rejects a perpendicular wall that is too far from the opening", () => {
    const result = validate([
      wall("distant-anchor", 520, 100, 520, 300),
    ]);

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.code).toBe("opening-outside-host-span");
  });

  it("does not grant terminal recovery to a generic door hypothesis", () => {
    const result = validate([
      wall("far-anchor", FAR_ANCHOR_X, 100, FAR_ANCHOR_X, 300),
    ], terminalDoorCandidate(false));

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.code).toBe("opening-outside-host-span");
  });
});
