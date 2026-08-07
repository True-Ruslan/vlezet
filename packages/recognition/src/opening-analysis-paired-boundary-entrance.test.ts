import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import { analyzeOpeningHypotheses } from "./opening-analysis-runtime-with-short-jamb";
import type { StructuralMaskView } from "./wall-completion";

const WIDTH = 1000;
const HEIGHT = 600;
const HOST_Y = 100;
const HOST_START_X = 100;
const HOST_END_X = 400;
const THICKNESS = 30;
const GAP_END_X = 495;

function wall(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thicknessPx = THICKNESS,
  reasons: readonly string[] = [
    "filled-wall-region-evidence",
    "paired-parallel-edges",
    "primary-structural-component",
    "topology-edge",
  ],
): RecognitionWallCandidate {
  return {
    id,
    start: { x: x1 / WIDTH, y: y1 / HEIGHT },
    end: { x: x2 / WIDTH, y: y2 / HEIGHT },
    estimatedThicknessPx: thicknessPx,
    confidence: "medium",
    evidence: { localScore: 0.74, cloudScore: null, reasons: [...reasons] },
    origin: "local",
    conflict: null,
  };
}

const host = wall("paired-boundary-host", HOST_START_X, HOST_Y, HOST_END_X, HOST_Y);
const perpendicularAnchor = wall("perpendicular-anchor", HOST_END_X, HOST_Y, HOST_END_X, 330, 22);

function rails(gapEndX = GAP_END_X): DetectedLineSegment[] {
  return [
    { x1: 100, y1: 85, x2: 400, y2: 85 },
    { x1: gapEndX, y1: 85, x2: 700, y2: 85 },
    { x1: 100, y1: 115, x2: 400, y2: 115 },
    { x1: gapEndX, y1: 115, x2: 700, y2: 115 },
  ];
}

function mask(options: Readonly<{ fillGap?: boolean }> = {}): StructuralMaskView {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural(x, y): boolean {
      const inWallBand = y >= 84 && y <= 116;
      if (inWallBand && x >= HOST_START_X && x <= HOST_END_X) return true;
      if (inWallBand && x >= GAP_END_X && x <= 700) return true;
      if (options.fillGap && inWallBand && x > HOST_END_X && x < GAP_END_X) return true;
      return x >= 389 && x <= 411 && y >= HOST_Y && y <= 330;
    },
  };
}

function analyze(options: Readonly<{
  wallCandidates?: readonly RecognitionWallCandidate[];
  symbolSegments?: readonly DetectedLineSegment[];
  structuralMask?: StructuralMaskView;
}> = {}) {
  return analyzeOpeningHypotheses({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: options.wallCandidates ?? [host, perpendicularAnchor],
    symbolSegments: options.symbolSegments ?? rails(),
    structuralMask: options.structuralMask ?? mask(),
  });
}

function pairedBoundaryRejections(result: ReturnType<typeof analyze>) {
  return result.rejections.filter(({ candidate }) =>
    candidate.evidence.reasons.includes("paired-boundary-door-gap"));
}

function pairedBoundaryCandidates(result: ReturnType<typeof analyze>) {
  return result.candidates.filter(({ evidence }) =>
    evidence.reasons.includes("paired-boundary-door-gap"));
}

describe("paired boundary entrance detector", () => {
  it("emits one p2-like entrance hypothesis but leaves it fail-closed at the common validator", () => {
    const result = analyze();
    const rejected = pairedBoundaryRejections(result);

    expect(pairedBoundaryCandidates(result)).toEqual([]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.code).toBe("opening-outside-host-span");
    expect(rejected[0]?.candidate.kind).toBe("door");
    expect(rejected[0]?.candidate.hostWallCandidateId).toBe(host.id);
    expect(rejected[0]?.candidate.center.x * WIDTH).toBeCloseTo((HOST_END_X + GAP_END_X) / 2, 0);
    expect(rejected[0]?.candidate.center.y * HEIGHT).toBeCloseTo(HOST_Y, 0);
    expect(rejected[0]?.candidate.widthPx).toBeCloseTo(GAP_END_X - HOST_END_X, 0);
    expect(rejected[0]?.candidate.orientationDeg).toBeCloseTo(0, 0);
  });

  it("does not infer an entrance when only one wall face has a far-side rail", () => {
    const oneFace = rails().filter((segment) => !(segment.y1 === 115 && segment.x1 === GAP_END_X));
    expect(pairedBoundaryRejections(analyze({ symbolSegments: oneFace }))).toEqual([]);
  });

  it("does not infer an entrance when the two boundary gaps disagree materially", () => {
    const mismatched = rails();
    mismatched[3] = { x1: 555, y1: 115, x2: 700, y2: 115 };
    expect(pairedBoundaryRejections(analyze({ symbolSegments: mismatched }))).toEqual([]);
  });

  it("does not infer an entrance without an independent perpendicular structural wall anchor", () => {
    expect(pairedBoundaryRejections(analyze({ wallCandidates: [host] }))).toEqual([]);
  });

  it("does not infer an entrance when the gap is filled by structural mask support", () => {
    expect(pairedBoundaryRejections(analyze({ structuralMask: mask({ fillGap: true }) }))).toEqual([]);
  });

  it("does not infer an entrance outside the entrance width-to-thickness scale", () => {
    for (const gapEndX of [465, 565]) {
      expect(pairedBoundaryRejections(analyze({ symbolSegments: rails(gapEndX) }))).toEqual([]);
    }
  });

  it("does not infer an entrance from a weak host without paired primary structural provenance", () => {
    const weakHost = wall(
      host.id,
      HOST_START_X,
      HOST_Y,
      HOST_END_X,
      HOST_Y,
      THICKNESS,
      ["filled-wall-region-evidence", "topology-edge"],
    );
    expect(pairedBoundaryRejections(analyze({ wallCandidates: [weakHost, perpendicularAnchor] }))).toEqual([]);
  });
});
