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

describe("M8.4 bounded wall source feature reader", () => {
  it("reuses the M8.3 bounded reader policy for a strong narrow vertical wall line", () => {
    const canvas = fixtureCanvas(rgbaImage(41, 41, (x) => x >= 19 && x <= 21 ? 0 : 255));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("fixture context missing");

    const features = readWallSourceFeatures({
      image: { naturalWidth: 1000, naturalHeight: 800 } as HTMLImageElement,
      point: { x: 500, y: 400 },
      createCanvas: () => canvas,
    });

    expect(canvas.width).toBe(41);
    expect(canvas.height).toBe(41);
    expect(context.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      480,
      380,
      41,
      41,
      0,
      0,
      41,
      41,
    );
    expect(features).toContainEqual(expect.objectContaining({
      id: "line-center:v:500.000",
      kind: "line-center",
      point: { x: 500, y: 400 },
      strength: 1,
    }));
  });

  it("returns no source evidence for a uniform empty patch", () => {
    const canvas = fixtureCanvas(rgbaImage(41, 41, () => 255));
    expect(readWallSourceFeatures({
      image: { naturalWidth: 1000, naturalHeight: 800 } as HTMLImageElement,
      point: { x: 500, y: 400 },
      createCanvas: () => canvas,
    })).toEqual([]);
  });

  it("preserves natural-image bounds when the source pointer is at an image corner", () => {
    const canvas = fixtureCanvas(rgbaImage(21, 21, () => 255));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("fixture context missing");

    readWallSourceFeatures({
      image: { naturalWidth: 30, naturalHeight: 30 } as HTMLImageElement,
      point: { x: 0, y: 0 },
      createCanvas: () => canvas,
    });

    expect(canvas.width).toBe(21);
    expect(canvas.height).toBe(21);
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 21, 21, 0, 0, 21, 21);
  });

  it("surfaces a canvas read failure so the editor controller can fail closed to manual behavior", () => {
    const canvas: CalibrationCanvasLike = {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: vi.fn(),
        getImageData: vi.fn(() => {
          throw new Error("fixture read failure");
        }),
      }),
    };

    expect(() => readWallSourceFeatures({
      image: { naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement,
      point: { x: 50, y: 50 },
      createCanvas: () => canvas,
    })).toThrow("fixture read failure");
  });
});
