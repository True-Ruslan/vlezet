import { afterEach, describe, expect, it, vi } from "vitest";
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

const validImage = { naturalWidth: 1000, naturalHeight: 800 } as HTMLImageElement;

function readWith(overrides: Partial<Parameters<typeof readWallSourceFeatures>[0]> = {}) {
  const canvas = fixtureCanvas(rgbaImage(41, 41, () => 255));
  return readWallSourceFeatures({
    image: validImage,
    point: { x: 500, y: 400 },
    viewportScale: 1,
    createCanvas: () => canvas,
    ...overrides,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("M8.4 bounded wall source feature reader", () => {
  it("reuses the M8.3 bounded reader policy for a strong narrow vertical wall line", () => {
    const canvas = fixtureCanvas(rgbaImage(41, 41, (x) => x >= 19 && x <= 21 ? 0 : 255));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("fixture context missing");

    const features = readWallSourceFeatures({
      image: validImage,
      point: { x: 500, y: 400 },
      viewportScale: 1,
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

  it("returns one centreline for a thick architectural wall band instead of two ambiguous edges", () => {
    const canvas = fixtureCanvas(rgbaImage(41, 41, (x) => x >= 16 && x <= 24 ? 45 : 245));

    const features = readWallSourceFeatures({
      image: validImage,
      point: { x: 500, y: 400 },
      viewportScale: 1,
      createCanvas: () => canvas,
    });

    const verticalCentres = features.filter((feature) =>
      feature.kind === "line-center" && feature.id.includes(":v:"));
    expect(verticalCentres).toHaveLength(1);
    expect(verticalCentres[0]).toEqual(expect.objectContaining({
      kind: "line-center",
      point: { x: 500, y: 400 },
    }));
    expect(verticalCentres[0]!.strength).toBeGreaterThanOrEqual(0.7);
  });

  it("reads bounded native source pixels before deterministic screen-space normalization", () => {
    const canvas = fixtureCanvas(rgbaImage(161, 161, (x) => x >= 79 && x <= 81 ? 20 : 245));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("fixture context missing");

    const features = readWallSourceFeatures({
      image: { naturalWidth: 2000, naturalHeight: 1600 } as HTMLImageElement,
      point: { x: 500, y: 400 },
      viewportScale: 0.25,
      createCanvas: () => canvas,
    });

    expect(canvas.width).toBe(161);
    expect(canvas.height).toBe(161);
    expect(context.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      420,
      320,
      161,
      161,
      0,
      0,
      161,
      161,
    );
    expect(features).toContainEqual(expect.objectContaining({
      kind: "line-center",
      point: { x: 500, y: 400 },
    }));
  });

  it("maps deterministically normalized perpendicular wall evidence back to one stable source intersection", () => {
    const canvas = fixtureCanvas(rgbaImage(161, 161, (x, y) => (
      (x >= 79 && x <= 81) || (y >= 79 && y <= 81) ? 20 : 245
    )));

    const features = readWallSourceFeatures({
      image: { naturalWidth: 2000, naturalHeight: 1600 } as HTMLImageElement,
      point: { x: 500, y: 400 },
      viewportScale: 0.25,
      createCanvas: () => canvas,
    });

    expect(features).toContainEqual(expect.objectContaining({
      id: "intersection:500.000:400.000",
      kind: "intersection",
      point: { x: 500, y: 400 },
    }));
    expect(features).toContainEqual(expect.objectContaining({ id: "line-center:h:400.000" }));
    expect(features).toContainEqual(expect.objectContaining({ id: "line-center:v:500.000" }));
  });

  it("abstains before canvas sampling when the source is too undersampled for deterministic wall evidence", () => {
    const createCanvas = vi.fn(() => fixtureCanvas(rgbaImage(41, 41, () => 20)));

    expect(readWallSourceFeatures({
      image: { naturalWidth: 4000, naturalHeight: 3000 } as HTMLImageElement,
      point: { x: 2000, y: 1500 },
      viewportScale: 0.2,
      createCanvas,
    })).toEqual([]);
    expect(createCanvas).not.toHaveBeenCalled();
  });

  it("returns no source evidence for a uniform empty patch", () => {
    const canvas = fixtureCanvas(rgbaImage(41, 41, () => 255));
    expect(readWallSourceFeatures({
      image: validImage,
      point: { x: 500, y: 400 },
      viewportScale: 1,
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
      viewportScale: 1,
      createCanvas: () => canvas,
    });

    expect(canvas.width).toBe(21);
    expect(canvas.height).toBe(21);
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 21, 21, 0, 0, 21, 21);
  });

  it("rejects malformed source geometry and viewport scale before touching canvas state", () => {
    expect(() => readWith({ image: { naturalWidth: 0, naturalHeight: 800 } as HTMLImageElement }))
      .toThrow("image.naturalWidth must be positive and finite.");
    expect(() => readWith({ image: { naturalWidth: Number.NaN, naturalHeight: 800 } as HTMLImageElement }))
      .toThrow("image.naturalWidth must be positive and finite.");
    expect(() => readWith({ image: { naturalWidth: 1000, naturalHeight: 0 } as HTMLImageElement }))
      .toThrow("image.naturalHeight must be positive and finite.");
    expect(() => readWith({ viewportScale: 0 }))
      .toThrow("viewportScale must be positive and finite.");
    expect(() => readWith({ viewportScale: Number.POSITIVE_INFINITY }))
      .toThrow("viewportScale must be positive and finite.");
  });

  it("rejects non-finite source points before sampling", () => {
    expect(() => readWith({ point: { x: Number.NaN, y: 400 } }))
      .toThrow("point.x must be finite.");
    expect(() => readWith({ point: { x: 500, y: Number.NEGATIVE_INFINITY } }))
      .toThrow("point.y must be finite.");
  });

  it("uses the browser canvas factory when no injectable factory is supplied", () => {
    const canvas = fixtureCanvas(rgbaImage(41, 41, () => 255));
    const createElement = vi.fn(() => canvas);
    vi.stubGlobal("document", { createElement });

    expect(readWallSourceFeatures({
      image: validImage,
      point: { x: 500, y: 400 },
      viewportScale: 1,
    })).toEqual([]);
    expect(createElement).toHaveBeenCalledWith("canvas");
    expect(canvas.width).toBe(41);
    expect(canvas.height).toBe(41);
  });

  it("fails explicitly when a canvas cannot provide a 2D context", () => {
    const canvas: CalibrationCanvasLike = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => null),
    };

    expect(() => readWallSourceFeatures({
      image: validImage,
      point: { x: 500, y: 400 },
      viewportScale: 1,
      createCanvas: () => canvas,
    })).toThrow("2D canvas context is unavailable.");
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
      viewportScale: 1,
      createCanvas: () => canvas,
    })).toThrow("fixture read failure");
  });
});