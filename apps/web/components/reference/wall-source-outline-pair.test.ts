import { describe, expect, it, vi } from "vitest";
import type { CalibrationCanvasLike } from "./calibration-image-features";
import { resolveCalibrationSnap } from "./calibration-snap";
import { readWallSourceFeatures } from "./wall-source-feature-reader";

type RasterSpan = readonly [number, number];

function raster(
  width: number,
  height: number,
  darkColumns: readonly Readonly<RasterSpan>[],
  darkRows: readonly Readonly<RasterSpan>[] = [],
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const onVerticalFace = darkColumns.some(([start, end]) => x >= start && x <= end);
      const onHorizontalFace = darkRows.some(([start, end]) => y >= start && y <= end);
      const value = onVerticalFace || onHorizontalFace ? 25 : 245;
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

function readOutlineFixture(input: Readonly<{
  darkColumns?: readonly Readonly<RasterSpan>[];
  darkRows?: readonly Readonly<RasterSpan>[];
}>) {
  return readWallSourceFeatures({
    image: { naturalWidth: 1000, naturalHeight: 800 } as HTMLImageElement,
    point: { x: 500, y: 400 },
    viewportScale: 1,
    createCanvas: () => canvasFixture(raster(
      41,
      41,
      input.darkColumns ?? [],
      input.darkRows ?? [],
    )),
  });
}

function resolveAtRawPoint(features: ReturnType<typeof readOutlineFixture>) {
  const rawPoint = { x: 500, y: 400 };
  return resolveCalibrationSnap({
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
}

describe("M8.4 architectural double-outline wall acquisition", () => {
  it("collapses two close vertical faces around the pointer into one source centreline", () => {
    const rawPoint = { x: 500, y: 400 };
    const features = readOutlineFixture({ darkColumns: [[14, 15], [25, 26]] });
    const verticalCentres = features.filter((feature) =>
      feature.kind === "line-center" && feature.id.includes(":v:"));

    expect(verticalCentres).toEqual([
      expect.objectContaining({
        id: "line-center:v:500.000",
        kind: "line-center",
        point: rawPoint,
      }),
    ]);
    expect(features.filter((feature) => feature.kind === "edge" && feature.id.includes(":v:"))).toEqual([]);
    expect(resolveAtRawPoint(features)).toEqual(expect.objectContaining({
      snapped: true,
      kind: "line-center",
      point: rawPoint,
      reason: "snapped",
    }));
  });

  it("collapses two close horizontal faces with the same source-centre semantics", () => {
    const rawPoint = { x: 500, y: 400 };
    const features = readOutlineFixture({ darkRows: [[14, 15], [25, 26]] });
    const horizontalCentres = features.filter((feature) =>
      feature.kind === "line-center" && feature.id.includes(":h:"));

    expect(horizontalCentres).toEqual([
      expect.objectContaining({
        id: "line-center:h:400.000",
        kind: "line-center",
        point: rawPoint,
      }),
    ]);
    expect(features.filter((feature) => feature.kind === "edge" && feature.id.includes(":h:"))).toEqual([]);
    expect(resolveAtRawPoint(features)).toEqual(expect.objectContaining({
      snapped: true,
      kind: "line-center",
      point: rawPoint,
      reason: "snapped",
    }));
  });

  it("infers the centreline of a benchmark-scale filled wall band wider than the generic calibration line limit", () => {
    const rawPoint = { x: 500, y: 400 };
    const features = readOutlineFixture({ darkRows: [[13, 27]] });
    const horizontalCentres = features.filter((feature) =>
      feature.kind === "line-center" && feature.id.includes(":h:"));

    expect(horizontalCentres).toEqual([
      expect.objectContaining({
        id: "line-center:h:400.000",
        kind: "line-center",
        point: rawPoint,
      }),
    ]);
    expect(features.filter((feature) => feature.kind === "edge" && feature.id.includes(":h:"))).toEqual([]);
    expect(resolveAtRawPoint(features)).toEqual(expect.objectContaining({
      snapped: true,
      kind: "line-center",
      point: rawPoint,
      reason: "snapped",
    }));
  });

  it("preserves perpendicular and intersection evidence while collapsing a wall outline", () => {
    const features = readOutlineFixture({
      darkColumns: [[14, 15], [25, 26]],
      darkRows: [[19, 21]],
    });

    expect(features).toContainEqual(expect.objectContaining({
      id: "line-center:v:500.000",
      kind: "line-center",
    }));
    expect(features.some((feature) => feature.kind === "line-center" && feature.id.includes(":h:"))).toBe(true);
    expect(features.some((feature) => feature.kind === "intersection")).toBe(true);
  });

  it("does not invent a wall centre from unrelated parallel lines outside the wall-width envelope", () => {
    const features = readOutlineFixture({ darkColumns: [[7, 8], [32, 33]] });

    expect(features).not.toContainEqual(expect.objectContaining({ id: "line-center:v:500.000" }));
    expect(features.filter((feature) => feature.kind === "line-center" && feature.id.includes(":v:"))).toHaveLength(2);
  });
});