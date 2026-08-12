import { describe, expect, it } from "vitest";
import { deriveRoomCanvasLabelLayout } from "./room-canvas-label-layout";

describe("deriveRoomCanvasLabelLayout", () => {
  it("keeps name, area and dimensions in an ordinary room", () => {
    expect(deriveRoomCanvasLabelLayout({ widthPx: 320, heightPx: 180 })).toMatchObject({
      hidden: false,
      nameLines: 2,
      showArea: true,
      showDimensions: true,
    });
  });

  it("drops dimensions before area as vertical space becomes constrained", () => {
    const layout = deriveRoomCanvasLabelLayout({ widthPx: 180, heightPx: 62 });
    expect(layout.hidden).toBe(false);
    expect(layout.showArea).toBe(true);
    expect(layout.showDimensions).toBe(false);
  });

  it("uses one name line before dropping area in a still smaller room", () => {
    const layout = deriveRoomCanvasLabelLayout({ widthPx: 145, heightPx: 43 });
    expect(layout.hidden).toBe(false);
    expect(layout.nameLines).toBe(1);
    expect(layout.showArea).toBe(true);
    expect(layout.showDimensions).toBe(false);
  });

  it("keeps only an ellipsizable name when area no longer fits", () => {
    const layout = deriveRoomCanvasLabelLayout({ widthPx: 110, heightPx: 26 });
    expect(layout.hidden).toBe(false);
    expect(layout.nameLines).toBe(1);
    expect(layout.showArea).toBe(false);
    expect(layout.showDimensions).toBe(false);
    expect(layout.textWidthPx).toBeLessThanOrEqual(96);
  });

  it("hides the interior label when even one safe line cannot fit", () => {
    expect(deriveRoomCanvasLabelLayout({ widthPx: 55, heightPx: 17 })).toMatchObject({ hidden: true });
  });

  it("returns fixed non-overlapping vertical slots for every visible tier", () => {
    for (const size of [
      { widthPx: 320, heightPx: 180 },
      { widthPx: 180, heightPx: 62 },
      { widthPx: 145, heightPx: 43 },
      { widthPx: 110, heightPx: 26 },
    ]) {
      const layout = deriveRoomCanvasLabelLayout(size);
      expect(layout.hidden).toBe(false);
      if (layout.hidden) continue;
      const slots = [layout.nameBox, layout.areaBox, layout.dimensionsBox].filter((slot) => slot !== null);
      for (let index = 1; index < slots.length; index += 1) {
        expect(slots[index]!.y).toBeGreaterThanOrEqual(slots[index - 1]!.y + slots[index - 1]!.height);
      }
      expect(layout.totalHeightPx).toBeLessThanOrEqual(size.heightPx - 8);
      expect(layout.textWidthPx).toBeLessThanOrEqual(size.widthPx - 8);
    }
  });
});
