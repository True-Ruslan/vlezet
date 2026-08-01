import { describe, expect, it } from "vitest";
import { FURNITURE_PRESETS } from "./furniture-presets";
import {
  filterFurniturePresets,
  furnitureCategoryCount,
  furnitureSearchTokens,
  normalizeFurnitureSearch,
} from "./furniture-catalog-model";

describe("furniture catalogue presentation model", () => {
  it("normalises punctuation, case, whitespace and ё deterministically", () => {
    expect(normalizeFurnitureSearch("  ТВ / ТУМБА  ")).toBe("тв тумба");
    expect(normalizeFurnitureSearch("Ёлка—стол")).toBe("елка стол");
    expect(furnitureSearchTokens("  рабочий... стол ")).toEqual(["рабочий", "стол"]);
  });

  it("requires every query token without fuzzy matching", () => {
    expect(filterFurniturePresets(FURNITURE_PRESETS, { query: "раб стол", category: "all" }).map((item) => item.id))
      .toEqual(["desk"]);
    expect(filterFurniturePresets(FURNITURE_PRESETS, { query: "тв тумба", category: "all" }).map((item) => item.id))
      .toEqual(["tv-stand"]);
    expect(filterFurniturePresets(FURNITURE_PRESETS, { query: "диван стол", category: "all" })).toEqual([]);
  });

  it("combines query and category with logical AND and preserves preset order", () => {
    expect(filterFurniturePresets(FURNITURE_PRESETS, { query: "стол", category: "table" }).map((item) => item.id))
      .toEqual(["desk", "dining-table"]);
    expect(filterFurniturePresets(FURNITURE_PRESETS, { query: "стол", category: "storage" }).map((item) => item.id))
      .toEqual([]);
    expect(furnitureCategoryCount(FURNITURE_PRESETS, "стол", "table")).toBe(2);
    expect(furnitureCategoryCount(FURNITURE_PRESETS, "стол", "storage")).toBe(0);
  });

  it("keeps an empty query unfiltered", () => {
    expect(filterFurniturePresets(FURNITURE_PRESETS, { query: "", category: "all" }))
      .toEqual(FURNITURE_PRESETS);
  });
});
