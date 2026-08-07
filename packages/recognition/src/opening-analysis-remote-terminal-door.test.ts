import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type {
  RecognitionOpeningCandidate,
  RecognitionWallCandidate,
} from "./model";
import { retryRemoteTerminalDoor } from "./opening-analysis-remote-terminal-door-retry";
import {
  analyzeOpeningHypotheses,
  validateOpeningHypotheses,
} from "./opening-analysis-runtime-with-short-jamb";
import type { StructuralMaskView } from "./wall-completion";

const WIDTH = 1000;
const HEIGHT = 600;
const HOST_Y = 200;
const HOST_START_X = 462;
const HOST_END_X = 550;
const REMOTE_EDGE_X = 376;
const LEAF_ANCHOR_X = 377;
const STUB_START_X = 360;
const DOOR_WIDTH_PX = HOST_START_X - REMOTE_EDGE_X;

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

function candidate(exact = true): RecognitionOpeningCandidate {
  return {
    id: exact ? "remote-terminal-door" : "generic-remote-door",
    kind: "door",
    hostWallCandidateId: "downstream-host",
    center: {
      x: ((REMOTE_EDGE_X + HOST_START_X) / 2) / WIDTH,
      y: HOST_Y / HEIGHT,
    },
    widthPx: DOOR_WIDTH_PX,
    orientationDeg: 0,
    confidence: "medium",
    evidence: {
      localScore: 0.72,
      cloudScore: null,
      reasons: exact
        ? [
            "continuous-host-mask-door-gap",
            "door-leaf-anchored",
            "perpendicular-door-leaf",
            "short-terminal-door-jamb-evidence",
            "terminal-host-mask-door-gap",
          ]
        : [
            "continuous-host-mask-door-gap",
            "door-leaf-anchored",
            "perpendicular-door-leaf",
            "terminal-host-mask-door-gap",
          ],
    },
    origin: "local",
    conflict: null,
  };
}

const leaf: DetectedLineSegment = {
  x1: LEAF_ANCHOR_X,
  y1: HOST_Y,
  x2: LEAF_ANCHOR_X,
  y2: HOST_Y + DOOR_WIDTH_PX,
};

function mask(options: Readonly<{
  stub?: boolean;
  fillGap?: boolean;
}> = {}): StructuralMaskView {
  const stub = options.stub !== false;
  const fillGap = options.fillGap === true;
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural(x, y): boolean {
      if (x >= HOST_START_X && x <= HOST_END_X && Math.abs(y - HOST_Y) <= 10) return true;
      if (stub && x >= STUB_START_X && x <= REMOTE_EDGE_X && Math.abs(y - HOST_Y) <= 10) return true;
      if (fillGap && x > REMOTE_EDGE_X && x < HOST_START_X && Math.abs(y - HOST_Y) <= 10) return true;
      return false;
    },
  };
}

function analyze(options: Readonly<{
  opening?: RecognitionOpeningCandidate;
  structuralMask?: StructuralMaskView;
  symbolSegments?: readonly DetectedLineSegment[];
}> = {}) {
  return analyzeOpeningHypotheses({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [wall()],
    symbolSegments: options.symbolSegments ?? [leaf],
    structuralMask: options.structuralMask ?? mask(),
    additionalHypotheses: [options.opening ?? candidate()],
  });
}

describe("remote terminal door validation retry", () => {
  it("accepts an exact remote terminal door only after revalidating its short jamb and leaf", () => {
    const result = analyze();

    expect(result.rejections).toEqual([]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.evidence.reasons).toContain("short-terminal-door-jamb-validated");
  });

  it("keeps outside-host rejection without the exact short-jamb provenance", () => {
    const generic = candidate(false);
    const validation = validateOpeningHypotheses({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [wall()],
      hypotheses: [generic],
    });
    expect(validation.candidates).toEqual([]);
    const rejection = validation.rejections.find(({ candidateId }) => candidateId === generic.id);
    expect(rejection?.code).toBe("opening-outside-host-span");
    expect(rejection).toBeDefined();

    const retried = retryRemoteTerminalDoor({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [wall()],
      symbolSegments: [leaf],
      structuralMask: mask(),
      additionalHypotheses: [generic],
    }, rejection!);

    expect(retried).toBeNull();
  });

  it("keeps outside-host rejection when remote structural support is absent", () => {
    const result = analyze({ structuralMask: mask({ stub: false }) });

    expect(result.candidates).toEqual([]);
    expect(result.rejections.some(({ code }) => code === "opening-outside-host-span")).toBe(true);
  });

  it("keeps outside-host rejection when the perpendicular leaf is absent", () => {
    const result = analyze({ symbolSegments: [] });

    expect(result.candidates).toEqual([]);
    expect(result.rejections.some(({ code }) => code === "opening-outside-host-span")).toBe(true);
  });

  it("keeps outside-host rejection when the supposed door gap is structurally occupied", () => {
    const result = analyze({ structuralMask: mask({ fillGap: true }) });

    expect(result.candidates).toEqual([]);
    expect(result.rejections.some(({ code }) => code === "opening-outside-host-span")).toBe(true);
  });
});
