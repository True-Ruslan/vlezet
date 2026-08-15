import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBrowserCalibrationCanvas,
  readCalibrationFeaturesFromImage,
  type CalibrationCanvasLike,
} from "./calibration-image-features";

const originalDocument = globalThis.document;

afterEach(() => {
  Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
});

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

describe("calibration browser feature adapter", () => {
  it("creates a plain browser canvas with requested dimensions", () => {
    const canvas = fixtureCanvas(new Uint8ClampedArray(4));
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { createElement: vi.fn(() => canvas) },
    });

    expect(createBrowserCalibrationCanvas(12, 9)).toBe(canvas);
    expect(canvas.width).toBe(12);
    expect(canvas.height).toBe(9);
  });

  it("reads only a bounded source window and maps detected points back to natural image coordinates", () => {
    const width = 11;
    const height = 11;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = x < 6 ? 255 : 0;
        const offset = (y * width + x) * 4;
        rgba[offset] = value;
        rgba[offset + 1] = value;
        rgba[offset + 2] = value;
        rgba[offset + 3] = 255;
      }
    }
    const canvas = fixtureCanvas(rgba);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("fixture context missing");

    const result = readCalibrationFeaturesFromImage({
      image: { naturalWidth: 1000, naturalHeight: 500 } as HTMLImageElement,
      point: { x: 505, y: 255 },
      radiusPx: 5,
      contrastThreshold: 60,
      darknessThreshold: 120,
      maximumLineWidthPx: 6,
      createCanvas: () => canvas,
    });

    expect(context.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      500,
      250,
      11,
      11,
      0,
      0,
      11,
      11,
    );
    expect(result).toContainEqual({
      id: "edge:v:505.500",
      kind: "edge",
      point: { x: 505.5, y: 255 },
      strength: 1,
    });
  });

  it("clips the requested window at natural image borders", () => {
    const rgba = new Uint8ClampedArray(6 * 6 * 4).fill(255);
    const canvas = fixtureCanvas(rgba);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("fixture context missing");

    readCalibrationFeaturesFromImage({
      image: { naturalWidth: 8, naturalHeight: 8 } as HTMLImageElement,
      point: { x: 0, y: 0 },
      radiusPx: 5,
      contrastThreshold: 60,
      darknessThreshold: 120,
      maximumLineWidthPx: 6,
      createCanvas: () => canvas,
    });

    expect(canvas.width).toBe(6);
    expect(canvas.height).toBe(6);
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 6, 6, 0, 0, 6, 6);
  });

  it("fails closed when a browser cannot provide a 2D canvas context", () => {
    const canvas: CalibrationCanvasLike = { width: 0, height: 0, getContext: () => null };
    expect(() => readCalibrationFeaturesFromImage({
      image: { naturalWidth: 8, naturalHeight: 8 } as HTMLImageElement,
      point: { x: 4, y: 4 },
      radiusPx: 2,
      contrastThreshold: 60,
      darknessThreshold: 120,
      maximumLineWidthPx: 6,
      createCanvas: () => canvas,
    })).toThrow("2D canvas context is unavailable.");
  });
});
