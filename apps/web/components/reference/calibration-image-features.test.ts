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

const analysis = {
  radiusPx: 5,
  contrastThreshold: 60,
  darknessThreshold: 120,
  maximumLineWidthPx: 6,
} as const;

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

  it("reads only a bounded source window and maps detected vertical points back to natural image coordinates", () => {
    const canvas = fixtureCanvas(rgbaImage(11, 11, (x) => x < 6 ? 255 : 0));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("fixture context missing");

    const result = readCalibrationFeaturesFromImage({
      image: { naturalWidth: 1000, naturalHeight: 500 } as HTMLImageElement,
      point: { x: 505, y: 255 },
      ...analysis,
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

  it("maps horizontal and intersection candidates back to global natural-image coordinates", () => {
    const canvas = fixtureCanvas(rgbaImage(11, 11, (x, y) => (
      (x >= 4 && x <= 6) || (y >= 4 && y <= 6) ? 0 : 255
    )));

    const result = readCalibrationFeaturesFromImage({
      image: { naturalWidth: 1000, naturalHeight: 500 } as HTMLImageElement,
      point: { x: 505, y: 255 },
      ...analysis,
      createCanvas: () => canvas,
    });

    expect(result).toContainEqual(expect.objectContaining({
      id: "line-center:h:255.000",
      kind: "line-center",
      point: { x: 505, y: 255 },
    }));
    expect(result).toContainEqual(expect.objectContaining({
      id: "intersection:505.000:255.000",
      kind: "intersection",
      point: { x: 505, y: 255 },
    }));
  });

  it("clips the requested window at natural image borders", () => {
    const canvas = fixtureCanvas(new Uint8ClampedArray(6 * 6 * 4).fill(255));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("fixture context missing");

    readCalibrationFeaturesFromImage({
      image: { naturalWidth: 8, naturalHeight: 8 } as HTMLImageElement,
      point: { x: 0, y: 0 },
      ...analysis,
      createCanvas: () => canvas,
    });

    expect(canvas.width).toBe(6);
    expect(canvas.height).toBe(6);
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 6, 6, 0, 0, 6, 6);
  });

  it("uses the browser canvas factory by default", () => {
    const canvas = fixtureCanvas(rgbaImage(5, 5, () => 255));
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { createElement: vi.fn(() => canvas) },
    });

    expect(readCalibrationFeaturesFromImage({
      image: { naturalWidth: 5, naturalHeight: 5 } as HTMLImageElement,
      point: { x: 2, y: 2 },
      radiusPx: 2,
      contrastThreshold: 60,
      darknessThreshold: 120,
      maximumLineWidthPx: 6,
    })).toEqual([]);
    expect(canvas.width).toBe(5);
    expect(canvas.height).toBe(5);
  });

  it("rejects invalid natural dimensions and analysis radius", () => {
    const canvas = fixtureCanvas(new Uint8ClampedArray(4));
    const base = {
      point: { x: 1, y: 1 },
      radiusPx: 1,
      contrastThreshold: 60,
      darknessThreshold: 120,
      maximumLineWidthPx: 6,
      createCanvas: () => canvas,
    };

    for (const image of [
      { naturalWidth: Number.NaN, naturalHeight: 8 },
      { naturalWidth: 0, naturalHeight: 8 },
      { naturalWidth: 8, naturalHeight: Number.NaN },
      { naturalWidth: 8, naturalHeight: 0 },
    ]) {
      expect(() => readCalibrationFeaturesFromImage({ image, ...base })).toThrow(
        "Natural image dimensions must be positive and finite.",
      );
    }
    expect(() => readCalibrationFeaturesFromImage({
      image: { naturalWidth: 8, naturalHeight: 8 },
      ...base,
      radiusPx: Number.NaN,
    })).toThrow("radiusPx must be positive and finite.");
    expect(() => readCalibrationFeaturesFromImage({
      image: { naturalWidth: 8, naturalHeight: 8 },
      ...base,
      radiusPx: 0,
    })).toThrow("radiusPx must be positive and finite.");
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
