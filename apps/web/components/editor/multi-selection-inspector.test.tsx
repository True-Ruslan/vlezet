import { createPlacedObject, type VlezetDocument } from "@vlezet/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { addToSelection, replaceSelection } from "./editor-selection";
import { MultiSelectionInspector } from "./multi-selection-inspector";

const noop = () => {};

function documentWithSelectionTargets(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 5000, y: 0 } },
      { id: "c", position: { x: 5000, y: 4000 } },
    ],
    walls: [
      { id: "wall-1", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 },
      { id: "wall-2", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 150 },
    ],
    openings: [],
    roomAnnotations: [],
    placedObjects: [
      createPlacedObject({
        id: "chair-1",
        presetId: null,
        name: "Стул 1",
        category: "chair",
        position: { x: 1000, y: 1000 },
        width: 500,
        depth: 500,
        rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      }),
      createPlacedObject({
        id: "chair-2",
        presetId: null,
        name: "Стул 2",
        category: "chair",
        position: { x: 2200, y: 1200 },
        width: 500,
        depth: 500,
        rotationDeg: 30,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      }),
    ],
  };
}

describe("M8.1 multi-selection inspector", () => {
  it("summarises a furniture group and exposes only common safe registered commands", () => {
    const document = documentWithSelectionTargets();
    const selection = addToSelection(
      replaceSelection({ kind: "placed-object", id: "chair-1" }),
      [{ kind: "placed-object", id: "chair-2" }],
    );

    const html = renderToStaticMarkup(
      <MultiSelectionInspector
        document={document}
        selection={selection}
        hasPlacedObjectClipboard
        executeCommand={noop}
      />,
    );

    expect(html).toContain("Выбрано: 2");
    expect(html).toContain("Предметы: 2");
    for (const command of ["Копировать", "Вырезать", "Вставить", "Дублировать", "Удалить"]) {
      expect(html).toContain(command);
    }
    expect(html).not.toContain(">Повернуть на 90°<");
    expect(html).toContain("Групповой поворот мебели будет добавлен в отдельном этапе.");
    for (const fakeSharedField of ["Ширина", "Глубина", "Позиция X", "Позиция Y"]) {
      expect(html).not.toContain(fakeSharedField);
    }
  });

  it("reports deterministic mixed type counts and explains why unsafe batch mutation is unavailable", () => {
    const document = documentWithSelectionTargets();
    const selection = addToSelection(
      replaceSelection({ kind: "wall", id: "wall-1" }),
      [{ kind: "placed-object", id: "chair-1" }],
    );

    const html = renderToStaticMarkup(
      <MultiSelectionInspector
        document={document}
        selection={selection}
        hasPlacedObjectClipboard={false}
        executeCommand={noop}
      />,
    );

    expect(html).toContain("Выбрано: 2");
    expect(html).toContain("Стены: 1");
    expect(html).toContain("Предметы: 1");
    expect(html.indexOf("Стены: 1")).toBeLessThan(html.indexOf("Предметы: 1"));
    expect(html).toContain("Смешанный набор нельзя изменять одной командой");
    for (const unsafe of ["Копировать", "Вырезать", "Дублировать", "Удалить"]) {
      expect(html).not.toContain(`>${unsafe}<`);
    }
  });

  it("keeps structural batch actions fail-closed with the topology reason visible", () => {
    const document = documentWithSelectionTargets();
    const selection = addToSelection(
      replaceSelection({ kind: "wall", id: "wall-1" }),
      [{ kind: "wall", id: "wall-2" }],
    );

    const html = renderToStaticMarkup(
      <MultiSelectionInspector
        document={document}
        selection={selection}
        hasPlacedObjectClipboard={false}
        executeCommand={noop}
      />,
    );

    expect(html).toContain("Выбрано: 2");
    expect(html).toContain("Стены: 2");
    expect(html).toContain("Структурные объекты нельзя изменять пакетно без проверки топологии.");
    expect(html).not.toContain(">Удалить<");
  });
});
