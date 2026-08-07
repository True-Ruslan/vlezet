import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import { detectPairedBoundaryDoorGaps } from "./paired-boundary-door-gap";
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

function detect(options: Readonly<{
  wallCandidates?: readonly RecognitionWallCandidate[];
  symbolSegments?: readonly DetectedLineSegment[];
  structuralMask?: StructuralMaskView;
}> = {}) {
  return detectPairedBoundaryDoorGaps({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: options.wallCandidates ?? [host, perpendicularAnchor],
    symbolSegments: options.symbolSegments ?? rails(),
    mask: options.structuralMask ?? mask(),
  });
}

describe("paired boundary entrance detector", () => {
  it("emits one p2-like entrance hypothesis with deterministic host-aware geometry", () => {
    const candidates = detect();

    expect(candidates).toHaveLength(1);
    const candidate = candidates[0];
    if (!candidate) throw new Error("Expected paired-boundary entrance candidate.");
    expect(candidate.kind).toBe("door");
    expect(candidate.hostWallCandidateId).toBe(host.id);
    expect(candidate.center.x * WIDTH).toBeCloseTo((HOST_END_X + GAP_END_X) / 2, 0);
    expect(candidate.center.y * HEIGHT).toBeCloseTo(HOST_Y, 0);
    expect(candidate.widthPx).toBeCloseTo(GAP_END_X - HOST_END_X, 0);
    expect(candidate.orientationDeg).toBeCloseTo(0, 0);
    expect(candidate.evidence.reasons).toContain("paired-boundary-door-gap");
  });

  it("does not infer an entrance when only one wall face has a far-side rail", () => {
    const oneFace = rails().filter((segment) => !(segment.y1 === 115 && segment.x1 === GAP_END_X));
    expect(detect({ symbolSegments: oneFace })).toEqual([]);
  });

  it("does not infer an entrance when the two boundary gaps disagree materially", () => {
    const mismatched = rails();
    mismatched[3] = { x1: 555, y1: 115, x2: 700, y2: 115 };
    expect(detect({ symbolSegments: mismatched })).toEqual([]);
  });

  it("does not infer an entrance without an independent perpendicular structural wall anchor", () => {
    expect(detect({ wallCandidates: [host] })).toEqual([]);
  });

  it("does not infer an entrance when the gap is filled by structural mask support", () => {
    expect(detect({ structuralMask: mask({ fillGap: true }) })).toEqual([]);
  });

  it("does not infer an entrance outside the entrance width-to-thickness scale", () => {
    for (const gapEndX of [465, 565]) {
      expect(detect({ symbolSegments: rails(gapEndX) })).toEqual([]);
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
    expect(detect({ wallCandidates: [weakHost, perpendicularAnchor] })).toEqual([]);
  });
});
