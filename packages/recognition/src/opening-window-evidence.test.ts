import { describe, expect, it } from "vitest";
import { buildOpeningHypotheses } from "./openings";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";

const wall: RecognitionWallCandidate = {
  id: "wall-window",
  start: { x: 0.1, y: 0.5 },
  end: { x: 0.9, y: 0.5 },
  estimatedThicknessPx: 20,
  confidence: "medium",
  evidence: { localScore: 0.72, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
  origin: "local",
  conflict: null,
};

const splitStructuralSegments: DetectedLineSegment[] = [
  { x1: 100, y1: 240, x2: 435, y2: 240 },
  { x1: 565, y1: 240, x2: 900, y2: 240 },
  { x1: 100, y1: 260, x2: 435, y2: 260 },
  { x1: 565, y1: 260, x2: 900, y2: 260 },
];

const continuousStructuralSegments: DetectedLineSegment[] = [
  { x1: 100, y1: 240, x2: 900, y2: 240 },
  { x1: 100, y1: 260, x2: 900, y2: 260 },
];

const windowSymbols: DetectedLineSegment[] = [
  { x1: 435, y1: 247, x2: 565, y2: 247 },
  { x1: 435, y1: 253, x2: 565, y2: 253 },
  { x1: 435, y1: 247, x2: 435, y2: 253 },
  { x1: 565, y1: 247, x2: 565, y2: 253 },
];

const fragmentedWindowSymbols: DetectedLineSegment[] = [
  { x1: 435, y1: 247, x2: 497, y2: 247 },
  { x1: 503, y1: 247, x2: 565, y2: 247 },
  { x1: 435, y1: 253, x2: 496, y2: 253 },
  { x1: 502, y1: 253, x2: 565, y2: 253 },
  { x1: 435, y1: 247, x2: 435, y2: 253 },
  { x1: 565, y1: 247, x2: 565, y2: 253 },
];

const rasterFragmentedWindowSymbols: DetectedLineSegment[] = [
  { x1: 435, y1: 247, x2: 490, y2: 247 },
  { x1: 508, y1: 247, x2: 565, y2: 247 },
  { x1: 435, y1: 253, x2: 489, y2: 253 },
  { x1: 507, y1: 253, x2: 565, y2: 253 },
];

const compressedWindowSymbols: DetectedLineSegment[] = [
  { x1: 435, y1: 249, x2: 565, y2: 249 },
  { x1: 435, y1: 251, x2: 565, y2: 251 },
];

const duplicateStrokeSymbols: DetectedLineSegment[] = [
  { x1: 435, y1: 249, x2: 565, y2: 249 },
  { x1: 435, y1: 250, x2: 565, y2: 250 },
];

const structuralEchoSymbols: DetectedLineSegment[] = [
  { x1: 435, y1: 242, x2: 565, y2: 242 },
  { x1: 435, y1: 258, x2: 565, y2: 258 },
];

function expectWindow(openings: ReturnType<typeof buildOpeningHypotheses>): void {
  expect(openings).toHaveLength(1);
  expect(openings[0]).toMatchObject({
    kind: "window",
    hostWallCandidateId: "wall-window",
    center: { x: 0.5, y: 0.5 },
    widthPx: 130,
    confidence: "medium",
  });
  expect(openings[0]?.evidence.reasons).toContain("paired-cross-lines");
}

describe("window evidence separation", () => {
  it("uses structural wall edges for the gap and thin symbol lines only for classification", () => {
    expectWindow(buildOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [wall],
      wallSegments: splitStructuralSegments,
      symbolSegments: windowSymbols,
    }));
  });

  it("classifies a structural wall gap from paired parallel rails without perpendicular caps", () => {
    expectWindow(buildOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [wall],
      wallSegments: splitStructuralSegments,
      symbolSegments: rasterFragmentedWindowSymbols,
    }));
  });

  it("accepts two independently detected rails compressed to a 2 px separation", () => {
    expectWindow(buildOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [wall],
      wallSegments: splitStructuralSegments,
      symbolSegments: compressedWindowSymbols,
    }));
  });

  it("does not accept a 1 px anti-alias duplicate as two window rails", () => {
    const openings = buildOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [wall],
      wallSegments: continuousStructuralSegments,
      symbolSegments: duplicateStrokeSymbols,
    });
    expect(openings).toEqual([]);
  });

  it("keeps door evidence authoritative when an angled swing line overlaps paired rails", () => {
    const openings = buildOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [wall],
      wallSegments: splitStructuralSegments,
      symbolSegments: [
        ...rasterFragmentedWindowSymbols,
        { x1: 435, y1: 250, x2: 500, y2: 185 },
      ],
    });
    expect(openings).toHaveLength(1);
    expect(openings[0]?.kind).toBe("door");
    expect(openings[0]?.evidence.reasons).toContain("door-arc-like-line");
  });

  it("does not let thin window rails bridge the wall gap in the legacy combined stream", () => {
    expectWindow(buildOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [wall],
      segments: [...splitStructuralSegments, ...windowSymbols],
    }));
  });

  it("recognizes paired bounded window rails when morphology closes the structural gap", () => {
    expectWindow(buildOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [wall],
      wallSegments: continuousStructuralSegments,
      symbolSegments: windowSymbols,
    }));
  });

  it("merges collinear Hough fragments before pairing window rails", () => {
    expectWindow(buildOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [wall],
      wallSegments: continuousStructuralSegments,
      symbolSegments: fragmentedWindowSymbols,
    }));
  });

  it("reconnects raster Hough fragments across a bounded 18 px gap into one window", () => {
    expectWindow(buildOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [wall],
      wallSegments: continuousStructuralSegments,
      symbolSegments: rasterFragmentedWindowSymbols,
    }));
  });

  it("does not reinterpret structural edge echoes as window rails", () => {
    expect(buildOpeningHypotheses({
      widthPx: 1000,
      heightPx: 500,
      wallCandidates: [wall],
      wallSegments: structuralEchoSymbols,
      symbolSegments: structuralEchoSymbols,
    })).toEqual([]);
  });
});
