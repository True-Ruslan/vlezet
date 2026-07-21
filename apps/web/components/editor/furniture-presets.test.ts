import { describe, expect, it } from "vitest";
import { FURNITURE_PRESETS } from "./furniture-presets";

describe("starter furniture catalogue", () => {
  it("contains the complete generic M2 planning set with unique ids", () => {
    expect(FURNITURE_PRESETS.map((preset) => preset.id)).toEqual([
      "single-bed",
      "double-bed",
      "sofa",
      "wardrobe",
      "dresser",
      "bedside-table",
      "desk",
      "dining-table",
      "chair",
      "kitchen-module",
      "fridge",
      "washing-machine",
      "tv-stand",
      "custom-object",
    ]);
    expect(new Set(FURNITURE_PRESETS.map((preset) => preset.id)).size).toBe(FURNITURE_PRESETS.length);
  });

  it("uses valid millimetre snapshots and non-negative clearances", () => {
    for (const preset of FURNITURE_PRESETS) {
      expect(preset.name.trim()).toBe(preset.name);
      expect(preset.width).toBeGreaterThanOrEqual(50);
      expect(preset.depth).toBeGreaterThanOrEqual(50);
      expect(Object.values(preset.clearance).every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
    }
  });

  it("freezes the most important consumer defaults", () => {
    expect(FURNITURE_PRESETS.find((preset) => preset.id === "double-bed")).toMatchObject({
      name: "Двуспальная кровать",
      width: 1600,
      depth: 2000,
      clearance: { front: 700, right: 600, back: 0, left: 600 },
    });
    expect(FURNITURE_PRESETS.find((preset) => preset.id === "wardrobe")).toMatchObject({
      width: 1600,
      depth: 600,
      clearance: { front: 800, right: 0, back: 0, left: 0 },
    });
  });
});
