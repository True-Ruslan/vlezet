import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";
import {
  analyzeOpeningHypotheses,
  validateOpeningHypotheses,
} from "./opening-analysis-runtime-with-short-jamb";
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
const wallCandidates = [host, perpendicularAnchor] as const;

function rails(): DetectedLineSegment[] {
  return [
    { x1: 100, y1: 85, x2: 400, y2: 85 },
    { x1: GAP_END_X, y1: 85, x2: 700, y2: 85 },
    { x1: 100, y1: 115, x2: 400, y2: 115 },
    { x1: GAP_END_X, y1: 115, x2: 700, y2: 115 },
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

function detectedCandidate(): RecognitionOpeningCandidate {
  const candidates = detectPairedBoundaryDoorGaps({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates,
    symbolSegments: rails(),
    mask: mask(),
  });
  expect(candidates).toHaveLength(1);
  const candidate = candidates[0];
  if (!candidate) throw new Error("Expected paired-boundary entrance candidate.");
  return candidate;
}

function analyze(options: Readonly<{
  symbolSegments?: readonly DetectedLineSegment[];
  structuralMask?: StructuralMaskView | null;
  additionalHypotheses?: readonly RecognitionOpeningCandidate[];
}> = {}) {
  const structuralMask = options.structuralMask === null ? undefined : options.structuralMask ?? mask();
  return analyzeOpeningHypotheses({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates,
    symbolSegments: options.symbolSegments ?? rails(),
    structuralMask,
    additionalHypotheses: options.additionalHypotheses,
  });
}

function validatedPaired(result: ReturnType<typeof analyze>) {
  return result.candidates.filter(({ evidence }) =>
    evidence.reasons.includes("paired-boundary-door-validated"));
}

describe("paired boundary entrance validation retry", () => {
  it("accepts exactly one replayed paired-boundary entrance through validation-only host extension", () => {
    const before = JSON.stringify(wallCandidates);
    const result = analyze();
    const recovered = validatedPaired(result);

    expect(recovered).toHaveLength(1);
    expect(recovered[0]?.kind).toBe("door");
    expect(recovered[0]?.hostWallCandidateId).toBe(host.id);
    expect(recovered[0]?.evidence.reasons).toContain("host-wall-validated");
    expect(recovered[0]?.evidence.reasons).toContain("opening-span-validated");
    expect(JSON.stringify(wallCandidates)).toBe(before);
    expect(result.rejections.some(({ candidateId }) => candidateId === recovered[0]?.id)).toBe(false);
  });

  it("keeps the common validator fail-closed for the exact detector candidate", () => {
    const candidate = detectedCandidate();
    const direct = validateOpeningHypotheses({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates,
      hypotheses: [candidate],
    });

    expect(direct.candidates).toEqual([]);
    expect(direct.rejections.find(({ candidateId }) => candidateId === candidate.id)?.code)
      .toBe("opening-outside-host-span");
  });

  it("does not retry without the structural mask", () => {
    expect(validatedPaired(analyze({ structuralMask: null }))).toEqual([]);
  });

  it("does not retry when exact raw-rail replay is unavailable", () => {
    expect(validatedPaired(analyze({ symbolSegments: [] }))).toEqual([]);
  });

  it("does not retry when the structural gap is filled", () => {
    expect(validatedPaired(analyze({ structuralMask: mask({ fillGap: true }) }))).toEqual([]);
  });

  it("does not accept a stale paired-boundary candidate that exact replay does not reproduce", () => {
    const exact = detectedCandidate();
    const tampered: RecognitionOpeningCandidate = {
      ...exact,
      id: "tampered-paired-boundary-door",
      center: { x: exact.center.x + 0.12, y: exact.center.y },
      widthPx: (exact.widthPx ?? 95) + 30,
    };
    const result = analyze({ additionalHypotheses: [tampered] });

    expect(result.candidates.some(({ id }) => id === tampered.id)).toBe(false);
  });

  it("does not grant the retry to an outside-host door without paired-boundary provenance", () => {
    const exact = detectedCandidate();
    const generic: RecognitionOpeningCandidate = {
      ...exact,
      id: "generic-outside-host-door",
      evidence: {
        ...exact.evidence,
        reasons: exact.evidence.reasons.filter((reason) =>
          reason !== "paired-boundary-door-gap"
          && reason !== "paired-boundary-rails"
          && reason !== "perpendicular-structural-anchor"
          && reason !== "terminal-host-mask-door-gap"),
      },
    };
    const result = analyze({ additionalHypotheses: [generic] });

    expect(result.candidates.some(({ id }) => id === generic.id)).toBe(false);
  });
});
