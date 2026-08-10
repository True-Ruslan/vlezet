import { createPlacedObject, type VlezetDocument } from "@vlezet/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EMPTY_EDITOR_SELECTION, addToSelection, replaceSelection } from "./editor-selection";
import {
  EditorContextMenu,
  availableContextMenuCommands,
  clampContextMenuPosition,
  runContextMenuCommand,
  selectionForContextMenuTarget,
  shouldDismissContextMenuOnKey,
} from "./editor-context-menu";

function documentFixture(): VlezetDocument {
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

describe("M8 registered-command context menu", () => {
  it("preserves a selected group, replaces an unselected target, and clears on empty canvas", () => {
    const group = addToSelection(
      replaceSelection({ kind: "placed-object", id: "chair-1" }),
      [{ kind: "placed-object", id: "chair-2" }],
    );

    expect(selectionForContextMenuTarget(group, { kind: "placed-object", id: "chair-2" })).toEqual(group);
    expect(selectionForContextMenuTarget(group, { kind: "wall", id: "wall-1" })).toEqual(
      replaceSelection({ kind: "wall", id: "wall-1" }),
    );
    expect(selectionForContextMenuTarget(group, null)).toEqual(EMPTY_EDITOR_SELECTION);
  });

  it("clamps menu bounds to a viewport margin without moving safe anchors", () => {
    expect(clampContextMenuPosition(
      { x: 120, y: 80 },
      { width: 190, height: 48 },
      { width: 390, height: 760 },
    )).toEqual({ x: 120, y: 80 });

    expect(clampContextMenuPosition(
      { x: 330, y: 730 },
      { width: 190, height: 80 },
      { width: 390, height: 760 },
    )).toEqual({ x: 192, y: 672 });

    expect(clampContextMenuPosition(
      { x: -30, y: -20 },
      { width: 500, height: 900 },
      { width: 390, height: 760 },
    )).toEqual({ x: 8, y: 8 });
  });

  it("derives furniture, structural and empty-canvas command sets from the same capability authority", () => {
    const document = documentFixture();
    const furnitureGroup = addToSelection(
      replaceSelection({ kind: "placed-object", id: "chair-1" }),
      [{ kind: "placed-object", id: "chair-2" }],
    );

    expect(availableContextMenuCommands(document, furnitureGroup, "placed-objects").map((item) => item.id)).toEqual([
      "selection.copy",
      "selection.cut",
      "selection.duplicate",
      "view.fitSelection",
      "selection.delete",
    ]);

    const closedStructure = addToSelection(
      replaceSelection({ kind: "wall", id: "wall-1" }),
      [{ kind: "wall", id: "wall-2" }],
    );
    expect(availableContextMenuCommands(document, closedStructure, "structural-fragment").map((item) => item.id)).toEqual([
      "selection.copy",
      "selection.cut",
      "selection.duplicate",
      "view.fitSelection",
    ]);

    expect(availableContextMenuCommands(document, replaceSelection({ kind: "wall", id: "wall-1" }), null).map((item) => item.id)).toEqual([
      "selection.copy",
      "selection.duplicate",
      "view.fitSelection",
    ]);

    for (const clipboardKind of ["placed-objects", "structural-fragment"] as const) {
      expect(availableContextMenuCommands(document, EMPTY_EDITOR_SELECTION, clipboardKind).map((item) => item.id)).toEqual([
        "selection.paste",
        "selection.selectAll",
        "view.fitPlan",
      ]);
    }
    expect(availableContextMenuCommands(document, EMPTY_EDITOR_SELECTION, null).map((item) => item.id)).toEqual([
      "selection.selectAll",
      "view.fitPlan",
    ]);

    const mixed = addToSelection(
      replaceSelection({ kind: "wall", id: "wall-1" }),
      [{ kind: "placed-object", id: "chair-1" }],
    );
    expect(availableContextMenuCommands(document, mixed, "structural-fragment").map((item) => item.id)).toEqual([
      "view.fitSelection",
    ]);
  });

  it("renders selection actions, separators and macOS-aware shortcut hints in approved order", () => {
    const document = documentFixture();
    const html = renderToStaticMarkup(
      <EditorContextMenu
        position={{ x: 120, y: 80 }}
        document={document}
        selection={replaceSelection({ kind: "placed-object", id: "chair-1" })}
        clipboardKind="placed-objects"
        shortcutPlatform="mac"
        executeCommand={() => true}
        onDismiss={() => {}}
      />,
    );

    for (const label of ["Копировать", "Вырезать", "Дублировать", "Показать выделение", "Удалить"]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain(">Вставить<");
    expect(html).not.toContain("Повернуть на 90°");
    expect(html.indexOf("Копировать")).toBeLessThan(html.indexOf("Показать выделение"));
    expect(html.indexOf("Показать выделение")).toBeLessThan(html.indexOf("Удалить"));
    expect((html.match(/editor-context-menu-separator/g) ?? []).length).toBe(2);
    for (const hint of ["⌘C", "⌘X", "⌘D", "⌫"]) expect(html).toContain(hint);
    expect(html).toContain('role="menu"');
  });

  it("renders empty-canvas actions with non-Mac shortcut hints for either clipboard kind", () => {
    const document = documentFixture();
    for (const clipboardKind of ["placed-objects", "structural-fragment"] as const) {
      const html = renderToStaticMarkup(
        <EditorContextMenu
          position={{ x: 120, y: 80 }}
          document={document}
          selection={EMPTY_EDITOR_SELECTION}
          clipboardKind={clipboardKind}
          shortcutPlatform="other"
          executeCommand={() => true}
          onDismiss={() => {}}
        />,
      );

      for (const label of ["Вставить", "Выбрать всё", "Показать весь план"]) expect(html).toContain(label);
      expect(html).not.toContain("Копировать");
      expect(html).toContain("Ctrl+V");
      expect(html).toContain("Ctrl+A");
      expect((html.match(/editor-context-menu-separator/g) ?? []).length).toBe(1);
    }
  });

  it("executes through the central command callback and dismisses only after execution", () => {
    const events: string[] = [];
    const executeCommand = vi.fn((command) => { events.push(`execute:${command}`); return true; });
    const dismiss = vi.fn(() => events.push("dismiss"));

    expect(runContextMenuCommand("selection.copy", executeCommand, dismiss)).toBe(true);
    expect(events).toEqual(["execute:selection.copy", "dismiss"]);
    expect(executeCommand).toHaveBeenCalledWith("selection.copy");
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("uses Escape as an explicit dismissal key without treating arbitrary keys as dismissal", () => {
    expect(shouldDismissContextMenuOnKey("Escape")).toBe(true);
    expect(shouldDismissContextMenuOnKey("Enter")).toBe(false);
    expect(shouldDismissContextMenuOnKey("a")).toBe(false);
  });
});