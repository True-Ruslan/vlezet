import { describe, expect, it, vi } from "vitest";
import type { CalibrationCanvasLike } from "./calibration-image-features";
import { resolveCalibrationSnap } from "./calibration-snap";
import { readWallSourceFeatures } from "./wall-source-feature-reader";

type RasterSpan = readonly [number, number];

type RasterTones = Readonly<{
  background: number;
  verticalFace: number;
  horizontalFace: number;
}>;

function architecturalCornerRaster(
  tones: RasterTones,
  darkColumns: readonly RasterSpan[] = [[14, 15], [25, 26]],
  darkRows: readonly RasterSpan[] = [[14, 15], [25, 26]],
): Uint8ClampedArray {
  const width = 41;
  const height = 41;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const onVerticalFace = darkColumns.some(([start, end]) => x >= start && x <= end);
      const onHorizontalFace = darkRows.some(([start, end]) => y >= start && y <= end);
      const value = onHorizontalFace
        ? tones.horizontalFace
        : onVerticalFace
          ? tones.verticalFace
          : tones.background;
      const offset = (y * width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }

  return data;
}

function readCorner(tones: RasterTones) {
  const data = architecturalCornerRaster(tones);
  const context = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data })),
  };
  const canvas: CalibrationCanvasLike = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
  };

  return readWallSourceFeatures({
    image: { naturalWidth: 1000, naturalHeight: 800 } as HTMLImageElement,
    point: { x: 500, y: 400 },
    viewportScale: 1,
    createCanvas: () => canvas,
  });
}

function resolve(features: ReturnType<typeof readCorner>) {
  return resolveCalibrationSnap({
    rawPoint: { x: 500, y: 400 },
    features,
    viewportScale: 1,
    acquisitionRadiusPx: 12,
    releaseRadiusPx: 18,
    distanceEquivalencePx: 1,
    minimumStrength: 0.35,
    activeCandidateId: null,
    snappingEnabled: true,
    suppressed: false,
  });
}

describe("M8.4 architectural wall corner confidence", () => {
  it("keeps a balanced two-axis architectural corner eligible across raster-phase contrast loss", () => {
    const features = readCorner({
      background: 210,
      verticalFace: 100,
      horizontalFace: 115,
    });
    const vertical = features.find((feature) => feature.kind === "line-center" && feature.id.includes(":v:"));
    const horizontal = features.find((feature) => feature.kind === "line-center" && feature.id.includes(":h:"));
    const intersection = features.find((feature) => feature.kind === "intersection");

    expect(vertical?.strength).toBeGreaterThan(0.35);
    expect(horizontal?.strength).toBeGreaterThan(0.3);
    expect(horizontal?.strength).toBeLessThan(0.35);
    expect(intersection?.strength).toBeGreaterThanOrEqual(0.35);
    expect(resolve(features)).toEqual(expect.objectContaining({
      snapped: true,
      kind: "intersection",
      point: { x: 500, y: 400 },
      reason: "snapped",
    }));
  });

  it("does not promote a materially weaker perpendicular axis into a wall corner", () => {
    const features = readCorner({
      background: 210,
      verticalFace: 100,
      horizontalFace: 125,
    });
    const horizontal = features.find((feature) => feature.kind === "line-center" && feature.id.includes(":h:"));
    const intersection = features.find((feature) => feature.kind === "intersection");

    expect(horizontal?.strength).toBeLessThan(0.3);
    expect(intersection?.strength).toBeLessThan(0.35);
    expect(resolve(features)).toEqual(expect.objectContaining({
      snapped: true,
      kind: "line-center",
      reason: "snapped",
    }));
  });
});
