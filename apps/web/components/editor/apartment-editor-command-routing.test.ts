import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./apartment-editor.tsx", import.meta.url), "utf8");

describe("M8.1 ApartmentEditor semantic command routing", () => {
  it("routes semantic keyboard commands through one executor", () => {
    expect(source).toContain('from "./editor-commands"');
    expect(source).toContain("commandForKeyboardEvent");
    expect(source).toContain("type EditorCommandId");
    expect(source).toContain("const executeEditorCommand = useCallback((command: EditorCommandId)");
    expect(source).toContain("executeEditorCommand(command)");
    expect(source).not.toContain("switch (shortcut)");
  });

  it("keeps native text editing ahead of semantic shortcuts while preserving Escape priority", () => {
    expect(source).toContain("isNativeEditableTarget(event.target)");
    expect(source).not.toContain("function isEditableTarget");
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain("deriveEditorEscapeAction");
  });

  it("uses semantic store commands for the migrated selection operations", () => {
    expect(source).toContain("store.selectAllConcreteEntities()");
    expect(source).toContain("store.copySelection()");
    expect(source).toContain("store.cutSelection()");
    expect(source).toContain("store.pasteClipboard(");
    expect(source).toContain("store.duplicateSelection()");
    expect(source).not.toContain("store.duplicateSelectedObject()");
  });

  it("routes furniture deletion through atomic semantic multi-delete while preserving single-opening delete", () => {
    const deleteCase = source.slice(
      source.indexOf('case "selection.delete"'),
      source.indexOf('case "selection.clear"'),
    );

    expect(deleteCase).toContain("if (selectedFurnitureOnly)");
    expect(deleteCase).toContain("store.deleteSelection()");
    expect(deleteCase).toContain("selectedOpeningIdFromSelection(store.selection)");
    expect(deleteCase).toContain("store.deleteSelectedOpening()");
    expect(deleteCase).not.toContain("store.deleteSelectedObject()");
  });

  it("routes all 2D view commands through one runtime-only Canvas request", () => {
    expect(source).toContain("const [viewCommandRequest, setViewCommandRequest]");
    expect(source).toContain("const requestViewportCommand = useCallback((command: EditorViewportCommand)");
    expect(source).toContain('requestViewportCommand("zoom-in")');
    expect(source).toContain('requestViewportCommand("zoom-out")');
    expect(source).toContain('requestViewportCommand("actual-size")');
    expect(source).toContain('requestViewportCommand("fit-plan")');
    expect(source).toContain('requestViewportCommand("fit-selection")');
    expect(source).toContain("if (store.selection.refs.length === 0) return false");
    expect(source).toContain("viewCommandRequest={viewCommandRequest}");
  });
});
