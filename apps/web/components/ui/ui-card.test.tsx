import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UiCard } from "./ui-card";

describe("UiCard", () => {
  it("exposes visual variant and selected state without manufacturing interaction", () => {
    const html = renderToStaticMarkup(
      <UiCard variant="selectable" selected>
        <strong>Диван</strong>
        <span className="ui-card-supporting">2200 × 950 мм</span>
      </UiCard>,
    );

    expect(html).toContain('class="ui-card ui-card-selectable is-selected"');
    expect(html).toContain('data-variant="selectable"');
    expect(html).toContain('data-selected="true"');
    expect(html).not.toContain("onclick");
  });

  it("supports neutral, result and evidence variants", () => {
    for (const variant of ["neutral", "result", "evidence"] as const) {
      const html = renderToStaticMarkup(<UiCard variant={variant}>{variant}</UiCard>);
      expect(html).toContain(`data-variant="${variant}"`);
    }
  });

  it("remains independent from stores and domain authorities", () => {
    const source = readFileSync(new URL("./ui-card.tsx", import.meta.url), "utf8");
    for (const forbidden of ["zustand", "editorStore", "@vlezet/geometry", "@vlezet/projects", "indexedDB"]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
