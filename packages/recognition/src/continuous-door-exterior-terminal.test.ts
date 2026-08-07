import { describe, expect, it } from "vitest";
import { detectContinuousHostDoorOpenings } from "./continuous-door-host-analysis-runtime";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";

const WIDTH = 1000;
const HEIGHT = 700;
const HOST_X = 500;
const HOST_START_Y = 80;
const HOST_END_Y = 300;
const HINGE_Y = 320;
const DOOR_WIDTH = 96;
const THICKNESS = 32;

function host(reasons: readonly string[] = [
  "filled-wall-region-evidence",
  "paired-parallel-edges",
  "primary-structural-component",
  "topology-edge",
  "junction-degree:1",
]): RecognitionWallCandidate {
  return {
    id: "exterior-terminal-host",
    start: { x: HOST_X / WIDTH, y: HOST_START_Y / HEIGHT },
    end: { x: HOST_X / WIDTH, y: HOST_END_Y / HEIGHT },
    estimatedThicknessPx: THICKNESS,
    confidence: "medium",
    evidence: {
      localScore: 0.74,
      cloudScore: null,
      reasons: [...reasons],
    },
    origin: "local",
    conflict: null,
  };
}

const terminalLeaf: DetectedLineSegment = {
  x1: HOST_X,
  y1: HINGE_Y,
  x2: HOST_X - DOOR_WIDTH,
  y2: HINGE_Y,
};

function mask(options: Readonly<{
  continuation?: boolean;
  openingFilled?: boolean;
}> = {}): StructuralMaskView {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural(x, y): boolean {
      const onHost = Math.abs(x - HOST_X) <= THICKNESS / 2;
      if (!onHost) return false;
      if (y >= HOST_START_Y && y <= HOST_END_Y) return true;
      if (options.continuation !== false && y > HOST_END_Y && y <= HINGE_Y) return true;
      if (options.openingFilled === true && y > HINGE_Y && y <= HINGE_Y + DOOR_WIDTH) return true;
      return false;
    },
  };
}

function detect(options: Readonly<{
  wall?: RecognitionWallCandidate;
  leaf?: DetectedLineSegment;
  structuralMask?: StructuralMaskView;
}> = {}) {
  return detectContinuousHostDoorOpenings({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [options.wall ?? host()],
    symbolSegments: [options.leaf ?? terminalLeaf],
    mask: options.structuralMask ?? mask(),
  });
}

describe("exterior terminal door recovery", () => {
  it("detects a leaf-anchored exterior door after a short mask-supported host continuation", () => {
    const result = detect();

    const opening = result.openingHypotheses.find((candidate) =>
      candidate.evidence.reasons.includes("exterior-terminal-door-leaf"));
    expect(opening).toBeDefined();
    if (!opening) throw new Error("Expected exterior terminal opening.");
    expect(opening.kind).toBe("door");
    expect(opening.hostWallCandidateId).toBe("exterior-terminal-host");
    expect(opening.center.x * WIDTH).toBeCloseTo(HOST_X, 0);
    expect(opening.center.y * HEIGHT).toBeCloseTo(HINGE_Y + DOOR_WIDTH / 2, 0);
    expect(opening.widthPx).toBeCloseTo(DOOR_WIDTH, 0);
    expect(opening.orientationDeg).toBeCloseTo(90, 0);
  });

  it("keeps one representative leaf when opposite host faces produce the same terminal opening", () => {
    const shortFaceLeaf: DetectedLineSegment = {
      x1: HOST_X - 14,
      y1: HINGE_Y,
      x2: HOST_X - 14 - 78,
      y2: HINGE_Y,
    };
    const fullFaceLeaf: DetectedLineSegment = {
      x1: HOST_X + 14,
      y1: HINGE_Y + 1,
      x2: HOST_X + 14 - 103,
      y2: HINGE_Y + 1,
    };
    const result = detectContinuousHostDoorOpenings({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [host()],
      symbolSegments: [shortFaceLeaf, fullFaceLeaf],
      mask: mask(),
    });
    const exterior = result.openingHypotheses.filter((candidate) =>
      candidate.evidence.reasons.includes("exterior-terminal-door-leaf"));

    expect(exterior).toHaveLength(1);
    expect(exterior[0]?.widthPx).toBeCloseTo(103, 0);
  });

  it("rejects the exterior door when the short continuation is not structural", () => {
    expect(detect({ structuralMask: mask({ continuation: false }) }).openingHypotheses
      .some((candidate) => candidate.evidence.reasons.includes("exterior-terminal-door-leaf")))
      .toBe(false);
  });

  it("rejects the exterior door when the opening span remains structural", () => {
    expect(detect({ structuralMask: mask({ openingFilled: true }) }).openingHypotheses
      .some((candidate) => candidate.evidence.reasons.includes("exterior-terminal-door-leaf")))
      .toBe(false);
  });

  it("rejects a leaf whose hinge is farther than one host thickness from the endpoint", () => {
    const distantLeaf = { ...terminalLeaf, y1: HOST_END_Y + THICKNESS + 8, y2: HOST_END_Y + THICKNESS + 8 };
    expect(detect({ leaf: distantLeaf }).openingHypotheses
      .some((candidate) => candidate.evidence.reasons.includes("exterior-terminal-door-leaf")))
      .toBe(false);
  });

  it("rejects a segment that is not perpendicular to the host", () => {
    const parallelLeaf = {
      x1: HOST_X,
      y1: HINGE_Y,
      x2: HOST_X,
      y2: HINGE_Y + DOOR_WIDTH,
    };
    expect(detect({ leaf: parallelLeaf }).openingHypotheses
      .some((candidate) => candidate.evidence.reasons.includes("exterior-terminal-door-leaf")))
      .toBe(false);
  });

  it("does not grant exterior-terminal recovery to a weak non-primary host", () => {
    const weak = host(["filled-wall-region-evidence", "topology-edge", "junction-degree:1"]);
    expect(detect({ wall: weak }).openingHypotheses
      .some((candidate) => candidate.evidence.reasons.includes("exterior-terminal-door-leaf")))
      .toBe(false);
  });
});
