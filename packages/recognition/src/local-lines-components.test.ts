import { describe, expect, it } from "vitest";
import { analyzeWallCandidates, type DetectedLineSegment } from "./local-lines";

const WIDTH = 1000;
const HEIGHT = 600;
const THICKNESS = 20;

type Point = Readonly<{ x: number; y: number }>;

function wallBoundaries(start: Point, end: Point): DetectedLineSegment[] {
  if (start.y === end.y) {
    return [
      { x1: start.x, y1: start.y - THICKNESS / 2, x2: end.x, y2: end.y - THICKNESS / 2 },
      { x1: start.x, y1: start.y + THICKNESS / 2, x2: end.x, y2: end.y + THICKNESS / 2 },
    ];
  }
  return [
    { x1: start.x - THICKNESS / 2, y1: start.y, x2: end.x - THICKNESS / 2, y2: end.y },
    { x1: start.x + THICKNESS / 2, y1: start.y, x2: end.x + THICKNESS / 2, y2: end.y },
  ];
}

function rectangle(left: number, top: number, right: number, bottom: number): DetectedLineSegment[] {
  return [
    ...wallBoundaries({ x: left, y: top }, { x: right, y: top }),
    ...wallBoundaries({ x: right, y: top }, { x: right, y: bottom }),
    ...wallBoundaries({ x: right, y: bottom }, { x: left, y: bottom }),
    ...wallBoundaries({ x: left, y: bottom }, { x: left, y: top }),
  ];
}

function pixelEndpoints(candidate: ReturnType<typeof analyzeWallCandidates>["candidates"][number]) {
  return [
    { x: candidate.start.x * WIDTH, y: candidate.start.y * HEIGHT },
    { x: candidate.end.x * WIDTH, y: candidate.end.y * HEIGHT },
  ] as const;
}

function touchesBox(
  candidate: ReturnType<typeof analyzeWallCandidates>["candidates"][number],
  box: Readonly<{ left: number; top: number; right: number; bottom: number }>,
): boolean {
  return pixelEndpoints(candidate).some((point) =>
    point.x >= box.left - 25
    && point.x <= box.right + 25
    && point.y >= box.top - 25
    && point.y <= box.bottom + 25);
}

describe("local wall component selection", () => {
  it("keeps multiple substantial disconnected structural components", () => {
    const primary = rectangle(50, 50, 450, 550);
    const secondary = rectangle(600, 80, 950, 390);

    const analysis = analyzeWallCandidates({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      segments: [...primary, ...secondary],
      options: {
        minimumSegmentLengthPx: 30,
        minimumWallThicknessPx: 8,
        maximumWallThicknessPx: 40,
        collinearMergeGapPx: 30,
        endpointSnapTolerancePx: 18,
        endpointExtensionTolerancePx: 24,
        intersectionTolerancePx: 8,
      },
    });

    expect(analysis.candidates.some((candidate) => touchesBox(candidate, {
      left: 600,
      top: 80,
      right: 950,
      bottom: 390,
    }))).toBe(true);
    expect(analysis.candidates.some((candidate) =>
      candidate.evidence.reasons.includes("retained-disconnected-structural-component")))
      .toBe(true);
  });

  it("drops a small disconnected furniture-like enclosure beside structural components", () => {
    const primary = rectangle(50, 50, 450, 550);
    const secondary = rectangle(600, 80, 950, 390);
    const furniture = rectangle(700, 455, 760, 510);

    const analysis = analyzeWallCandidates({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      segments: [...primary, ...secondary, ...furniture],
      options: {
        minimumSegmentLengthPx: 20,
        minimumWallThicknessPx: 8,
        maximumWallThicknessPx: 40,
        collinearMergeGapPx: 24,
        endpointSnapTolerancePx: 16,
        endpointExtensionTolerancePx: 20,
        intersectionTolerancePx: 6,
        minimumTopologyEdgeLengthPx: 12,
      },
    });

    expect(analysis.candidates.some((candidate) => touchesBox(candidate, {
      left: 700,
      top: 455,
      right: 760,
      bottom: 510,
    }))).toBe(false);
  });

  it("keeps a long isolated partition when it lies near the primary wall network", () => {
    const primary = rectangle(50, 50, 450, 550);
    const partition = wallBoundaries({ x: 500, y: 170 }, { x: 500, y: 430 });

    const analysis = analyzeWallCandidates({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      segments: [...primary, ...partition],
      options: {
        minimumSegmentLengthPx: 30,
        minimumWallThicknessPx: 8,
        maximumWallThicknessPx: 40,
        collinearMergeGapPx: 24,
        endpointSnapTolerancePx: 16,
        endpointExtensionTolerancePx: 20,
        intersectionTolerancePx: 6,
      },
    });

    expect(analysis.candidates.some((candidate) => {
      const [start, end] = pixelEndpoints(candidate);
      return Math.abs(start.x - 500) <= 20
        && Math.abs(end.x - 500) <= 20
        && Math.abs(end.y - start.y) >= 230;
    })).toBe(true);
  });

  it("is deterministic under segment ordering", () => {
    const segments = [
      ...rectangle(50, 50, 450, 550),
      ...rectangle(600, 80, 950, 390),
      ...rectangle(700, 455, 760, 510),
    ];
    const options = {
      minimumSegmentLengthPx: 20,
      minimumWallThicknessPx: 8,
      maximumWallThicknessPx: 40,
      collinearMergeGapPx: 24,
      endpointSnapTolerancePx: 16,
      endpointExtensionTolerancePx: 20,
      intersectionTolerancePx: 6,
      minimumTopologyEdgeLengthPx: 12,
    };

    expect(analyzeWallCandidates({ widthPx: WIDTH, heightPx: HEIGHT, segments: [...segments].reverse(), options }))
      .toEqual(analyzeWallCandidates({ widthPx: WIDTH, heightPx: HEIGHT, segments, options }));
  });
});
