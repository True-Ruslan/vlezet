import { describe, expect, it } from "vitest";
import { analyzeCalibrationFeatures } from "./calibration-features";

function image(
  width: number,
  height: number,
  luminanceAt: (x: number, y: number) => number,
) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = luminanceAt(x, y);
      const offset = (y * width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return { width, height, data };
}

const options = {
  point: { x: 5, y: 5 },
  radiusPx: 5,
  contrastThreshold: 60,
  darknessThreshold: 120,
  maximumLineWidthPx: 6,
} as const;

function hasVerticalLineCenter(features: ReturnType<typeof analyzeCalibrationFeatures>): boolean {
  return features.some((feature) => feature.kind === "line-center" && feature.id.startsWith("line-center:v:"));
}

describe("calibration local raster features", () => {
  it("finds an isolated high-contrast edge without inventing a line centre", () => {
    const raster = image(11, 11, (x) => x < 6 ? 255 : 0);
    const features = analyzeCalibrationFeatures({ image: raster, ...options });

    expect(features).toContainEqual({
      id: "edge:v:5.500",
      kind: "edge",
      point: { x: 5.5, y: 5 },
      strength: 1,
    });
    expect(features.some((feature) => feature.kind === "line-center")).toBe(false);
  });

  it("derives the stable centre between two parallel dark edges", () => {
    const raster = image(11, 11, (x) => x >= 4 && x <= 6 ? 0 : 255);
    const features = analyzeCalibrationFeatures({ image: raster, ...options });

    expect(features).toContainEqual({
      id: "line-center:v:5.000",
      kind: "line-center",
      point: { x: 5, y: 5 },
      strength: 1,
    });
  });

  it("derives an intersection only from perpendicular strong line centres", () => {
    const raster = image(11, 11, (x, y) => (
      (x >= 4 && x <= 6) || (y >= 4 && y <= 6) ? 0 : 255
    ));
    const features = analyzeCalibrationFeatures({ image: raster, ...options });

    expect(features).toContainEqual({
      id: "intersection:5.000:5.000",
      kind: "intersection",
      point: { x: 5, y: 5 },
      strength: expect.any(Number),
    });
    const intersection = features.find((feature) => feature.kind === "intersection");
    expect(intersection?.strength).toBeGreaterThanOrEqual(0.7);
  });

  it("abstains on faint alternating evidence below the configured contrast", () => {
    const raster = image(11, 11, (x, y) => (x + y) % 2 === 0 ? 235 : 225);
    expect(analyzeCalibrationFeatures({ image: raster, ...options })).toEqual([]);
  });

  it("keeps bounded analysis safe at image borders", () => {
    const raster = image(8, 8, (x) => x < 2 ? 0 : 255);
    const features = analyzeCalibrationFeatures({
      image: raster,
      ...options,
      point: { x: 0, y: 0 },
      radiusPx: 20,
    });

    for (const feature of features) {
      expect(feature.point.x).toBeGreaterThanOrEqual(0);
      expect(feature.point.x).toBeLessThanOrEqual(7);
      expect(feature.point.y).toBeGreaterThanOrEqual(0);
      expect(feature.point.y).toBeLessThanOrEqual(7);
    }
  });

  it("rejects malformed image geometry and invalid analysis parameters", () => {
    const valid = image(2, 2, () => 255);

    expect(() => analyzeCalibrationFeatures({
      image: { ...valid, width: Number.NaN },
      ...options,
    })).toThrow("image.width must be finite.");
    expect(() => analyzeCalibrationFeatures({
      image: valid,
      ...options,
      radiusPx: 0,
    })).toThrow("radiusPx must be positive.");
    expect(() => analyzeCalibrationFeatures({
      image: { width: 2.5, height: 2, data: new Uint8ClampedArray(20) },
      ...options,
    })).toThrow("image dimensions must be integers.");
    expect(() => analyzeCalibrationFeatures({
      image: { width: 2, height: 2.5, data: new Uint8ClampedArray(20) },
      ...options,
    })).toThrow("image dimensions must be integers.");
    expect(() => analyzeCalibrationFeatures({
      image: { width: 2, height: 2, data: new Uint8ClampedArray(15) },
      ...options,
    })).toThrow("image.data is shorter than the declared dimensions.");
  });

  it("does not call a clipped or over-wide dark run a stable line centre", () => {
    const startsAtWindowEdge = analyzeCalibrationFeatures({
      image: image(11, 11, (x) => x <= 2 ? 0 : 255),
      ...options,
    });
    const endsAtWindowEdge = analyzeCalibrationFeatures({
      image: image(11, 11, (x) => x >= 8 ? 0 : 255),
      ...options,
    });
    const tooWide = analyzeCalibrationFeatures({
      image: image(11, 11, (x) => x >= 2 && x <= 8 ? 0 : 255),
      ...options,
    });

    expect(hasVerticalLineCenter(startsAtWindowEdge)).toBe(false);
    expect(hasVerticalLineCenter(endsAtWindowEdge)).toBe(false);
    expect(hasVerticalLineCenter(tooWide)).toBe(false);
  });

  it("requires strong contrast on both sides before accepting a line centre", () => {
    const weakLeft = analyzeCalibrationFeatures({
      image: image(11, 11, (x) => x === 3 ? 136 : x >= 4 && x <= 6 ? 135 : 255),
      ...options,
    });
    const weakRight = analyzeCalibrationFeatures({
      image: image(11, 11, (x) => x === 7 ? 136 : x >= 4 && x <= 6 ? 135 : 255),
      ...options,
    });

    expect(hasVerticalLineCenter(weakLeft)).toBe(false);
    expect(hasVerticalLineCenter(weakRight)).toBe(false);
  });

  it("returns byte-for-byte deterministic feature order for identical input", () => {
    const raster = image(11, 11, (x, y) => (
      (x >= 4 && x <= 6) || (y >= 4 && y <= 6) ? 0 : 255
    ));
    const input = { image: raster, ...options };

    expect(analyzeCalibrationFeatures(input)).toEqual(analyzeCalibrationFeatures(input));
  });
});
