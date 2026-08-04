import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import { detectWindowHostBridgeOpenings } from "./window-host-bridge-opening";

const widthPx = 1000;
const heightPx = 600;

function wall(reasons: readonly string[] = ["window-symbol-host-bridge"]): RecognitionWallCandidate {
  return {
    id: "window-host",
    start: { x: 100 / widthPx, y: 300 / heightPx },
    end: { x: 900 / widthPx, y: 300 / heightPx },
    estimatedThicknessPx: 20,
    confidence: "medium",
    evidence: { localScore: 0.74, cloudScore: null, reasons },
    origin: "local",
    conflict: null,
  };
}

const rails: readonly DetectedLineSegment[] = [
  { x1: 430, y1: 296, x2: 570, y2: 296 },
  { x1: 430, y1: 304, x2: 570, y2: 304 },
];

function detect(input: Readonly<{
  reasons?: readonly string[];
  segments?: readonly DetectedLineSegment[];
}> = {}) {
  return detectWindowHostBridgeOpenings({
    widthPx,
    heightPx,
    wallCandidates: [wall(input.reasons)],
    symbolSegments: input.segments ?? rails,
  });
}

describe("window-symbol host bridge openings", () => {
  it("recreates the accepted rail gap as a window hypothesis", () => {
    const openings = detect();
    expect(openings).toHaveLength(1);
    const opening = openings[0]!;
    expect(opening.kind).toBe("window");
    expect(opening.hostWallCandidateId).toBe("window-host");
    expect(opening.center.x * widthPx).toBeCloseTo(500, 4);
    expect(opening.center.y * heightPx).toBeCloseTo(300, 4);
    expect(opening.widthPx).toBeCloseTo(140, 4);
    expect(opening.orientationDeg).toBeCloseTo(0, 4);
    expect(opening.confidence).toBe("medium");
    expect(opening.evidence.reasons).toEqual(expect.arrayContaining([
      "paired-window-rails",
      "window-host-bridge-opening",
    ]));
  });

  it("does not infer a window without accepted window-host evidence", () => {
    expect(detect({ reasons: ["filled-wall-region-evidence"] })).toHaveLength(0);
  });

  it("does not infer a window from a single rail", () => {
    expect(detect({ segments: rails.slice(0, 1) })).toHaveLength(0);
  });

  it("does not accept parallel dimension lines outside the wall thickness", () => {
    expect(detect({
      segments: [
        { x1: 430, y1: 250, x2: 570, y2: 250 },
        { x1: 430, y1: 258, x2: 570, y2: 258 },
      ],
    })).toHaveLength(0);
  });

  it("does not classify a rail gap containing a perpendicular symbol as a window", () => {
    expect(detect({
      segments: [
        ...rails,
        { x1: 430, y1: 300, x2: 430, y2: 420 },
      ],
    })).toHaveLength(0);
  });
});
