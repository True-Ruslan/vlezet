import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UiField, UiFieldMessage } from "./ui-field";

describe("UiField", () => {
  it("connects label, description, unit and validation message to the control", () => {
    const html = renderToStaticMarkup(
      <UiField
        id="width"
        label="Ширина"
        description="Чистый внутренний размер"
        unit="мм"
        invalid
        message={<UiFieldMessage tone="error">Введите число</UiFieldMessage>}
      >
        <input value="abc" readOnly />
      </UiField>,
    );

    expect(html).toContain('class="ui-field"');
    expect(html).toContain('for="width"');
    expect(html).toContain('id="width"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="width-description width-message"');
    expect(html).toContain('id="width-description"');
    expect(html).toContain('id="width-message"');
    expect(html).toContain("Чистый внутренний размер");
    expect(html).toContain("Введите число");
    expect(html).toContain("мм");
  });

  it("supports helper messages without marking the field invalid", () => {
    const html = renderToStaticMarkup(
      <UiField
        id="name"
        label="Название"
        message={<UiFieldMessage>До 80 символов</UiFieldMessage>}
      >
        <input value="Комната" readOnly />
      </UiField>,
    );

    expect(html).not.toContain("aria-invalid");
    expect(html).toContain('aria-describedby="name-message"');
    expect(html).toContain('data-tone="helper"');
  });

  it("remains independent from stores and domain authorities", () => {
    const source = readFileSync(new URL("./ui-field.tsx", import.meta.url), "utf8");
    for (const forbidden of ["zustand", "editorStore", "@vlezet/geometry", "@vlezet/projects", "indexedDB"]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
