import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UiButton } from "./ui-button";

describe("UiButton", () => {
  it("exposes busy state without losing visible action meaning", () => {
    const html = renderToStaticMarkup(
      <UiButton variant="primary" busy busyLabel="Сохраняем">
        Сохранить
      </UiButton>,
    );

    expect(html).toContain('class="ui-button ui-button-primary"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("disabled");
    expect(html).toContain("Сохраняем");
    expect(html).not.toContain(">Сохранить<");
  });

  it("preserves caller disabled state and native attributes", () => {
    const html = renderToStaticMarkup(
      <UiButton variant="secondary" disabled type="submit" aria-label="Подтвердить">
        Готово
      </UiButton>,
    );

    expect(html).toContain('type="submit"');
    expect(html).toContain('aria-label="Подтвердить"');
    expect(html).toContain("disabled");
  });

  it("remains independent from stores and domain authorities", () => {
    const source = readFileSync(new URL("./ui-button.tsx", import.meta.url), "utf8");
    for (const forbidden of ["zustand", "editorStore", "@vlezet/geometry", "@vlezet/projects", "indexedDB"]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
