import { describe, expect, it, vi } from "vitest";
import type { CalibrationCanvasLike } from "./calibration-image-features";
import { resolveCalibrationSnap } from "./calibration-snap";
import { readWallSourceFeatures } from "./wall-source-feature-reader";

function raster(width: number, height: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const onWallFace = (x >= 14 && x <= 15) || (x >= 25 && x <= 26);
      const value = onWallFace ? 25 : 245;
      const offset = (y * width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return data;
}

function canvasFixture(data: Uint8ClampedArray): CalibrationCanvasLike {
  const context = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data })),
  };
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
  };
}

describe("M8.4 architectural double-outline wall acquisition", () => {
  it("collapses two parallel faces of one wall into one source centreline", () => {
    const canvas = canvasFixture(raster(41, 41));
    const rawPoint = { x: 500, y: 400 };
    const features = readWallSourceFeatures({
      image: { naturalWidth: 1000, naturalHeight: 800 } as HTMLImageElement,
      point: rawPoint,
      viewportScale: 1,
      createCanvas: () => canvas,
    });

    const resolved = resolveCalibrationSnap({
      rawPoint,
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

    expect(features).toContainEqual(expect.objectContaining({
      id: "line-center:v:500.000",
      kind: "line-center",
      point: rawPoint,
    }));
    expect(resolved).toEqual(expect.objectContaining({
      snapped: true,
      kind: "line-center",
      point: rawPoint,
      reason: "snapped",
    }));
  });
});
