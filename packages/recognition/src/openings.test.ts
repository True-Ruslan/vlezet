import { describe, expect, it } from "vitest";
import { buildOpeningHypotheses } from "./openings";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";

function wallAt(id: string, yPx: number): RecognitionWallCandidate {
  return {
    id,
    start: { x: 0.1, y: yPx / 500 },
    end: { x: 0.9, y: yPx / 500 },
    estimatedThicknessPx: 20,
    confidence: "high",
    evidence: { localScore: 0.9, cloudScore: null, reasons: ["parallel-edges"] },
    origin: "local",
    conflict: null,
  };
}

const wall = wallAt("wall-1", 250);
const boundaryWall = wallAt("boundary-wall", 20);
const lowResolutionBoundaryWall = wallAt("low-resolution-boundary-wall", 28);
const nearInteriorWall = wallAt("near-interior-wall", 40);

function edgesAt(yPx: number): DetectedLineSegment[] {
  return [
    { x1: 100, y1: yPx - 10, x2: 450, y2: yPx - 10 },
    { x1: 100, y1: yPx + 10, x2: 450, y2: yPx + 10 },
    { x1: 550, y1: yPx - 10, x2: 900, y2: yPx - 10 },
    { x1: 550, y1: yPx + 10, x2: 900, y2: yPx + 10 },
  ];
}

const baseEdges = edgesAt(250);
const boundaryEdges = edgesAt(20);
const lowResolutionBoundaryEdges = edgesAt(28);
const nearInteriorEdges = edgesAt(40);

function run(segments: DetectedLineSegment[], wallCandidate = wall) {
  return buildOpeningHypotheses({
    widthPx: 1000,
    heightPx: 500,
    wallCandidates: [wallCandidate],
    segments,
  });
}

describe("local opening hypotheses", () => {
  it("keeps an unsupported interior wall gap as a low-confidence unknown opening", () => {
    const result = run(baseEdges);
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe("unknown-opening");
    expect(result[0]?.confidence).toBe("low");
    expect(result[0]?.hostWallCandidateId).toBe("wall-1");
    expect(result[0]?.center.x).toBeCloseTo(0.5, 2);
  });

  it("classifies an unsupported gap on the exterior image boundary as a reviewable window", () => {
    const result = run(boundaryEdges, boundaryWall);
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe("window");
    expect(result[0]?.confidence).toBe("medium");
    expect(result[0]?.hostWallCandidateId).toBe("boundary-wall");
    expect(result[0]?.evidence.reasons).toContain("exterior-boundary-gap");
  });

  it("keeps the generated low-resolution 30 px source margin inside the exterior boundary band", () => {
    const result = run(lowResolutionBoundaryEdges, lowResolutionBoundaryWall);
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe("window");
    expect(result[0]?.evidence.reasons).toContain("exterior-boundary-gap");
  });

  it("does not extend exterior inference to a wall 40 px inside the image", () => {
    const result = run(nearInteriorEdges, nearInteriorWall);
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe("unknown-opening");
    expect(result[0]?.evidence.reasons).not.toContain("exterior-boundary-gap");
  });

  it("keeps an anchored exterior entrance leaf authoritative over boundary-window inference", () => {
    const result = run([
      ...boundaryEdges,
      { x1: 450, y1: 20, x2: 450, y2: 120 },
    ], boundaryWall);
    expect(result[0]?.kind).toBe("door");
    expect(result[0]?.evidence.reasons).toContain("door-leaf-anchored");
    expect(result[0]?.evidence.reasons).not.toContain("exterior-boundary-gap");
  });

  it("upgrades a line anchored at a gap edge and leaving the wall axis to a door", () => {
    const result = run([...baseEdges, { x1: 450, y1: 250, x2: 520, y2: 185 }]);
    expect(result[0]?.kind).toBe("door");
    expect(result[0]?.confidence).toBe("medium");
    expect(result[0]?.evidence.reasons).toContain("door-leaf-anchored");
  });

  it("recognizes a long perpendicular leaf anchored at the gap edge", () => {
    const result = run([...baseEdges, { x1: 450, y1: 250, x2: 450, y2: 150 }]);
    expect(result[0]?.kind).toBe("door");
    expect(result[0]?.evidence.reasons).toContain("door-leaf-anchored");
  });

  it("does not turn a window into a door from an unanchored nearby diagonal", () => {
    const result = run([
      ...baseEdges,
      { x1: 455, y1: 235, x2: 455, y2: 265 },
      { x1: 545, y1: 235, x2: 545, y2: 265 },
      { x1: 470, y1: 205, x2: 530, y2: 165 },
    ]);
    expect(result[0]?.kind).toBe("window");
    expect(result[0]?.evidence.reasons).not.toContain("door-leaf-anchored");
  });

  it("uses paired short perpendicular marks as a conservative window hint", () => {
    const result = run([
      ...baseEdges,
      { x1: 455, y1: 235, x2: 455, y2: 265 },
      { x1: 545, y1: 235, x2: 545, y2: 265 },
    ]);
    expect(result[0]?.kind).toBe("window");
    expect(result[0]?.confidence).toBe("medium");
  });
});
