import { describe, expect, it, vi } from "vitest";
import type { CalibrationCanvasLike } from "./calibration-image-features";
import { resolveCalibrationSnap } from "./calibration-snap";
import { readWallSourceFeatures } from "./wall-source-feature-reader";

function raster(width: number, height: number, darkColumns: readonly Readonly<[number, number]>[]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const onWallFace = darkColumns.some(([start, end]) => x >= start && x <= end);
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

function readDoubleOutline(darkColumns: readonly Readonly<[number, number]>[]) {
  return readWallSourceFeatures({
    image: { naturalWidth: 1000, naturalHeight: 800 } as HTMLImageElement,
    point: { x: 500, y: 400 },
    viewportScale: 1,
    createCanvas: () => canvasFixture(raster(41, 41, darkColumns)),
  });
}

describe("M8.4 architectural double-outline wall acquisition", () => {
  it("collapses two close parallel faces around the pointer into one source centreline", () => {
    const rawPoint = { x: 500, y: 400 };
    const features = readDoubleOutline([[14, 15], [25, 26]]);
    const verticalCentres = features.filter((feature) =>
      feature.kind === "line-center" && feature.id.includes(":v:"));

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

    expect(verticalCentres).toEqual([
      expect.objectContaining({
        id: "line-center:v:500.000",
        kind: "line-center",
        point: rawPoint,
      }),
    ]);
    expect(features.filter((feature) => feature.kind === "edge" && feature.id.includes(":v:"))).toEqual([]);
    expect(resolved).toEqual(expect.objectContaining({
      snapped: true,
      kind: "line-center",
      point: rawPoint,
      reason: "snapped",
    }));
  });

  it("does not invent a wall centre from unrelated parallel lines outside the wall-width envelope", () => {
    const features = readDoubleOutline([[7, 8], [32, 33]]);

    expect(features).not.toContainEqual(expect.objectContaining({ id: "line-center:v:500.000" }));
    expect(features.filter((feature) => feature.kind === "line-center" && feature.id.includes(":v:"))).toHaveLength(2);
  });
});
