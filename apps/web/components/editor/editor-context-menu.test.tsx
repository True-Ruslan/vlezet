import { createPlacedObject, type VlezetDocument } from "@vlezet/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { addToSelection, replaceSelection } from "./editor-selection";
import {
  EditorContextMenu,
  availableContextMenuCommands,
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
    ],
    walls: [
      { id: "wall-1", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 },
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

describe("M8.1 registered-command context menu", () => {
  it("preserves the current group when right-clicking a selected member and replaces it otherwise", () => {
    const group = addToSelection(
      replaceSelection({ kind: "placed-object", id: "chair-1" }),
      [{ kind: "placed-object", id: "chair-2" }],
    );

    expect(selectionForContextMenuTarget(group, { kind: "placed-object", id: "chair-2" })).toEqual(group);
    expect(selectionForContextMenuTarget(group, { kind: "wall", id: "wall-1" })).toEqual(
      replaceSelection({ kind: "wall", id: "wall-1" }),
    );
  });

  it("derives menu availability from the shared capability matrix and command registry", () => {
    const document = documentFixture();
    const group = addToSelection(
      replaceSelection({ kind: "placed-object", id: "chair-1" }),
      [{ kind: "placed-object", id: "chair-2" }],
    );

    expect(availableContextMenuCommands(document, group, true).map((item) => item.id)).toEqual([
      "selection.copy",
      "selection.cut",
      "selection.paste",
      "selection.duplicate",
      "selection.delete",
    ]);

    expect(availableContextMenuCommands(
      document,
      replaceSelection({ kind: "placed-object", id: "chair-1" }),
      false,
    ).map((item) => item.id)).toEqual([
      "selection.copy",
      "selection.cut",
      "selection.duplicate",
      "object.rotate90",
      "selection.delete",
    ]);

    const mixed = addToSelection(
      replaceSelection({ kind: "wall", id: "wall-1" }),
      [{ kind: "placed-object", id: "chair-1" }],
    );
    expect(availableContextMenuCommands(document, mixed, true).map((item) => item.id)).toEqual([
      "selection.paste",
    ]);
  });

  it("renders only available registered commands in deterministic order", () => {
    const document = documentFixture();
    const html = renderToStaticMarkup(
      <EditorContextMenu
        position={{ x: 120, y: 80 }}
        document={document}
        selection={replaceSelection({ kind: "placed-object", id: "chair-1" })}
        hasPlacedObjectClipboard={false}
        executeCommand={() => true}
        onDismiss={() => {}}
      />,
    );

    for (const label of ["Копировать", "Вырезать", "Дублировать", "Повернуть на 90°", "Удалить"]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain(">Вставить<");
    expect(html.indexOf("Копировать")).toBeLessThan(html.indexOf("Удалить"));
    expect(html).toContain('role="menu"');
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
