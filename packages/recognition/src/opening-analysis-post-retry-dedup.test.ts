import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";
import { analyzeOpeningHypotheses } from "./opening-analysis-runtime-with-short-jamb";
import type { StructuralMaskView } from "./wall-completion";

const WIDTH = 1000;
const HEIGHT = 600;
const Y = 200;
const REMOTE_EDGE_X = 376;
const DOWNSTREAM_START_X = 462;
const DOWNSTREAM_END_X = 550;
const REMOTE_WIDTH_PX = DOWNSTREAM_START_X - REMOTE_EDGE_X;

function wall(id: string, startX: number, endX: number): RecognitionWallCandidate {
  return {
    id,
    start: { x: startX / WIDTH, y: Y / HEIGHT },
    end: { x: endX / WIDTH, y: Y / HEIGHT },
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

const upstream = wall("upstream-host", 100, 500);
const downstream = wall("downstream-host", DOWNSTREAM_START_X, DOWNSTREAM_END_X);

const directDoor: RecognitionOpeningCandidate = {
  id: "direct-door",
  kind: "door",
  hostWallCandidateId: upstream.id,
  center: { x: 412 / WIDTH, y: Y / HEIGHT },
  widthPx: 80,
  orientationDeg: 0,
  confidence: "medium",
  evidence: {
    localScore: 0.74,
    cloudScore: null,
    reasons: ["door-leaf-anchored", "host-wall-validated", "opening-span-validated"],
  },
  origin: "local",
  conflict: null,
};

const remoteDoor: RecognitionOpeningCandidate = {
  id: "remote-terminal-door",
  kind: "door",
  hostWallCandidateId: downstream.id,
  center: {
    x: ((REMOTE_EDGE_X + DOWNSTREAM_START_X) / 2) / WIDTH,
    y: Y / HEIGHT,
  },
  widthPx: REMOTE_WIDTH_PX,
  orientationDeg: 0,
  confidence: "medium",
  evidence: {
    localScore: 0.72,
    cloudScore: null,
    reasons: [
      "continuous-host-mask-door-gap",
      "door-leaf-anchored",
      "perpendicular-door-leaf",
      "short-terminal-door-jamb-evidence",
      "terminal-host-mask-door-gap",
    ],
  },
  origin: "local",
  conflict: null,
};

const leaf: DetectedLineSegment = {
  x1: REMOTE_EDGE_X + 1,
  y1: Y,
  x2: REMOTE_EDGE_X + 1,
  y2: Y + REMOTE_WIDTH_PX,
};

const mask: StructuralMaskView = {
  widthPx: WIDTH,
  heightPx: HEIGHT,
  isStructural(x, y): boolean {
    if (x >= DOWNSTREAM_START_X && x <= DOWNSTREAM_END_X && Math.abs(y - Y) <= 10) return true;
    if (x >= 360 && x <= REMOTE_EDGE_X && Math.abs(y - Y) <= 10) return true;
    return false;
  },
};

describe("post-retry cross-host opening dedupe", () => {
  it("deduplicates an equivalent remote retry against an already valid collinear-host door", () => {
    const result = analyzeOpeningHypotheses({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [upstream, downstream],
      symbolSegments: [leaf],
      structuralMask: mask,
      additionalHypotheses: [directDoor, remoteDoor],
    });

    expect(result.rejections).toEqual([]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      id: "direct-door",
      kind: "door",
      hostWallCandidateId: "upstream-host",
    });
    expect(result.candidates[0]?.evidence.reasons).toContain("opening-hypothesis-deduplicated");
  });
});
