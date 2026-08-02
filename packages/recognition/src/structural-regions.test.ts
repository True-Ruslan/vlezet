import { describe, expect, it } from "vitest";
import { extractStructuralWallRegions } from "./structural-regions";

function raster(width: number, height: number): Uint8Array {
  return new Uint8Array(width * height);
}

function fillRect(
  pixels: Uint8Array,
  width: number,
  x: number,
  y: number,
  rectangleWidth: number,
  rectangleHeight: number,
): void {
  for (let row = y; row < y + rectangleHeight; row += 1) {
    for (let column = x; column < x + rectangleWidth; column += 1) {
      pixels[row * width + column] = 255;
    }
  }
}

const options = {
  minimumLengthPx: 10,
  minimumThicknessPx: 4,
  maximumThicknessPx: 12,
  minimumRunOverlapRatio: 0.65,
  minimumRunLengthSimilarityRatio: 0.55,
  minimumAspectRatio: 2.5,
} as const;

describe("structural wall regions", () => {
  it("keeps a thick wall band and rejects a long thin annotation line", () => {
    const width = 48;
    const height = 28;
    const pixels = raster(width, height);
    fillRect(pixels, width, 3, 4, 39, 6);
    fillRect(pixels, width, 3, 18, 39, 1);

    const result = extractStructuralWallRegions({ widthPx: width, heightPx: height, pixels, options });

    expect(result.regions).toEqual([
      {
        orientation: "horizontal",
        startPx: { x: 3, y: 6.5 },
        endPx: { x: 41, y: 6.5 },
        thicknessPx: 6,
        evidenceLineCount: 6,
      },
    ]);
    expect(result.boundarySegments).toEqual([
      { x1: 3, y1: 4, x2: 41, y2: 4 },
      { x1: 3, y1: 9, x2: 41, y2: 9 },
    ]);
  });

  it("separates an orthogonal cross into one horizontal and one vertical wall region", () => {
    const width = 48;
    const height = 48;
    const pixels = raster(width, height);
    fillRect(pixels, width, 3, 20, 42, 6);
    fillRect(pixels, width, 20, 3, 6, 42);

    const result = extractStructuralWallRegions({ widthPx: width, heightPx: height, pixels, options });

    expect(result.regions.map((region) => region.orientation)).toEqual(["horizontal", "vertical"]);
    expect(result.regions[0]).toMatchObject({
      startPx: { x: 3, y: 22.5 },
      endPx: { x: 44, y: 22.5 },
      thicknessPx: 6,
    });
    expect(result.regions[1]).toMatchObject({
      startPx: { x: 22.5, y: 3 },
      endPx: { x: 22.5, y: 44 },
      thicknessPx: 6,
    });
  });

  it("does not attach a narrow perpendicular branch to a long wall band", () => {
    const width = 60;
    const height = 48;
    const pixels = raster(width, height);
    fillRect(pixels, width, 4, 5, 50, 7);
    fillRect(pixels, width, 4, 12, 7, 28);

    const result = extractStructuralWallRegions({ widthPx: width, heightPx: height, pixels, options });

    expect(result.regions).toHaveLength(2);
    expect(result.regions[0]).toMatchObject({
      orientation: "horizontal",
      startPx: { x: 4 },
      endPx: { x: 53 },
      thicknessPx: 7,
    });
    expect(result.regions[1]).toMatchObject({
      orientation: "vertical",
      startPx: { y: 5 },
      endPx: { y: 39 },
      thicknessPx: 7,
    });
  });

  it("returns deterministic regions and boundary segments", () => {
    const width = 40;
    const height = 32;
    const pixels = raster(width, height);
    fillRect(pixels, width, 2, 3, 30, 5);
    fillRect(pixels, width, 25, 4, 5, 24);

    const first = extractStructuralWallRegions({ widthPx: width, heightPx: height, pixels, options });
    const second = extractStructuralWallRegions({ widthPx: width, heightPx: height, pixels, options });

    expect(second).toEqual(first);
  });
});
