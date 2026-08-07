import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";
import { recoverWindowBoundaryBands } from "./window-boundary-band-recovery";

const WIDTH = 818;
const HEIGHT = 1270;

function wall(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thicknessPx: number,
): RecognitionWallCandidate {
  return {
    id,
    start: { x: x1 / WIDTH, y: y1 / HEIGHT },
    end: { x: x2 / WIDTH, y: y2 / HEIGHT },
    estimatedThicknessPx: thicknessPx,
    confidence: "medium",
    evidence: { localScore: 0.74, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
    origin: "local",
    conflict: null,
  };
}

function segment(x1: number, y1: number, x2: number, y2: number): DetectedLineSegment {
  return { x1, y1, x2, y2 };
}

const leftAnchor = wall("left-anchor", 124, 390, 124, 974, 38);
const downstream = wall("downstream-host", 462, 959.5, 550, 959.5, 29);
const rails = [951, 953, 958, 961, 965, 968].map((y) => segment(152, y, 294, y));
const jambs = [
  segment(287, 945, 287, 973),
  segment(293, 945, 294, 973),
];

function jambMask(enabled = true): StructuralMaskView {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural(x, y) {
      return enabled && x >= 285 && x <= 296 && y >= 942 && y <= 976;
    },
  };
}

function run(overrides: Readonly<{
  walls?: readonly RecognitionWallCandidate[];
  segments?: readonly DetectedLineSegment[];
  mask?: StructuralMaskView;
}> = {}) {
  return recoverWindowBoundaryBands({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: overrides.walls ?? [leftAnchor, downstream],
    symbolSegments: overrides.segments ?? [...rails, ...jambs],
    structuralMask: overrides.mask ?? jambMask(),
  });
}

function pixels(candidate: RecognitionWallCandidate): [number, number, number, number] {
  return [
    Math.round(candidate.start.x * WIDTH),
    Math.round(candidate.start.y * HEIGHT),
    Math.round(candidate.end.x * WIDTH),
    Math.round(candidate.end.y * HEIGHT),
  ];
}

describe("window boundary-band recovery", () => {
  it("recovers a missing host from a perpendicular anchor, repeated rails, structural jamb pair and downstream collinear wall", () => {
    const result = run();
    expect(result.recoveredWalls).toHaveLength(1);
    expect(pixels(result.recoveredWalls[0]!)).toEqual([124, 960, 290, 960]);
    expect(result.recoveredWalls[0]?.estimatedThicknessPx).toBeCloseTo(29, 0);
    expect(result.recoveredWalls[0]?.confidence).toBe("medium");
    expect(result.recoveredWalls[0]?.evidence.reasons).toEqual(expect.arrayContaining([
      "paired-window-rails",
      "perpendicular-structural-anchor",
      "short-terminal-jamb-evidence",
      "window-boundary-band-recovery",
    ]));
    expect(result.proposalEvidence).toHaveLength(1);
    expect(result.proposalEvidence[0]).toMatchObject({
      sourceWallCandidateIds: ["left-anchor", "downstream-host"],
      bridgeKind: "symbol",
      openingEligible: true,
      gap: {
        center: { x: 219.5, y: 959.5 },
        widthPx: 135,
        orientationDeg: 0,
      },
    });
  });

  it("rejects fewer than four distinct parallel rails", () => {
    expect(run({ segments: [...rails.slice(0, 3), ...jambs] }).recoveredWalls).toEqual([]);
  });

  it("rejects a jamb pair without structural-mask support", () => {
    expect(run({ mask: jambMask(false) }).recoveredWalls).toEqual([]);
  });

  it("rejects a single short jamb edge", () => {
    expect(run({ segments: [...rails, jambs[0]!] }).recoveredWalls).toEqual([]);
  });

  it("rejects the band without an independent downstream collinear wall", () => {
    expect(run({ walls: [leftAnchor] }).recoveredWalls).toEqual([]);
  });

  it("rejects a downstream wall on another axis", () => {
    expect(run({ walls: [leftAnchor, wall("off-axis", 462, 1010, 550, 1010, 29)] }).recoveredWalls).toEqual([]);
  });

  it("does not duplicate an already active host across the recovered band", () => {
    const existing = wall("existing-host", 124, 959.5, 300, 959.5, 29);
    expect(run({ walls: [leftAnchor, existing, downstream] }).recoveredWalls).toEqual([]);
  });

  it("is deterministic under wall and segment ordering", () => {
    const forward = run();
    const reverse = run({
      walls: [downstream, leftAnchor],
      segments: [...jambs, ...rails].reverse(),
    });
    expect(reverse).toEqual(forward);
  });
});
