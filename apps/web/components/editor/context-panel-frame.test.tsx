import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  ContextActionArea,
  ContextDangerZone,
  ContextPanelFrame,
  ContextSection,
} from "./context-panel-frame";
import type { ContextDescriptor } from "./context-panel-contract";

const selectionDescriptor: ContextDescriptor = {
  kind: "object",
  category: "selection",
  eyebrow: "Предмет",
  title: "Диван",
  subtitle: "Влезает",
};

const workflowDescriptor: ContextDescriptor = {
  kind: "planning",
  category: "workflow",
  eyebrow: "Варианты расстановки",
  title: "Гостиная",
  phase: "Найденные варианты",
  returnLabel: "К комнате «Гостиная»",
};

describe("ContextPanelFrame", () => {
  it("renders one labelled complementary region with one semantic title", () => {
    const markup = renderToStaticMarkup(
      <ContextPanelFrame descriptor={selectionDescriptor}>
        <ContextSection title="Параметры"><label>Название<input defaultValue="Диван" /></label></ContextSection>
      </ContextPanelFrame>,
    );

    expect(markup).toContain('role="complementary"');
    expect(markup).toContain('aria-label="Предмет: Диван"');
    expect(markup.match(/<h2/g)).toHaveLength(1);
    expect(markup).toContain('class="context-panel-eyebrow">Предмет');
    expect(markup).toContain('class="context-panel-title">Диван');
    expect(markup).toContain('class="context-panel-subtitle">Влезает');
  });

  it("renders exactly one workflow navigation action before identity", () => {
    const markup = renderToStaticMarkup(
      <ContextPanelFrame
        descriptor={workflowDescriptor}
        navigation={{ label: "К комнате «Гостиная»", onActivate: vi.fn() }}
      >
        <ContextSection title="Ограничения">Содержимое</ContextSection>
      </ContextPanelFrame>,
    );

    expect(markup.match(/context-panel-navigation/g)).toHaveLength(1);
    expect(markup).toContain('aria-label="К комнате «Гостиная»"');
    expect(markup.indexOf("context-panel-navigation")).toBeLessThan(markup.indexOf("context-panel-eyebrow"));
    expect(markup).not.toContain(">Закрыть<");
    expect(markup).not.toContain("×");
  });

  it("orders body, workflow actions and danger zone predictably", () => {
    const markup = renderToStaticMarkup(
      <ContextPanelFrame descriptor={selectionDescriptor}>
        <ContextSection title="Параметры">Поля</ContextSection>
        <ContextActionArea><button type="button">Применить</button></ContextActionArea>
        <ContextDangerZone description="Можно отменить через «Отменить»."><button type="button">Удалить предмет</button></ContextDangerZone>
      </ContextPanelFrame>,
    );

    const sectionIndex = markup.indexOf("context-panel-section");
    const actionIndex = markup.indexOf("context-panel-action-area");
    const dangerIndex = markup.indexOf("context-panel-danger-zone");
    expect(sectionIndex).toBeGreaterThan(-1);
    expect(actionIndex).toBeGreaterThan(sectionIndex);
    expect(dangerIndex).toBeGreaterThan(actionIndex);
    expect(markup).toContain("Можно отменить через «Отменить».");
    expect(markup).toContain('class="context-panel-danger-description"');
  });

  it("keeps semantic markup independent from docked or compact presentation", () => {
    const render = () => renderToStaticMarkup(
      <ContextPanelFrame descriptor={selectionDescriptor}>
        <ContextSection title="Параметры">Поля</ContextSection>
      </ContextPanelFrame>,
    );
    expect(render()).toBe(render());
    expect(render()).not.toContain("is-compact");
    expect(render()).not.toContain("is-docked");
  });
});
