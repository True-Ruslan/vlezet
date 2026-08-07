import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";
import { detectContinuousHostDoorOpenings } from "./continuous-door-host-analysis-runtime";

const WIDTH = 1000;
const HEIGHT = 600;
const HOST_Y = 200;
const HOST_START_X = 462;
const HOST_END_X = 550;
const LEAF_ANCHOR_X = 377;
const STUB_START_X = 360;
const STUB_END_X = 376;
const LEAF_LENGTH_PX = HOST_START_X - LEAF_ANCHOR_X;

function wall(): RecognitionWallCandidate {
  return {
    id: "downstream-host",
    start: { x: HOST_START_X / WIDTH, y: HOST_Y / HEIGHT },
    end: { x: HOST_END_X / WIDTH, y: HOST_Y / HEIGHT },
    estimatedThicknessPx: 20,
    confidence: "medium",
    evidence: {
      localScore: 0.74,
      cloudScore: null,
      reasons: ["filled-wall-region-evidence", "topology-edge"],
    },
    origin: "local",
    conflict: null,
  };
}

const remoteLeaf: DetectedLineSegment = {
  x1: LEAF_ANCHOR_X,
  y1: HOST_Y,
  x2: LEAF_ANCHOR_X,
  y2: HOST_Y + LEAF_LENGTH_PX,
};

function mask(options: Readonly<{
  stub?: "strong" | "weak" | "none";
  fillGap?: boolean;
}> = {}): StructuralMaskView {
  const stub = options.stub ?? "strong";
  const fillGap = options.fillGap === true;
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural(x, y): boolean {
      if (x >= HOST_START_X && x <= HOST_END_X && Math.abs(y - HOST_Y) <= 10) return true;
      if (fillGap && x > LEAF_ANCHOR_X && x < HOST_START_X && Math.abs(y - HOST_Y) <= 10) return true;
      if (stub === "strong" && x >= STUB_START_X && x <= STUB_END_X && Math.abs(y - HOST_Y) <= 10) return true;
      if (stub === "weak" && x >= STUB_START_X && x <= STUB_END_X && y === HOST_Y) return true;
      return false;
    },
  };
}

function detect(
  structuralMask = mask(),
  leaf: DetectedLineSegment = remoteLeaf,
) {
  return detectContinuousHostDoorOpenings({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [wall()],
    symbolSegments: [leaf],
    mask: structuralMask,
  });
}

describe("remote terminal door leaf with short structural jamb", () => {
  it("recovers the door when a short mask-supported jamb anchors the remote leaf edge", () => {
    const result = detect();

    expect(result.openingHypotheses).toHaveLength(1);
    const opening = result.openingHypotheses[0]!;
    expect(opening.kind).toBe("door");
    expect(opening.hostWallCandidateId).toBe("downstream-host");
    expect(opening.center.x * WIDTH).toBeCloseTo((LEAF_ANCHOR_X + HOST_START_X) / 2, 0);
    expect(opening.center.y * HEIGHT).toBeCloseTo(HOST_Y, 0);
    expect(opening.widthPx).toBeCloseTo(LEAF_LENGTH_PX, 0);
    expect(opening.evidence.reasons).toContain("terminal-host-mask-door-gap");
    expect(opening.evidence.reasons).toContain("short-terminal-door-jamb-evidence");
  });

  it("rejects the remote leaf without structural jamb support behind its anchor", () => {
    expect(detect(mask({ stub: "none" })).openingHypotheses).toEqual([]);
  });

  it("rejects a remote leaf when the proposed door gap is structurally occupied", () => {
    expect(detect(mask({ fillGap: true })).openingHypotheses).toEqual([]);
  });

  it("rejects a non-perpendicular remote symbol even with a strong short jamb", () => {
    const diagonalLeaf: DetectedLineSegment = {
      x1: LEAF_ANCHOR_X,
      y1: HOST_Y,
      x2: LEAF_ANCHOR_X + 45,
      y2: HOST_Y + 45,
    };
    expect(detect(mask(), diagonalLeaf).openingHypotheses).toEqual([]);
  });

  it("rejects fixture-like single-line support instead of treating it as a structural jamb", () => {
    expect(detect(mask({ stub: "weak" })).openingHypotheses).toEqual([]);
  });
});
