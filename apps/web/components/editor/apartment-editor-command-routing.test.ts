import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./apartment-editor.tsx", import.meta.url), "utf8");

describe("M8 ApartmentEditor semantic command routing", () => {
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

  it("gates all selection mutations through the shared capability authority", () => {
    expect(source).toContain('from "./editor-selection-capabilities"');
    expect(source).toContain("const capabilities = deriveSelectionCapabilities({");
    expect(source).toContain("document: store.history.document");
    expect(source).toContain("selection: store.selection");
    expect(source).toContain("clipboardKind: store.clipboard.payload?.kind ?? null");

    const deleteCase = source.slice(
      source.indexOf('case "selection.delete"'),
      source.indexOf('case "selection.clear"'),
    );
    expect(deleteCase).toContain("if (editingBlocked || !capabilities.delete.enabled) return false");
    expect(deleteCase).toContain("store.deleteSelection()");
    expect(deleteCase).not.toContain("selectedFurnitureOnly");
    expect(deleteCase).not.toContain("selectedOpeningIdFromSelection(store.selection)");
    expect(deleteCase).not.toContain("store.deleteSelectedOpening()");
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

  it("derives multi-selection context from the unified selection and renders the shared inspector", () => {
    expect(source).toContain('from "./multi-selection-inspector"');
    expect(source).toContain("const selection = useStore(editorStore, (state) => state.selection)");
    expect(source).toContain("const clipboardKind = useStore(editorStore, (state) => state.clipboard.payload?.kind ?? null)");
    expect(source).toContain("selectionCount: selection.refs.length");
    expect(source).toContain('contextKind === "multi-selection"');
    expect(source).toContain("<MultiSelectionInspector");
    expect(source).toContain("selection={selection}");
    expect(source).toContain("clipboardKind={clipboardKind}");
    expect(source).toContain("setSelectedWallsThickness={(thickness) => editorStore.getState().setSelectedWallsThickness(thickness)}");
    expect(source).toContain("executeCommand={executeEditorCommand}");
  });

  it("owns context-menu lifetime with a render-derived owner key while Canvas emits only semantic target requests", () => {
    expect(source).toContain('from "./editor-context-menu"');
    expect(source).toContain("type OwnedEditorContextMenuRequest");
    expect(source).toContain("const [ownedContextMenuRequest, setOwnedContextMenuRequest]");
    expect(source).toContain("const contextMenuOwnerKey = [");
    expect(source).toContain("ownedContextMenuRequest?.ownerKey === contextMenuOwnerKey");
    expect(source).toContain("selectionForContextMenuTarget(store.selection, request.target)");
    expect(source).toContain("store.replaceSelection(request.target)");
    expect(source).toContain("setOwnedContextMenuRequest({ ownerKey: contextMenuOwnerKey, request })");
    expect(source).toContain("onContextMenuRequest={openContextMenu}");
    expect(source).toContain("<EditorContextMenu");
    expect(source).toContain("position={contextMenuRequest.position}");
    expect(source).toContain("clipboardKind={clipboardKind}");
    expect(source).toContain("executeCommand={executeEditorCommand}");
    expect(source).toContain("onDismiss={() => setOwnedContextMenuRequest(null)}");
    expect(source).not.toContain("setContextMenuRequest(null)");
  });
});
