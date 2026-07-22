import { describe, expect, it } from "vitest";
import { buildOpeningHypotheses } from "./openings";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";

const wall: RecognitionWallCandidate = {
  id: "wall-1",
  start: { x: 0.1, y: 0.5 },
  end: { x: 0.9, y: 0.5 },
  estimatedThicknessPx: 20,
  confidence: "high",
  evidence: { localScore: 0.9, cloudScore: null, reasons: ["parallel-edges"] },
  origin: "local",
  conflict: null,
};

const baseEdges: DetectedLineSegment[] = [
  { x1: 100, y1: 240, x2: 450, y2: 240 },
  { x1: 100, y1: 260, x2: 450, y2: 260 },
  { x1: 550, y1: 240, x2: 900, y2: 240 },
  { x1: 550, y1: 260, x2: 900, y2: 260 },
];

function run(segments: DetectedLineSegment[]) {
  return buildOpeningHypotheses({ widthPx: 1000, heightPx: 500, wallCandidates: [wall], segments });
}

describe("local opening hypotheses", () => {
  it("keeps an unsupported wall gap as a low-confidence unknown opening", () => {
    const result = run(baseEdges);
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe("unknown-opening");
    expect(result[0]?.confidence).toBe("low");
    expect(result[0]?.hostWallCandidateId).toBe("wall-1");
    expect(result[0]?.center.x).toBeCloseTo(0.5, 2);
  });

  it("upgrades a nearby angled leaf/arc-like line to a door hypothesis", () => {
    const result = run([...baseEdges, { x1: 450, y1: 250, x2: 520, y2: 185 }]);
    expect(result[0]?.kind).toBe("door");
    expect(result[0]?.confidence).toBe("medium");
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
