import { createPlacedObject, type VlezetDocument } from "@vlezet/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { addToSelection, replaceSelection } from "./editor-selection";
import { MultiSelectionInspector } from "./multi-selection-inspector";

const noop = () => {};

function documentWithSelectionTargets(secondWallThickness = 150): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 5000, y: 0 } },
      { id: "c", position: { x: 5000, y: 4000 } },
    ],
    walls: [
      { id: "wall-1", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 },
      { id: "wall-2", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: secondWallThickness },
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

function wallSelection() {
  return addToSelection(
    replaceSelection({ kind: "wall", id: "wall-1" }),
    [{ kind: "wall", id: "wall-2" }],
  );
}

describe("M8 multi-selection inspector", () => {
  it("summarises a furniture group behind one compact safe-actions disclosure", () => {
    const document = documentWithSelectionTargets();
    const selection = addToSelection(
      replaceSelection({ kind: "placed-object", id: "chair-1" }),
      [{ kind: "placed-object", id: "chair-2" }],
    );

    const html = renderToStaticMarkup(
      <MultiSelectionInspector
        document={document}
        selection={selection}
        clipboardKind="placed-objects"
        executeCommand={noop}
        setSelectedWallsThickness={noop}
      />,
    );

    expect(html).toContain("Выбрано: 2");
    expect(html).toContain("Предметы: 2");
    expect(html).toContain('class="multi-selection-actions-menu"');
    expect(html).toContain("Действия");
    expect(html).toContain("···");
    for (const command of ["Копировать", "Вырезать", "Дублировать", "Удалить"]) {
      expect(html).toContain(command);
    }
    expect(html).not.toContain(">Вставить<");
    expect(html).not.toContain(">Повернуть на 90°<");
    expect(html).not.toContain("Групповой поворот мебели будет добавлен в отдельном этапе.");
    expect(html).not.toContain("Толщина стен, мм");
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
        clipboardKind={null}
        executeCommand={noop}
        setSelectedWallsThickness={noop}
      />,
    );

    expect(html).toContain("Выбрано: 2");
    expect(html).toContain("Стены: 1");
    expect(html).toContain("Предметы: 1");
    expect(html.indexOf("Стены: 1")).toBeLessThan(html.indexOf("Предметы: 1"));
    expect(html).toContain("Смешанный набор нельзя изменять одной командой");
    expect(html).not.toContain('class="multi-selection-actions-menu"');
    expect(html).not.toContain("Толщина стен, мм");
    for (const unsafe of ["Копировать", "Вырезать", "Вставить", "Дублировать", "Удалить"]) {
      expect(html).not.toContain(`>${unsafe}<`);
    }
  });

  it("exposes safe structural actions and a common atomic thickness for a closed wall selection", () => {
    const html = renderToStaticMarkup(
      <MultiSelectionInspector
        document={documentWithSelectionTargets()}
        selection={wallSelection()}
        clipboardKind={null}
        executeCommand={noop}
        setSelectedWallsThickness={noop}
      />,
    );

    expect(html).toContain("Выбрано: 2");
    expect(html).toContain("Стены: 2");
    expect(html).toContain('class="multi-selection-actions-menu"');
    for (const command of ["Копировать", "Вырезать", "Дублировать"]) expect(html).toContain(command);
    expect(html).not.toContain(">Удалить<");
    expect(html).toContain("Толщина стен, мм");
    expect(html).toContain('name="wall-thickness-mm"');
    expect(html).toContain('value="150"');
    expect(html).toContain('min="50"');
    expect(html).toContain('max="1000"');
    expect(html).toContain("Применить");
    expect(html).toContain("атомарно");
    expect(html).toContain("центральной линии");
    expect(html).not.toContain("Разные значения");
  });

  it("shows an explicit mixed-value state instead of averaging wall thicknesses", () => {
    const html = renderToStaticMarkup(
      <MultiSelectionInspector
        document={documentWithSelectionTargets(200)}
        selection={wallSelection()}
        clipboardKind="structural-fragment"
        executeCommand={noop}
        setSelectedWallsThickness={noop}
      />,
    );

    expect(html).toContain("Толщина стен, мм");
    expect(html).toContain('placeholder="Разные значения"');
    expect(html).not.toContain('value="175"');
    expect(html).toContain("Копировать");
    expect(html).toContain("Вырезать");
    expect(html).toContain("Дублировать");
    expect(html).not.toContain(">Удалить<");
  });
});
