import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { FurnitureCatalog } from "./furniture-catalog";
import { editorStore } from "./use-editor-store";

describe("FurnitureCatalog design-system migration", () => {
  beforeEach(() => editorStore.getState().setPlacementPreset(null));

  it("uses shared selectable card anatomy without changing preset semantics", () => {
    const html = renderToStaticMarkup(<FurnitureCatalog />);

    expect(html).toContain("Мебель и техника");
    expect(html).toContain('class="preset-card ui-card-host"');
    expect(html).toContain('class="ui-card ui-card-selectable furniture-preset-card"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("мм");
    expect(html).toContain('title="');
  });

  it("keeps active selection visible through aria-pressed and shared selected state", () => {
    editorStore.getState().setPlacementPreset("sofa-3");
    const html = renderToStaticMarkup(<FurnitureCatalog />);

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("is-selected");
    expect(html).toContain("Отмена");
  });
});
