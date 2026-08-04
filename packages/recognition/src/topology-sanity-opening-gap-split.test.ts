import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import { sanitizeRecognitionWallTopology } from "./topology-sanity";

const WIDTH = 1000;
const HEIGHT = 600;

function bridgedWall(): RecognitionWallCandidate {
  return {
    id: "blind-bridge",
    start: { x: 0.1, y: 1 / 3 },
    end: { x: 0.9, y: 1 / 3 },
    estimatedThicknessPx: 20,
    confidence: "high",
    evidence: {
      localScore: 0.88,
      cloudScore: null,
      reasons: [
        "bounded-opening-gap-bridge",
        "collinear-centerline-merge",
        "filled-wall-region-evidence",
      ],
    },
    origin: "local",
    conflict: null,
  };
}

function structuralMask(structuralInGap: boolean) {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural(x: number, y: number): boolean {
      if (y < 190 || y > 210) return false;
      if (x >= 430 && x <= 490) return structuralInGap;
      return x >= 100 && x <= 900;
    },
  };
}

function coordinates(candidate: RecognitionWallCandidate) {
  return [
    Math.round(candidate.start.x * WIDTH),
    Math.round(candidate.start.y * HEIGHT),
    Math.round(candidate.end.x * WIDTH),
    Math.round(candidate.end.y * HEIGHT),
  ];
}

describe("mask-confirmed blind opening bridge confidence", () => {
  it("caps confidence without changing wall identity or geometry", () => {
    const result = sanitizeRecognitionWallTopology({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      millimetersPerPixel: 10,
      structuralMask: structuralMask(false),
      wallCandidates: [bridgedWall()],
    });

    expect(result.walls).toHaveLength(1);
    expect(result.walls[0]).toMatchObject({
      id: "blind-bridge",
      confidence: "medium",
      conflict: null,
    });
    expect(coordinates(result.walls[0]!)).toEqual([100, 200, 900, 200]);
    expect(result.walls[0]?.evidence.reasons)
      .toContain("topology-mask-opening-gap-confidence-capped");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "topology-mask-opening-gap-confidence-capped",
      candidateId: "blind-bridge",
    }));
  });

  it("keeps high confidence when the mask confirms structural continuity", () => {
    const result = sanitizeRecognitionWallTopology({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      millimetersPerPixel: 10,
      structuralMask: structuralMask(true),
      wallCandidates: [bridgedWall()],
    });

    expect(result.walls[0]).toMatchObject({
      id: "blind-bridge",
      confidence: "high",
      conflict: null,
    });
    expect(result.walls[0]?.evidence.reasons)
      .not.toContain("topology-mask-opening-gap-confidence-capped");
  });

  it("preserves legacy confidence when no structural mask is supplied", () => {
    const result = sanitizeRecognitionWallTopology({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      millimetersPerPixel: 10,
      wallCandidates: [bridgedWall()],
    });

    expect(result.walls[0]).toMatchObject({
      id: "blind-bridge",
      confidence: "high",
      conflict: null,
    });
  });
});
