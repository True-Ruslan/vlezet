import { describe, expect, it, vi } from "vitest";
import type { CalibrationCanvasLike } from "./calibration-image-features";
import { readWallSourceFeatures } from "./wall-source-feature-reader";

function rgbaImage(width: number, height: number, luminanceAt: (x: number, y: number) => number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = luminanceAt(x, y);
      const offset = (y * width + x) * 4;
      rgba[offset] = value;
      rgba[offset + 1] = value;
      rgba[offset + 2] = value;
      rgba[offset + 3] = 255;
    }
  }
  return rgba;
}

function fixtureCanvas(data: Uint8ClampedArray): CalibrationCanvasLike {
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data })),
    })),
  };
}

describe("M8.4 antialiased architectural wall band", () => {
  it("collapses resampling-split edge responses to the physical wall centreline", () => {
    // Mirrors the repository dense fixture near source (370, 34): one physical
    // 16 px wall band has antialiased boundary pixels. At the accepted fit scale
    // (≈0.86 screen px / source px), deterministic area resampling turns the
    // upper physical boundary into two adjacent edge responses while the lower
    // boundary remains one response. Those responses still describe exactly one
    // wall and must not be treated as three independent edges.
    const canvas = fixtureCanvas(rgbaImage(49, 49, (_x, y) => {
      if (y === 12 || y === 27) return 137;
      if (y >= 13 && y <= 26) return 21;
      return 255;
    }));

    const features = readWallSourceFeatures({
      image: { naturalWidth: 1000, naturalHeight: 800 } as HTMLImageElement,
      point: { x: 500, y: 400 },
      viewportScale: 0.8595238095238095,
      createCanvas: () => canvas,
    });

    const horizontalCentres = features.filter((feature) =>
      feature.kind === "line-center" && feature.id.includes(":h:"));

    expect(horizontalCentres).toHaveLength(1);
    expect(horizontalCentres[0]!.point.y).toBeCloseTo(395.5, 0);
    expect(horizontalCentres[0]!.strength).toBeGreaterThanOrEqual(0.35);
  });
});
