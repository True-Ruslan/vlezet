import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  EditorProjectBarView,
  EditorToolBarView,
  saveStatusCopy,
} from "./editor-toolbar";

const noop = () => {};

describe("M7.1 editor project bar", () => {
  it("uses explicit local-first save copy", () => {
    expect(saveStatusCopy({ kind: "idle" })).toBe("Локальный проект");
    expect(saveStatusCopy({ kind: "saving" })).toBe("Сохраняем локально…");
    expect(saveStatusCopy({ kind: "saved", savedAt: "2026-07-30T18:00:00.000Z" })).toBe("Сохранено локально");
    expect(saveStatusCopy({ kind: "failed", message: "IndexedDB error" })).toBe("Не сохранено — повторить");
  });

  it("keeps project identity, context, actions and history in one global layer", () => {
    const html = renderToStaticMarkup(
      <EditorProjectBarView
        projectName="Квартира"
        saveStatus={{ kind: "saved", savedAt: "2026-07-30T18:00:00.000Z" }}
        contextTriggerVisible
        contextOpen={false}
        contextLabel="Свойства · Комната"
        hasReferencePlan
        canUndo
        canRedo={false}
        wallCount={4}
        openingCount={2}
        objectCount={3}
        onBack={noop}
        onRenameProject={noop}
        onToggleContext={noop}
        onRetrySave={noop}
        onFit={noop}
        onExportJson={noop}
        onExportPng={noop}
        onExportPngWithReference={noop}
        onUndo={noop}
        onRedo={noop}
      />,
    );

    expect(html).toContain("editor-project-bar");
    expect(html).toContain("Квартира");
    expect(html).toContain("Сохранено локально");
    expect(html).toContain("Свойства · Комната");
    expect(html).toContain('aria-controls="editor-context-surface"');
    expect(html).toContain("Действия");
    expect(html).toContain("Показать весь план");
    expect(html).toContain("PNG с подложкой");
    expect(html).toContain("Vlezet JSON");
    expect(html).toContain("4 стен · 2 проёмов · 3 предметов");
    expect(html).toContain("Отменить");
    expect(html).toContain("Повторить");
  });

  it("renders failed save state as a retry action", () => {
    const html = renderToStaticMarkup(
      <EditorProjectBarView
        projectName="Квартира"
        saveStatus={{ kind: "failed", message: "IndexedDB error" }}
        contextTriggerVisible={false}
        contextOpen={false}
        contextLabel="Свойства"
        hasReferencePlan={false}
        canUndo={false}
        canRedo={false}
        wallCount={0}
        openingCount={0}
        objectCount={0}
        onBack={noop}
        onRenameProject={noop}
        onToggleContext={noop}
        onRetrySave={noop}
        onFit={noop}
        onExportJson={noop}
        onExportPng={noop}
        onExportPngWithReference={noop}
        onUndo={noop}
        onRedo={noop}
      />,
    );

    expect(html).toContain("Не сохранено — повторить");
    expect(html).toContain("IndexedDB error");
    expect(html).toContain("<button");
  });
});

describe("M7.1 editor tool bar", () => {
  it("preserves every editing, workflow and view action with accessible names", () => {
    const html = renderToStaticMarkup(
      <EditorToolBarView
        tool="wall"
        measurementActive={false}
        dimensionsVisible
        viewMode="2d"
        placementPresetId={null}
        furnitureCatalogOpen={false}
        referencePanelOpen={false}
        recognitionPanelOpen={false}
        hasReferencePlan
        editingDisabled={false}
        onChooseTool={noop}
        onActivateMeasurement={noop}
        onToggleDimensions={noop}
        onToggleFurniture={noop}
        onToggleReference={noop}
        onToggleRecognition={noop}
        onChooseViewMode={noop}
      />,
    );

    expect(html).toContain("editor-tool-bar");
    for (const label of [
      "Выбор",
      "Стена",
      "Дверь",
      "Окно",
      "Измерить",
      "Мебель",
      "Подложка",
      "Распознать",
      "Размеры",
      "2D",
      "3D",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain('aria-label="Инструменты редактирования"');
    expect(html).toContain('aria-label="Рабочие процессы"');
    expect(html).toContain('aria-label="Представление"');
    expect(html).not.toContain("M7.1");
    expect(html).not.toContain("M6.4");
  });
});
