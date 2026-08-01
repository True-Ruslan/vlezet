import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FurnitureCatalog } from "./furniture-catalog";

describe("FurnitureCatalog", () => {
  it("keeps shared selectable card anatomy and adds accessible discovery controls", () => {
    const html = renderToStaticMarkup(<FurnitureCatalog />);

    expect(html).toContain("Мебель и техника");
    expect(html).toContain('aria-label="Поиск мебели и техники"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Все");
    expect(html).toContain("Найдено:");
    expect(html).toContain('class="preset-card ui-card-host"');
    expect(html).toContain('class="ui-card ui-card-selectable furniture-preset-card"');
    expect(html).toContain("мм");
    expect(html).toContain('title="');
  });

  it("uses runtime-only filters and preserves existing placement commands", () => {
    const source = readFileSync(new URL("./furniture-catalog.tsx", import.meta.url), "utf8");

    expect(source).toContain("useStore(furnitureCatalogUiStore");
    expect(source).toContain("filterFurniturePresets");
    expect(source).toContain("resetFilters");
    expect(source).toContain("selected={active}");
    expect(source).toContain("aria-pressed={active}");
    expect(source).toContain("setPlacementPreset(active ? null : preset.id)");
    expect(source).toContain("setPlacementPreset(null)");
  });
});
