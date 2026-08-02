import { describe, expect, it } from "vitest";
import {
  buildWallCandidates,
  createAdaptiveLocalRecognitionOptions,
  DEFAULT_LOCAL_RECOGNITION_OPTIONS,
  LOCAL_RECOGNITION_ENGINE_VERSION,
  type DetectedLineSegment,
} from "./local-lines";

describe("local wall post-processing", () => {
  it("pairs parallel wall edges into one centerline candidate", () => {
    const candidates = buildWallCandidates({
      widthPx: 1000,
      heightPx: 800,
      segments: [
        { x1: 100, y1: 200, x2: 900, y2: 200 },
        { x1: 100, y1: 220, x2: 900, y2: 220 },
      ],
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.start.y).toBeCloseTo(210 / 800, 5);
    expect(candidates[0]?.end.y).toBeCloseTo(210 / 800, 5);
    expect(candidates[0]?.estimatedThicknessPx).toBeCloseTo(20, 5);
  });

  it("merges collinear fragments and rejects short isolated noise", () => {
    const candidates = buildWallCandidates({
      widthPx: 1000,
      heightPx: 800,
      segments: [
        { x1: 100, y1: 100, x2: 450, y2: 100 },
        { x1: 100, y1: 120, x2: 450, y2: 120 },
        { x1: 440, y1: 100, x2: 900, y2: 100 },
        { x1: 440, y1: 120, x2: 900, y2: 120 },
        { x1: 30, y1: 30, x2: 45, y2: 30 },
      ],
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.start.x).toBeCloseTo(0.1, 3);
    expect(candidates[0]?.end.x).toBeCloseTo(0.9, 3);
  });

  it("derives relaxed thresholds from calibrated physical scale for thick fragmented walls", () => {
    const strict = buildWallCandidates({
      widthPx: 1200,
      heightPx: 900,
      segments: [
        { x1: 100, y1: 200, x2: 500, y2: 200 },
        { x1: 320, y1: 310, x2: 780, y2: 310 },
      ],
    });
    expect(strict).toHaveLength(0);

    const adaptive = buildWallCandidates({
      widthPx: 1200,
      heightPx: 900,
      segments: [
        { x1: 100, y1: 200, x2: 500, y2: 200 },
        { x1: 320, y1: 310, x2: 780, y2: 310 },
      ],
      options: createAdaptiveLocalRecognitionOptions({
        analysisMillimetersPerPixel: 2.5,
        widthPx: 1200,
        heightPx: 900,
      }),
    });

    expect(adaptive).toHaveLength(1);
    expect(adaptive[0]?.estimatedThicknessPx).toBeCloseTo(110, 5);
  });

  it("constructs one connected exterior wall graph and removes border artefacts", () => {
    const candidates = buildWallCandidates({
      widthPx: 1000,
      heightPx: 800,
      segments: [
        { x1: 0, y1: 1, x2: 999, y2: 1 },
        { x1: 100, y1: 100, x2: 900, y2: 100 },
        { x1: 100, y1: 120, x2: 900, y2: 120 },
        { x1: 100, y1: 680, x2: 900, y2: 680 },
        { x1: 100, y1: 700, x2: 900, y2: 700 },
        { x1: 100, y1: 100, x2: 100, y2: 700 },
        { x1: 120, y1: 100, x2: 120, y2: 700 },
        { x1: 880, y1: 100, x2: 880, y2: 700 },
        { x1: 900, y1: 100, x2: 900, y2: 700 },
      ],
    });

    expect(candidates).toHaveLength(4);
    expect(candidates.every((candidate) => candidate.evidence.reasons.includes("architectural-line-filter"))).toBe(true);
    expect(candidates.every((candidate) => candidate.evidence.reasons.includes("topology-edge"))).toBe(true);
    expect(candidates.every((candidate) => candidate.evidence.reasons.some((reason) => reason.startsWith("junction-degree:")))).toBe(true);
  });

  it("finds walls in a dense developer-plan analogue with decorative noise", () => {
    const structural: DetectedLineSegment[] = [
      { x1: 80, y1: 80, x2: 920, y2: 80 },
      { x1: 80, y1: 102, x2: 920, y2: 102 },
      { x1: 80, y1: 698, x2: 920, y2: 698 },
      { x1: 80, y1: 720, x2: 920, y2: 720 },
      { x1: 80, y1: 80, x2: 80, y2: 720 },
      { x1: 102, y1: 80, x2: 102, y2: 720 },
      { x1: 898, y1: 80, x2: 898, y2: 720 },
      { x1: 920, y1: 80, x2: 920, y2: 720 },
      { x1: 480, y1: 102, x2: 480, y2: 698 },
      { x1: 500, y1: 102, x2: 500, y2: 698 },
      { x1: 102, y1: 390, x2: 898, y2: 390 },
      { x1: 102, y1: 410, x2: 898, y2: 410 },
    ];
    const decorative: DetectedLineSegment[] = [
      { x1: 180, y1: 180, x2: 260, y2: 260 },
      { x1: 220, y1: 500, x2: 260, y2: 540 },
      { x1: 600, y1: 180, x2: 680, y2: 180 },
      { x1: 610, y1: 190, x2: 670, y2: 190 },
      { x1: 0, y1: 799, x2: 999, y2: 799 },
    ];

    const candidates = buildWallCandidates({
      widthPx: 1000,
      heightPx: 800,
      segments: [...decorative, ...structural],
      options: createAdaptiveLocalRecognitionOptions({
        analysisMillimetersPerPixel: 8,
        widthPx: 1000,
        heightPx: 800,
      }),
    });

    expect(candidates.length).toBeGreaterThanOrEqual(8);
    expect(candidates.some((candidate) => candidate.confidence !== "low")).toBe(true);
  });

  it("keeps output identity stable under input permutation and direction reversal", () => {
    const forward: DetectedLineSegment[] = [
      { x1: 100, y1: 100, x2: 900, y2: 100 },
      { x1: 100, y1: 120, x2: 900, y2: 120 },
      { x1: 100, y1: 100, x2: 100, y2: 700 },
      { x1: 120, y1: 100, x2: 120, y2: 700 },
    ];
    const reversed = [...forward].reverse().map((segment) => ({
      x1: segment.x2,
      y1: segment.y2,
      x2: segment.x1,
      y2: segment.y1,
    }));

    expect(buildWallCandidates({ widthPx: 1000, heightPx: 800, segments: forward }))
      .toEqual(buildWallCandidates({ widthPx: 1000, heightPx: 800, segments: reversed }));
  });

  it("keeps recognition thresholds and engine version explicit", () => {
    expect(DEFAULT_LOCAL_RECOGNITION_OPTIONS.minimumSegmentLengthPx).toBeGreaterThan(0);
    expect(DEFAULT_LOCAL_RECOGNITION_OPTIONS.maximumWallThicknessPx).toBeGreaterThan(
      DEFAULT_LOCAL_RECOGNITION_OPTIONS.minimumWallThicknessPx,
    );
    expect(DEFAULT_LOCAL_RECOGNITION_OPTIONS.endpointSnapTolerancePx).toBeGreaterThan(0);
    expect(LOCAL_RECOGNITION_ENGINE_VERSION).toBe("4");
  });
});
