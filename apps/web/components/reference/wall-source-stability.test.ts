import { describe, expect, it, vi } from "vitest";
import type { CalibrationCanvasLike } from "./calibration-image-features";
import { resolveCalibrationSnap } from "./calibration-snap";
import { readWallSourceFeatures } from "./wall-source-feature-reader";

type RasterSpan = readonly [number, number];

type RasterFixture = Readonly<{
  width: number;
  height: number;
  darkColumns?: readonly RasterSpan[];
  darkRows?: readonly RasterSpan[];
  grayColumns?: readonly RasterSpan[];
  grayRows?: readonly RasterSpan[];
}>;

function raster(input: RasterFixture): Uint8ClampedArray {
  const data = new Uint8ClampedArray(input.width * input.height * 4);
  for (let y = 0; y < input.height; y += 1) {
    for (let x = 0; x < input.width; x += 1) {
      const dark = (input.darkColumns ?? []).some(([start, end]) => x >= start && x <= end)
        || (input.darkRows ?? []).some(([start, end]) => y >= start && y <= end);
      const gray = !dark && ((input.grayColumns ?? []).some(([start, end]) => x >= start && x <= end)
        || (input.grayRows ?? []).some(([start, end]) => y >= start && y <= end));
      const value = dark ? 25 : gray ? 175 : 245;
      const offset = (y * input.width + x) * 4;
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

const image = { naturalWidth: 1200, naturalHeight: 900 } as HTMLImageElement;

function readAt(point: { x: number; y: number }, localRaster: RasterFixture) {
  return readWallSourceFeatures({
    image,
    point,
    viewportScale: 1,
    createCanvas: () => canvasFixture(raster(localRaster)),
  });
}

function resolveAt(point: { x: number; y: number }, features: ReturnType<typeof readAt>, activeCandidateId: string | null = null) {
  return resolveCalibrationSnap({
    rawPoint: point,
    features,
    viewportScale: 1,
    acquisitionRadiusPx: 12,
    releaseRadiusPx: 18,
    distanceEquivalencePx: 1,
    minimumStrength: 0.35,
    activeCandidateId,
    snappingEnabled: true,
    suppressed: false,
  });
}

describe("M8.4 real tracing source-axis stability", () => {
  it("keeps a thick horizontal architectural wall on one centreline across noisy pointer positions", () => {
    const pointerOffsets = [-7, -5, -3, -1, 0, 2, 4, 6, 7];
    let activeCandidateId: string | null = null;

    for (const offset of pointerOffsets) {
      const point = { x: 500 + offset * 3, y: 400 + offset };
      const features = readAt(point, {
        width: 41,
        height: 41,
        darkRows: [[13 - offset, 27 - offset]],
        grayColumns: [[31, 31]],
      });
      const result = resolveAt(point, features, activeCandidateId);

      expect(result.snapped).toBe(true);
      expect(result.kind).toBe("line-center");
      expect(result.point.y).toBeCloseTo(400, 6);
      expect(result.candidateId).toBe("line-center:h:400.000");
      activeCandidateId = result.candidateId;
    }
  });

  it("keeps the active wall axis instead of hopping to a nearby parallel architectural line", () => {
    const firstPoint = { x: 500, y: 400 };
    const firstFeatures = readAt(firstPoint, {
      width: 41,
      height: 41,
      darkRows: [[16, 18], [24, 26]],
    });
    const first = resolveAt(firstPoint, firstFeatures);
    expect(first.snapped).toBe(true);
    expect(first.candidateId).toBe("line-center:h:400.000");

    const movedPoint = { x: 520, y: 407 };
    const movedFeatures = readAt(movedPoint, {
      width: 41,
      height: 41,
      darkRows: [[9, 11], [23, 25]],
    });
    const moved = resolveAt(movedPoint, movedFeatures, first.candidateId);

    expect(moved.snapped).toBe(true);
    expect(moved.candidateId).toBe("line-center:h:400.000");
    expect(moved.point.y).toBeCloseTo(400, 6);
  });

  it("resolves an architectural corner as one stable intersection before changing axis", () => {
    const cornerPoint = { x: 500, y: 400 };
    const features = readAt(cornerPoint, {
      width: 41,
      height: 41,
      darkRows: [[13, 27]],
      darkColumns: [[13, 27]],
    });
    const result = resolveAt(cornerPoint, features);

    expect(result.snapped).toBe(true);
    expect(result.kind).toBe("intersection");
    expect(result.point).toEqual(cornerPoint);
  });
});
