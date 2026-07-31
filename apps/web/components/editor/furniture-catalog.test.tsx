import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FurnitureCatalog } from "./furniture-catalog";

describe("FurnitureCatalog design-system migration", () => {
  it("uses shared selectable card anatomy without changing preset semantics", () => {
    const html = renderToStaticMarkup(<FurnitureCatalog />);

    expect(html).toContain("Мебель и техника");
    expect(html).toContain('class="preset-card ui-card-host"');
    expect(html).toContain('class="ui-card ui-card-selectable furniture-preset-card"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("мм");
    expect(html).toContain('title="');
  });

  it("wires selected, repeated-click and cancel behaviour to the existing store", () => {
    const source = readFileSync(new URL("./furniture-catalog.tsx", import.meta.url), "utf8");

    expect(source).toContain("selected={active}");
    expect(source).toContain("aria-pressed={active}");
    expect(source).toContain("setPlacementPreset(active ? null : preset.id)");
    expect(source).toContain("setPlacementPreset(null)");
  });
});
